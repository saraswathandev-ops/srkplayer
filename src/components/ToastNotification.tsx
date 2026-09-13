import React from 'react';
import { ListPlus, X, Check } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

export function ToastNotification() {
  const { toastMessage, clearToast, themeColors, settings } = usePlayer();

  if (!toastMessage) return null;

  const isDark = settings.theme === 'dark';

  return (
    <div
      id="app-toast-notification"
      className="fixed top-5 left-1/2 -translate-x-1/2 z-60 pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-2xl shadow-2xl border backdrop-blur-xl animate-fade-in transition-all"
      style={{
        backgroundColor: isDark ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.96)',
        borderColor: themeColors.primary,
        boxShadow: `0 10px 25px -5px ${themeColors.primary}33`,
      }}
    >
      <div
        className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${themeColors.primary}25` }}
      >
        <ListPlus className="w-4 h-4" style={{ color: themeColors.primary }} />
      </div>

      <p className="text-xs sm:text-sm font-semibold text-slate-100 min-w-0 max-w-xs sm:max-w-md truncate">
        {toastMessage}
      </p>

      <button
        id="toast-dismiss-btn"
        onClick={clearToast}
        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/30 transition-colors ml-1 cursor-pointer"
        title="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
