/**
 * Audio Metadata & Embedded ID3/MP4 Tag Parser
 * Extracts embedded album art, title, artist, album, and other tags from audio files
 * Supports ID3v2.2, ID3v2.3, ID3v2.4, ID3v1, and M4A/MP4 (iTunes) atoms.
 */

export interface AudioMetadataTags {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  genre?: string;
  trackNumber?: string;
  albumArt?: string; // Blob object URL or data URL
  albumArtFormat?: string; // e.g. 'image/jpeg', 'image/png'
  albumArtSize?: number; // in bytes
  hasEmbeddedArt: boolean;
  hasEmbeddedTags: boolean;
  embeddedLyrics?: string;
  hasEmbeddedLyrics?: boolean;
  tagType?: 'ID3v2.2' | 'ID3v2.3' | 'ID3v2.4' | 'ID3v1' | 'M4A/MP4' | 'Sample';
}

// In-memory cache to avoid re-parsing the same audio source repeatedly
const metadataCache = new Map<string, AudioMetadataTags>();
const LOCAL_METADATA_READ_SIZE = 8 * 1024 * 1024;

/**
 * Decode text from an ArrayBuffer/Uint8Array based on ID3 encoding byte:
 * 0: ISO-8859-1 (Latin-1)
 * 1: UTF-16 with BOM
 * 2: UTF-16BE without BOM
 * 3: UTF-8
 */

function base64ToBytes(value: string): Uint8Array {
  const normalized = value.replace(/\\s/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function readLocalFileSlice(
  source: string,
  position: number,
  length: number
): Promise<ArrayBuffer> {
  const RNFS = require("react-native-fs") as {
    read: (
      filepath: string,
      length?: number,
      position?: number,
      encoding?: string
    ) => Promise<string>;
  };
  const filePath = source.startsWith("file://") ? source.slice(7) : source;
  const base64 = await RNFS.read(filePath, length, position, "base64");
  const bytes = base64ToBytes(base64);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function bytesToDataUri(bytes: Uint8Array, mimeType: string): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
  }
  return "data:" + mimeType + ";base64," + btoa(binary);
}

function findFourCc(bytes: Uint8Array, value: string): number {
  if (value.length !== 4) return -1;
  const target = [value.charCodeAt(0), value.charCodeAt(1), value.charCodeAt(2), value.charCodeAt(3)];
  for (let index = 0; index <= bytes.length - 4; index++) {
    if (
      bytes[index] === target[0] &&
      bytes[index + 1] === target[1] &&
      bytes[index + 2] === target[2] &&
      bytes[index + 3] === target[3]
    ) {
      return index;
    }
  }
  return -1;
}

function decodeEncodedText(bytes: Uint8Array, encoding: number): string {
  if (bytes.length === 0) return '';
  try {
    if (encoding === 3) {
      // UTF-8
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(bytes).replace(/\0+$/, '').trim();
    } else if (encoding === 1) {
      // UTF-16 with BOM
      const decoder = new TextDecoder('utf-16');
      return decoder.decode(bytes).replace(/\0+$/, '').trim();
    } else if (encoding === 2) {
      // UTF-16BE
      const decoder = new TextDecoder('utf-16be');
      return decoder.decode(bytes).replace(/\0+$/, '').trim();
    } else {
      // 0: ISO-8859-1
      let str = '';
      for (let i = 0; i < bytes.length; i++) {
        if (bytes[i] === 0) break;
        str += String.fromCharCode(bytes[i]);
      }
      return str.trim();
    }
  } catch {
    // Fallback: simple character conversion
    let fallback = '';
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] >= 32 && bytes[i] <= 126) {
        fallback += String.fromCharCode(bytes[i]);
      }
    }
    return fallback.trim();
  }
}

/**
 * Parse ID3v2 tags (ID3v2.3 and ID3v2.4)
 */
