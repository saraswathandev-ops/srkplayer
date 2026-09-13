import React from 'react';
import { Play, Globe, Upload, Moon, Sun, Search, Trash2 } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

interface NavbarProps {
  onOpenStream: () => void;
  onOpenImport: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeTab: string;
  setActiveTab: (t: string) => void;
}

export function Navbar({
  onOpenStream,
  onOpenImport,
  searchQuery,
  onSearchChange,
  activeTab,
  setActiveTab,
}: NavbarProps) {
  const { settings, updateSettings, themeColors, recycleBin } = usePlayer();
  const isDark = settings.theme === 'dark';

  return (
    <header
      id="skr-navbar"
      className="sticky top-0 z-30 border-b backdrop-blur-md transition-colors duration-200"
      style={{
        backgroundColor: isDark ? 'rgba(12, 14, 22, 0.85)' : 'rgba(255, 255, 255, 0.85)',
        borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo & Brand */}
        <div
          id="navbar-brand"
          className="flex items-center gap-3 cursor-pointer select-none"
          onClick={() => setActiveTab('videos')}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg font-black text-white"
            style={{
              background: `linear-gradient(135deg, ${themeColors.primary}, ${themeColors.primaryDark})`,
              boxShadow: `0 4px 14px ${themeColors.primary}40`,
            }}
          >
            <Play className="w-5 h-5 fill-white ml-0.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg tracking-tight">SKR Player</span>
              <span
                className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded text-white"
                style={{ backgroundColor: themeColors.primary }}
              >
                PRO
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium hidden sm:block">Offline & Stream Media Center</p>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="flex-1 max-w-md hidden md:block">
          <div
            className="relative flex items-center rounded-xl border transition-all"
            style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
              borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
            }}
          >
            <Search className="w-4 h-4 ml-3 text-slate-400 pointer-events-none" />
            <input
              id="navbar-search-input"
              type="text"
              placeholder="Search videos, music, artists, folders..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-transparent px-3 py-2 text-sm focus:outline-none placeholder-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="mr-3 text-xs text-slate-400 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            id="navbar-stream-btn"
            onClick={onOpenStream}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:opacity-90 cursor-pointer"
            style={{
              borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
            }}
            title="Play Network URL"
          >
            <Globe className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Stream URL</span>
          </button>

          <button
            id="navbar-import-btn"
            onClick={onOpenImport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white shadow-sm transition-opacity hover:opacity-95 cursor-pointer"
            style={{
              backgroundColor: themeColors.primary,
            }}
            title="Import Local Media"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Import Media</span>
          </button>

          {recycleBin.length > 0 && (
            <button
              id="navbar-bin-btn"
              onClick={() => setActiveTab('recycle-bin')}
              className="relative p-2 rounded-lg border transition-colors cursor-pointer"
              style={{
                borderColor: activeTab === 'recycle-bin' ? themeColors.primary : (isDark ? themeColors.borderDark : themeColors.borderLight),
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
              }}
              title="Recycle Bin"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-[10px] text-white flex items-center justify-center font-bold">
                {recycleBin.length}
              </span>
            </button>
          )}

          <button
            id="navbar-theme-toggle"
            onClick={() => updateSettings({ theme: isDark ? 'light' : 'dark' })}
            className="p-2 rounded-lg border transition-colors hover:opacity-80 cursor-pointer"
            style={{
              borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
            }}
            title="Toggle Light/Dark Theme"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>
        </div>
      </div>

      {/* Mobile search bar */}
      <div className="px-4 pb-3 md:hidden">
        <div
          className="relative flex items-center rounded-xl border"
          style={{
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
            borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
          }}
        >
          <Search className="w-4 h-4 ml-3 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search all media..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-transparent px-3 py-1.5 text-sm focus:outline-none placeholder-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="mr-3 text-xs text-slate-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
