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
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { formatTime } from '../utils/formatters';

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
  } = usePlayer();

  const [showQueue, setShowQueue] = useState(false);
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<number | null>(null);
  const [showSleepMenu, setShowSleepMenu] = useState(false);

  const isDark = settings.theme === 'dark';

  // Sleep timer ticker
  useEffect(() => {
    if (!sleepTimerRemaining || sleepTimerRemaining <= 0) return;
    const interval = setInterval(() => {
      setSleepTimerRemaining((prev) => {
        if (!prev || prev <= 1) {
          clearInterval(interval);
          setSleepTimerMinutes(null);
          // Pause playback on timer expiration
          const audio = document.querySelector('audio');
          audio?.pause();
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepTimerRemaining]);

  const handleSetSleepTimer = (minutes: number | null) => {
    setSleepTimerMinutes(minutes);
    setSleepTimerRemaining(minutes ? minutes * 60 : null);
    setShowSleepMenu(false);
  };

  if (!isAudioModalOpen || !activeMedia || activeMedia.mediaType !== 'audio') return null;

  const cycleLoopMode = () => {
    if (loopMode === 'none') setLoopMode('all');
    else if (loopMode === 'all') setLoopMode('one');
    else setLoopMode('none');
  };

  return (
    <div
      id="audio-player-modal"
      className="fixed inset-0 z-50 flex flex-col justify-between p-6 sm:p-10 backdrop-blur-2xl transition-all select-none overflow-y-auto"
      style={{
        backgroundColor: isDark ? 'rgba(10, 12, 20, 0.96)' : 'rgba(248, 250, 252, 0.96)',
      }}
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-4 max-w-2xl w-full mx-auto">
        <button
          onClick={closeAudioModal}
          className="p-2.5 rounded-2xl border hover:bg-slate-700/20 transition-colors cursor-pointer"
          style={{
            borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
          }}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center min-w-0">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Now Playing</p>
          <p className="text-xs text-slate-300 font-semibold truncate max-w-xs sm:max-w-md">
            {activeMedia.album || activeMedia.folder}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Sleep Timer */}
          <div className="relative">
            <button
              onClick={() => setShowSleepMenu(!showSleepMenu)}
              className="p-2.5 rounded-2xl border hover:bg-slate-700/20 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              style={{
                borderColor: sleepTimerRemaining ? themeColors.primary : isDark ? themeColors.borderDark : themeColors.borderLight,
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                color: sleepTimerRemaining ? themeColors.primary : undefined,
              }}
              title="Sleep Timer"
            >
              <Clock className="w-4 h-4" />
              {sleepTimerRemaining && <span>{Math.ceil(sleepTimerRemaining / 60)}m</span>}
            </button>

            {showSleepMenu && (
              <div
                className="absolute right-0 top-12 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-1.5 z-50 text-xs font-medium w-36"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-3 py-1.5 text-slate-400 text-[10px] font-bold uppercase">Sleep Timer</div>
                {[15, 30, 45, 60].map((m) => (
                  <button
                    key={m}
                    onClick={() => handleSetSleepTimer(m)}
                    className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-white/10 text-white"
                  >
                    {m} Minutes
                  </button>
                ))}
                {sleepTimerRemaining && (
                  <button
                    onClick={() => handleSetSleepTimer(null)}
                    className="w-full text-left px-3 py-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10"
                  >
                    Turn Off
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Toggle Queue Panel */}
          <button
            onClick={() => setShowQueue(!showQueue)}
            className="p-2.5 rounded-2xl border hover:bg-slate-700/20 transition-colors cursor-pointer"
            style={{
              borderColor: showQueue ? themeColors.primary : isDark ? themeColors.borderDark : themeColors.borderLight,
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
      <div className="max-w-2xl w-full mx-auto my-auto py-6 flex flex-col items-center">
        {showQueue ? (
          /* Queue View */
          <div
            className="w-full max-h-[380px] overflow-y-auto rounded-3xl border p-4 space-y-2"
            style={{
              backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
              borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
            }}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-700/30">
              <h4 className="text-sm font-bold">Upcoming Queue ({queue.length} items)</h4>
              <button
                onClick={() => setShowQueue(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Back to Art
              </button>
            </div>

            {queue.map((item, idx) => {
              const isCurrent = idx === queueIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => playMedia(item, queue, false)}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-700/20 transition-colors"
                  style={{
                    backgroundColor: isCurrent ? 'rgba(255,255,255,0.08)' : 'transparent',
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-semibold text-slate-400 w-5 text-center">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: isCurrent ? themeColors.primary : undefined }}
                      >
                        {item.title}
                      </p>
                      <p className="text-xs text-slate-400 truncate">{item.artist || 'Unknown'}</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 tabular-nums">
                    {formatTime(item.duration)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          /* Vinyl Album Art */
          <div className="relative flex flex-col items-center">
            <div
              className={`relative w-64 h-64 sm:w-80 sm:h-80 rounded-full overflow-hidden shadow-2xl border-4 ${
                isPlaying ? 'animate-spin' : ''
              }`}
              style={{
                borderColor: themeColors.primary,
                animationDuration: '14s',
                animationTimingFunction: 'linear',
                animationIterationCount: 'infinite',
              }}
            >
              {activeMedia.thumbnail ? (
                <img
                  src={activeMedia.thumbnail}
                  alt={activeMedia.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500">
                  <Music className="w-20 h-20" />
                </div>
              )}

              {/* Center Vinyl Hole */}
              <div className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-slate-900 border-4 border-slate-700 flex items-center justify-center shadow-inner">
                <div className="w-4 h-4 rounded-full bg-white" />
              </div>
            </div>

            {/* Audio Equalizer Waves */}
            <div className="flex items-end justify-center gap-1.5 h-8 mt-6">
              {[40, 75, 100, 60, 85, 45, 95, 65, 80, 50, 90, 70].map((h, i) => (
                <span
                  key={i}
                  className="w-1 rounded-full transition-all duration-300"
                  style={{
                    height: isPlaying ? `${h}%` : '15%',
                    backgroundColor: themeColors.primary,
                    opacity: isPlaying ? 0.9 : 0.3,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Title, Artist, and Favorite */}
        <div className="w-full text-center mt-6">
          <div className="flex items-center justify-center gap-3">
            <h3 className="text-xl sm:text-2xl font-bold truncate max-w-md sm:max-w-xl">
              {activeMedia.title}
            </h3>
            <button
              onClick={() => toggleFavorite(activeMedia.id)}
              className="p-1 rounded-full hover:scale-110 transition-transform cursor-pointer"
            >
              <Heart
                className="w-5 h-5"
                fill={activeMedia.isFavorite ? '#EF4444' : 'none'}
                color={activeMedia.isFavorite ? '#EF4444' : 'currentColor'}
              />
            </button>
          </div>
          <p className="text-sm text-slate-400 mt-1 font-medium truncate">
            {activeMedia.artist || 'Unknown Artist'}
          </p>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="max-w-2xl w-full mx-auto space-y-4">
        {/* Scrubber */}
        <div className="space-y-1">
          <input
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
            onClick={previousTrack}
            className="p-3 rounded-full hover:bg-slate-700/20 hover:scale-110 transition-all cursor-pointer"
            title="Previous Track"
          >
            <SkipBack className="w-7 h-7" />
          </button>

          <button
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
            onClick={nextTrack}
            className="p-3 rounded-full hover:bg-slate-700/20 hover:scale-110 transition-all cursor-pointer"
            title="Next Track"
          >
            <SkipForward className="w-7 h-7" />
          </button>

          <button
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

        {/* Volume */}
        <div className="flex items-center justify-center gap-3 pt-2">
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
            className="w-36 h-1 rounded bg-slate-700/40 cursor-pointer"
            style={{ accentColor: themeColors.primary }}
          />
        </div>
      </div>
    </div>
  );
}
