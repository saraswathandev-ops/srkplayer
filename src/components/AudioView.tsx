import React, { useState, useMemo } from 'react';
import {
  Play,
  Pause,
  Shuffle,
  Music,
  User,
  Disc,
  Folder,
  Search,
  LayoutList,
  LayoutGrid,
  ArrowUpDown,
  Heart,
  Flame,
  ListPlus,
  Gauge,
  Sparkles,
} from 'lucide-react';
import { VideoItem } from '../types';
import { AudioTrackItem } from './AudioTrackItem';
import { usePlayer } from '../context/PlayerContext';
import { formatTime } from '../utils/formatters';

interface AudioViewProps {
  searchQuery: string;
}

type SortField = 'title' | 'artist' | 'album' | 'duration' | 'dateAdded' | 'playCount';
type SortOrder = 'asc' | 'desc';
type QuickFilter = 'all' | 'favorites' | 'mostPlayed';

export function AudioView({ searchQuery }: AudioViewProps) {
  const {
    mediaList,
    playMedia,
    settings,
    themeColors,
    toggleFavorite,
    playNext,
    activeMedia,
    isPlaying,
    togglePlay,
    toggleVolumeNormalization,
  } = usePlayer();

  const [subTab, setSubTab] = useState<'tracks' | 'artists' | 'albums' | 'folders'>('tracks');
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  // Sorting & View Mode
  const [sortField, setSortField] = useState<SortField>('title');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');

  const isDark = settings.theme === 'dark';
  const norm = settings.volumeNormalization;

  const allAudio = useMemo(() => {
    return mediaList.filter((m) => m.mediaType === 'audio');
  }, [mediaList]);

  // Distinct artists
  const artists = useMemo(() => {
    const map = new Map<string, number>();
    allAudio.forEach((a) => {
      const art = a.artist || 'Unknown Artist';
      map.set(art, (map.get(art) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [allAudio]);

  // Distinct albums
  const albums = useMemo(() => {
    const map = new Map<string, { count: number; cover?: string }>();
    allAudio.forEach((a) => {
      const alb = a.album || 'Unknown Album';
      const existing = map.get(alb);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(alb, { count: 1, cover: a.thumbnail });
      }
    });
    return Array.from(map.entries()).map(([name, data]) => ({ name, ...data }));
  }, [allAudio]);

  // Distinct folders
  const folders = useMemo(() => {
    const map = new Map<string, number>();
    allAudio.forEach((a) => {
      const f = a.folder || 'Music';
      map.set(f, (map.get(f) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [allAudio]);

  // Filtered & Sorted tracks
  const filteredAudio = useMemo(() => {
    let list = allAudio;

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          (a.artist && a.artist.toLowerCase().includes(q)) ||
          (a.album && a.album.toLowerCase().includes(q)) ||
          a.folder.toLowerCase().includes(q)
      );
    }

    // Category filters
    if (selectedArtist) {
      list = list.filter((a) => (a.artist || 'Unknown Artist') === selectedArtist);
    }

    if (selectedAlbum) {
      list = list.filter((a) => (a.album || 'Unknown Album') === selectedAlbum);
    }

    if (selectedFolder) {
      list = list.filter((a) => a.folder === selectedFolder);
    }

    // Quick filter chips
    if (quickFilter === 'favorites') {
      list = list.filter((a) => a.isFavorite);
    } else if (quickFilter === 'mostPlayed') {
      list = list.filter((a) => (a.playCount || 0) > 0);
    }

    // Sorting
    return [...list].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'artist':
          comparison = (a.artist || '').localeCompare(b.artist || '');
          break;
        case 'album':
          comparison = (a.album || '').localeCompare(b.album || '');
          break;
        case 'duration':
          comparison = (a.duration || 0) - (b.duration || 0);
          break;
        case 'dateAdded':
          comparison = new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime();
          break;
        case 'playCount':
          comparison = (a.playCount || 0) - (b.playCount || 0);
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [allAudio, searchQuery, selectedArtist, selectedAlbum, selectedFolder, quickFilter, sortField, sortOrder]);

  const totalDurationSeconds = useMemo(() => {
    return filteredAudio.reduce((acc, cur) => acc + (cur.duration || 0), 0);
  }, [filteredAudio]);

  const handlePlayAll = () => {
    if (filteredAudio.length > 0) {
      playMedia(filteredAudio[0], filteredAudio, false);
    }
  };

  const handleShuffleAll = () => {
    if (filteredAudio.length > 0) {
      const shuffled = [...filteredAudio].sort(() => Math.random() - 0.5);
      playMedia(shuffled[0], shuffled, false);
    }
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  return (
    <div id="audio-view-container" className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl font-bold tracking-tight">Music & Audio</h2>
            <span
              className="px-2.5 py-0.5 rounded-full text-xs font-semibold border"
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
              }}
            >
              {filteredAudio.length} tracks • {formatTime(totalDurationSeconds)} total
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {artists.length} artists • {albums.length} albums • {folders.length} directories
          </p>
        </div>

        {/* Header Right: Normalization Status Pill & Play Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Quick Volume Normalization Status Pill */}
          <button
            id="audio-view-norm-pill"
            onClick={toggleVolumeNormalization}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer shadow-sm hover:scale-105"
            style={{
              borderColor: norm?.enabled ? themeColors.primary : isDark ? '#334155' : '#CBD5E1',
              color: norm?.enabled ? themeColors.primary : '#94A3B8',
              backgroundColor: norm?.enabled ? `${themeColors.primary}18` : 'transparent',
            }}
            title={norm?.enabled ? 'Volume Normalization Active - Click to bypass' : 'Volume Normalization Off - Click to enable'}
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>NORM: {norm?.enabled ? 'ON' : 'OFF'}</span>
            {norm?.enabled && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>

          <button
            id="play-all-audio-btn"
            onClick={handlePlayAll}
            disabled={filteredAudio.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white shadow-md transition-opacity hover:opacity-95 disabled:opacity-50 cursor-pointer"
            style={{ backgroundColor: themeColors.primary }}
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Play All</span>
          </button>

          <button
            id="shuffle-all-audio-btn"
            onClick={handleShuffleAll}
            disabled={filteredAudio.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all hover:bg-slate-700/20 disabled:opacity-50 cursor-pointer"
            style={{
              borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
              backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
            }}
          >
            <Shuffle className="w-3.5 h-3.5 text-emerald-400" />
            <span>Shuffle</span>
          </button>
        </div>
      </div>

      {/* Primary Sub Tabs: Tracks / Artists / Albums / Folders */}
      <div
        className="flex items-center justify-between gap-3 border-b pb-2 flex-wrap"
        style={{ borderColor: isDark ? themeColors.borderDark : themeColors.borderLight }}
      >
        <div className="flex items-center gap-1.5">
          {[
            { id: 'tracks', label: 'All Tracks', icon: Music },
            { id: 'artists', label: 'Artists', icon: User },
            { id: 'albums', label: 'Albums', icon: Disc },
            { id: 'folders', label: 'Folders', icon: Folder },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = subTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setSubTab(tab.id as any);
                  setSelectedArtist(null);
                  setSelectedAlbum(null);
                  setSelectedFolder(null);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                style={{
                  backgroundColor: isActive
                    ? isDark
                      ? 'rgba(255,255,255,0.1)'
                      : 'rgba(0,0,0,0.06)'
                    : 'transparent',
                  color: isActive ? themeColors.primary : undefined,
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right side: Sorting & View Mode (when viewing tracks) */}
        {subTab === 'tracks' && (
          <div className="flex items-center gap-2">
            {/* Sort Field Selector */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-400 hidden sm:inline">Sort:</span>
              <select
                id="audio-sort-select"
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                className="px-2.5 py-1 rounded-xl text-xs font-medium border focus:outline-none cursor-pointer"
                style={{
                  backgroundColor: isDark ? '#1C2133' : '#F1F5F9',
                  borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
                }}
              >
                <option value="title">Title (A-Z)</option>
                <option value="artist">Artist</option>
                <option value="album">Album</option>
                <option value="duration">Duration</option>
                <option value="playCount">Most Played</option>
                <option value="dateAdded">Recently Added</option>
              </select>

              {/* Sort direction toggle */}
              <button
                id="audio-sort-direction-btn"
                onClick={toggleSortOrder}
                className="p-1.5 rounded-xl border text-slate-400 hover:text-white transition-colors cursor-pointer"
                style={{
                  borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
                  backgroundColor: isDark ? '#1C2133' : '#F1F5F9',
                }}
                title={sortOrder === 'asc' ? 'Ascending (A-Z, Low to High)' : 'Descending (Z-A, High to Low)'}
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* List / Grid View Toggle */}
            <div
              className="flex items-center p-0.5 rounded-xl border"
              style={{
                borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
                backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
              }}
            >
              <button
                id="audio-view-mode-list"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'list' ? 'text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
                style={{
                  backgroundColor: viewMode === 'list' ? themeColors.primary : 'transparent',
                }}
                title="Detailed List View"
              >
                <LayoutList className="w-3.5 h-3.5" />
              </button>
              <button
                id="audio-view-mode-grid"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'grid' ? 'text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
                style={{
                  backgroundColor: viewMode === 'grid' ? themeColors.primary : 'transparent',
                }}
                title="Grid / Artwork Cards View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick Filter Chips (All, Favorites, Most Played) */}
      {subTab === 'tracks' && !selectedArtist && !selectedAlbum && !selectedFolder && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setQuickFilter('all')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 border ${
              quickFilter === 'all'
                ? 'text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            style={{
              backgroundColor: quickFilter === 'all' ? themeColors.primary : 'transparent',
              borderColor: quickFilter === 'all' ? 'transparent' : isDark ? themeColors.borderDark : themeColors.borderLight,
            }}
          >
            All Tracks ({allAudio.length})
          </button>

          <button
            onClick={() => setQuickFilter('favorites')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 border ${
              quickFilter === 'favorites'
                ? 'text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            style={{
              backgroundColor: quickFilter === 'favorites' ? '#EF4444' : 'transparent',
              borderColor: quickFilter === 'favorites' ? 'transparent' : isDark ? themeColors.borderDark : themeColors.borderLight,
            }}
          >
            <Heart className="w-3 h-3 fill-current" />
            <span>Favorites ({allAudio.filter((a) => a.isFavorite).length})</span>
          </button>

          <button
            onClick={() => setQuickFilter('mostPlayed')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 border ${
              quickFilter === 'mostPlayed'
                ? 'text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            style={{
              backgroundColor: quickFilter === 'mostPlayed' ? '#F59E0B' : 'transparent',
              borderColor: quickFilter === 'mostPlayed' ? 'transparent' : isDark ? themeColors.borderDark : themeColors.borderLight,
            }}
          >
            <Flame className="w-3 h-3 fill-current" />
            <span>Recently Played ({allAudio.filter((a) => (a.playCount || 0) > 0).length})</span>
          </button>
        </div>
      )}

      {/* Filter breadcrumb if artist/album/folder selected */}
      {(selectedArtist || selectedAlbum || selectedFolder) && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Filtered by:</span>
          <span className="px-2.5 py-1 rounded-xl font-semibold text-white shadow-sm" style={{ backgroundColor: themeColors.primary }}>
            {selectedArtist || selectedAlbum || selectedFolder}
          </span>
          <button
            onClick={() => {
              setSelectedArtist(null);
              setSelectedAlbum(null);
              setSelectedFolder(null);
            }}
            className="text-slate-400 hover:text-white underline cursor-pointer ml-1"
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* Tab: Artists */}
      {subTab === 'artists' && !selectedArtist && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {artists.map((art) => (
            <div
              key={art.name}
              onClick={() => setSelectedArtist(art.name)}
              className="p-4 rounded-2xl border text-center cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md"
              style={{
                backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
                borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
              }}
            >
              <div
                className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-white font-bold text-lg shadow-md"
                style={{
                  background: `linear-gradient(135deg, ${themeColors.primary}, ${themeColors.accent})`,
                }}
              >
                <User className="w-7 h-7" />
              </div>
              <h4 className="font-bold text-sm truncate">{art.name}</h4>
              <p className="text-xs text-slate-400 mt-0.5">{art.count} {art.count === 1 ? 'track' : 'tracks'}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Albums */}
      {subTab === 'albums' && !selectedAlbum && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {albums.map((alb) => (
            <div
              key={alb.name}
              onClick={() => setSelectedAlbum(alb.name)}
              className="p-3 rounded-2xl border cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md"
              style={{
                backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
                borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
              }}
            >
              <div className="aspect-square rounded-xl overflow-hidden bg-slate-800 mb-2.5 shadow-sm">
                {alb.cover ? (
                  <img src={alb.cover} alt={alb.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-500">
                    <Disc className="w-8 h-8" />
                  </div>
                )}
              </div>
              <h4 className="font-bold text-sm truncate">{alb.name}</h4>
              <p className="text-xs text-slate-400 mt-0.5">{alb.count} {alb.count === 1 ? 'track' : 'tracks'}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Folders */}
      {subTab === 'folders' && !selectedFolder && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {folders.map((f) => (
            <div
              key={f.name}
              onClick={() => setSelectedFolder(f.name)}
              className="p-4 rounded-2xl border cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md flex items-center gap-3"
              style={{
                backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
                borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm"
                style={{ backgroundColor: themeColors.primary }}
              >
                <Folder className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-sm truncate">{f.name}</h4>
                <p className="text-xs text-slate-400">{f.count} tracks</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tracks Presentation (When in tracks tab or when artist/album/folder is selected) */}
      {(subTab === 'tracks' || selectedArtist || selectedAlbum || selectedFolder) && (
        <>
          {filteredAudio.length === 0 ? (
            <div
              className="text-center py-16 px-4 rounded-3xl border"
              style={{
                backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
                borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
              }}
            >
              <Music className="w-12 h-12 mx-auto text-slate-500 mb-3 opacity-60" />
              <h3 className="font-bold text-base">No audio tracks found</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? `No audio tracks match "${searchQuery}".`
                  : quickFilter !== 'all'
                  ? 'No tracks matching the current filter.'
                  : 'Import local audio files or play online streams.'}
              </p>
              {(searchQuery || quickFilter !== 'all' || selectedArtist || selectedAlbum || selectedFolder) && (
                <button
                  onClick={() => {
                    setQuickFilter('all');
                    setSelectedArtist(null);
                    setSelectedAlbum(null);
                    setSelectedFolder(null);
                  }}
                  className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-sm cursor-pointer"
                  style={{ backgroundColor: themeColors.primary }}
                >
                  Reset All Filters
                </button>
              )}
            </div>
          ) : viewMode === 'list' ? (
            /* List View */
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pb-0.5">
                <span>{filteredAudio.length} {filteredAudio.length === 1 ? 'track' : 'tracks'}</span>
                <span className="opacity-75">Tip: Swipe track left to delete</span>
              </div>
              {filteredAudio.map((track, idx) => (
                <AudioTrackItem
                  key={track.id}
                  track={track}
                  index={idx}
                  onPlay={(t) => playMedia(t, filteredAudio, false)}
                />
              ))}
            </div>
          ) : (
            /* Grid / Card View */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredAudio.map((track) => {
                const isCurrent = activeMedia?.id === track.id;
                return (
                  <div
                    key={track.id}
                    className="group relative p-3 rounded-2xl border transition-all hover:scale-[1.02] hover:shadow-lg flex flex-col justify-between"
                    style={{
                      backgroundColor: isCurrent
                        ? isDark
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(0,0,0,0.04)'
                        : isDark
                        ? themeColors.cardDark
                        : themeColors.cardLight,
                      borderColor: isCurrent
                        ? themeColors.primary
                        : isDark
                        ? themeColors.borderDark
                        : themeColors.borderLight,
                    }}
                  >
                    <div>
                      {/* Artwork thumbnail with play overlay */}
                      <div
                        className="relative aspect-square rounded-xl overflow-hidden bg-slate-800 mb-2.5 cursor-pointer shadow-md"
                        onClick={() => (isCurrent ? togglePlay() : playMedia(track, filteredAudio, false))}
                      >
                        {track.thumbnail ? (
                          <img
                            src={track.thumbnail}
                            alt={track.title}
                            className={`w-full h-full object-cover transition-transform duration-300 ${
                              isCurrent && isPlaying ? 'scale-105' : 'group-hover:scale-105'
                            }`}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-500">
                            <Music className="w-10 h-10" />
                          </div>
                        )}

                        {/* Overlay play button */}
                        <div
                          className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
                            isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110"
                            style={{ backgroundColor: themeColors.primary }}
                          >
                            {isCurrent && isPlaying ? (
                              <Pause className="w-5 h-5 fill-white" />
                            ) : (
                              <Play className="w-5 h-5 fill-white ml-0.5" />
                            )}
                          </div>
                        </div>

                        {/* Duration badge */}
                        <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[10px] font-mono text-white backdrop-blur-sm">
                          {formatTime(track.duration)}
                        </span>
                      </div>

                      {/* Track title and artist */}
                      <h4
                        className="font-bold text-xs truncate cursor-pointer hover:underline"
                        style={{ color: isCurrent ? themeColors.primary : undefined }}
                        onClick={() => (isCurrent ? togglePlay() : playMedia(track, filteredAudio, false))}
                        title={track.title}
                      >
                        {track.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {track.artist || 'Unknown Artist'}
                      </p>
                    </div>

                    {/* Quick action buttons row */}
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-700/20">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          playNext(track);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-slate-700/20 transition-colors cursor-pointer"
                        title="Play Next"
                      >
                        <ListPlus className="w-3.5 h-3.5" />
                      </button>

                      {track.playCount ? (
                        <span className="text-[10px] text-slate-400 font-medium">
                          {track.playCount} plays
                        </span>
                      ) : null}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(track.id);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                        title="Favorite"
                      >
                        <Heart
                          className="w-3.5 h-3.5"
                          fill={track.isFavorite ? '#EF4444' : 'none'}
                          color={track.isFavorite ? '#EF4444' : 'currentColor'}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
