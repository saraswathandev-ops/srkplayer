import React from 'react';
import {
  X,
  Tag,
  Disc,
  User,
  Music,
  Calendar,
  Layers,
  FileAudio,
  Image as ImageIcon,
  CheckCircle2,
  HardDrive,
  Clock,
  Sparkles,
} from 'lucide-react';
import { VideoItem } from '../types';
import { AudioMetadataTags } from '../utils/audioMetadata';
import { formatFileSize, formatTime } from '../utils/formatters';
import { usePlayer } from '../context/PlayerContext';

interface AudioMetadataModalProps {
  isOpen: boolean;
  onClose: () => void;
  media: VideoItem;
  tags: AudioMetadataTags | null;
  duration: number;
}

export function AudioMetadataModal({
  isOpen,
  onClose,
  media,
  tags,
  duration,
}: AudioMetadataModalProps) {
  const { settings, themeColors } = usePlayer();

  if (!isOpen) return null;

  const isDark = settings.theme === 'dark';
  const displayTitle = tags?.title || media.title;
  const displayArtist = tags?.artist || media.artist || 'Unknown Artist';
  const displayAlbum = tags?.album || media.album || 'Unknown Album';
  const displayYear = tags?.year || media.year;
  const displayGenre = tags?.genre || media.genre;
  const displayTrack = tags?.trackNumber || media.trackNumber;
  const displayArtwork = tags?.albumArt || media.thumbnail;
  const hasEmbeddedArt = Boolean(tags?.hasEmbeddedArt || media.hasEmbeddedArt);

  return (
    <div
      id="audio-metadata-modal-overlay"
      className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        id="audio-metadata-modal-card"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-3xl border p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[90vh] select-none"
        style={{
          backgroundColor: isDark ? '#111420' : '#FFFFFF',
          borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-sm"
              style={{ backgroundColor: themeColors.primary }}
            >
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Track Metadata & Tags</h3>
              <p className="text-xs text-slate-400">
                Embedded audio tags and file attributes
              </p>
            </div>
          </div>

          <button
            id="audio-metadata-close-btn"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700/20 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Embedded Artwork Card */}
        {displayArtwork && (
          <div
            className="p-4 rounded-2xl border flex items-center gap-4"
            style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
            }}
          >
            <div className="relative w-16 h-16 rounded-xl overflow-hidden shadow-md shrink-0 border border-white/10">
              <img
                src={displayArtwork}
                alt={displayTitle}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                    hasEmbeddedArt
                      ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                      : 'text-slate-400 border-slate-700 bg-white/5'
                  }`}
                >
                  {hasEmbeddedArt ? (
                    <>
                      <Sparkles className="w-3 h-3 text-emerald-400" />
                      <span>Embedded Album Art</span>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-3 h-3" />
                      <span>Standard Artwork</span>
                    </>
                  )}
                </span>

                {tags?.tagType && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {tags.tagType}
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-400 mt-1.5 truncate">
                {tags?.albumArtFormat || 'image/jpeg'}
                {tags?.albumArtSize ? ` • ${formatFileSize(tags.albumArtSize)}` : ''}
              </p>
            </div>
          </div>
        )}

        {/* Tag Fields List */}
        <div className="space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Metadata Tags
          </span>

          <div
            className="rounded-2xl border divide-y overflow-hidden text-xs"
            style={{
              borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
              backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
            }}
          >
            {/* Title */}
            <div className="p-3 flex items-start justify-between gap-4">
              <div className="flex items-center gap-2 text-slate-400 font-medium shrink-0">
                <Music className="w-4 h-4" />
                <span>Title</span>
              </div>
              <div className="text-right">
                <p className="font-semibold text-slate-200">{displayTitle}</p>
                <span className="text-[10px] text-slate-500 font-mono">Tag: TIT2 / ©nam</span>
              </div>
            </div>

            {/* Artist */}
            <div className="p-3 flex items-start justify-between gap-4">
              <div className="flex items-center gap-2 text-slate-400 font-medium shrink-0">
                <User className="w-4 h-4" />
                <span>Artist</span>
              </div>
              <div className="text-right">
                <p className="font-semibold text-slate-200">{displayArtist}</p>
                <span className="text-[10px] text-slate-500 font-mono">Tag: TPE1 / ©ART</span>
              </div>
            </div>

            {/* Album */}
            <div className="p-3 flex items-start justify-between gap-4">
              <div className="flex items-center gap-2 text-slate-400 font-medium shrink-0">
                <Disc className="w-4 h-4" />
                <span>Album</span>
              </div>
              <div className="text-right">
                <p className="font-semibold text-slate-200">{displayAlbum}</p>
                <span className="text-[10px] text-slate-500 font-mono">Tag: TALB / ©alb</span>
              </div>
            </div>

            {/* Year */}
            {displayYear && (
              <div className="p-3 flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 text-slate-400 font-medium shrink-0">
                  <Calendar className="w-4 h-4" />
                  <span>Year</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-200">{displayYear}</p>
                  <span className="text-[10px] text-slate-500 font-mono">Tag: TYER / TDRC</span>
                </div>
              </div>
            )}

            {/* Genre */}
            {displayGenre && (
              <div className="p-3 flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 text-slate-400 font-medium shrink-0">
                  <Layers className="w-4 h-4" />
                  <span>Genre</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-200">{displayGenre}</p>
                  <span className="text-[10px] text-slate-500 font-mono">Tag: TCON</span>
                </div>
              </div>
            )}

            {/* Track Number */}
            {displayTrack && (
              <div className="p-3 flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 text-slate-400 font-medium shrink-0">
                  <FileAudio className="w-4 h-4" />
                  <span>Track Number</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-200">{displayTrack}</p>
                  <span className="text-[10px] text-slate-500 font-mono">Tag: TRCK</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Technical File Details */}
        <div className="space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Audio Specifications
          </span>

          <div
            className="rounded-2xl border p-3.5 space-y-2.5 text-xs"
            style={{
              borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
              backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Duration
              </span>
              <span className="font-mono font-semibold text-slate-200">
                {formatTime(duration || media.duration)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5" /> File Size
              </span>
              <span className="font-mono font-semibold text-slate-200">
                {formatFileSize(media.size)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <FileAudio className="w-3.5 h-3.5" /> Format / Bitrate
              </span>
              <span className="font-mono font-semibold text-slate-200">
                {media.mimeType || 'audio/mpeg'} • {media.bitrate || '320 kbps'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> Folder
              </span>
              <span className="font-semibold text-slate-200">{media.folder}</span>
            </div>
          </div>
        </div>

        {/* Done Button */}
        <button
          id="audio-metadata-done-btn"
          onClick={onClose}
          className="w-full py-2.5 rounded-2xl border text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          style={{ borderColor: isDark ? themeColors.borderDark : themeColors.borderLight }}
        >
          Close Inspector
        </button>
      </div>
    </div>
  );
}
