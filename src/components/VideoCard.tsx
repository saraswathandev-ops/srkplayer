import React, { useState } from 'react';
import { Play, Heart, MoreVertical, Folder, Trash2, PlusCircle, Check } from 'lucide-react';
import { VideoItem, ViewMode } from '../types';
import { formatTime, formatFileSize, formatDate } from '../utils/formatters';
import { usePlayer } from '../context/PlayerContext';

interface VideoCardProps {
  video: VideoItem;
  viewMode: ViewMode;
  onPlay: (v: VideoItem) => void;
  onAddToPlaylist?: (v: VideoItem) => void;
}

export function VideoCard({ video, viewMode, onPlay, onAddToPlaylist }: VideoCardProps) {
  const { toggleFavorite, deleteMedia, settings, themeColors, playlists, addToPlaylist } = usePlayer();
  const [showMenu, setShowMenu] = useState(false);
  const [showPlaylistSubmenu, setShowPlaylistSubmenu] = useState(false);
  const isDark = settings.theme === 'dark';

  const progressPercent = video.lastPosition && video.duration
    ? Math.min(100, Math.round((video.lastPosition / video.duration) * 100))
    : 0;

  if (viewMode === 'list') {
    return (
      <div
        id={`video-list-item-${video.id}`}
        className="group relative flex items-center gap-3 sm:gap-4 p-2.5 sm:p-3 rounded-2xl border transition-all duration-200 hover:shadow-md"
        style={{
          backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
          borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
        }}
      >
        {/* Thumbnail with overlay play */}
        <div
          className="relative w-28 sm:w-36 h-18 sm:h-20 rounded-xl overflow-hidden shrink-0 bg-slate-900 cursor-pointer"
          onClick={() => onPlay(video)}
        >
          {video.thumbnail ? (
            <img
              src={video.thumbnail}
              alt={video.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500">
              <Play className="w-6 h-6" />
            </div>
          )}

          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 flex items-center justify-center transition-colors">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all shadow-lg"
              style={{ backgroundColor: themeColors.primary }}
            >
              <Play className="w-4 h-4 fill-white ml-0.5" />
            </div>
          </div>

          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/75 text-white backdrop-blur-xs">
            {formatTime(video.duration)}
          </span>

          {progressPercent > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
              <div
                className="h-full"
                style={{ width: `${progressPercent}%`, backgroundColor: themeColors.primary }}
              />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onPlay(video)}>
          <h3 className="font-semibold text-sm sm:text-base truncate leading-snug">
            {video.title}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-xs text-slate-400 flex-wrap">
            <span className="flex items-center gap-1">
              <Folder className="w-3.5 h-3.5" />
              {video.folder}
            </span>
            <span>•</span>
            <span>{formatFileSize(video.size)}</span>
            {video.resolution && (
              <>
                <span>•</span>
                <span className="px-1 py-0.2 rounded text-[10px] bg-slate-700/50 text-slate-300 font-medium">
                  {video.resolution}
                </span>
              </>
            )}
            <span>•</span>
            <span>{formatDate(video.dateAdded)}</span>
          </div>

          {progressPercent > 0 && (
            <p className="text-[11px] mt-1 font-medium" style={{ color: themeColors.primary }}>
              Resume at {formatTime(video.lastPosition)} ({progressPercent}%)
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => toggleFavorite(video.id)}
            className="p-2 rounded-lg text-slate-400 hover:text-rose-500 transition-colors"
            title={video.isFavorite ? 'Remove Favorite' : 'Add Favorite'}
          >
            <Heart
              className="w-4 h-4"
              fill={video.isFavorite ? '#EF4444' : 'none'}
              color={video.isFavorite ? '#EF4444' : 'currentColor'}
            />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <div
                className="absolute right-0 top-10 w-48 rounded-xl shadow-xl border z-20 py-1.5 text-xs font-medium backdrop-blur-md"
                style={{
                  backgroundColor: isDark ? '#181B28' : '#FFFFFF',
                  borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
                }}
              >
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onPlay(video);
                  }}
                  className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-slate-700/20"
                >
                  <Play className="w-3.5 h-3.5" /> Play Video
                </button>

                <div className="relative">
                  <button
                    onClick={() => setShowPlaylistSubmenu(!showPlaylistSubmenu)}
                    className="w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-700/20"
                  >
                    <span className="flex items-center gap-2">
                      <PlusCircle className="w-3.5 h-3.5" /> Add to Playlist
                    </span>
                  </button>

                  {showPlaylistSubmenu && (
                    <div
                      className="absolute left-full top-0 ml-1 w-44 rounded-xl shadow-xl border py-1.5 text-xs z-30"
                      style={{
                        backgroundColor: isDark ? '#181B28' : '#FFFFFF',
                        borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
                      }}
                    >
                      {playlists.map((pl) => {
                        const inPlaylist = pl.mediaIds.includes(video.id);
                        return (
                          <button
                            key={pl.id}
                            onClick={() => {
                              addToPlaylist(pl.id, video.id);
                              setShowPlaylistSubmenu(false);
                              setShowMenu(false);
                            }}
                            className="w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-slate-700/20"
                          >
                            <span className="truncate">{pl.name}</span>
                            {inPlaylist && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="h-px my-1 bg-slate-700/30" />

                <button
                  onClick={() => {
                    setShowMenu(false);
                    deleteMedia(video.id);
                  }}
                  className="w-full text-left px-3 py-2 flex items-center gap-2 text-rose-400 hover:bg-rose-500/10"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Move to Recycle Bin
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div
      id={`video-card-${video.id}`}
      className="group relative rounded-2xl border overflow-hidden transition-all duration-200 hover:shadow-lg flex flex-col"
      style={{
        backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
        borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
      }}
    >
      {/* Thumbnail */}
      <div
        className="relative w-full aspect-video bg-slate-900 overflow-hidden cursor-pointer"
        onClick={() => onPlay(video)}
      >
        {video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt={video.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500">
            <Play className="w-8 h-8" />
          </div>
        )}

        {/* Hover play icon */}
        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 flex items-center justify-center transition-colors">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center text-white opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all shadow-xl"
            style={{ backgroundColor: themeColors.primary }}
          >
            <Play className="w-5 h-5 fill-white ml-0.5" />
          </div>
        </div>

        {/* Top badges */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-black/60 text-white backdrop-blur-xs flex items-center gap-1">
            <Folder className="w-3 h-3" />
            {video.folder}
          </span>
          {video.resolution && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-black/70 text-slate-200">
              {video.resolution}
            </span>
          )}
        </div>

        {/* Bottom duration & progress */}
        <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-black/80 text-white backdrop-blur-xs">
          {formatTime(video.duration)}
        </span>

        {progressPercent > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
            <div
              className="h-full"
              style={{ width: `${progressPercent}%`, backgroundColor: themeColors.primary }}
            />
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="p-3.5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3
              onClick={() => onPlay(video)}
              className="font-semibold text-sm line-clamp-2 leading-snug cursor-pointer hover:underline"
            >
              {video.title}
            </h3>
            <div className="relative shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showMenu && (
                <div
                  className="absolute right-0 top-8 w-48 rounded-xl shadow-xl border z-20 py-1.5 text-xs font-medium backdrop-blur-md"
                  style={{
                    backgroundColor: isDark ? '#181B28' : '#FFFFFF',
                    borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
                  }}
                >
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onPlay(video);
                    }}
                    className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-slate-700/20"
                  >
                    <Play className="w-3.5 h-3.5" /> Play Video
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => setShowPlaylistSubmenu(!showPlaylistSubmenu)}
                      className="w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-700/20"
                    >
                      <span className="flex items-center gap-2">
                        <PlusCircle className="w-3.5 h-3.5" /> Add to Playlist
                      </span>
                    </button>

                    {showPlaylistSubmenu && (
                      <div
                        className="absolute right-full top-0 mr-1 w-44 rounded-xl shadow-xl border py-1.5 text-xs z-30"
                        style={{
                          backgroundColor: isDark ? '#181B28' : '#FFFFFF',
                          borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
                        }}
                      >
                        {playlists.map((pl) => (
                          <button
                            key={pl.id}
                            onClick={() => {
                              addToPlaylist(pl.id, video.id);
                              setShowPlaylistSubmenu(false);
                              setShowMenu(false);
                            }}
                            className="w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-slate-700/20"
                          >
                            <span className="truncate">{pl.name}</span>
                            {pl.mediaIds.includes(video.id) && <Check className="w-3 h-3 text-emerald-400" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="h-px my-1 bg-slate-700/30" />

                  <button
                    onClick={() => {
                      setShowMenu(false);
                      deleteMedia(video.id);
                    }}
                    className="w-full text-left px-3 py-2 flex items-center gap-2 text-rose-400 hover:bg-rose-500/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Move to Recycle Bin
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
            <span>{formatFileSize(video.size)}</span>
            <span>{formatDate(video.dateAdded)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-700/20">
          <button
            onClick={() => toggleFavorite(video.id)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-500 transition-colors"
          >
            <Heart
              className="w-4 h-4"
              fill={video.isFavorite ? '#EF4444' : 'none'}
              color={video.isFavorite ? '#EF4444' : 'currentColor'}
            />
            <span>{video.isFavorite ? 'Favorited' : 'Favorite'}</span>
          </button>

          {progressPercent > 0 && (
            <span className="text-[11px] font-semibold" style={{ color: themeColors.primary }}>
              {progressPercent}% watched
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
