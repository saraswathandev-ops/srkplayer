import React from 'react';
import { X } from 'lucide-react';
import { VideoItem } from '../types';
import { formatTime, formatFileSize } from '../utils/formatters';

interface VideoPropertiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  media: VideoItem;
  liveDimensions: { width: number; height: number } | null;
  currentTime: number;
  duration: number;
  decoderProfile: 'hw+' | 'hw' | 'sw';
}

export function VideoPropertiesModal({
  isOpen,
  onClose,
  media,
  liveDimensions,
  currentTime,
  duration,
  decoderProfile,
}: VideoPropertiesModalProps) {
  if (!isOpen) return null;

  const resolvedResolution =
    liveDimensions && liveDimensions.width > 0 && liveDimensions.height > 0
      ? `${liveDimensions.width} × ${liveDimensions.height}`
      : media.resolution || 'Auto';

  const rows: { label: string; value: string; mono?: boolean }[] = [
    { label: 'Title', value: media.title },
    { label: 'Folder', value: media.folder || 'Library' },
    { label: 'Resolution', value: resolvedResolution, mono: true },
    { label: 'Duration', value: formatTime(duration || media.duration), mono: true },
    { label: 'Position', value: formatTime(currentTime), mono: true },
    { label: 'File Size', value: media.size ? formatFileSize(media.size) : 'Stream', mono: true },
    { label: 'Bitrate', value: media.bitrate || 'Variable', mono: true },
    { label: 'Format', value: media.mimeType || 'video/mp4', mono: true },
    { label: 'Decoder Profile', value: decoderProfile.toUpperCase(), mono: true },
    { label: 'Play Count', value: `${media.playCount || 0}`, mono: true },
    { label: 'Date Added', value: new Date(media.dateAdded).toLocaleDateString(), mono: true },
  ];

  return (
    <div
      id="video-properties-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        id="video-properties-modal"
        className="w-full max-w-md bg-slate-950/95 backdrop-blur-2xl border border-white/12 rounded-3xl p-5 sm:p-6 shadow-2xl text-slate-100 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/10">
          <div>
            <h3 className="text-base font-semibold text-white">Media Properties</h3>
            <p className="text-xs text-slate-400">Stream and file specifications</p>
          </div>
          <button
            type="button"
            id="close-properties-modal-btn"
            onClick={onClose}
            aria-label="Close Properties"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <dl className="divide-y divide-white/[0.07]">
          {rows.map((row) => (
            <div key={row.label} className="py-2.5 flex items-center justify-between gap-4 text-xs">
              <dt className="text-slate-400 shrink-0">{row.label}</dt>
              <dd
                className={`text-slate-100 text-right truncate ${
                  row.mono ? 'font-mono tabular-nums' : 'font-medium'
                }`}
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
