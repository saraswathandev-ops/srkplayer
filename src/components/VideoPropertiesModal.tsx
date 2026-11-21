import React, { useEffect, useState } from 'react';
import { X, Cpu, PlayCircle } from 'lucide-react';
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
  autoPlayNext: boolean;
  onToggleAutoPlayNext: (enabled: boolean) => void;
  autoNextCountdownSeconds: number;
  onChangeAutoNextCountdown: (seconds: number) => void;
}

interface PropertyRow {
  label: string;
  value: string;
  mono?: boolean;
  accent?: 'emerald' | 'amber' | 'sky';
}

function resolveCodecLabel(media: VideoItem): string {
  const uriLower = (media.uri || '').toLowerCase();
  const mime = (media.mimeType || '').toLowerCase();
  if (uriLower.includes('.m3u8') || mime.includes('mpegurl')) {
    return 'HLS / H.264 (m3u8)';
  }
  if (mime.includes('webm') || uriLower.endsWith('.webm')) {
    return 'VP9 / WebM';
  }
  if (mime.includes('matroska') || uriLower.endsWith('.mkv')) {
    return 'H.264 / MKV';
  }
  if (mime.includes('hevc') || mime.includes('h265')) {
    return 'HEVC / H.265';
  }
  return `H.264 / AVC (${media.mimeType || 'video/mp4'})`;
}

function resolveStreamBitrate(media: VideoItem, totalSeconds: number): string {
  if (media.bitrate && media.bitrate.trim()) {
    return media.bitrate;
  }
  if (media.size && media.size > 0 && totalSeconds > 0) {
    const bitsPerSec = (media.size * 8) / totalSeconds;
    if (bitsPerSec >= 1_000_000) {
      return `${(bitsPerSec / 1_000_000).toFixed(1)} Mbps (Est.)`;
    }
    return `${Math.round(bitsPerSec / 1000)} kbps (Est.)`;
  }
  return 'Adaptive (VBR)';
}

function getDecodingMethodLabel(profile: 'hw+' | 'hw' | 'sw'): string {
  if (profile === 'hw+') return 'HW+ (Extended Hardware)';
  if (profile === 'hw') return 'HW (Standard Hardware)';
  return 'SW (Software Decoder)';
}

