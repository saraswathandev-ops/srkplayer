/**
 * Lyrics Matching & Metadata Analysis Service
 * 
 * Performs intelligent metadata cleaning, title/artist extraction,
 * embedded ID3/MP4 tag inspection, confidence scoring, and auto-matching
 * with synchronized (.lrc) lyrics from embedded audio tags, bundled catalogue,
 * and open synced lyrics repositories (LRCLIB).
 */

import { VideoItem, TrackLyrics, LyricLine } from '../types';
import { AudioMetadataTags } from '../utils/audioMetadata';
import {
  getLyricsForMedia,
  saveCustomLyrics,
  parseLrc,
  INITIAL_LYRICS,
} from './transcriptService';

export interface CleanedMetadata {
  rawTitle: string;
  rawArtist: string;
  cleanedTitle: string;
  cleanedArtist: string;
  cleanedAlbum: string;
  featuredArtists: string[];
  duration: number;
  hasEmbeddedLyrics: boolean;
  embeddedLyrics?: string;
  searchQueries: string[];
}

export interface LyricsMatchResult {
  status: 'idle' | 'analyzing' | 'searching' | 'matched' | 'not_found' | 'error';
  lyrics: TrackLyrics | null;
  source?: 'embedded' | 'lrclib' | 'catalogue' | 'custom' | 'generated';
  confidence: number; // 0 - 100
  metadataAnalysis: CleanedMetadata;
  matchedTitle?: string;
  matchedArtist?: string;
  matchedDuration?: number;
  message?: string;
  alternativeMatches?: Array<{
    title: string;
    artist: string;
    duration?: number;
    syncedLyrics?: string;
    plainLyrics?: string;
    confidence: number;
  }>;
}

const MATCHED_CACHE_KEY = 'skr_lyrics_matched_cache_v1';

// In-memory cache for fast lookups
const matchCache = new Map<string, LyricsMatchResult>();

// Listeners for real-time status updates
type MatchListener = (result: LyricsMatchResult) => void;
const listeners = new Map<string, Set<MatchListener>>();

/**
 * Normalized string similarity using Levenshtein distance and token overlap
 */
export function calculateTextSimilarity(a: string, b: string): number {
  const normA = a.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const normB = b.toLowerCase().replace(/[^\w\s]/g, '').trim();

  if (normA === normB) return 1.0;
  if (!normA || !normB) return 0.0;

  // Check substring containment
  if (normA.includes(normB) || normB.includes(normA)) {
    const ratio = Math.min(normA.length, normB.length) / Math.max(normA.length, normB.length);
    return Math.max(0.7, ratio);
  }

  // Token Dice coefficient
  const tokensA = new Set(normA.split(/\s+/));
  const tokensB = new Set(normB.split(/\s+/));
  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }
  const dice = (2 * intersection) / (tokensA.size + tokensB.size);
  return Math.min(1.0, Math.max(0.0, dice));
}

/**
 * Analyze audio metadata and clean title/artist/tags
 */
