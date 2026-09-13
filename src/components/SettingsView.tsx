import React from 'react';
import { Palette, Play, Volume2, Sun, HardDrive, RotateCcw, Check, Sparkles, Sliders } from 'lucide-react';
import { ThemePreset } from '../types';
import { THEME_PRESETS } from '../constants/theme';
import { usePlayer } from '../context/PlayerContext';
import { formatFileSize, formatTime } from '../utils/formatters';
import { INITIAL_MEDIA, INITIAL_PLAYLISTS } from '../data/sampleMedia';

export function SettingsView() {
  const { settings, updateSettings, themeColors, stats } = usePlayer();
  const isDark = settings.theme === 'dark';

  const handleResetSampleData = () => {
    if (confirm('Reset your media library and playlists to original sample media? Custom items will be lost.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div id="settings-view-container" className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight">Player Settings & Customization</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Tune playback preferences, audio-visual aesthetics, and manage local storage.
        </p>
      </div>

      {/* Theme Presets Section */}
      <section
        id="theme-presets-section"
        className="p-5 rounded-3xl border space-y-4"
        style={{
          backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
          borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
        }}
      >
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5 text-indigo-400" />
          <h3 className="font-bold text-sm">Theme Accent Colors (12 Styles)</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {Object.entries(THEME_PRESETS).map(([key, preset]) => {
            const isSelected = settings.themePreset === key;
            const displayName = key.charAt(0).toUpperCase() + key.slice(1);
            return (
              <button
                key={key}
                id={`theme-preset-${key}`}
                onClick={() => updateSettings({ themePreset: key as ThemePreset })}
                className="flex items-center gap-2.5 p-3 rounded-2xl border text-left transition-all hover:scale-[1.02] cursor-pointer"
                style={{
                  backgroundColor: isSelected
                    ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)')
                    : 'transparent',
                  borderColor: isSelected ? preset.primary : (isDark ? themeColors.borderDark : themeColors.borderLight),
                }}
              >
                <div
                  className="w-5 h-5 rounded-full shrink-0 shadow-sm flex items-center justify-center text-white"
                  style={{ backgroundColor: preset.primary }}
                >
                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <span className="text-xs font-semibold truncate">{displayName}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Playback Controls & Defaults */}
      <section
        id="playback-settings-section"
        className="p-5 rounded-3xl border space-y-5"
        style={{
          backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
          borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
        }}
      >
        <div className="flex items-center gap-2">
          <Sliders className="w-5 h-5 text-emerald-400" />
          <h3 className="font-bold text-sm">Playback Preferences</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Toggles */}
          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 rounded-2xl border cursor-pointer" style={{ borderColor: isDark ? themeColors.borderDark : themeColors.borderLight }}>
              <div>
                <p className="text-xs font-semibold">Auto-Play Next Media</p>
                <p className="text-[11px] text-slate-400">Advance to next track or video automatically</p>
              </div>
              <input
                type="checkbox"
                checked={settings.autoPlay}
                onChange={(e) => updateSettings({ autoPlay: e.target.checked })}
                className="w-4 h-4 rounded accent-indigo-500 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-2xl border cursor-pointer" style={{ borderColor: isDark ? themeColors.borderDark : themeColors.borderLight }}>
              <div>
                <p className="text-xs font-semibold">Remember Playback Position</p>
                <p className="text-[11px] text-slate-400">Resume video where you last paused</p>
              </div>
              <input
                type="checkbox"
                checked={settings.rememberPosition}
                onChange={(e) => updateSettings({ rememberPosition: e.target.checked })}
                className="w-4 h-4 rounded accent-indigo-500 cursor-pointer"
              />
            </label>
          </div>

          {/* Sliders and Modes */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-1">
                <span className="flex items-center gap-1.5"><Volume2 className="w-4 h-4 text-slate-400" /> Default Volume</span>
                <span>{Math.round(settings.defaultVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.defaultVolume}
                onChange={(e) => updateSettings({ defaultVolume: parseFloat(e.target.value) })}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-1">
                <span className="flex items-center gap-1.5"><Sun className="w-4 h-4 text-slate-400" /> Default Video Brightness</span>
                <span>{Math.round(settings.defaultBrightness * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.4"
                max="1.5"
                step="0.05"
                value={settings.defaultBrightness}
                onChange={(e) => updateSettings({ defaultBrightness: parseFloat(e.target.value) })}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Default Aspect Ratio Mode</label>
              <select
                value={settings.videoSizeMode}
                onChange={(e) => updateSettings({ videoSizeMode: e.target.value as any })}
                className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none cursor-pointer"
                style={{
                  backgroundColor: isDark ? '#1D2133' : '#F1F5F9',
                  borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
                }}
              >
                <option value="contain">Fit to Screen (Contain)</option>
                <option value="cover">Fill Screen (Crop/Cover)</option>
                <option value="fill">Stretch to Screen (Fill)</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Library Stats & Storage */}
      <section
        id="storage-stats-section"
        className="p-5 rounded-3xl border space-y-4"
        style={{
          backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
          borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
        }}
      >
        <div className="flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-sky-400" />
          <h3 className="font-bold text-sm">Library Statistics & Storage</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-2xl border text-center" style={{ borderColor: isDark ? themeColors.borderDark : themeColors.borderLight }}>
            <p className="text-xl font-bold">{stats.totalVideos}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Videos Loaded</p>
          </div>

          <div className="p-3 rounded-2xl border text-center" style={{ borderColor: isDark ? themeColors.borderDark : themeColors.borderLight }}>
            <p className="text-xl font-bold">{stats.totalAudio}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Audio Tracks</p>
          </div>

          <div className="p-3 rounded-2xl border text-center" style={{ borderColor: isDark ? themeColors.borderDark : themeColors.borderLight }}>
            <p className="text-xl font-bold">{formatFileSize(stats.totalSize)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Library Size</p>
          </div>

          <div className="p-3 rounded-2xl border text-center" style={{ borderColor: isDark ? themeColors.borderDark : themeColors.borderLight }}>
            <p className="text-xl font-bold">{formatTime(stats.totalWatchTime)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Total Watch/Listen Time</p>
          </div>
        </div>

        <div className="pt-3 border-t flex items-center justify-between flex-wrap gap-3" style={{ borderColor: isDark ? themeColors.borderDark : themeColors.borderLight }}>
          <p className="text-xs text-slate-400">
            Stored locally using HTML5 LocalStorage & Blob memory.
          </p>

          <button
            onClick={handleResetSampleData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-400 border border-rose-500/30 hover:bg-rose-500/10 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Default Sample Media</span>
          </button>
        </div>
      </section>
    </div>
  );
}
