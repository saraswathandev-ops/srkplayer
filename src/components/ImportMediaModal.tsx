import React, { useState, useRef } from 'react';
import { X, Upload, Film, Music, Check, Folder, Tag, Image as ImageIcon } from 'lucide-react';
import { MediaType, VideoItem } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { formatFileSize } from '../utils/formatters';
import { parseAudioMetadata, AudioMetadataTags } from '../utils/audioMetadata';

interface ImportMediaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ImportMediaModal({ isOpen, onClose }: ImportMediaModalProps) {
  const { addCustomMedia, playMedia, settings, themeColors } = usePlayer();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [folder, setFolder] = useState('Downloads');
  const [mediaType, setMediaType] = useState<MediaType>('video');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedTags, setExtractedTags] = useState<AudioMetadataTags | null>(null);
  const [customThumbnail, setCustomThumbnail] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDark = settings.theme === 'dark';

  if (!isOpen) return null;

  const handleFileChange = async (file: File) => {
    setSelectedFile(file);
    const cleanName = file.name.replace(/\.[^/.]+$/, '');
    setTitle(cleanName);
    const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name);
    setMediaType(isAudio ? 'audio' : 'video');
    setFolder(isAudio ? 'Music' : 'Downloads');
    setArtist('');
    setAlbum('');
    setExtractedTags(null);
    setCustomThumbnail(null);

    // If audio, asynchronously parse embedded metadata tags & cover art
    if (isAudio) {
      try {
        const tags = await parseAudioMetadata(file);
        setExtractedTags(tags);
        if (tags.title) setTitle(tags.title);
        if (tags.artist) setArtist(tags.artist);
        if (tags.album) setAlbum(tags.album);
        if (tags.albumArt) setCustomThumbnail(tags.albumArt);
      } catch (err) {
        console.warn('Could not extract audio metadata tags:', err);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsProcessing(true);

    const objectUrl = URL.createObjectURL(selectedFile);
    const item: Omit<VideoItem, 'id' | 'playCount' | 'isFavorite' | 'dateAdded'> = {
      title: title.trim() || selectedFile.name,
      artist: artist.trim() || extractedTags?.artist || undefined,
      album: album.trim() || extractedTags?.album || undefined,
      year: extractedTags?.year || undefined,
      genre: extractedTags?.genre || undefined,
      trackNumber: extractedTags?.trackNumber || undefined,
      hasEmbeddedArt: Boolean(customThumbnail || extractedTags?.hasEmbeddedArt),
      uri: objectUrl,
      duration: 0,
      size: selectedFile.size,
      folder: folder.trim() || (mediaType === 'audio' ? 'Music' : 'Downloads'),
      mediaType,
      mimeType: selectedFile.type,
      thumbnail: customThumbnail || (mediaType === 'video'
        ? 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80'
        : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80'),
    };

    const saved = addCustomMedia(item);
    playMedia(saved, [saved], mediaType === 'video');
    setIsProcessing(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden flex flex-col"
        style={{
          backgroundColor: isDark ? '#151824' : '#FFFFFF',
          borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
        }}
      >
        {/* Header */}
        <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: isDark ? themeColors.borderDark : themeColors.borderLight }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: themeColors.primary }}>
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Import Local Media</h3>
              <p className="text-xs text-slate-400">Add videos or audio files from your device</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all hover:border-slate-400"
            style={{
              borderColor: isDragging ? themeColors.primary : isDark ? themeColors.borderDark : themeColors.borderLight,
              backgroundColor: isDragging ? 'rgba(110, 96, 255, 0.08)' : isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,audio/*,.mp4,.mkv,.webm,.mov,.avi,.mp3,.wav,.ogg,.m4a"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileChange(e.target.files[0]);
                }
              }}
            />

            {selectedFile ? (
              <div className="space-y-1">
                <div className="w-10 h-10 rounded-full mx-auto flex items-center justify-center text-white mb-2" style={{ backgroundColor: themeColors.primary }}>
                  {mediaType === 'video' ? <Film className="w-5 h-5" /> : <Music className="w-5 h-5" />}
                </div>
                <p className="font-bold text-sm truncate max-w-xs mx-auto">{selectedFile.name}</p>
                <p className="text-xs text-slate-400">{formatFileSize(selectedFile.size)} • Click to change file</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Upload className="w-8 h-8 mx-auto text-slate-400" />
                <p className="text-sm font-semibold">Drag & drop video or audio file here</p>
                <p className="text-xs text-slate-400">or click to browse from device</p>
                <p className="text-[10px] text-slate-500 mt-2">Supports MP4, WebM, MKV, MP3, WAV, OGG, M4A</p>
              </div>
            )}
          </div>

          {selectedFile && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none"
                  style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                    borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Folder</label>
                  <input
                    type="text"
                    value={folder}
                    onChange={(e) => setFolder(e.target.value)}
                    placeholder="Movies, Downloads, Music..."
                    className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none"
                    style={{
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                      borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
                    }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Media Type</label>
                  <select
                    value={mediaType}
                    onChange={(e) => setMediaType(e.target.value as MediaType)}
                    className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none cursor-pointer"
                    style={{
                      backgroundColor: isDark ? '#1D2133' : '#F1F5F9',
                      borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
                    }}
                  >
                    <option value="video">Video</option>
                    <option value="audio">Audio</option>
                  </select>
                </div>
              </div>

              {/* Audio metadata tags (Artist, Album) */}
              {mediaType === 'audio' && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Artist Tag
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Artist name"
                      value={artist}
                      onChange={(e) => setArtist(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none"
                      style={{
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                        borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Album Tag
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Album name"
                      value={album}
                      onChange={(e) => setAlbum(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none"
                      style={{
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                        borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Embedded Album Art Preview */}
              {customThumbnail && (
                <div
                  className="p-3 rounded-2xl border flex items-center gap-3"
                  style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    borderColor: themeColors.primary,
                  }}
                >
                  <img
                    src={customThumbnail}
                    alt="Embedded Album Art"
                    className="w-12 h-12 rounded-xl object-cover shadow-sm border border-white/10 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Embedded Album Art Detected</span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {extractedTags?.albumArtFormat || 'image/jpeg'} • Ready to display in player
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-slate-700/20"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedFile || isProcessing}
              className="px-5 py-2 rounded-xl text-xs font-semibold text-white shadow-md disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              style={{ backgroundColor: themeColors.primary }}
            >
              <Check className="w-4 h-4" />
              <span>Import & Play</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