export function analyzeAudioMetadata(
  media: VideoItem,
  tags?: AudioMetadataTags
): CleanedMetadata {
  const rawTitle = (tags?.title || media.title || '').trim();
  const rawArtist = (tags?.artist || media.artist || '').trim();
  const rawAlbum = (tags?.album || media.album || '').trim();

  let cleanedTitle = rawTitle;
  let cleanedArtist = rawArtist;
  const featuredArtists: string[] = [];

  // 1. Strip file extension if in title
  cleanedTitle = cleanedTitle.replace(/\.(mp3|wav|flac|m4a|aac|ogg|opus|wma|mp4)$/i, '');

  // 2. Strip track number prefixes like "01 - ", "01. ", "01 ", "1-01 "
  cleanedTitle = cleanedTitle.replace(/^[0-9]{1,3}[.\s\-_]+\s*/i, '');

  // 3. Extract "Artist - Title" if title contains hyphen and artist is missing
  if (!cleanedArtist || cleanedArtist.toLowerCase() === 'unknown artist' || cleanedArtist.toLowerCase() === 'music') {
    const splitMatch = cleanedTitle.match(/^([^-]+)\s*[-–—]\s*(.+)$/);
    if (splitMatch) {
      cleanedArtist = splitMatch[1].trim();
      cleanedTitle = splitMatch[2].trim();
    }
  }

  // 4. Extract and clean featured artists: (feat. XYZ) or [feat. XYZ]
  const featRegex = /[([][\s]*(?:feat\.?|ft\.?|featuring)\s+([^\])]+)[)\]]/gi;
  let featMatch;
  while ((featMatch = featRegex.exec(cleanedTitle)) !== null) {
    if (featMatch[1]) {
      featuredArtists.push(featMatch[1].trim());
    }
  }
  cleanedTitle = cleanedTitle.replace(featRegex, '').trim();

  // 5. Remove junk suffixes like [Official Video], (Remastered 2021), [Lyrics], etc.
  const noisePatterns = [
    /\[official\s*(music\s*)?video\]/gi,
    /\(official\s*(music\s*)?video\)/gi,
    /\[official\s*audio\]/gi,
    /\(official\s*audio\)/gi,
    /\[lyrics?\s*(video)?\]/gi,
    /\(lyrics?\s*(video)?\)/gi,
    /\[visualizer\]/gi,
    /\(visualizer\)/gi,
    /\[hd\]/gi,
    /\[4k\]/gi,
    /\[hq\]/gi,
    /\(live\)/gi,
    /\[live\]/gi,
    /\(remaster(ed)?\s*(\d{4})?\)/gi,
    /\[remaster(ed)?\s*(\d{4})?\]/gi,
    /\(audio\)/gi,
    /\[audio\]/gi,
    /\(extended\s*(mix)?\)/gi,
    /\(slowed\s*\+\s*reverb\)/gi,
  ];

  for (const pattern of noisePatterns) {
    cleanedTitle = cleanedTitle.replace(pattern, '').trim();
  }

  // 6. Clean artist name
  if (cleanedArtist) {
    cleanedArtist = cleanedArtist
      .replace(/\s*-\s*topic$/i, '')
      .replace(/\s*vevo$/i, '')
      .replace(/\s*official$/i, '')
      .trim();
  }

  // 7. Generate structured search queries
  const searchQueries: string[] = [];
  if (cleanedArtist && cleanedTitle) {
    searchQueries.push(`${cleanedArtist} ${cleanedTitle}`);
    searchQueries.push(`${cleanedTitle} ${cleanedArtist}`);
  }
  searchQueries.push(cleanedTitle);

  return {
    rawTitle,
    rawArtist,
    cleanedTitle,
    cleanedArtist,
    cleanedAlbum: rawAlbum,
    featuredArtists,
    duration: media.duration || 0,
    hasEmbeddedLyrics: Boolean(tags?.hasEmbeddedLyrics && tags?.embeddedLyrics),
    embeddedLyrics: tags?.embeddedLyrics,
    searchQueries,
  };
}

/**
 * Automatically creates rhythmic synchronized lines from plain text lyrics
 * by estimating pacing, word density, and phrase cadence across the audio duration.
 */
export function synchronizePlainTextLyrics(
  plainText: string,
  totalDurationSeconds: number,
  title?: string,
  artist?: string
): TrackLyrics {
  const rawLines = plainText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('[') && !l.endsWith(']'));

  if (rawLines.length === 0) {
    return {
      mediaId: 'generated',
      title,
      artist,
      hasSync: false,
      lines: [],
    };
  }

  // Reserve intro and outro buffers
  const introSeconds = Math.min(8, Math.max(2, totalDurationSeconds * 0.05));
  const outroSeconds = Math.min(10, Math.max(3, totalDurationSeconds * 0.05));
  const activeSingingTime = Math.max(10, totalDurationSeconds - introSeconds - outroSeconds);

  // Weight lines by word length / character density
  const weights = rawLines.map((line) => Math.max(1, line.split(/\s+/).length));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  let accumulatedTime = introSeconds;
  const lines: LyricLine[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const text = rawLines[i];
    const durationShare = (weights[i] / totalWeight) * activeSingingTime;

    lines.push({
      id: `gen-${i + 1}`,
      time: Math.round(accumulatedTime * 10) / 10,
      textEnglish: text,
    });

    accumulatedTime += durationShare;
  }

  return {
    mediaId: 'generated',
    title,
    artist,
    hasSync: true,
    lines,
  };
}

