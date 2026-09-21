import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Maximize2,
  X,
  GripVertical,
  Music,
  Gauge,
  CornerDownRight,
  CornerDownLeft,
  CornerUpRight,
  CornerUpLeft,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { formatTime } from '../utils/formatters';

const PIP_AUDIO_DIMENSIONS: Record<'sm' | 'md' | 'lg', { width: number; height: number }> = {
  sm: { width: 280, height: 160 },
  md: { width: 340, height: 180 },
  lg: { width: 420, height: 210 },
};

const SPEED_OPTIONS = [1, 1.25, 1.5, 2];

export function FloatingAudioPip() {
  const {
    activeMedia,
    isFloatingPipOpen,
    isAudioModalOpen,
    isPlaying,
    togglePlay,
    currentTime,
    duration,
    seek,
    volume,
    setVolume,
    isMuted,
    toggleMute,
    playbackRate,
    setPlaybackRate,
    nextTrack,
    previousTrack,
    themeColors,
    pipPosition,
    setPipPosition,
    pipSize,
    setPipSize,
    expandPipToModal,
    closeFloatingPip,
    settings,
    showToast,
  } = usePlayer();

  const isDark = settings.theme === 'dark';
  const [showCornerMenu, setShowCornerMenu] = useState(false);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, pipX: 0, pipY: 0 });

  // Only render if floating PiP is open and audio is active, and modal isn't open
  if (!isFloatingPipOpen || !activeMedia || activeMedia.mediaType !== 'audio' || isAudioModalOpen) {
    return null;
  }

  const { width, height } = PIP_AUDIO_DIMENSIONS[pipSize];

  // Drag handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    isDraggingRef.current = true;
    const currentX = pipPosition ? pipPosition.x : window.innerWidth - width - 24;
    const currentY = pipPosition ? pipPosition.y : window.innerHeight - height - 100;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      pipX: currentX,
      pipY: currentY,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    e.stopPropagation();
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const newX = Math.max(12, Math.min(window.innerWidth - width - 12, dragStartRef.current.pipX + dx));
    const newY = Math.max(12, Math.min(window.innerHeight - height - 12, dragStartRef.current.pipY + dy));
    setPipPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {}
    }
  };

  const snapToCorner = (corner: 'br' | 'bl' | 'tr' | 'tl') => {
    const pad = 20;
    const bottomPad = 96; // keep above bottom player bar
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let newX = vw - width - pad;
    let newY = vh - height - bottomPad;

    if (corner === 'bl') {
      newX = pad;
      newY = vh - height - bottomPad;
    } else if (corner === 'tr') {
      newX = vw - width - pad;
      newY = pad + 64;
    } else if (corner === 'tl') {
      newX = pad;
      newY = pad + 64;
    }

    setPipPosition({ x: Math.max(12, Math.min(newX, vw - width - 12)), y: Math.max(12, Math.min(newY, vh - height - 12)) });
    setShowCornerMenu(false);
  };

  const cycleSpeed = () => {
    const currentIndex = SPEED_OPTIONS.findIndex((s) => Math.abs(s - playbackRate) < 0.05);
    const nextIndex = (currentIndex + 1) % SPEED_OPTIONS.length;
    const nextSpeed = SPEED_OPTIONS[nextIndex];
    setPlaybackRate(nextSpeed);
    showToast(`Speed: ${nextSpeed}x`);
  };

  const cycleSize = () => {
    const sizes: ('sm' | 'md' | 'lg')[] = ['sm', 'md', 'lg'];
    const next = sizes[(sizes.indexOf(pipSize) + 1) % sizes.length];
    setPipSize(next);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      id="floating-audio-pip-window"
      className="fixed z-40 rounded-2xl shadow-2xl border flex flex-col justify-between overflow-hidden select-none transition-shadow duration-200"
      style={{
        left: pipPosition ? `${pipPosition.x}px` : undefined,
        top: pipPosition ? `${pipPosition.y}px` : undefined,
        right: pipPosition ? undefined : '24px',
        bottom: pipPosition ? undefined : '100px',
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.96)',
        borderColor: isDark ? 'rgba(51, 65, 85, 0.7)' : 'rgba(203, 213, 225, 0.9)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 20px 35px -8px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
      }}
    >
      {/* Drag Handle & Top Header Bar */}
      <div
        id="audio-pip-drag-header"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="flex items-center justify-between px-2.5 py-1.5 border-b cursor-grab active:cursor-grabbing shrink-0"
        style={{
          borderColor: isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.8)',
          backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : 'rgba(241, 245, 249, 0.7)',
        }}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2 pointer-events-none">
          <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span
            className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-white shrink-0"
            style={{ backgroundColor: themeColors.primary }}
          >
            Audio PiP
          </span>
          <span className="text-xs font-semibold truncate text-slate-200">
            {activeMedia.title}
          </span>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Snap Corner Button */}
          <div className="relative">
            <button
              id="audio-pip-dock-btn"
              onClick={() => setShowCornerMenu(!showCornerMenu)}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/40 transition-colors cursor-pointer"
              title="Snap to Corner"
            >
              <CornerDownRight className="w-3.5 h-3.5" />
            </button>

            {showCornerMenu && (
              <div
                className="absolute right-0 top-full mt-1 p-1 rounded-xl shadow-xl border flex gap-1 z-50 bg-slate-900 border-slate-700"
              >
                <button
                  onClick={() => snapToCorner('tl')}
                  className="p-1 rounded hover:bg-slate-800 text-slate-300"
                  title="Top Left"
                >
                  <CornerUpLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => snapToCorner('tr')}
                  className="p-1 rounded hover:bg-slate-800 text-slate-300"
                  title="Top Right"
                >
                  <CornerUpRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => snapToCorner('bl')}
                  className="p-1 rounded hover:bg-slate-800 text-slate-300"
                  title="Bottom Left"
                >
                  <CornerDownLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => snapToCorner('br')}
                  className="p-1 rounded hover:bg-slate-800 text-slate-300"
                  title="Bottom Right"
                >
                  <CornerDownRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Size toggle */}
          <button
            id="audio-pip-size-toggle"
            onClick={cycleSize}
            className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-slate-300 hover:text-white hover:bg-slate-700/40 transition-colors cursor-pointer"
            title="Toggle Window Size (SM / MD / LG)"
          >
            {pipSize.toUpperCase()}
          </button>

          {/* Expand to full modal */}
          <button
            id="audio-pip-expand-btn"
            onClick={expandPipToModal}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/40 transition-colors cursor-pointer"
            title="Expand to Full Audio Player"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {/* Close button */}
          <button
            id="audio-pip-close-btn"
            onClick={() => closeFloatingPip(false)}
            className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
            title="Close Floating Window"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex items-center gap-3 px-3 py-1 flex-1 min-h-0">
        {/* Vinyl / Cover Art */}
        <div
          onClick={expandPipToModal}
          className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden shrink-0 shadow-md border border-slate-700/40 flex items-center justify-center cursor-pointer group"
          style={{
            background: `linear-gradient(135deg, ${themeColors.primary}30, #0f172a)`,
          }}
        >
          {activeMedia.thumbnail ? (
            <img
              src={activeMedia.thumbnail}
              alt={activeMedia.title}
              className={`w-full h-full object-cover transition-transform duration-700 ${
                isPlaying ? 'scale-105' : ''
              }`}
            />
          ) : (
            <div className={`flex items-center justify-center ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '8s' }}>
              <Music className="w-6 h-6" style={{ color: themeColors.primary }} />
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <Maximize2 className="w-4 h-4 text-white" />
          </div>
        </div>

        {/* Track Title & Artist & Animated Equalizer Waves */}
        <div className="flex-1 min-w-0">
          <h4
            onClick={expandPipToModal}
            className="text-xs sm:text-sm font-bold truncate text-slate-100 cursor-pointer hover:underline"
            title={activeMedia.title}
          >
            {activeMedia.title}
          </h4>
          <p className="text-[11px] text-slate-400 truncate">
            {activeMedia.artist || activeMedia.album || activeMedia.folder}
          </p>

          {/* Animated visualizer waves */}
          <div className="flex items-center gap-1 mt-1.5 h-3">
            {[40, 75, 100, 60, 90, 45].map((heightPct, idx) => (
              <span
                key={idx}
                className="w-1 rounded-full transition-all duration-150"
                style={{
                  height: isPlaying ? `${Math.max(20, (heightPct * (0.4 + ((currentTime * (idx + 1)) % 1))))}%` : '20%',
                  backgroundColor: themeColors.primary,
                }}
              />
            ))}
            <span className="text-[10px] text-slate-400 font-mono ml-2">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Controls Strip */}
      <div className="px-3 pb-2 pt-0.5 flex flex-col gap-1.5 shrink-0">
        {/* Progress scrub bar */}
        <div
          id="audio-pip-scrub-bar"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickPos = (e.clientX - rect.left) / rect.width;
            seek(clickPos * duration);
          }}
          className="relative w-full h-1.5 bg-slate-700/50 hover:h-2 rounded-full cursor-pointer transition-all overflow-hidden"
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${progressPercent}%`,
              backgroundColor: themeColors.primary,
            }}
          />
        </div>

        {/* Media Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {/* Speed Badge */}
            <button
              id="audio-pip-speed-btn"
              onClick={cycleSpeed}
              className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 transition-colors cursor-pointer"
              title="Cycle Speed (1x, 1.25x, 1.5x, 2x)"
            >
              {playbackRate}x
            </button>

            {/* Mute button */}
            <button
              id="audio-pip-mute-btn"
              onClick={toggleMute}
              className="p-1 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Center Playback Controls */}
          <div className="flex items-center gap-2">
            <button
              id="audio-pip-prev-btn"
              onClick={previousTrack}
              className="p-1 rounded-full text-slate-300 hover:text-white hover:bg-slate-700/30 transition-colors cursor-pointer"
              title="Previous track"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>

            <button
              id="audio-pip-rewind-btn"
              onClick={() => seek(Math.max(0, currentTime - 10))}
              className="p-1 rounded-full text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Rewind 10s"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Play/Pause */}
            <button
              id="audio-pip-play-btn"
              onClick={togglePlay}
              className="w-7 h-7 rounded-full flex items-center justify-center text-white shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
              style={{
                backgroundColor: themeColors.primary,
              }}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 fill-white" /> : <Play className="w-3.5 h-3.5 fill-white ml-0.5" />}
            </button>

            <button
              id="audio-pip-forward-btn"
              onClick={() => seek(Math.min(duration, currentTime + 10))}
              className="p-1 rounded-full text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Forward 10s"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>

            <button
              id="audio-pip-next-btn"
              onClick={nextTrack}
              className="p-1 rounded-full text-slate-300 hover:text-white hover:bg-slate-700/30 transition-colors cursor-pointer"
              title="Next track"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Expand to Modal */}
          <button
            id="audio-pip-bottom-expand-btn"
            onClick={expandPipToModal}
            className="text-[10px] font-semibold text-slate-400 hover:text-white flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-700/30 transition-colors cursor-pointer"
            title="Expand to Full Player"
          >
            <span>Full</span>
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
