import React from 'react';
import { Trash2, RotateCcw, AlertTriangle, Film, Music } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { formatTime, formatFileSize } from '../utils/formatters';

export function RecycleBinView() {
  const { recycleBin, restoreMedia, deleteMedia, emptyRecycleBin, settings, themeColors } = usePlayer();
  const isDark = settings.theme === 'dark';

  return (
    <div id="recycle-bin-container" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Recycle Bin</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Deleted media stays here until permanently removed.
          </p>
        </div>

        {recycleBin.length > 0 && (
          <button
            id="empty-bin-btn"
            onClick={() => {
              if (confirm('Are you sure you want to permanently delete all items in the Recycle Bin?')) {
                emptyRecycleBin();
              }
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-400 border border-rose-500/30 hover:bg-rose-500/10 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Empty Recycle Bin</span>
          </button>
        )}
      </div>

      {recycleBin.length === 0 ? (
        <div
          className="text-center py-20 px-4 rounded-3xl border"
          style={{
            backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
            borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
          }}
        >
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-slate-800 text-slate-400">
            <Trash2 className="w-8 h-8 opacity-60" />
          </div>
          <h3 className="font-bold text-base">Recycle Bin is Empty</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Files deleted from your video or audio library will appear here first so you can easily restore them.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div
            className="p-3.5 rounded-2xl border flex items-center gap-3 text-xs text-amber-300"
            style={{
              backgroundColor: isDark ? 'rgba(245, 158, 11, 0.08)' : 'rgba(245, 158, 11, 0.12)',
              borderColor: isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.3)',
            }}
          >
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              {recycleBin.length} {recycleBin.length === 1 ? 'item is' : 'items are'} currently stored in the recycle bin.
            </span>
          </div>

          <div className="space-y-2.5">
            {recycleBin.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all"
                style={{
                  backgroundColor: isDark ? themeColors.cardDark : themeColors.cardLight,
                  borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-800 shrink-0 flex items-center justify-center">
                    {item.thumbnail ? (
                      <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                    ) : item.mediaType === 'video' ? (
                      <Film className="w-6 h-6 text-slate-400" />
                    ) : (
                      <Music className="w-6 h-6 text-slate-400" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <h4 className="font-semibold text-sm truncate">{item.title}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {item.folder} • {formatFileSize(item.size)} • {formatTime(item.duration)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => restoreMedia(item.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
                    style={{ backgroundColor: themeColors.primary }}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Restore</span>
                  </button>

                  <button
                    onClick={() => {
                      if (confirm(`Permanently delete "${item.title}"? This cannot be undone.`)) {
                        deleteMedia(item.id, true);
                      }
                    }}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title="Delete permanently"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