/**
 * Service to auto-match synchronized lyrics using metadata analysis
 */
class LyricsMatchingService {
  /**
   * Subscribe to match status updates for a specific media item
   */
  public subscribe(mediaId: string, listener: MatchListener): () => void {
    if (!listeners.has(mediaId)) {
      listeners.set(mediaId, new Set());
    }
    listeners.get(mediaId)!.add(listener);

    // If already in cache, notify immediately
    const cached = matchCache.get(mediaId);
    if (cached) {
      listener(cached);
    }

    return () => {
      const set = listeners.get(mediaId);
      if (set) {
        set.delete(listener);
        if (set.size === 0) listeners.delete(mediaId);
      }
    };
  }

  private notify(mediaId: string, result: LyricsMatchResult) {
    matchCache.set(mediaId, result);
    const set = listeners.get(mediaId);
    if (set) {
      set.forEach((fn) => fn(result));
    }
  }

  /**
   * Main matching entry point
   */
  public async autoMatchLyrics(
    media: VideoItem,
    tags?: AudioMetadataTags,
    forceReanalyze = false
  ): Promise<LyricsMatchResult> {
    const mediaId = media.id;

    // Check memory cache unless force requested
    if (!forceReanalyze && matchCache.has(mediaId)) {
      const cached = matchCache.get(mediaId)!;
      if (cached.status === 'matched') return cached;
    }

    // 1. Analyze metadata
    const analysis = analyzeAudioMetadata(media, tags);

    this.notify(mediaId, {
      status: 'analyzing',
      lyrics: null,
      confidence: 0,
      metadataAnalysis: analysis,
      message: `Analyzing metadata for "${analysis.cleanedTitle}"...`,
    });

    // 2. Check Custom / Stored User Lyrics
    const custom = getLyricsForMedia(mediaId);
    if (custom && custom.lines.length > 0) {
      const result: LyricsMatchResult = {
        status: 'matched',
        lyrics: custom,
        source: 'custom',
        confidence: 100,
        metadataAnalysis: analysis,
        matchedTitle: custom.title || analysis.cleanedTitle,
        matchedArtist: custom.artist || analysis.cleanedArtist,
        message: 'Loaded user-customized synchronized lyrics',
      };
      this.notify(mediaId, result);
      return result;
    }

    // 3. Check Embedded Audio Tags (USLT, SYLT, ©lyr)
    if (analysis.hasEmbeddedLyrics && analysis.embeddedLyrics) {
      const embeddedRaw = analysis.embeddedLyrics;
      let lyrics: TrackLyrics;

      // Check if embedded lyrics contain LRC timestamps [00:12.34]
      if (/\[\d{1,2}:\d{2}(\.\d{1,3})?\]/.test(embeddedRaw)) {
        lyrics = parseLrc(embeddedRaw, mediaId, analysis.cleanedTitle, analysis.cleanedArtist);
      } else {
        // Plain embedded text -> auto-synchronize to track duration
        lyrics = synchronizePlainTextLyrics(
          embeddedRaw,
          media.duration || 180,
          analysis.cleanedTitle,
          analysis.cleanedArtist
        );
        lyrics.mediaId = mediaId;
      }

      saveCustomLyrics(lyrics);

      const result: LyricsMatchResult = {
        status: 'matched',
        lyrics,
        source: 'embedded',
        confidence: 99,
        metadataAnalysis: analysis,
        matchedTitle: analysis.cleanedTitle,
        matchedArtist: analysis.cleanedArtist,
        message: 'Auto-matched from embedded ID3/MP4 audio tags',
      };
      this.notify(mediaId, result);
      return result;
    }

    // 4. Check Bundled / Catalogue Lyrics with Fuzzy Metadata Matching
    const catalogueMatch = this.matchFromCatalogue(analysis, mediaId);
    if (catalogueMatch) {
      saveCustomLyrics(catalogueMatch.lyrics);
      const result: LyricsMatchResult = {
        status: 'matched',
        lyrics: catalogueMatch.lyrics,
        source: 'catalogue',
        confidence: catalogueMatch.confidence,
        metadataAnalysis: analysis,
        matchedTitle: catalogueMatch.lyrics.title,
        matchedArtist: catalogueMatch.lyrics.artist,
        message: `Auto-matched from built-in library (${catalogueMatch.confidence}% confidence)`,
      };
      this.notify(mediaId, result);
      return result;
    }

    // 5. Query Open LRCLIB Synced Lyrics API
    this.notify(mediaId, {
      status: 'searching',
      lyrics: null,
      confidence: 0,
      metadataAnalysis: analysis,
      message: `Searching synchronized lyrics repository for "${analysis.cleanedTitle}"...`,
    });

    try {
      const onlineMatch = await this.queryOnlineLrclib(analysis, mediaId);
      if (onlineMatch && onlineMatch.lyrics) {
        saveCustomLyrics(onlineMatch.lyrics);
        const result: LyricsMatchResult = {
          status: 'matched',
          lyrics: onlineMatch.lyrics,
          source: 'lrclib',
          confidence: onlineMatch.confidence,
          metadataAnalysis: analysis,
          matchedTitle: onlineMatch.title,
          matchedArtist: onlineMatch.artist,
          matchedDuration: onlineMatch.duration,
          alternativeMatches: onlineMatch.alternatives,
          message: `Auto-matched via LRCLIB synced repository (${onlineMatch.confidence}% confidence)`,
        };
        this.notify(mediaId, result);
        return result;
      }
    } catch (err) {
      console.warn('Online lyrics matching failed or network offline:', err);
    }

    // 6. Not Found
    const notFoundResult: LyricsMatchResult = {
      status: 'not_found',
      lyrics: null,
      confidence: 0,
      metadataAnalysis: analysis,
      message: `No matching synchronized lyrics found for "${analysis.cleanedTitle}". You can import or paste an .LRC file.`,
    };
    this.notify(mediaId, notFoundResult);
    return notFoundResult;
  }

