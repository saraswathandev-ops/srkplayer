import React from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Maximize2, Music, Clock, Gauge } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { formatTime } from '../utils/formatters';

export function AudioPlayerBar() {
  const {
    activeMedia,
    isPlaying,
    togglePlay,
    currentTime,
    duration,
    seek,
    volume,
    setVolume,
    isMuted,
    toggleMute,
    nextTrack,
    previousTrack,
    openAudioModal,
    settings,
    themeColors,
    audioRef,
    onTimeUpdate,
    onEnded,
    sleepTimerRemaining,
    sleepTimerEndTrack,
    toggleVolumeNormalization,
  } = usePlayer();

  const isDark = settings.theme === 'dark';
  const norm = settings.volumeNormalization;

  // Mount the audio element regardless so background playback stays consistent
  return (
    <>
      <audio
        ref={audioRef}
        src={activeMedia?.mediaType === 'audio' ? activeMedia.uri : undefined}
        onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime, e.currentTarget.duration)}
        onEnded={onEnded}
      />

      {/* Render mini player bar only if activeMedia is audio */}
      {activeMedia && activeMedia.mediaType === 'audio' && (
        <div
          id="audio-player-bar"
          className="fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-xl transition-all shadow-2xl"
          style={{
            backgroundColor: isDark ? 'rgba(15, 18, 28, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
          }}
        >
          {/* Top Progress bar */}
          <div
            className="w-full h-1 bg-slate-700/20 cursor-pointer relative group/bar"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const percent = (e.clientX - rect.left) / rect.width;
              seek(percent * (duration || 1));
            }}
          >
            <div
              className="h-full transition-all duration-100"
              style={{
                width: `${duration ? Math.min(100, (currentTime / duration) * 100) : 0}%`,
                backgroundColor: themeColors.primary,
              }}
            />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between gap-4">
            {/* Left: Track info */}
            <div
              className="flex items-center gap-3 min-w-0 max-w-xs sm:max-w-sm cursor-pointer"
              onClick={openAudioModal}
            >
              <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-800 shrink-0 shadow-md">
                {activeMedia.thumbnail ? (
                  <img
                    src={activeMedia.thumbnail}
                    alt={activeMedia.title}
                    className={`w-full h-full object-cover ${isPlaying ? 'scale-105' : ''} transition-transform`}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <Music className="w-6 h-6" />
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <h4 className="font-bold text-sm truncate hover:underline">
                  {activeMedia.title}
                </h4>
                <p className="text-xs text-slate-400 truncate mt-0.5">
                  {activeMedia.artist || 'Unknown Artist'}
                </p>
              </div>
            </div>

            {/* Center: Playback Controls */}
            <div className="flex items-center gap-3 sm:gap-5">
              <button
                onClick={previousTrack}
                className="p-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Previous Track"
              >
                <SkipBack className="w-5 h-5" />
              </button>

              <button
                id="mini-audio-play-toggle"
                onClick={togglePlay}
                className="w-11 h-11 rounded-full flex items-center justify-center text-white shadow-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                style={{ backgroundColor: themeColors.primary }}
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 fill-white" />
                ) : (
                  <Play className="w-5 h-5 fill-white ml-0.5" />
                )}
              </button>

              <button
                onClick={nextTrack}
                className="p-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Next Track"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>

            {/* Right: Time, Volume, Expand */}
            <div className="flex items-center gap-4 shrink-0">
              <span className="text-xs text-slate-400 hidden sm:inline tabular-nums">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              {/* Volume Normalization mini toggle badge */}
              <button
                id="mini-bar-norm-badge"
                onClick={toggleVolumeNormalization}
                className="hidden sm:flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border cursor-pointer hover:scale-105 transition-all"
                style={{
                  borderColor: norm?.enabled ? themeColors.primary : isDark ? '#334155' : '#CBD5E1',
                  color: norm?.enabled ? themeColors.primary : '#94A3B8',
                  backgroundColor: norm?.enabled ? `${themeColors.primary}18` : 'transparent',
                }}
                title={norm?.enabled ? `Volume Normalization: Active (${norm.mode}) - Click to bypass` : 'Volume Normalization: Off - Click to enable'}
              >
                <Gauge className="w-3 h-3" />
                <span>NORM</span>
                {norm?.enabled && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </button>

              {/* Sleep timer mini indicator */}
              {(sleepTimerRemaining !== null || sleepTimerEndTrack) && (
                <button
                  id="mini-bar-sleep-timer-badge"
                  onClick={openAudioModal}
                  className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border cursor-pointer hover:scale-105 transition-transform"
                  style={{
                    borderColor: themeColors.primary,
                    color: themeColors.primary,
                    backgroundColor: `${themeColors.primary}18`,
                  }}
                  title="Sleep timer active - click to open player"
                >
                  <Clock className="w-3 h-3 animate-pulse" />
                  <span>
                    {sleepTimerRemaining !== null
                      ? `${Math.ceil(sleepTimerRemaining / 60)}m`
                      : 'End of Song'}
                  </span>
                </button>
              )}

              {/* Volume Slider */}
              <div className="hidden md:flex items-center gap-2">
                <button onClick={toggleMute} className="text-slate-400 hover:text-white cursor-pointer">
                  {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-20 h-1 rounded bg-slate-700 cursor-pointer"
                  style={{ accentColor: themeColors.primary }}
                />
              </div>

              {/* Expand to full modal button */}
              <button
                id="expand-audio-modal-btn"
                onClick={openAudioModal}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700/20 transition-colors cursor-pointer"
                title="Open Full Player"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
