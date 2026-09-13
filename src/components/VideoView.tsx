import React, { useState, useMemo } from 'react';
import { LayoutGrid, List, ArrowUpDown, Folder, Play, Clock, Sparkles } from 'lucide-react';
import { VideoItem, SortMode, ViewMode } from '../types';
import { VideoCard } from './VideoCard';
import { usePlayer } from '../context/PlayerContext';
import { formatTime } from '../utils/formatters';

interface VideoViewProps {
  searchQuery: string;
}

export function VideoView({ searchQuery }: VideoViewProps) {
  const { mediaList, playMedia, settings, themeColors } = usePlayer();
  const [activeFolder, setActiveFolder] = useState<string>('all');
  const [sortMode, setSortMode] = useState<SortMode>('date');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const isDark = settings.theme === 'dark';

  const allVideos = useMemo(() => {
    return mediaList.filter((m) => m.mediaType === 'video');
  }, [mediaList]);

  // Distinct folders
  const folders = useMemo(() => {
    const map = new Map<string, number>();
    allVideos.forEach((v) => {
      const f = v.folder || 'Other';
      map.set(f, (map.get(f) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [allVideos]);

  // Continue watching list (items with lastPosition > 0 and watched recently)
  const continueWatching = useMemo(() => {
    return allVideos
      .filter((v) => v.lastPosition && v.lastPosition > 5 && v.lastPosition < (v.duration - 15))
      .sort((a, b) => (b.watchedAt || 0) - (a.watchedAt || 0))
      .slice(0, 6);
  }, [allVideos]);

  // Filtered and sorted videos
  const filteredVideos = useMemo(() => {
    let list = allVideos;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.folder.toLowerCase().includes(q) ||
          (v.resolution && v.resolution.toLowerCase().includes(q))
      );
    }

    // Folder filter
    if (activeFolder !== 'all') {
      list = list.filter((v) => v.folder === activeFolder);
    }

    // Sorting
    return [...list].sort((a, b) => {
      if (sortMode === 'name') return a.title.localeCompare(b.title);
      if (sortMode === 'size') return b.size - a.size;
      if (sortMode === 'duration') return b.duration - a.duration;
      return b.dateAdded - a.dateAdded; // default: date
    });
  }, [allVideos, searchQuery, activeFolder, sortMode]);

  return (
    <div id="video-view-container" className="space-y-6">
      {/* Continue Watching Section */}
      {!searchQuery && activeFolder === 'all' && continueWatching.length > 0 && (
        <section id="continue-watching-section" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              Continue Watching
            </h2>
            <span className="text-xs text-slate-400 font-medium">{continueWatching.length} in progress</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {continueWatching.map((item) => {
              const progress = Math.min(100, Math.round(((item.lastPosition || 0) / item.duration) * 100));
              return (
                <div
                  key={`cw-${item.id}`}
                  onClick={() => playMedia(item, allVideos, true)}
                  className="group flex items-center gap-3 p-2.5 rounded-2xl border transition-all cursor-pointer hover:shadow-md"
                  style={{
                    backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
                    borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
                  }}
                >
                  <div className="relative w-24 h-16 rounded-xl overflow-hidden shrink-0 bg-slate-900">
                    <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 flex items-center justify-center">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white"
                        style={{ backgroundColor: themeColors.primary }}
                      >
                        <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                      <div className="h-full" style={{ width: `${progress}%`, backgroundColor: themeColors.primary }} />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-xs sm:text-sm truncate group-hover:underline">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Left off at {formatTime(item.lastPosition)} ({progress}%)
                    </p>
                    <span className="inline-block mt-1 px-1.5 py-0.2 text-[10px] rounded font-medium bg-slate-800 text-slate-300">
                      {item.folder}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Folder Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setActiveFolder('all')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer"
          style={{
            backgroundColor: activeFolder === 'all' ? themeColors.primary : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
            color: activeFolder === 'all' ? '#FFFFFF' : undefined,
          }}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>All Videos ({allVideos.length})</span>
        </button>

        {folders.map((f) => (
          <button
            key={f.name}
            onClick={() => setActiveFolder(f.name)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer"
            style={{
              backgroundColor: activeFolder === f.name ? themeColors.primary : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
              color: activeFolder === f.name ? '#FFFFFF' : undefined,
            }}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>{f.name} ({f.count})</span>
          </button>
        ))}
      </div>

      {/* Control Bar: Total Count + Sort & View Toggles */}
      <div className="flex items-center justify-between gap-3 text-xs flex-wrap">
        <span className="text-slate-400 font-medium">
          Showing {filteredVideos.length} {filteredVideos.length === 1 ? 'video' : 'videos'}
          {activeFolder !== 'all' && ` in ${activeFolder}`}
        </span>

        <div className="flex items-center gap-2">
          {/* Sort Selector */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium"
            style={{
              backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
              borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
            }}
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="date" className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-black'}>Sort by Date</option>
              <option value="name" className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-black'}>Sort by Name</option>
              <option value="size" className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-black'}>Sort by Size</option>
              <option value="duration" className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-black'}>Sort by Duration</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div
            className="flex items-center p-1 rounded-xl border"
            style={{
              backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
              borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
            }}
          >
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${viewMode === 'grid' ? 'text-white' : 'text-slate-400 hover:text-white'}`}
              style={{ backgroundColor: viewMode === 'grid' ? themeColors.primary : 'transparent' }}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${viewMode === 'list' ? 'text-white' : 'text-slate-400 hover:text-white'}`}
              style={{ backgroundColor: viewMode === 'list' ? themeColors.primary : 'transparent' }}
              title="List View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Videos List / Grid */}
      {filteredVideos.length === 0 ? (
        <div
          className="text-center py-16 px-4 rounded-3xl border"
          style={{
            backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
            borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
          }}
        >
          <Folder className="w-12 h-12 mx-auto text-slate-500 mb-3 opacity-60" />
          <h3 className="font-bold text-base">No videos found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? `No videos match "${searchQuery}". Try a different search.`
              : 'You can import local video files or play a network stream.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredVideos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              viewMode="grid"
              onPlay={(v) => playMedia(v, filteredVideos, true)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredVideos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              viewMode="list"
              onPlay={(v) => playMedia(v, filteredVideos, true)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