  /**
   * Search through bundled INITIAL_LYRICS and known songs using metadata similarity
   */
  private matchFromCatalogue(
    analysis: CleanedMetadata,
    mediaId: string
  ): { lyrics: TrackLyrics; confidence: number } | null {
    let bestMatch: TrackLyrics | null = null;
    let highestScore = 0;

    for (const [key, item] of Object.entries(INITIAL_LYRICS)) {
      if (!item.lines || item.lines.length === 0) continue;

      // Direct media ID match
      if (key === mediaId) {
        return { lyrics: { ...item, mediaId }, confidence: 100 };
      }

      const itemTitle = item.title || '';
      const itemArtist = item.artist || '';

      const titleSim = calculateTextSimilarity(analysis.cleanedTitle, itemTitle);
      const artistSim = analysis.cleanedArtist
        ? calculateTextSimilarity(analysis.cleanedArtist, itemArtist)
        : 0.5;

      const score = Math.round((titleSim * 0.7 + artistSim * 0.3) * 100);

      if (score > highestScore && score >= 65) {
        highestScore = score;
        bestMatch = {
          ...item,
          mediaId,
        };
      }
    }

    if (bestMatch && highestScore >= 65) {
      return { lyrics: bestMatch, confidence: highestScore };
    }

    return null;
  }

