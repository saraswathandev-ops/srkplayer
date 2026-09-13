import React, { useState } from 'react';
import { X, Globe, Play, Plus, Radio, Sparkles } from 'lucide-react';
import { MediaType, VideoItem } from '../types';
import { PRESET_STREAM_URLS } from '../data/sampleMedia';
import { usePlayer } from '../context/PlayerContext';

interface NetworkStreamModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NetworkStreamModal({ isOpen, onClose }: NetworkStreamModalProps) {
  const { playMedia, addCustomMedia, settings, themeColors } = usePlayer();
  const [streamUrl, setStreamUrl] = useState('');
  const [title, setTitle] = useState('');
  const [mediaType, setMediaType] = useState<MediaType>('video');

  const isDark = settings.theme === 'dark';

  if (!isOpen) return null;

  const handlePlayNow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!streamUrl.trim()) return;

    const detectedTitle = title.trim() || `Stream ${new Date().toLocaleTimeString()}`;
    const item: Omit<VideoItem, 'id' | 'playCount' | 'isFavorite' | 'dateAdded'> = {
      title: detectedTitle,
      uri: streamUrl.trim(),
      duration: 0,
      size: 0,
      folder: 'Streams',
      mediaType,
      thumbnail: mediaType === 'video'
        ? 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80'
        : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
    };

    const saved = addCustomMedia(item);
    playMedia(saved, [saved], mediaType === 'video');
    onClose();
  };

  const handleSelectPreset = (preset: typeof PRESET_STREAM_URLS[0]) => {
    setStreamUrl(preset.url);
    setTitle(preset.title);
    setMediaType(preset.type);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{
          backgroundColor: isDark ? '#151824' : '#FFFFFF',
          borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
        }}
      >
        {/* Header */}
        <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: isDark ? themeColors.borderDark : themeColors.borderLight }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: themeColors.primary }}>
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Network Stream</h3>
              <p className="text-xs text-slate-400">Play any direct video or audio stream URL</p>
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
        <div className="p-5 space-y-4 overflow-y-auto">
          <form onSubmit={handlePlayNow} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Stream URL (HTTP/HTTPS)</label>
              <input
                type="url"
                required
                placeholder="https://example.com/stream.mp4 or .m3u8"
                value={streamUrl}
                onChange={(e) => setStreamUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none"
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                  borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Title (Optional)</label>
                <input
                  type="text"
                  placeholder="My Stream"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
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
                  <option value="video">Video Stream</option>
                  <option value="audio">Audio Stream</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={!streamUrl.trim()}
              className="w-full py-2.5 rounded-xl text-xs font-semibold text-white shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              style={{ backgroundColor: themeColors.primary }}
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Start Playback</span>
            </button>
          </form>

          {/* Quick presets */}
          <div className="pt-2 border-t" style={{ borderColor: isDark ? themeColors.borderDark : themeColors.borderLight }}>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Preset Test Streams
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESET_STREAM_URLS.map((preset) => (
                <button
                  key={preset.title}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className="p-2.5 rounded-xl border text-left text-xs font-medium hover:bg-slate-700/20 transition-all flex items-center justify-between cursor-pointer"
                  style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
                  }}
                >
                  <span className="truncate pr-2">{preset.title}</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] uppercase font-bold bg-slate-800 text-slate-300">
                    {preset.type}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