function parseID3v2(view: DataView): Partial<AudioMetadataTags> | null {
  if (view.byteLength < 10) return null;

  // Check magic bytes: 'ID3'
  if (
    view.getUint8(0) !== 0x49 || // 'I'
    view.getUint8(1) !== 0x44 || // 'D'
    view.getUint8(2) !== 0x33 // '3'
  ) {
    return null;
  }

  const majorVersion = view.getUint8(3); // 2, 3, or 4
  const revision = view.getUint8(4);
  const flags = view.getUint8(5);

  // Tag size is stored as a 4-byte synchsafe integer (7 bits per byte)
  const tagSize =
    ((view.getUint8(6) & 0x7f) << 21) |
    ((view.getUint8(7) & 0x7f) << 14) |
    ((view.getUint8(8) & 0x7f) << 7) |
    (view.getUint8(9) & 0x7f);

  const endOffset = Math.min(view.byteLength, 10 + tagSize);
  let offset = 10;

  // Handle extended header flag
  if ((flags & 0x40) !== 0 && offset + 4 <= endOffset) {
    const extSize =
      majorVersion === 4
        ? ((view.getUint8(offset) & 0x7f) << 21) |
          ((view.getUint8(offset + 1) & 0x7f) << 14) |
          ((view.getUint8(offset + 2) & 0x7f) << 7) |
          (view.getUint8(offset + 3) & 0x7f)
        : view.getUint32(offset);
    offset += extSize;
  }

  const tags: Partial<AudioMetadataTags> = {
    tagType: majorVersion === 4 ? 'ID3v2.4' : majorVersion === 3 ? 'ID3v2.3' : 'ID3v2.2',
  };

  const idLength = majorVersion === 2 ? 3 : 4;

  while (offset + idLength + 4 <= endOffset) {
    let frameId = '';
    for (let i = 0; i < idLength; i++) {
      const charCode = view.getUint8(offset + i);
      if (charCode === 0) break;
      frameId += String.fromCharCode(charCode);
    }

    if (frameId.length < idLength || !/^[A-Z0-9]+$/.test(frameId)) {
      break;
    }

    let frameSize = 0;
    if (majorVersion === 2) {
      // 3 bytes size
      frameSize =
        (view.getUint8(offset + 3) << 16) |
        (view.getUint8(offset + 4) << 8) |
        view.getUint8(offset + 5);
      offset += 6;
    } else if (majorVersion === 3) {
      // 4 bytes standard integer
      frameSize = view.getUint32(offset + 4);
      offset += 10;
    } else {
      // ID3v2.4 synchsafe integer
      frameSize =
        ((view.getUint8(offset + 4) & 0x7f) << 21) |
        ((view.getUint8(offset + 5) & 0x7f) << 14) |
        ((view.getUint8(offset + 6) & 0x7f) << 7) |
        (view.getUint8(offset + 7) & 0x7f);
      offset += 10;
    }

    if (frameSize <= 0 || offset + frameSize > view.byteLength) {
      break;
    }

    const frameBytes = new Uint8Array(view.buffer, view.byteOffset + offset, frameSize);

    // Parse Text Frames
    if (frameId === 'TIT2' || frameId === 'TT2') {
      const encoding = frameBytes[0];
      tags.title = decodeEncodedText(frameBytes.slice(1), encoding);
    } else if (frameId === 'TPE1' || frameId === 'TP1') {
      const encoding = frameBytes[0];
      tags.artist = decodeEncodedText(frameBytes.slice(1), encoding);
    } else if (frameId === 'TALB' || frameId === 'TAL') {
      const encoding = frameBytes[0];
      tags.album = decodeEncodedText(frameBytes.slice(1), encoding);
    } else if (frameId === 'TYER' || frameId === 'TDRC' || frameId === 'TYE') {
      const encoding = frameBytes[0];
      tags.year = decodeEncodedText(frameBytes.slice(1), encoding);
    } else if (frameId === 'TCON' || frameId === 'TCO') {
      const encoding = frameBytes[0];
      tags.genre = decodeEncodedText(frameBytes.slice(1), encoding);
    } else if (frameId === 'TRCK' || frameId === 'TRK') {
      const encoding = frameBytes[0];
      tags.trackNumber = decodeEncodedText(frameBytes.slice(1), encoding);
    }
    // Parse Unsynchronized / Synchronized Lyrics (USLT, ULT, SYLT, SLT)
    else if (frameId === 'USLT' || frameId === 'ULT' || frameId === 'SYLT' || frameId === 'SLT') {
      try {
        const encoding = frameBytes[0];
        let pOffset = 4; // Skip encoding (1 byte) + language (3 bytes)
        // Skip description (null terminated according to encoding)
        if (encoding === 1 || encoding === 2) {
          while (pOffset + 1 < frameBytes.length) {
            if (frameBytes[pOffset] === 0 && frameBytes[pOffset + 1] === 0) {
              pOffset += 2;
              break;
            }
            pOffset += 2;
          }
        } else {
          while (pOffset < frameBytes.length && frameBytes[pOffset] !== 0) {
            pOffset++;
          }
          pOffset++;
        }
        if (pOffset < frameBytes.length) {
          const lyricsText = decodeEncodedText(frameBytes.slice(pOffset), encoding);
          if (lyricsText && lyricsText.trim().length > 0) {
            tags.embeddedLyrics = lyricsText.trim();
            tags.hasEmbeddedLyrics = true;
          }
        }
      } catch (e) {
        console.warn('Failed parsing lyrics frame:', e);
      }
    }
    // Parse Attached Picture (APIC or PIC)
    else if (frameId === 'APIC' || frameId === 'PIC') {
      try {
        const encoding = frameBytes[0];
        let pOffset = 1;

        let mimeType = 'image/jpeg';
        if (majorVersion === 2) {
          // 3-byte format like 'JPG' or 'PNG'
          const format = String.fromCharCode(
            frameBytes[pOffset],
            frameBytes[pOffset + 1],
            frameBytes[pOffset + 2]
          ).toLowerCase();
          mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
          pOffset += 3;
        } else {
          // Null-terminated MIME string
          let mimeStr = '';
          while (pOffset < frameBytes.length && frameBytes[pOffset] !== 0) {
            mimeStr += String.fromCharCode(frameBytes[pOffset]);
            pOffset++;
          }
          if (mimeStr) mimeType = mimeStr.toLowerCase();
          pOffset++; // Skip null terminator
        }

        // Picture type (e.g. 0x03 Front cover)
        if (pOffset < frameBytes.length) {
          pOffset++; // Skip picture type byte
        }

        // Description (null-terminated according to encoding)
        if (encoding === 1 || encoding === 2) {
          // UTF-16: 2 null bytes terminator
          while (pOffset + 1 < frameBytes.length) {
            if (frameBytes[pOffset] === 0 && frameBytes[pOffset + 1] === 0) {
              pOffset += 2;
              break;
            }
            pOffset += 2;
          }
        } else {
          // 1 null byte terminator
          while (pOffset < frameBytes.length && frameBytes[pOffset] !== 0) {
            pOffset++;
          }
          pOffset++; // skip null
        }

        if (pOffset < frameBytes.length) {
          const imgData = frameBytes.slice(pOffset);
          if (imgData.length > 32) {
            tags.albumArt = bytesToDataUri(imgData, mimeType);
            tags.albumArtFormat = mimeType;
            tags.albumArtSize = imgData.length;
            tags.hasEmbeddedArt = true;
          }
        }
      } catch (e) {
        console.warn('Failed parsing APIC frame:', e);
      }
    }

    offset += frameSize;
  }

  return tags;
}

