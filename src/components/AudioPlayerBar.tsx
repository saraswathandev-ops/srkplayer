import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Maximize2,
  Music,
  Clock,
  Gauge,
  Shuffle,
  Minus,
  Plus,
  RotateCcw,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { formatTime } from '../utils/formatters';

const SPEED_PRESETS = [0.5, 0.75, 0.9, 1, 1.25, 1.5, 1.75, 2];

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
    playbackRate,
    setPlaybackRate,
    isShuffled,
    toggleShuffle,
    queue,
    showToast,
  } = usePlayer();

  const isDark = settings.theme === 'dark';
  const norm = settings.volumeNormalization;

  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const speedMenuRef = useRef<HTMLDivElement>(null);

  // Synchronize audio element playbackRate
  useEffect(() => {
    if (audioRef.current && audioRef.current.playbackRate !== playbackRate) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, activeMedia?.id, audioRef]);

  // Click outside listener for speed menu popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (speedMenuRef.current && !speedMenuRef.current.contains(e.target as Node)) {
        setShowSpeedMenu(false);
      }
    };
    if (showSpeedMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSpeedMenu]);

  // Escape key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showSpeedMenu) {
        setShowSpeedMenu(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSpeedMenu]);

  const changeSpeed = (delta: number) => {
    const newRate = Math.round((playbackRate + delta) * 100) / 100;
    const clamped = Math.max(0.25, Math.min(3, newRate));
    setPlaybackRate(clamped);
    showToast(`Speed: ${clamped}x`);
  };

  // Mount the audio element regardless so background playback stays consistent
  return (
    <>
      <audio
        ref={audioRef}
        crossOrigin="anonymous"
        src={activeMedia?.mediaType === 'audio' ? activeMedia.uri : undefined}
        onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime, e.currentTarget.duration)}
        onPlay={(e) => {
          if (e.currentTarget.playbackRate !== playbackRate) {
            e.currentTarget.playbackRate = playbackRate;
          }
        }}
        onCanPlay={(e) => {
          if (e.currentTarget.playbackRate !== playbackRate) {
            e.currentTarget.playbackRate = playbackRate;
          }
        }}
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

          {/* Compact mobile mini-player */}
          <div className="sm:hidden px-3 py-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={openAudioModal}
                className="relative w-11 h-11 rounded-lg overflow-hidden bg-slate-800 shrink-0 shadow-md cursor-pointer"
                title="Open Full Player"
              >
                {activeMedia.thumbnail ? (
                  <img src={activeMedia.thumbnail} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400"><Music className="w-5 h-5" /></div>
                )}
              </button>
              <button
                type="button"
                onClick={openAudioModal}
                className="min-w-0 flex-1 text-left cursor-pointer"
                title="Open Full Player"
              >
                <div className="font-bold text-xs truncate">{activeMedia.title}</div>
                <div className="text-[11px] text-slate-400 truncate">{activeMedia.artist || 'Unknown Artist'}</div>
                <div className="text-[10px] text-slate-500 tabular-nums mt-0.5">{formatTime(currentTime)} / {formatTime(duration)}</div>
              </button>
              <button
                id="mobile-mini-audio-prev-btn"
                onClick={previousTrack}
                className="p-2 text-slate-400 hover:text-white cursor-pointer shrink-0"
                title="Previous Track"
              ><SkipBack className="w-4.5 h-4.5" /></button>
              <button
                id="mobile-mini-audio-play-toggle"
                onClick={togglePlay}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg cursor-pointer shrink-0 active:scale-95"
                style={{ backgroundColor: themeColors.primary }}
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-4.5 h-4.5 fill-white" /> : <Play className="w-4.5 h-4.5 fill-white ml-0.5" />}
              </button>
              <button
                id="mobile-mini-audio-next-btn"
                onClick={nextTrack}
                className="p-2 text-slate-400 hover:text-white cursor-pointer shrink-0"
                title="Next Track"
              ><SkipForward className="w-4.5 h-4.5" /></button>
              <button
                id="mobile-mini-audio-expand-btn"
                onClick={openAudioModal}
                className="p-2 text-slate-400 hover:text-white cursor-pointer shrink-0"
                title="Open Full Player"
              ><Maximize2 className="w-4 h-4" /></button>
            </div>
          </div>

          {/* Full desktop/tablet mini-player */}
          <div className="hidden sm:flex max-w-7xl mx-auto px-4 sm:px-6 h-18 items-center justify-between gap-4">
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
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Shuffle Toggle Button */}
              <button
                id="mini-audio-shuffle-btn"
                onClick={toggleShuffle}
                className="p-2 transition-all cursor-pointer relative rounded-xl hover:bg-slate-700/20"
                style={{
                  color: isShuffled ? themeColors.primary : undefined,
                  backgroundColor: isShuffled ? `${themeColors.primary}20` : 'transparent',
                }}
                title={
                  isShuffled
                    ? `Shuffle: ON (${queue.length} tracks) - Click to restore original order`
                    : `Shuffle playlist: OFF - Click to shuffle (${queue.length} tracks)`
                }
              >
                <Shuffle className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${isShuffled ? '' : 'text-slate-400 hover:text-white'}`} />
                {isShuffled && (
                  <span
                    className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{ backgroundColor: themeColors.primary }}
                  />
                )}
              </button>

              <button
                id="mini-audio-prev-btn"
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
                id="mini-audio-next-btn"
                onClick={nextTrack}
                className="p-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Next Track"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>

            {/* Right: Time, Speed Control, Volume, Expand */}
            <div className="flex items-center gap-3 sm:gap-4 shrink-0">
              <span className="text-xs text-slate-400 hidden sm:inline tabular-nums">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              {/* Quick-Access Playback Speed Control */}
              <div className="relative" ref={speedMenuRef}>
                <div className="flex items-center gap-1">
                  {/* Stepper decrease (desktop) */}
                  <button
                    id="mini-bar-speed-decrease"
                    onClick={() => changeSpeed(-0.25)}
                    className="hidden md:flex p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/30 transition-colors cursor-pointer"
                    title="Slow down (-0.25x)"
                  >
                    <Minus className="w-3 h-3" />
                  </button>

                  {/* Speed Trigger Badge / Button */}
                  <button
                    id="mini-bar-speed-trigger"
                    onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                    className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border cursor-pointer hover:scale-105 transition-all"
                    style={{
                      borderColor: playbackRate !== 1 ? themeColors.primary : isDark ? '#334155' : '#CBD5E1',
                      color: playbackRate !== 1 ? themeColors.primary : '#94A3B8',
                      backgroundColor: playbackRate !== 1 ? `${themeColors.primary}18` : 'transparent',
                    }}
                    title={`Playback speed: ${playbackRate}x - Click for quick-access speeds`}
                  >
                    <Gauge className="w-3 h-3" />
                    <span>{playbackRate}x</span>
                  </button>

                  {/* Stepper increase (desktop) */}
                  <button
                    id="mini-bar-speed-increase"
                    onClick={() => changeSpeed(0.25)}
                    className="hidden md:flex p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/30 transition-colors cursor-pointer"
                    title="Speed up (+0.25x)"
                  >
                    <Plus className="w-3 h-3" />
                  </button>

                  {/* Quick Speed Pills on desktop (1x, 1.25x, 1.5x) for instant 1-click access */}
                  <div className="hidden xl:flex items-center gap-1 ml-1 bg-slate-800/40 p-0.5 rounded-lg border border-slate-700/30">
                    {[1, 1.25, 1.5].map((speed) => (
                      <button
                        key={speed}
                        id={`mini-bar-quick-speed-${speed}x`}
                        onClick={() => {
                          setPlaybackRate(speed);
                          showToast(`Speed: ${speed}x`);
                        }}
                        className={`px-1.5 py-0.5 text-[10px] font-semibold rounded cursor-pointer transition-all ${
                          playbackRate === speed
                            ? 'text-white font-bold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                        style={{
                          backgroundColor: playbackRate === speed ? themeColors.primary : 'transparent',
                        }}
                        title={`Set speed to ${speed}x`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick-Access Speed Menu Popover */}
                {showSpeedMenu && (
                  <div
                    id="mini-bar-speed-popover"
                    className="absolute bottom-full right-0 mb-3 w-64 p-3 rounded-2xl shadow-2xl border backdrop-blur-2xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-150"
                    style={{
                      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.98)' : 'rgba(255, 255, 255, 0.98)',
                      borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
                    }}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-700/30 mb-2.5">
                      <div className="flex items-center gap-1.5">
                        <Gauge className="w-3.5 h-3.5" style={{ color: themeColors.primary }} />
                        <span className="text-xs font-semibold">Playback Speed</span>
                      </div>
                      <span
                        className="text-xs font-bold font-mono px-2 py-0.5 rounded-md"
                        style={{
                          backgroundColor: `${themeColors.primary}20`,
                          color: themeColors.primary,
                        }}
                      >
                        {playbackRate}x
                      </span>
                    </div>

                    {/* Quick Fine-Tuning Stepper Bar */}
                    <div className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-slate-800/30 border border-slate-700/30 mb-2.5">
                      <button
                        onClick={() => changeSpeed(-0.25)}
                        disabled={playbackRate <= 0.25}
                        className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        title="Decrease speed by 0.25x"
                      >
                        <Minus className="w-3 h-3" />
                        <span>-0.25x</span>
                      </button>
                      <button
                        onClick={() => changeSpeed(0.25)}
                        disabled={playbackRate >= 3.0}
                        className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        title="Increase speed by 0.25x"
                      >
                        <Plus className="w-3 h-3" />
                        <span>+0.25x</span>
                      </button>
                    </div>

                    {/* Quick-Access Speed Buttons Grid */}
                    <div className="grid grid-cols-4 gap-1.5 mb-2">
                      {SPEED_PRESETS.map((preset) => {
                        const isCurrent = Math.abs(playbackRate - preset) < 0.01;
                        return (
                          <button
                            key={preset}
                            id={`speed-preset-btn-${preset}`}
                            onClick={() => {
                              setPlaybackRate(preset);
                              showToast(`Speed: ${preset}x`);
                            }}
                            className={`py-1.5 px-1 text-xs font-semibold rounded-lg transition-all text-center cursor-pointer ${
                              isCurrent
                                ? 'text-white font-bold shadow-sm scale-105'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30'
                            }`}
                            style={{
                              backgroundColor: isCurrent ? themeColors.primary : undefined,
                            }}
                          >
                            {preset === 1 ? '1.0x' : `${preset}x`}
                          </button>
                        );
                      })}
                    </div>

                    {/* Reset button if speed is not 1x */}
                    {playbackRate !== 1 && (
                      <button
                        id="mini-bar-speed-reset"
                        onClick={() => {
                          setPlaybackRate(1);
                          showToast('Speed reset to 1.0x (Normal)');
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-1 text-[11px] font-medium text-slate-400 hover:text-white hover:bg-slate-700/20 rounded-lg transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset to Normal (1.0x)</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

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
