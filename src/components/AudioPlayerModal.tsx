import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Shuffle,
  Repeat,
  Repeat1,
  Heart,
  ListMusic,
  Clock,
  Music,
  Volume2,
  VolumeX,
  Tag,
  Disc,
  User,
  Sparkles,
  ZoomIn,
  Image as ImageIcon,
  Layers,
  ChevronUp,
  ChevronDown,
  Trash2,
  ListPlus,
  Gauge,
  Check,
  Mic,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { formatTime } from '../utils/formatters';
import { parseAudioMetadata, AudioMetadataTags } from '../utils/audioMetadata';
import { SleepTimerModal } from './SleepTimerModal';
import { AudioMetadataModal } from './AudioMetadataModal';
import { VOLUME_NORMALIZATION_MODES } from '../constants/theme';
import { VolumeNormalizationMode } from '../types';
import { AudioLyricsView } from './AudioLyricsView';

export function AudioPlayerModal() {
  const {
    activeMedia,
    isAudioModalOpen,
    closeAudioModal,
    isPlaying,
    togglePlay,
    currentTime,
    duration,
    seek,
    volume,
    setVolume,
    isMuted,
    toggleMute,
    loopMode,
    setLoopMode,
    nextTrack,
    previousTrack,
    queue,
    queueIndex,
    playMedia,
    toggleFavorite,
    settings,
    themeColors,
    sleepTimerRemaining,
    sleepTimerEndTrack,
    updateMediaMetadata,
    removeFromQueue,
    moveQueueItem,
    clearUpcomingQueue,
    toggleVolumeNormalization,
    setVolumeNormalizationMode,
    updateSettings,
    showToast,
  } = usePlayer();

  const [showQueue, setShowQueue] = useState(false);
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [showNormMenu, setShowNormMenu] = useState(false);
  const [artViewMode, setArtViewMode] = useState<'cover' | 'vinyl' | 'lyrics'>('cover');
  const [isZoomArtOpen, setIsZoomArtOpen] = useState(false);
  const [embeddedTags, setEmbeddedTags] = useState<AudioMetadataTags | null>(null);

  const isDark = settings.theme === 'dark';
  const norm = settings.volumeNormalization;

  // Extract embedded tags and artwork whenever activeMedia changes
  useEffect(() => {
    let isCancelled = false;
    if (!activeMedia || activeMedia.mediaType !== 'audio') {
      setEmbeddedTags(null);
      return;
    }

    parseAudioMetadata(activeMedia.uri, activeMedia.id)
      .then((tags) => {
        if (!isCancelled) {
          setEmbeddedTags(tags);
          // If media item is missing artist/album/thumbnail and embedded tags provide them, update media item
          if (
            (!activeMedia.artist && tags.artist) ||
            (!activeMedia.album && tags.album) ||
            (!activeMedia.thumbnail && tags.albumArt)
          ) {
            updateMediaMetadata(activeMedia.id, {
              artist: activeMedia.artist || tags.artist,
              album: activeMedia.album || tags.album,
              thumbnail: activeMedia.thumbnail || tags.albumArt,
              year: activeMedia.year || tags.year,
              genre: activeMedia.genre || tags.genre,
              trackNumber: activeMedia.trackNumber || tags.trackNumber,
              hasEmbeddedArt: Boolean(tags.albumArt || activeMedia.hasEmbeddedArt),
            });
          }
        }
      })
      .catch((err) => {
        console.warn('Could not read embedded audio tags:', err);
      });

    return () => {
      isCancelled = true;
    };
  }, [activeMedia?.id, activeMedia?.uri]);

  if (!isAudioModalOpen || !activeMedia || activeMedia.mediaType !== 'audio') return null;

  const cycleLoopMode = () => {
    if (loopMode === 'none') setLoopMode('all');
    else if (loopMode === 'all') setLoopMode('one');
    else setLoopMode('none');
  };

  // Resolved metadata with priority given to extracted embedded tags
  const displayTitle = embeddedTags?.title || activeMedia.title;
  const displayArtist = embeddedTags?.artist || activeMedia.artist || 'Unknown Artist';
  const displayAlbum = embeddedTags?.album || activeMedia.album;
  const displayArtwork = embeddedTags?.albumArt || activeMedia.thumbnail;
  const hasEmbeddedArt = Boolean(embeddedTags?.hasEmbeddedArt || activeMedia.hasEmbeddedArt);
  const displayYear = embeddedTags?.year || activeMedia.year;
  const displayGenre = embeddedTags?.genre || activeMedia.genre;

  return (
    <div
      id="audio-player-modal"
      className="fixed inset-0 z-50 flex flex-col justify-between p-4 sm:p-8 backdrop-blur-2xl transition-all select-none overflow-y-auto"
      style={{
        backgroundColor: isDark ? 'rgba(10, 12, 20, 0.97)' : 'rgba(248, 250, 252, 0.97)',
      }}
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-4 max-w-2xl w-full mx-auto shrink-0">
        <button
          id="audio-modal-close-btn"
          onClick={closeAudioModal}
          className="p-2.5 rounded-2xl border hover:bg-slate-700/20 transition-colors cursor-pointer"
          style={{
            borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
          }}
          title="Minimize Player"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center min-w-0 flex-1 px-2">
          <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            Now Playing
          </p>
          <p className="text-xs text-slate-200 font-semibold truncate max-w-xs sm:max-w-md mx-auto">
            {displayAlbum ? `${displayAlbum}` : activeMedia.folder}
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Track Metadata Inspector Button */}
          <button
            id="audio-modal-tag-inspector-btn"
            onClick={() => setShowTagModal(true)}
            className="p-2.5 rounded-2xl border hover:bg-slate-700/20 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
            style={{
              borderColor: showTagModal
                ? themeColors.primary
                : isDark
                ? themeColors.borderDark
                : themeColors.borderLight,
              backgroundColor: showTagModal
                ? `${themeColors.primary}20`
                : isDark
                ? 'rgba(255,255,255,0.05)'
                : 'rgba(0,0,0,0.04)',
              color: showTagModal ? themeColors.primary : undefined,
            }}
            title="Embedded Metadata & Tag Inspector"
          >
            <Tag className="w-4 h-4" />
            <span className="hidden md:inline">Tags</span>
          </button>

          {/* Quick Lyrics Button */}
          <button
            id="audio-modal-lyrics-btn"
            onClick={() => {
              if (showQueue) setShowQueue(false);
              setArtViewMode(artViewMode === 'lyrics' ? 'cover' : 'lyrics');
            }}
            className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold ${
              artViewMode === 'lyrics' && !showQueue
                ? 'border-amber-400/60 bg-amber-400/20 text-amber-300'
                : 'hover:bg-slate-700/20'
            }`}
            style={{
              borderColor:
                artViewMode === 'lyrics' && !showQueue
                  ? undefined
                  : isDark
                  ? themeColors.borderDark
                  : themeColors.borderLight,
              backgroundColor:
                artViewMode === 'lyrics' && !showQueue
                  ? undefined
                  : isDark
                  ? 'rgba(255,255,255,0.05)'
                  : 'rgba(0,0,0,0.04)',
            }}
            title="Lyrics (English & Native)"
          >
            <Mic className="w-4 h-4" />
            <span className="hidden sm:inline">Lyrics</span>
          </button>

          {/* Sleep Timer Button */}
          <button
            id="audio-modal-sleep-timer-btn"
            onClick={() => setShowSleepModal(true)}
            className="p-2.5 rounded-2xl border hover:bg-slate-700/20 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
            style={{
              borderColor:
                sleepTimerRemaining !== null || sleepTimerEndTrack
                  ? themeColors.primary
                  : isDark
                  ? themeColors.borderDark
                  : themeColors.borderLight,
              backgroundColor:
                sleepTimerRemaining !== null || sleepTimerEndTrack
                  ? `${themeColors.primary}20`
                  : isDark
                  ? 'rgba(255,255,255,0.05)'
                  : 'rgba(0,0,0,0.04)',
              color:
                sleepTimerRemaining !== null || sleepTimerEndTrack ? themeColors.primary : undefined,
            }}
            title="Sleep Timer"
          >
            <Clock className="w-4 h-4" />
            {sleepTimerRemaining !== null ? (
              <span className="font-mono tabular-nums">
                {sleepTimerRemaining >= 60
                  ? `${Math.ceil(sleepTimerRemaining / 60)}m`
                  : `${sleepTimerRemaining}s`}
              </span>
            ) : sleepTimerEndTrack ? (
              <span className="text-[11px] hidden sm:inline">End of Song</span>
            ) : null}
          </button>

          {/* Volume Normalization Quick Button & Menu */}
          <div className="relative">
            <button
              id="audio-modal-norm-btn"
              onClick={() => setShowNormMenu(!showNormMenu)}
              className="p-2.5 rounded-2xl border hover:bg-slate-700/20 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              style={{
                borderColor: norm?.enabled
                  ? themeColors.primary
                  : isDark
                  ? themeColors.borderDark
                  : themeColors.borderLight,
                backgroundColor: norm?.enabled
                  ? `${themeColors.primary}20`
                  : isDark
                  ? 'rgba(255,255,255,0.05)'
                  : 'rgba(0,0,0,0.04)',
                color: norm?.enabled ? themeColors.primary : undefined,
              }}
              title={
                norm?.enabled
                  ? `Volume Normalization: Active (${norm.mode}) - Click for options`
                  : 'Volume Normalization: Bypassed - Click to configure'
              }
            >
              <Gauge className="w-4 h-4" />
              <span className="hidden sm:inline font-mono">
                {norm?.enabled ? `NORM ${VOLUME_NORMALIZATION_MODES[norm.mode]?.targetLabel || ''}` : 'NORM'}
              </span>
              {norm?.enabled && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>

            {/* Quick Normalization Mode Dropdown */}
            {showNormMenu && (
              <div
                id="audio-modal-norm-dropdown"
                className="absolute right-0 top-12 w-64 p-3 rounded-2xl shadow-2xl border z-50 space-y-2.5 backdrop-blur-xl"
                style={{
                  backgroundColor: isDark ? '#161926' : '#FFFFFF',
                  borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
                }}
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-700/30">
                  <div className="flex items-center gap-1.5">
                    <Gauge className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold">Loudness Normalization</span>
                  </div>
                  <button
                    onClick={toggleVolumeNormalization}
                    className="text-[11px] font-bold px-2 py-0.5 rounded-md cursor-pointer transition-colors"
                    style={{
                      backgroundColor: norm?.enabled ? `${themeColors.primary}30` : 'rgba(255,255,255,0.1)',
                      color: norm?.enabled ? themeColors.primary : '#94A3B8',
                    }}
                  >
                    {norm?.enabled ? 'Active' : 'Off'}
                  </button>
                </div>

                <p className="text-[11px] text-slate-400">
                  Select target perceived loudness to prevent sudden jumps between tracks:
                </p>

                <div className="space-y-1">
                  {(Object.entries(VOLUME_NORMALIZATION_MODES) as [
                    VolumeNormalizationMode,
                    (typeof VOLUME_NORMALIZATION_MODES)[VolumeNormalizationMode]
                  ][]).map(([key, mode]) => {
                    const isSelected = norm?.mode === key;
                    return (
                      <button
                        key={key}
                        onClick={() => {
                          setVolumeNormalizationMode(key);
                        }}
                        className={`w-full p-2 rounded-xl text-left flex items-center justify-between text-xs transition-colors cursor-pointer ${
                          isSelected && norm?.enabled
                            ? 'bg-slate-700/40 font-bold'
                            : 'hover:bg-slate-700/20 text-slate-300'
                        }`}
                        style={{
                          color: isSelected && norm?.enabled ? themeColors.primary : undefined,
                        }}
                      >
                        <div>
                          <p>{mode.name}</p>
                          <p className="text-[10px] text-slate-400 font-normal">{mode.targetLabel}</p>
                        </div>
                        {isSelected && norm?.enabled && <Check className="w-4 h-4" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Toggle Queue Panel */}
          <button
            id="audio-modal-queue-btn"
            onClick={() => setShowQueue(!showQueue)}
            className="p-2.5 rounded-2xl border hover:bg-slate-700/20 transition-colors cursor-pointer"
            style={{
              borderColor: showQueue
                ? themeColors.primary
                : isDark
                ? themeColors.borderDark
                : themeColors.borderLight,
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
              color: showQueue ? themeColors.primary : undefined,
            }}
            title="Playback Queue"
          >
            <ListMusic className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="max-w-2xl w-full mx-auto my-auto py-4 flex flex-col items-center">
        {showQueue ? (
          /* Queue View */
          <div
            id="audio-modal-queue-container"
            className="w-full max-h-[390px] overflow-y-auto rounded-3xl border p-4 space-y-2.5 shadow-xl"
            style={{
              backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
              borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
            }}
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/30">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold">Playback Queue</h4>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/40 text-slate-300 font-mono">
                    {queue.length} {queue.length === 1 ? 'track' : 'tracks'}
                  </span>
                </div>
                {queueIndex < queue.length - 1 && (
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {queue.length - 1 - queueIndex} upcoming • ~{formatTime(queue.slice(queueIndex + 1).reduce((sum, t) => sum + (t.duration || 0), 0))} remaining
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {queueIndex < queue.length - 1 && (
                  <button
                    id="queue-clear-upcoming-btn"
                    onClick={clearUpcomingQueue}
                    className="text-xs text-rose-400 hover:text-rose-300 hover:underline px-2 py-1 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title="Clear all tracks after the current one"
                  >
                    Clear Upcoming
                  </button>
                )}
                <button
                  id="queue-back-to-art-btn"
                  onClick={() => setShowQueue(false)}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg border hover:bg-slate-700/20 transition-colors cursor-pointer"
                  style={{
                    borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
                  }}
                >
                  Back to Artwork
                </button>
              </div>
            </div>

            {queue.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Queue is empty. Select "Play Next" on any track or playlist to queue it up.
              </div>
            ) : (
              queue.map((item, idx) => {
                const isCurrent = idx === queueIndex;
                const isImmediateNext = idx === queueIndex + 1;
                const isPast = idx < queueIndex;
                const isUpcoming = idx > queueIndex;

                return (
                  <div
                    key={`${item.id}-${idx}`}
                    id={`queue-item-${idx}`}
                    className="group flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-all"
                    style={{
                      backgroundColor: isCurrent
                        ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)')
                        : (isImmediateNext ? 'rgba(56, 189, 248, 0.05)' : 'transparent'),
                      borderColor: isCurrent
                        ? themeColors.primary
                        : (isImmediateNext ? 'rgba(56, 189, 248, 0.3)' : 'transparent'),
                    }}
                  >
                    <div
                      className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                      onClick={() => playMedia(item, queue, false)}
                    >
                      <span className="text-xs font-mono font-semibold text-slate-400 w-5 text-center shrink-0">
                        {idx + 1}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <p
                            className="text-sm font-medium truncate"
                            style={{ color: isCurrent ? themeColors.primary : undefined }}
                          >
                            {item.title}
                          </p>
                          {isCurrent && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                              PLAYING
                            </span>
                          )}
                          {isImmediateNext && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30 shrink-0 flex items-center gap-0.5">
                              <ListPlus className="w-2.5 h-2.5" /> UP NEXT
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 truncate">
                          {item.artist || 'Unknown'} {item.album ? `• ${item.album}` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Right action controls */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs text-slate-400 tabular-nums mr-1">
                        {formatTime(item.duration)}
                      </span>

                      {/* If item is upcoming but not immediately next, offer button to make it play next */}
                      {idx > queueIndex + 1 && (
                        <button
                          id={`queue-make-play-next-${idx}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveQueueItem(idx, queueIndex + 1);
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-slate-700/20 transition-all cursor-pointer opacity-80 group-hover:opacity-100"
                          title="Move this track to play next"
                        >
                          <ListPlus className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Re-order Up / Down for upcoming tracks */}
                      {isUpcoming && (
                        <>
                          <button
                            disabled={idx <= queueIndex + 1}
                            onClick={(e) => {
                              e.stopPropagation();
                              moveQueueItem(idx, idx - 1);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700/20 disabled:opacity-20 cursor-pointer"
                            title="Move Up"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            disabled={idx >= queue.length - 1}
                            onClick={(e) => {
                              e.stopPropagation();
                              moveQueueItem(idx, idx + 1);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700/20 disabled:opacity-20 cursor-pointer"
                            title="Move Down"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}

                      {/* Remove from queue */}
                      {!isCurrent && (
                        <button
                          id={`queue-remove-item-${idx}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromQueue(idx);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Remove from queue"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* Album Art & Audio Waves Display */
          <div className="relative flex flex-col items-center w-full">
            {/* View Mode Switcher (Cover Art vs Vinyl) */}
            <div
              className="flex items-center p-1 rounded-full border mb-4 text-[11px] font-semibold"
              style={{
                borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
              }}
            >
              <button
                id="art-mode-cover-btn"
                onClick={() => setArtViewMode('cover')}
                className={`px-3 py-1 rounded-full transition-all cursor-pointer flex items-center gap-1.5 ${
                  artViewMode === 'cover' ? 'text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
                style={{
                  backgroundColor: artViewMode === 'cover' ? themeColors.primary : 'transparent',
                }}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Album Art</span>
              </button>
              <button
                id="art-mode-vinyl-btn"
                onClick={() => setArtViewMode('vinyl')}
                className={`px-3 py-1 rounded-full transition-all cursor-pointer flex items-center gap-1.5 ${
                  artViewMode === 'vinyl' ? 'text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
                style={{
                  backgroundColor: artViewMode === 'vinyl' ? themeColors.primary : 'transparent',
                }}
              >
                <Disc className="w-3.5 h-3.5" />
                <span>Vinyl Disc</span>
              </button>
              <button
                id="art-mode-lyrics-btn"
                onClick={() => setArtViewMode('lyrics')}
                className={`px-3 py-1 rounded-full transition-all cursor-pointer flex items-center gap-1.5 ${
                  artViewMode === 'lyrics' ? 'text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
                style={{
                  backgroundColor: artViewMode === 'lyrics' ? themeColors.primary : 'transparent',
                }}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Lyrics</span>
              </button>
            </div>

            {artViewMode === 'lyrics' ? (
              /* Synchronized Lyrics View */
              <div className="w-full flex justify-center py-1">
                <AudioLyricsView
                  activeMedia={activeMedia}
                  currentTime={currentTime}
                  duration={duration}
                  onSeek={seek}
                  lyricsSettings={settings.lyricsSettings}
                  onUpdateLyricsSettings={(partial) => {
                    updateSettings({
                      lyricsSettings: {
                        ...settings.lyricsSettings,
                        ...partial,
                      },
                    });
                  }}
                  themeColors={themeColors}
                  isDark={isDark}
                  onShowToast={showToast}
                />
              </div>
            ) : artViewMode === 'cover' ? (
              /* High-Fidelity Album Cover View */
              <div className="relative group flex items-center justify-center">
                {/* Ambient dynamic glow halo */}
                <div
                  className="absolute -inset-4 rounded-3xl opacity-30 blur-2xl transition-all duration-700 -z-10"
                  style={{
                    backgroundColor: themeColors.primary,
                    transform: isPlaying ? 'scale(1.05)' : 'scale(0.95)',
                  }}
                />

                <div
                  id="audio-modal-cover-art"
                  className="relative w-64 h-64 sm:w-72 sm:h-72 md:w-80 md:h-80 rounded-3xl overflow-hidden shadow-2xl border transition-all duration-300 group"
                  style={{
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                  }}
                >
                  {displayArtwork ? (
                    <img
                      src={displayArtwork}
                      alt={displayTitle}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900/80 text-slate-500">
                      <Music className="w-16 h-16 mb-2 opacity-50" />
                      <p className="text-xs text-slate-400 font-medium">No Album Art Found</p>
                    </div>
                  )}

                  {/* Embedded Artwork Badge */}
                  {hasEmbeddedArt && (
                    <div
                      id="embedded-art-badge"
                      className="absolute top-3 left-3 bg-black/70 backdrop-blur-md border border-emerald-500/40 text-emerald-300 text-[10px] sm:text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-lg animate-fade-in"
                    >
                      <Sparkles className="w-3 h-3 text-emerald-400" />
                      <span>Embedded Art</span>
                    </div>
                  )}

                  {/* Zoom Lightbox Trigger */}
                  {displayArtwork && (
                    <button
                      id="zoom-art-btn"
                      onClick={() => setIsZoomArtOpen(true)}
                      className="absolute bottom-3 right-3 p-2 rounded-xl bg-black/60 backdrop-blur-md text-white/80 hover:text-white hover:bg-black/90 transition-all opacity-90 sm:opacity-0 sm:group-hover:opacity-100 shadow-md cursor-pointer"
                      title="Enlarge Album Art"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* Vinyl Spinning Disc View */
              <div className="relative flex flex-col items-center">
                <div
                  className={`relative w-64 h-64 sm:w-72 sm:h-72 md:w-80 md:h-80 rounded-full overflow-hidden shadow-2xl border-4 ${
                    isPlaying ? 'animate-spin' : ''
                  }`}
                  style={{
                    borderColor: themeColors.primary,
                    animationDuration: '14s',
                    animationTimingFunction: 'linear',
                    animationIterationCount: 'infinite',
                  }}
                >
                  {displayArtwork ? (
                    <img
                      src={displayArtwork}
                      alt={displayTitle}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500">
                      <Music className="w-20 h-20" />
                    </div>
                  )}

                  {/* Center Vinyl Hole & Ring */}
                  <div className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-slate-900 border-4 border-slate-700 flex items-center justify-center shadow-inner">
                    <div className="w-4 h-4 rounded-full bg-white" />
                  </div>
                </div>
              </div>
            )}

            {/* Audio Equalizer Frequency Wave Bars */}
            {artViewMode !== 'lyrics' && (
              <div className="flex items-end justify-center gap-1.5 h-7 mt-5">
                {[35, 70, 95, 55, 80, 45, 90, 60, 75, 50, 85, 65].map((h, i) => (
                  <span
                    key={i}
                    className="w-1 rounded-full transition-all duration-300"
                    style={{
                      height: isPlaying ? `${h}%` : '15%',
                      backgroundColor: themeColors.primary,
                      opacity: isPlaying ? 0.9 : 0.25,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Track Metadata Section: Title, Artist, Album & Tags */}
        <div className="w-full text-center mt-5 space-y-2">
          {/* Title and Favorite Button */}
          <div className="flex items-center justify-center gap-3 px-4">
            <h3
              id="audio-player-track-title"
              className="text-xl sm:text-2xl md:text-3xl font-extrabold truncate max-w-md sm:max-w-xl text-slate-100 tracking-tight"
            >
              {displayTitle}
            </h3>
            <button
              id="audio-modal-fav-btn"
              onClick={() => toggleFavorite(activeMedia.id)}
              className="p-1 rounded-full hover:scale-110 transition-transform cursor-pointer shrink-0"
              title={activeMedia.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Heart
                className="w-5 h-5"
                fill={activeMedia.isFavorite ? '#EF4444' : 'none'}
                color={activeMedia.isFavorite ? '#EF4444' : 'currentColor'}
              />
            </button>
          </div>

          {/* Artist Tag */}
          <div className="flex items-center justify-center gap-1.5 text-sm sm:text-base font-semibold text-slate-300 truncate max-w-md mx-auto">
            <User className="w-4 h-4 shrink-0" style={{ color: themeColors.primary }} />
            <span id="audio-player-artist-name" className="truncate">
              {displayArtist}
            </span>
          </div>

          {/* Album Tag */}
          {displayAlbum && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 font-medium truncate max-w-md mx-auto">
              <Disc className="w-3.5 h-3.5 shrink-0" />
              <span id="audio-player-album-name" className="truncate">
                Album: {displayAlbum}
              </span>
            </div>
          )}

          {/* Metadata Chips Strip */}
          <div className="flex items-center justify-center flex-wrap gap-1.5 pt-1">
            {displayYear && (
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full border border-white/10 bg-white/5 text-slate-300">
                {displayYear}
              </span>
            )}
            {displayGenre && (
              <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full border border-white/10 bg-white/5 text-slate-300">
                {displayGenre}
              </span>
            )}
            <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full border border-white/10 bg-white/5 text-slate-400">
              {activeMedia.bitrate || '320 kbps'}
            </span>
            <button
              id="audio-modal-tag-pill-btn"
              onClick={() => setShowTagModal(true)}
              className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-emerald-500/30 text-emerald-400 bg-emerald-500/10 flex items-center gap-1 hover:bg-emerald-500/20 transition-colors cursor-pointer"
              title="Inspect embedded metadata tags"
            >
              <Tag className="w-3 h-3" />
              <span>{embeddedTags?.tagType || 'ID3 Tags'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="max-w-2xl w-full mx-auto space-y-4 shrink-0">
        {/* Scrubber */}
        <div className="space-y-1">
          <input
            id="audio-modal-scrubber"
            type="range"
            min="0"
            max={duration || 100}
            step="0.1"
            value={currentTime}
            onChange={(e) => seek(parseFloat(e.target.value))}
            className="w-full h-1.5 rounded-lg appearance-none bg-slate-700/30 cursor-pointer"
            style={{ accentColor: themeColors.primary }}
          />
          <div className="flex items-center justify-between text-xs text-slate-400 tabular-nums">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Playback Buttons */}
        <div className="flex items-center justify-between gap-4">
          <button
            id="audio-modal-shuffle-btn"
            onClick={() => {
              const shuffled = [...queue].sort(() => Math.random() - 0.5);
              playMedia(shuffled[0], shuffled, false);
            }}
            className="p-3 rounded-xl hover:bg-slate-700/20 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Shuffle Queue"
          >
            <Shuffle className="w-5 h-5" />
          </button>

          <button
            id="audio-modal-prev-btn"
            onClick={previousTrack}
            className="p-3 rounded-full hover:bg-slate-700/20 hover:scale-110 transition-all cursor-pointer"
            title="Previous Track"
          >
            <SkipBack className="w-7 h-7" />
          </button>

          <button
            id="audio-modal-play-btn"
            onClick={togglePlay}
            className="w-16 h-16 rounded-full flex items-center justify-center text-white shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
            style={{ backgroundColor: themeColors.primary }}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-8 h-8 fill-white" />
            ) : (
              <Play className="w-8 h-8 fill-white ml-1" />
            )}
          </button>

          <button
            id="audio-modal-next-btn"
            onClick={nextTrack}
            className="p-3 rounded-full hover:bg-slate-700/20 hover:scale-110 transition-all cursor-pointer"
            title="Next Track"
          >
            <SkipForward className="w-7 h-7" />
          </button>

          <button
            id="audio-modal-loop-btn"
            onClick={cycleLoopMode}
            className="p-3 rounded-xl hover:bg-slate-700/20 transition-colors cursor-pointer"
            style={{
              color: loopMode !== 'none' ? themeColors.primary : undefined,
            }}
            title={`Repeat: ${loopMode}`}
          >
            {loopMode === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
          </button>
        </div>

        {/* Volume Slider */}
        <div className="flex items-center justify-center gap-3 pt-1">
          <button onClick={toggleMute} className="text-slate-400 hover:text-white cursor-pointer">
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <input
            id="audio-modal-volume-slider"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-36 h-1 rounded bg-slate-700/40 cursor-pointer"
            style={{ accentColor: themeColors.primary }}
          />
        </div>
      </div>

      {/* Sleep Timer Modal Dialog */}
      <SleepTimerModal isOpen={showSleepModal} onClose={() => setShowSleepModal(false)} />

      {/* Track Metadata & Tag Inspector Dialog */}
      <AudioMetadataModal
        isOpen={showTagModal}
        onClose={() => setShowTagModal(false)}
        media={activeMedia}
        tags={embeddedTags}
        duration={duration}
      />

      {/* Full-Screen Cover Art Zoom Lightbox */}
      {isZoomArtOpen && displayArtwork && (
        <div
          id="audio-cover-art-zoom-lightbox"
          className="fixed inset-0 z-70 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-fade-in"
          onClick={() => setIsZoomArtOpen(false)}
        >
          <button
            id="close-zoom-lightbox-btn"
            onClick={() => setIsZoomArtOpen(false)}
            className="absolute top-6 right-6 p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>

          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-lg w-full flex flex-col items-center space-y-4"
          >
            <div className="w-72 h-72 sm:w-96 sm:h-96 rounded-3xl overflow-hidden shadow-2xl border border-white/20">
              <img
                src={displayArtwork}
                alt={displayTitle}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-center">
              <h4 className="text-lg font-bold text-white">{displayTitle}</h4>
              <p className="text-sm text-slate-400">
                {displayArtist} {displayAlbum ? `• ${displayAlbum}` : ''}
              </p>
              {hasEmbeddedArt && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-400 mt-1 font-semibold">
                  <Sparkles className="w-3.5 h-3.5" /> Embedded Album Artwork
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