/**
 * Parse ID3v1 tags (last 128 bytes of file)
 */
function parseID3v1(view: DataView): Partial<AudioMetadataTags> | null {
  if (view.byteLength < 128) return null;
  const offset = view.byteLength - 128;

  // Check 'TAG' marker
  if (
    view.getUint8(offset) !== 0x54 || // 'T'
    view.getUint8(offset + 1) !== 0x41 || // 'A'
    view.getUint8(offset + 2) !== 0x47 // 'G'
  ) {
    return null;
  }

  const decodeString = (start: number, len: number) => {
    let str = '';
    for (let i = 0; i < len; i++) {
      const code = view.getUint8(offset + start + i);
      if (code === 0) break;
      str += String.fromCharCode(code);
    }
    return str.trim();
  };

  const title = decodeString(3, 30);
  const artist = decodeString(33, 30);
  const album = decodeString(63, 30);
  const year = decodeString(93, 4);

  return {
    title: title || undefined,
    artist: artist || undefined,
    album: album || undefined,
    year: year || undefined,
    tagType: 'ID3v1',
  };
}

/**
 * Parse MP4 / M4A metadata atoms (iTunes metadata)
 */
function parseM4A(view: DataView): Partial<AudioMetadataTags> | null {
  // Look for 'moov' -> 'udta' -> 'meta' -> 'ilst'
  if (view.byteLength < 16) return null;

  const readString = (offset: number, len: number) => {
    let s = '';
    for (let i = 0; i < len; i++) {
      if (offset + i < view.byteLength) {
        s += String.fromCharCode(view.getUint8(offset + i));
      }
    }
    return s;
  };

  const tags: Partial<AudioMetadataTags> = { tagType: 'M4A/MP4' };

  // Search through atoms
  let offset = 0;
  while (offset + 8 <= view.byteLength) {
    const size = view.getUint32(offset);
    if (size < 8 || offset + size > view.byteLength) break;
    const type = readString(offset + 4, 4);

    if (type === 'moov' || type === 'udta' || type === 'meta' || type === 'ilst') {
      // Step into container atom
      // Note: 'meta' has a 4-byte version/flags after the type header
      offset += type === 'meta' ? 12 : 8;
      continue;
    }

    // Inside ilst: check iTunes metadata atoms
    if (
      type === '©nam' ||
      type === '©ART' ||
      type === '©alb' ||
      type === '©day' ||
      type === '©lyr' ||
      type === 'covr'
    ) {
      // Look for nested 'data' atom
      let innerOffset = offset + 8;
      while (innerOffset + 8 <= offset + size) {
        const innerSize = view.getUint32(innerOffset);
        if (innerSize < 8) break;
        const innerType = readString(innerOffset + 4, 4);

        if (innerType === 'data') {
          const typeFlags = view.getUint32(innerOffset + 8);
          // Data payload starts at innerOffset + 16
          const dataLength = innerSize - 16;
          if (dataLength > 0 && innerOffset + 16 + dataLength <= view.byteLength) {
            if (type === 'covr') {
              // typeFlags & 0xFF indicates format: 13 = JPEG, 14 = PNG
              const mime = (typeFlags & 0xff) === 14 ? 'image/png' : 'image/jpeg';
              const imgBytes = new Uint8Array(
                view.buffer,
                view.byteOffset + innerOffset + 16,
                dataLength
              );
              tags.albumArt = bytesToDataUri(imgBytes, mime);
              tags.albumArtFormat = mime;
              tags.albumArtSize = dataLength;
              tags.hasEmbeddedArt = true;
            } else {
              // Text data
              const textBytes = new Uint8Array(
                view.buffer,
                view.byteOffset + innerOffset + 16,
                dataLength
              );
              const text = decodeEncodedText(textBytes, 3);
              if (type === '©nam') tags.title = text;
              else if (type === '©ART') tags.artist = text;
              else if (type === '©alb') tags.album = text;
              else if (type === '©day') tags.year = text;
              else if (type === '©lyr') {
                tags.embeddedLyrics = text;
                tags.hasEmbeddedLyrics = true;
              }
            }
          }
          break;
        }
        innerOffset += innerSize;
      }
    }

    offset += size;
  }

  return tags.title || tags.artist || tags.album || tags.albumArt || tags.embeddedLyrics ? tags : null;
}

