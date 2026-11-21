import React from 'react';
import { X, Play, Film, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { VideoItem } from '../types';
import { formatTime } from '../utils/formatters';

interface VideoQueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  queue: VideoItem[];
  queueIndex: number;
  activeMediaId: string;
  autoPlayNext: boolean;
  onToggleAutoPlayNext: (enabled: boolean) => void;
  onSelectTrack: (item: VideoItem) => void;
  onRemoveFromQueue: (index: number) => void;
  onMoveQueueItem: (fromIndex: number, toIndex: number) => void;
  themeColor: string;
}

export function VideoQueueDrawer({
  isOpen,
  onClose,
  queue,
  queueIndex,
  activeMediaId,
  autoPlayNext,
  onToggleAutoPlayNext,
  onSelectTrack,
  onRemoveFromQueue,
  onMoveQueueItem,
  themeColor,
}: VideoQueueDrawerProps) {
  if (!isOpen) return null;

  return (
    <div
      id="video-queue-drawer-backdrop"
      className="fixed inset-0 z-50 flex justify-end items-end sm:items-stretch bg-black/55 backdrop-blur-sm"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <aside
        id="video-queue-drawer"
        className="w-full sm:w-96 max-h-[78vh] sm:max-h-full bg-slate-950/92 backdrop-blur-2xl border-t sm:border-t-0 sm:border-l border-white/12 rounded-t-3xl sm:rounded-none flex flex-col text-slate-100 shadow-2xl select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile grab handle */}
        <div className="w-10 h-1.5 bg-slate-700 rounded-full mx-auto mt-3 sm:hidden shrink-0" />

        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-white">Up Next</h3>
            <p className="text-xs text-slate-400 tabular-nums">
              {queue.length} {queue.length === 1 ? 'video' : 'videos'} in queue
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <span className="whitespace-nowrap">Auto-Next</span>
              <button
                type="button"
                id="queue-autonext-toggle"
                role="switch"
                aria-checked={autoPlayNext}
                onClick={() => onToggleAutoPlayNext(!autoPlayNext)}
                className={`w-10 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                  autoPlayNext ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    autoPlayNext ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </label>

            <button
              type="button"
              id="close-queue-drawer-btn"
              onClick={onClose}
              aria-label="Close Up Next Queue"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Queue List */}
        <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06] px-3 py-2">
          {queue.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              No videos in the current queue.
            </div>
          ) : (
            queue.map((item, idx) => {
              const isCurrent = item.id === activeMediaId && idx === queueIndex;
              const isNext = idx === queueIndex + 1;

              return (
                <div
                  key={`${item.id}-${idx}`}
                  id={`video-queue-item-${idx}`}
                  className={`flex items-center gap-3 py-2.5 px-2 rounded-xl transition-colors ${
                    isCurrent ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectTrack(item)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                  >
                    <div className="relative w-20 h-12 rounded-lg overflow-hidden bg-slate-900 shrink-0 border border-white/10">
                      {item.thumbnail ? (
                        <img
                          src={item.thumbnail}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-500">
                          <Film className="w-4 h-4" />
                        </div>
                      )}
                      {isCurrent && (
                        <div
                          className="absolute inset-0 bg-black/55 flex items-center justify-center"
                          style={{ color: themeColor }}
                        >
                          <Play className="w-4 h-4 fill-current" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div
                        className="text-sm font-medium truncate"
                        style={{ color: isCurrent ? themeColor : '#F1F5F9' }}
                      >
                        {item.title}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-1.5 tabular-nums mt-0.5">
                        <span>{formatTime(item.duration)}</span>
                        {item.resolution && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{item.resolution}</span>
                          </>
                        )}
                        {isCurrent && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-emerald-400 font-medium">Playing</span>
                          </>
                        )}
                        {isNext && !isCurrent && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-sky-300 font-medium">Next</span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>

                  {!isCurrent && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0 || idx - 1 === queueIndex}
                        onClick={() => onMoveQueueItem(idx, idx - 1)}
                        aria-label="Move up"
                        className="p-2 rounded-lg text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={idx >= queue.length - 1}
                        onClick={() => onMoveQueueItem(idx, idx + 1)}
                        aria-label="Move down"
                        className="p-2 rounded-lg text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveFromQueue(idx)}
                        aria-label="Remove from queue"
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-400 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}
