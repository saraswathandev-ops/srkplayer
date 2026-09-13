import React from 'react';
import { Film, Music, ListMusic, Settings, Trash2 } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

interface TabBarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function TabBar({ activeTab, setActiveTab }: TabBarProps) {
  const { settings, themeColors, mediaList, recycleBin } = usePlayer();
  const isDark = settings.theme === 'dark';

  const videoCount = mediaList.filter((m) => m.mediaType === 'video').length;
  const audioCount = mediaList.filter((m) => m.mediaType === 'audio').length;

  const tabs = [
    { id: 'videos', label: 'Videos', icon: Film, badge: videoCount },
    { id: 'audio', label: 'Music', icon: Music, badge: audioCount },
    { id: 'playlists', label: 'Playlists', icon: ListMusic },
    { id: 'recycle-bin', label: 'Recycle Bin', icon: Trash2, badge: recycleBin.length },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav
      id="main-tab-bar"
      aria-label="Main Navigation"
      className="border-b transition-colors select-none"
      style={{
        backgroundColor: isDark ? 'rgba(15, 18, 28, 0.6)' : 'rgba(245, 247, 250, 0.8)',
        borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-start gap-1 sm:gap-3 overflow-x-auto py-2 scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap"
              style={{
                backgroundColor: isActive
                  ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)')
                  : 'transparent',
                color: isActive ? themeColors.primary : isDark ? '#94A3B8' : '#64748B',
                boxShadow: isActive ? `inset 0 -2px 0 ${themeColors.primary}` : 'none',
              }}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span
                  className="px-1.5 py-0.2 text-[10px] rounded-full font-bold"
                  style={{
                    backgroundColor: isActive ? themeColors.primary : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                    color: isActive ? '#FFFFFF' : isDark ? '#CBD5E1' : '#475569',
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