/**
 * Main parser entry point.
 * Parses tags from a File, Blob, or URL.
 */
export async function parseAudioMetadata(
  source: File | Blob | string,
  cacheKey?: string
): Promise<AudioMetadataTags> {
  const key =
    cacheKey ||
    (typeof source === 'string' ? source : 'name' in source ? (source as File).name : undefined);

  if (key && metadataCache.has(key)) {
    return metadataCache.get(key)!;
  }

  const defaultResult: AudioMetadataTags = {
    hasEmbeddedArt: false,
    hasEmbeddedTags: false,
  };

  try {
    let arrayBuffer: ArrayBuffer;
    let localTailParsed: Partial<AudioMetadataTags> | null = null;

    if (typeof source === 'string') {
      if (source.startsWith("file://") || source.startsWith("/")) {
        const info = await (async () => {
          const RNFS = require("react-native-fs") as {
            stat: (filepath: string) => Promise<{ size: number }>;
          };
          const filePath = source.startsWith("file://") ? source.slice(7) : source;
          return RNFS.stat(filePath);
        })();

        const firstLength = Math.min(Number(info.size) || LOCAL_METADATA_READ_SIZE, LOCAL_METADATA_READ_SIZE);
        arrayBuffer = await readLocalFileSlice(source, 0, firstLength);

        // MP4/M4A files may keep their moov/ilst atoms near the end. If the
        // initial slice does not contain useful tags, inspect a bounded tail.
        if (source.toLowerCase().match(/\\.(m4a|mp4|m4b|aac)$/) && Number(info.size) > firstLength) {
          const tailLength = Math.min(Number(info.size), LOCAL_METADATA_READ_SIZE);
          const tailPosition = Math.max(0, Number(info.size) - tailLength);
          const tailBuffer = await readLocalFileSlice(source, tailPosition, tailLength);
          const tailBytes = new Uint8Array(tailBuffer);
          const moovIndex = findFourCc(tailBytes, "moov");
          if (moovIndex > 0) {
            const candidate = tailBytes.slice(Math.max(0, moovIndex - 4)).buffer;
            const candidateView = new DataView(candidate);
            const tailParsed = parseM4A(candidateView);
            if (tailParsed) {
              // Store the bounded tail parse for the main flow below.
              localTailParsed = tailParsed;
            }
          }
        }
      } else {
        // For network URLs, read the first 512KB where ID3v2 header/artwork usually resides
        const response = await fetch(source, {
          headers: { Range: 'bytes=0-524288' },
        });
        if (!response.ok && response.status !== 206) {
          const fullResponse = await fetch(source);
          arrayBuffer = await fullResponse.arrayBuffer();
        } else {
          arrayBuffer = await response.arrayBuffer();
        }
      }
    } else {
      // Local File or Blob: read first 2MB to ensure large embedded album art is captured
      const slice = source.slice(0, Math.min(source.size, 2 * 1024 * 1024));
      arrayBuffer = await slice.arrayBuffer();
    }

    const view = new DataView(arrayBuffer);

    // 1. Try ID3v2 (most common for MP3s)
    let parsed = parseID3v2(view);

    // 2. If no ID3v2, check MP4/M4A
    if (!parsed) {
      parsed = parseM4A(view);
    }

    // MP4/M4A metadata can live in a moov atom near EOF.
    if (localTailParsed) {
      parsed = { ...parsed, ...localTailParsed };
    }

    // 3. If no title/artist and it's a full buffer, check ID3v1 at the end
    if (!parsed?.title && !parsed?.artist && source instanceof Blob && source.size > 128) {
      try {
        const tailSlice = source.slice(source.size - 128);
        const tailBuffer = await tailSlice.arrayBuffer();
        const tailView = new DataView(tailBuffer);
        const id3v1 = parseID3v1(tailView);
        if (id3v1) {
          parsed = { ...parsed, ...id3v1 };
        }
      } catch (e) {
        console.warn('Failed reading ID3v1 tail:', e);
      }
    }

    if (parsed) {
      const result: AudioMetadataTags = {
        title: parsed.title,
        artist: parsed.artist,
        album: parsed.album,
        year: parsed.year,
        genre: parsed.genre,
        trackNumber: parsed.trackNumber,
        albumArt: parsed.albumArt,
        albumArtFormat: parsed.albumArtFormat,
        albumArtSize: parsed.albumArtSize,
        hasEmbeddedArt: Boolean(parsed.albumArt),
        hasEmbeddedTags: Boolean(parsed.title || parsed.artist || parsed.album),
        tagType: parsed.tagType,
      };

      if (key) {
        metadataCache.set(key, result);
      }
      return result;
    }
  } catch (err) {
    console.warn('Audio metadata parsing could not read tags:', err);
  }

  return defaultResult;
}
