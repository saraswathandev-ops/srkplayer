import React, { useState } from 'react';
import { Plus, Heart, History, Flame, Play, Trash2, ListMusic, ArrowLeft, Shuffle } from 'lucide-react';
import { Playlist, VideoItem } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { VideoCard } from './VideoCard';
import { AudioTrackItem } from './AudioTrackItem';
import { formatDate } from '../utils/formatters';

export function PlaylistsView() {
  const { playlists, createPlaylist, deletePlaylist, mediaList, playMedia, settings, themeColors, removeFromPlaylist } = usePlayer();
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const isDark = settings.theme === 'dark';

  // System Smart Playlists
  const favorites = mediaList.filter((m) => m.isFavorite);
  const recentlyPlayed = [...mediaList]
    .filter((m) => m.watchedAt)
    .sort((a, b) => (b.watchedAt || 0) - (a.watchedAt || 0))
    .slice(0, 20);
  const mostPlayed = [...mediaList]
    .filter((m) => m.playCount > 0)
    .sort((a, b) => b.playCount - a.playCount)
    .slice(0, 20);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    createPlaylist(newPlaylistName.trim());
    setNewPlaylistName('');
    setShowCreateModal(false);
  };

  // If a playlist is selected for detail view
  if (selectedPlaylistId) {
    let title = '';
    let items: VideoItem[] = [];

    if (selectedPlaylistId === 'system-favorites') {
      title = 'Favorites';
      items = favorites;
    } else if (selectedPlaylistId === 'system-recent') {
      title = 'Recently Played';
      items = recentlyPlayed;
    } else if (selectedPlaylistId === 'system-most-played') {
      title = 'Most Played';
      items = mostPlayed;
    } else {
      const pl = playlists.find((p) => p.id === selectedPlaylistId);
      title = pl?.name || 'Playlist';
      items = mediaList.filter((m) => pl?.mediaIds.includes(m.id));
    }

    return (
      <div id="playlist-detail-view" className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedPlaylistId(null)}
              className="p-2 rounded-xl border hover:bg-slate-700/20 transition-colors cursor-pointer"
              style={{
                borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
                backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
              }}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl font-bold tracking-tight">{title}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{items.length} {items.length === 1 ? 'item' : 'items'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={items.length === 0}
              onClick={() => items.length > 0 && playMedia(items[0], items, items[0].mediaType === 'video')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-md disabled:opacity-50 cursor-pointer"
              style={{ backgroundColor: themeColors.primary }}
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Play All</span>
            </button>

            <button
              disabled={items.length === 0}
              onClick={() => {
                if (items.length > 0) {
                  const shuffled = [...items].sort(() => Math.random() - 0.5);
                  playMedia(shuffled[0], shuffled, shuffled[0].mediaType === 'video');
                }
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border hover:bg-slate-700/20 disabled:opacity-50 cursor-pointer"
              style={{
                borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
                backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
              }}
            >
              <Shuffle className="w-4 h-4 text-emerald-400" />
              <span>Shuffle</span>
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <div
            className="text-center py-16 px-4 rounded-3xl border"
            style={{
              backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
              borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
            }}
          >
            <ListMusic className="w-12 h-12 mx-auto text-slate-500 mb-3 opacity-60" />
            <h3 className="font-bold text-base">This playlist is empty</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Add videos or audio tracks to this playlist from their options menu.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, idx) => {
              if (item.mediaType === 'video') {
                return (
                  <VideoCard
                    key={item.id}
                    video={item}
                    viewMode="list"
                    onPlay={(v) => playMedia(v, items, true)}
                  />
                );
              }
              return (
                <AudioTrackItem
                  key={item.id}
                  track={item}
                  index={idx}
                  onPlay={(t) => playMedia(t, items, false)}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div id="playlists-view-container" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Playlists & Collections</h2>
          <p className="text-xs text-slate-400 mt-0.5">Custom mixes and automated collections</p>
        </div>

        <button
          id="create-playlist-trigger-btn"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-white shadow-md transition-opacity hover:opacity-95 cursor-pointer"
          style={{ backgroundColor: themeColors.primary }}
        >
          <Plus className="w-4 h-4" />
          <span>New Playlist</span>
        </button>
      </div>

      {/* Smart Playlists Section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Favorites */}
        <div
          id="smart-playlist-favorites"
          onClick={() => setSelectedPlaylistId('system-favorites')}
          className="p-4 rounded-2xl border cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg flex items-center gap-3.5"
          style={{
            backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
            borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
          }}
        >
          <div className="w-12 h-12 rounded-xl bg-rose-500/15 flex items-center justify-center text-rose-500 shrink-0">
            <Heart className="w-6 h-6 fill-rose-500" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Favorites</h3>
            <p className="text-xs text-slate-400 mt-0.5">{favorites.length} media items</p>
          </div>
        </div>

        {/* Recently Played */}
        <div
          id="smart-playlist-recent"
          onClick={() => setSelectedPlaylistId('system-recent')}
          className="p-4 rounded-2xl border cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg flex items-center gap-3.5"
          style={{
            backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
            borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
          }}
        >
          <div className="w-12 h-12 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-500 shrink-0">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Recently Played</h3>
            <p className="text-xs text-slate-400 mt-0.5">{recentlyPlayed.length} media items</p>
          </div>
        </div>

        {/* Most Played */}
        <div
          id="smart-playlist-most-played"
          onClick={() => setSelectedPlaylistId('system-most-played')}
          className="p-4 rounded-2xl border cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg flex items-center gap-3.5"
          style={{
            backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
            borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
          }}
        >
          <div className="w-12 h-12 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-500 shrink-0">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Most Played</h3>
            <p className="text-xs text-slate-400 mt-0.5">{mostPlayed.length} media items</p>
          </div>
        </div>
      </div>

      {/* User Playlists */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Your Playlists</h3>

        {playlists.length === 0 ? (
          <div
            className="text-center py-12 px-4 rounded-3xl border"
            style={{
              backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
              borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
            }}
          >
            <ListMusic className="w-10 h-10 mx-auto text-slate-500 mb-2 opacity-60" />
            <h4 className="font-bold text-sm">No custom playlists yet</h4>
            <p className="text-xs text-slate-400 mt-1">Create a playlist to group your favorite videos and tracks together.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {playlists.map((pl) => (
              <div
                key={pl.id}
                id={`playlist-card-${pl.id}`}
                className="group relative p-3.5 rounded-2xl border transition-all hover:shadow-md flex flex-col justify-between"
                style={{
                  backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
                  borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
                }}
              >
                <div
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => setSelectedPlaylistId(pl.id)}
                >
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-800 shrink-0 shadow-sm">
                    {pl.coverUri ? (
                      <img src={pl.coverUri} alt={pl.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500">
                        <ListMusic className="w-6 h-6" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm truncate group-hover:underline">{pl.name}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {pl.mediaIds.length} {pl.mediaIds.length === 1 ? 'item' : 'items'}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{formatDate(pl.createdAt)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-700/20">
                  <button
                    onClick={() => setSelectedPlaylistId(pl.id)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:underline cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-emerald-400" />
                    <span>View & Play</span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete playlist "${pl.name}"?`)) {
                        deletePlaylist(pl.id);
                      }
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Delete Playlist"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="w-full max-w-md rounded-3xl border shadow-2xl p-6"
            style={{
              backgroundColor: isDark ? '#151824' : '#FFFFFF',
              borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
            }}
          >
            <h3 className="text-lg font-bold">Create New Playlist</h3>
            <p className="text-xs text-slate-400 mt-1">Enter a name for your custom playlist.</p>

            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <input
                type="text"
                autoFocus
                placeholder="e.g. Road Trip Beats, Sci-Fi Movies..."
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none"
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                  borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
                }}
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-slate-700/20"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newPlaylistName.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-md disabled:opacity-50"
                  style={{ backgroundColor: themeColors.primary }}
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