  /**
   * Query the free, open-source LRCLIB API (https://lrclib.net/)
   */
  private async queryOnlineLrclib(
    analysis: CleanedMetadata,
    mediaId: string
  ): Promise<{
    lyrics: TrackLyrics | null;
    confidence: number;
    title: string;
    artist: string;
    duration?: number;
    alternatives?: any[];
  } | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      // Step A: Try exact match via /api/get if artist and title are present
      if (analysis.cleanedArtist && analysis.cleanedTitle) {
        const getParams = new URLSearchParams({
          track_name: analysis.cleanedTitle,
          artist_name: analysis.cleanedArtist,
        });
        if (analysis.cleanedAlbum) getParams.set('album_name', analysis.cleanedAlbum);
        if (analysis.duration > 0) getParams.set('duration', Math.round(analysis.duration).toString());

        const getRes = await fetch(`https://lrclib.net/api/get?${getParams.toString()}`, {
          signal: controller.signal,
          headers: { 'User-Agent': 'SKRPlayer/1.0 (https://github.com/skrplayer)' },
        });

        if (getRes.ok) {
          const data = await getRes.json();
          if (data && (data.syncedLyrics || data.plainLyrics)) {
            clearTimeout(timeout);
            return this.formatLrclibData(data, mediaId, analysis, 96);
          }
        }
      }

      // Step B: Search via /api/search with cleaned queries
      const query = analysis.cleanedArtist
        ? `${analysis.cleanedArtist} ${analysis.cleanedTitle}`
        : analysis.cleanedTitle;

      const searchParams = new URLSearchParams({ q: query });
      const searchRes = await fetch(`https://lrclib.net/api/search?${searchParams.toString()}`, {
        signal: controller.signal,
        headers: { 'User-Agent': 'SKRPlayer/1.0 (https://github.com/skrplayer)' },
      });

      clearTimeout(timeout);

      if (searchRes.ok) {
        const candidates = await searchRes.json();
        if (Array.isArray(candidates) && candidates.length > 0) {
          // Rank candidates by title, artist, and duration similarity
          let bestCandidate = null;
          let bestScore = 0;
          const rankedAlternatives: any[] = [];

          for (const cand of candidates) {
            if (!cand.syncedLyrics && !cand.plainLyrics) continue;

            const tSim = calculateTextSimilarity(analysis.cleanedTitle, cand.trackName || '');
            const aSim = analysis.cleanedArtist
              ? calculateTextSimilarity(analysis.cleanedArtist, cand.artistName || '')
              : 0.6;

            // Duration delta penalty
            let durBonus = 0;
            if (analysis.duration > 0 && cand.duration > 0) {
              const diff = Math.abs(analysis.duration - cand.duration);
              if (diff <= 3) durBonus = 0.15;
              else if (diff <= 8) durBonus = 0.05;
              else if (diff > 30) durBonus = -0.2;
            }

            const isSyncedBonus = cand.syncedLyrics ? 0.1 : 0;
            const score = Math.min(100, Math.max(0, Math.round((tSim * 0.55 + aSim * 0.35 + durBonus + isSyncedBonus) * 100)));

            rankedAlternatives.push({
              title: cand.trackName,
              artist: cand.artistName,
              duration: cand.duration,
              syncedLyrics: cand.syncedLyrics,
              plainLyrics: cand.plainLyrics,
              confidence: score,
            });

            if (score > bestScore) {
              bestScore = score;
              bestCandidate = cand;
            }
          }

          if (bestCandidate && bestScore >= 55) {
            return this.formatLrclibData(bestCandidate, mediaId, analysis, bestScore, rankedAlternatives);
          }
        }
      }
    } catch (e: any) {
      clearTimeout(timeout);
      if (e.name !== 'AbortError') {
        console.warn('Lrclib request error:', e);
      }
    }

    return null;
  }

  private formatLrclibData(
    data: any,
    mediaId: string,
    analysis: CleanedMetadata,
    confidence: number,
    alternatives: any[] = []
  ) {
    let lyrics: TrackLyrics;
    if (data.syncedLyrics) {
      lyrics = parseLrc(data.syncedLyrics, mediaId, data.trackName, data.artistName);
    } else if (data.plainLyrics) {
      lyrics = synchronizePlainTextLyrics(
        data.plainLyrics,
        analysis.duration || data.duration || 180,
        data.trackName,
        data.artistName
      );
      lyrics.mediaId = mediaId;
    } else {
      return null;
    }

    return {
      lyrics,
      confidence,
      title: data.trackName || analysis.cleanedTitle,
      artist: data.artistName || analysis.cleanedArtist,
      duration: data.duration,
      alternatives,
    };
  }
}

export const lyricsMatchingService = new LyricsMatchingService();
