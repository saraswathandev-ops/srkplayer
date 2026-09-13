import React, { useState } from 'react';
import { Play, Pause, Heart, MoreVertical, PlusCircle, Trash2, Check, Music, ListPlus } from 'lucide-react';
import { VideoItem } from '../types';
import { formatTime, formatFileSize } from '../utils/formatters';
import { usePlayer } from '../context/PlayerContext';
import { SwipeToDelete } from './SwipeToDelete';

interface AudioTrackItemProps {
  track: VideoItem;
  index: number;
  onPlay: (t: VideoItem) => void;
  onDelete?: (t: VideoItem) => void;
  deleteLabel?: string;
  disableSwipe?: boolean;
}

export function AudioTrackItem({
  track,
  index,
  onPlay,
  onDelete,
  deleteLabel = 'Delete',
  disableSwipe = false,
}: AudioTrackItemProps) {
  const {
    activeMedia,
    isPlaying,
    togglePlay,
    toggleFavorite,
    deleteMedia,
    settings,
    themeColors,
    playlists,
    addToPlaylist,
    playNext,
    queue,
    queueIndex,
    showToast,
  } = usePlayer();
  const [showMenu, setShowMenu] = useState(false);
  const [showPlaylistSubmenu, setShowPlaylistSubmenu] = useState(false);
  const isDark = settings.theme === 'dark';

  const isCurrent = activeMedia?.id === track.id;
  const isNextInQueue = !isCurrent && queue.length > 0 && queueIndex >= 0 && queue[queueIndex + 1]?.id === track.id;

  const handleItemDelete = () => {
    if (onDelete) {
      onDelete(track);
    } else {
      deleteMedia(track.id);
      showToast(`Moved "${track.title}" to Recycle Bin`);
    }
  };

  return (
    <SwipeToDelete
      onDelete={handleItemDelete}
      deleteLabel={deleteLabel}
      itemTitle={track.title}
      disabled={disableSwipe}
      roundedClass="rounded-xl"
    >
      <div
        id={`audio-track-${track.id}`}
        className="group relative flex items-center gap-3 sm:gap-4 p-2.5 sm:p-3 rounded-xl border transition-all duration-200 hover:shadow-sm"
        style={{
          backgroundColor: isCurrent
            ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)')
            : (isDark ? themeColors.cardDark : themeColors.cardLight),
          borderColor: isCurrent ? themeColors.primary : (isDark ? themeColors.borderDark : themeColors.borderLight),
        }}
      >
      {/* Index or Playing indicator */}
      <div className="w-6 text-center text-xs font-semibold text-slate-400 shrink-0">
        {isCurrent && isPlaying ? (
          <div className="flex items-end justify-center gap-0.5 h-4">
            <span className="w-1 bg-emerald-400 rounded-full animate-bounce" style={{ height: '60%', animationDuration: '0.6s' }} />
            <span className="w-1 bg-emerald-400 rounded-full animate-bounce" style={{ height: '100%', animationDuration: '0.4s' }} />
            <span className="w-1 bg-emerald-400 rounded-full animate-bounce" style={{ height: '80%', animationDuration: '0.8s' }} />
          </div>
        ) : (
          <span>{index + 1}</span>
        )}
      </div>

      {/* Album cover / Thumbnail */}
      <div
        className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-slate-800 cursor-pointer shadow-sm"
        onClick={() => (isCurrent ? togglePlay() : onPlay(track))}
      >
        {track.thumbnail ? (
          <img src={track.thumbnail} alt={track.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400">
            <Music className="w-5 h-5" />
          </div>
        )}

        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 flex items-center justify-center transition-colors">
          {isCurrent && isPlaying ? (
            <Pause className="w-4 h-4 fill-white text-white" />
          ) : (
            <Play className="w-4 h-4 fill-white text-white ml-0.5" />
          )}
        </div>
      </div>

      {/* Track Info */}
      <div
        className="flex-1 min-w-0 cursor-pointer"
        onClick={() => (isCurrent ? togglePlay() : onPlay(track))}
      >
        <div className="flex items-center gap-2 min-w-0">
          <h4
            className="font-medium text-sm truncate"
            style={{ color: isCurrent ? themeColors.primary : undefined }}
          >
            {track.title}
          </h4>
          {isNextInQueue && (
            <span
              id={`track-up-next-badge-${track.id}`}
              className="px-1.5 py-0.5 rounded text-[9px] font-bold text-sky-400 bg-sky-500/15 border border-sky-500/30 shrink-0"
              title="This track is queued to play next"
            >
              UP NEXT
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 truncate mt-0.5">
          {track.artist || 'Unknown Artist'} • {track.album || track.folder}
        </p>
      </div>

      {/* Badges / Duration */}
      <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 shrink-0">
        {track.bitrate && (
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700/40 text-slate-300 font-medium">
            {track.bitrate}
          </span>
        )}
        <span>{formatFileSize(track.size)}</span>
      </div>

      <div className="text-xs font-semibold text-slate-400 shrink-0 tabular-nums">
        {formatTime(track.duration)}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          id={`track-quick-play-next-${track.id}`}
          onClick={(e) => {
            e.stopPropagation();
            playNext(track);
          }}
          className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-slate-700/20 transition-all cursor-pointer opacity-70 group-hover:opacity-100"
          title="Play Next (queue after current track)"
        >
          <ListPlus className="w-4 h-4" />
        </button>

        <button
          onClick={() => toggleFavorite(track.id)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 transition-colors"
          title="Favorite"
        >
          <Heart
            className="w-4 h-4"
            fill={track.isFavorite ? '#EF4444' : 'none'}
            color={track.isFavorite ? '#EF4444' : 'currentColor'}
          />
        </button>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <div
              className="absolute right-0 top-8 w-44 rounded-xl shadow-xl border z-20 py-1 text-xs font-medium backdrop-blur-md"
              style={{
                backgroundColor: isDark ? '#181B28' : '#FFFFFF',
                borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
              }}
            >
              <button
                onClick={() => {
                  setShowMenu(false);
                  onPlay(track);
                }}
                className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-slate-700/20"
              >
                <Play className="w-3.5 h-3.5" /> Play Track
              </button>

              <button
                id={`track-menu-play-next-${track.id}`}
                onClick={() => {
                  setShowMenu(false);
                  playNext(track);
                }}
                className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-slate-700/20 text-sky-400 font-medium"
              >
                <ListPlus className="w-3.5 h-3.5" /> Play Next
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
                          addToPlaylist(pl.id, track.id);
                          setShowPlaylistSubmenu(false);
                          setShowMenu(false);
                        }}
                        className="w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-slate-700/20"
                      >
                        <span className="truncate">{pl.name}</span>
                        {pl.mediaIds.includes(track.id) && <Check className="w-3 h-3 text-emerald-400" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="h-px my-1 bg-slate-700/30" />

              <button
                onClick={() => {
                  setShowMenu(false);
                  handleItemDelete();
                }}
                className="w-full text-left px-3 py-2 flex items-center gap-2 text-rose-400 hover:bg-rose-500/10"
              >
                <Trash2 className="w-3.5 h-3.5" /> {deleteLabel === 'Delete' ? 'Move to Recycle Bin' : deleteLabel}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
    </SwipeToDelete>
  );
}
