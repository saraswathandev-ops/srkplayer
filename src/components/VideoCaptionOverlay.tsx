import React from 'react';
import { CaptionCue, SubtitleSettings } from '../types';

interface VideoCaptionOverlayProps {
  cue: CaptionCue | null;
  settings: SubtitleSettings;
  controlsVisible: boolean;
}

export function VideoCaptionOverlay({ cue, settings, controlsVisible }: VideoCaptionOverlayProps) {
  if (!settings.enabled || !cue) return null;

  const fontClass =
    settings.fontSize === 'small'
      ? 'text-xs sm:text-sm'
      : settings.fontSize === 'large'
      ? 'text-base sm:text-lg md:text-xl font-bold'
      : 'text-sm sm:text-base font-semibold';

  const bottomOffset = controlsVisible ? 'bottom-24 sm:bottom-28' : 'bottom-8 sm:bottom-12';

  return (
    <div
      id="video-caption-overlay"
      className={`absolute left-0 right-0 ${bottomOffset} flex flex-col items-center justify-center px-4 sm:px-8 pointer-events-none transition-all duration-200 z-30`}
    >
      <div
        className="max-w-3xl text-center px-4 py-2 rounded-2xl backdrop-blur-xs shadow-2xl transition-all"
        style={{
          backgroundColor: `rgba(0, 0, 0, ${settings.backgroundOpacity})`,
          border: '1px solid rgba(255, 255, 255, 0.12)',
        }}
      >
        {/* Speaker Name Tag */}
        {cue.speaker && (
          <span className="block text-[11px] font-bold text-amber-300 uppercase tracking-wider mb-0.5">
            {cue.speaker}
          </span>
        )}

        {/* Dual Mode: Native script on top, English translation underneath */}
        {settings.languageMode === 'dual' && cue.textNative ? (
          <div className="space-y-1">
            <p
              className={`${fontClass} leading-snug drop-shadow-md text-amber-200`}
              style={{ color: '#FDE047' }}
            >
              {cue.textNative}
            </p>
            <p className={`${fontClass} leading-snug drop-shadow-md text-white font-medium`}>
              {cue.textEnglish}
            </p>
          </div>
        ) : settings.languageMode === 'native' && cue.textNative ? (
          /* Native Only */
          <p
            className={`${fontClass} leading-snug drop-shadow-md text-amber-200`}
            style={{ color: '#FEF08A' }}
          >
            {cue.textNative}
          </p>
        ) : (
          /* English (Default) */
          <p className={`${fontClass} leading-snug drop-shadow-md text-white`}>
            {cue.textEnglish}
          </p>
        )}
      </div>
    </div>
  );
}