export function VideoPropertiesModal({
  isOpen,
  onClose,
  media,
  liveDimensions,
  currentTime,
  duration,
  decoderProfile,
  autoPlayNext,
  onToggleAutoPlayNext,
  autoNextCountdownSeconds,
  onChangeAutoNextCountdown,
}: VideoPropertiesModalProps) {
  const [hwCapable, setHwCapable] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (decoderProfile === 'sw') {
      setHwCapable(false);
      return;
    }

    let cancelled = false;
    const width = liveDimensions?.width || 1280;
    const height = liveDimensions?.height || 720;
    const contentType =
      media.mimeType && media.mimeType.includes('codecs=')
        ? media.mimeType
        : `${media.mimeType || 'video/mp4'}; codecs="avc1.42E01E"`;

    if (typeof navigator !== 'undefined' && navigator.mediaCapabilities?.decodingInfo) {
      navigator.mediaCapabilities
        .decodingInfo({
          type: 'file',
          video: {
            contentType,
            width,
            height,
            bitrate: 4_000_000,
            framerate: 30,
          },
        })
        .then((info) => {
          if (!cancelled) {
            setHwCapable(Boolean(info.supported && info.powerEfficient));
          }
        })
        .catch(() => {
          if (!cancelled) {
            setHwCapable(true);
          }
        });
    } else {
      setHwCapable(true);
    }

    return () => {
      cancelled = true;
    };
  }, [isOpen, decoderProfile, liveDimensions?.width, liveDimensions?.height, media.mimeType]);

  if (!isOpen) return null;

  const effectiveDuration = duration || media.duration;
  const resolvedResolution =
    liveDimensions && liveDimensions.width > 0 && liveDimensions.height > 0
      ? `${liveDimensions.width} × ${liveDimensions.height}`
      : media.resolution || 'Auto';

  const generalRows: PropertyRow[] = [
    { label: 'Title', value: media.title },
    { label: 'Folder', value: media.folder || 'Library' },
    { label: 'Resolution', value: resolvedResolution, mono: true },
    { label: 'Duration', value: formatTime(effectiveDuration), mono: true },
    { label: 'Position', value: formatTime(currentTime), mono: true },
    { label: 'File Size', value: media.size ? formatFileSize(media.size) : 'Stream', mono: true },
    { label: 'Play Count', value: `${media.playCount || 0}`, mono: true },
    { label: 'Date Added', value: new Date(media.dateAdded).toLocaleDateString(), mono: true },
  ];

  const hwAccelStatus =
    decoderProfile === 'sw'
      ? 'Disabled (Software Fallback)'
      : hwCapable === false
      ? 'Software Assisted'
      : 'Active (GPU Accelerated)';

  const hardwareCodecRows: PropertyRow[] = [
    { label: 'Stream Bitrate', value: resolveStreamBitrate(media, effectiveDuration), mono: true },
    { label: 'Codec / Container', value: resolveCodecLabel(media), mono: true },
    { label: 'Decoding Method', value: getDecodingMethodLabel(decoderProfile), mono: true },
    {
      label: 'Hardware Acceleration',
      value: hwAccelStatus,
      accent: decoderProfile === 'sw' ? 'amber' : 'emerald',
    },
  ];

  const getValueColor = (accent?: PropertyRow['accent']) => {
    if (accent === 'emerald') return 'text-emerald-300';
    if (accent === 'amber') return 'text-amber-300';
    if (accent === 'sky') return 'text-sky-300';
    return 'text-slate-100';
  };

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
        className="w-full max-w-md max-h-[85vh] overflow-y-auto bg-slate-950/95 backdrop-blur-2xl border border-white/12 rounded-3xl p-5 sm:p-6 shadow-2xl text-slate-100 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
          <div>
            <h3 className="text-base font-semibold text-white">Media Properties</h3>
            <p className="text-xs text-slate-400">Stream, file, and decoder specifications</p>
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
          {generalRows.map((row) => (
            <div key={row.label} className="py-2 flex items-center justify-between gap-4 text-xs">
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

        {/* Hardware/Codec Section */}
        <div id="video-properties-hardware-section" className="mt-4 pt-3.5 border-t border-white/12">
          <div className="flex items-center gap-2 mb-1.5">
            <Cpu className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Hardware/Codec
            </h4>
          </div>

          <dl className="divide-y divide-white/[0.07]">
            {hardwareCodecRows.map((row) => (
              <div key={row.label} className="py-2 flex items-center justify-between gap-4 text-xs">
                <dt className="text-slate-400 shrink-0">{row.label}</dt>
                <dd
                  className={`text-right truncate ${getValueColor(row.accent)} ${
                    row.mono ? 'font-mono tabular-nums' : 'font-medium'
                  }`}
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        {/* Playback & Auto-Next Section */}
        <div id="video-properties-autonext-section" className="mt-4 pt-3.5 border-t border-white/12 space-y-3">
          <div className="flex items-center gap-2">
            <PlayCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Playback & Auto-Next
            </h4>
          </div>

          <div className="flex items-center justify-between gap-3 py-1">
            <div>
              <div className="text-xs font-medium text-white">Auto-Next</div>
              <p className="text-[11px] text-slate-400">
                Show countdown and play next queued video
              </p>
            </div>
            <button
              type="button"
              id="properties-autonext-toggle"
              role="switch"
              aria-checked={autoPlayNext}
              onClick={() => onToggleAutoPlayNext(!autoPlayNext)}
              className={`w-10 h-5 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
                autoPlayNext ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  autoPlayNext ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className={`space-y-1.5 transition-opacity ${autoPlayNext ? 'opacity-100' : 'opacity-45'}`}>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Countdown Duration</span>
              <span className="font-mono tabular-nums font-semibold text-white">
                {autoNextCountdownSeconds}s
              </span>
            </div>
            <input
              id="properties-autonext-slider"
              type="range"
              min="1"
              max="15"
              step="1"
              disabled={!autoPlayNext}
              value={autoNextCountdownSeconds}
              onChange={(e) => onChangeAutoNextCountdown(parseInt(e.target.value, 10))}
              className="w-full h-1.5 rounded-lg bg-white/15 accent-emerald-400 cursor-pointer disabled:cursor-not-allowed"
            />
            <div className="flex justify-between text-[10px] font-mono tabular-nums text-slate-500">
              <span>1s</span>
              <span>5s default</span>
              <span>15s</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
