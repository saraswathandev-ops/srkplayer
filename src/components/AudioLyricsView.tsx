import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Mic,
  Languages,
  Sparkles,
  Type,
  Upload,
  Copy,
  ArrowDownCircle,
  Play,
  X,
  FileText,
  Search,
  Check,
} from 'lucide-react';
import { VideoItem, LyricLine, TrackLyrics, LyricsSettings } from '../types';
import {
  getLyricsForMedia,
  saveCustomLyrics,
  parseLrc,
  exportLyricsAsLrc,
} from '../services/transcriptService';
import { formatTime } from '../utils/formatters';

interface AudioLyricsViewProps {
  activeMedia: VideoItem;
  currentTime: number;
  duration: number;
  onSeek: (seconds: number) => void;
  lyricsSettings: LyricsSettings;
  onUpdateLyricsSettings: (partial: Partial<LyricsSettings>) => void;
  themeColors: {
    primary: string;
    primaryDark?: string;
    accent?: string;
    cardDark: string;
    cardLight: string;
    borderDark: string;
    borderLight: string;
  };
  isDark: boolean;
  onShowToast: (msg: string) => void;
}

export function AudioLyricsView({
  activeMedia,
  currentTime,
  onSeek,
  lyricsSettings,
  onUpdateLyricsSettings,
  themeColors,
  isDark,
  onShowToast,
}: AudioLyricsViewProps) {
  const [lyricsData, setLyricsData] = useState<TrackLyrics | null>(() =>
    getLyricsForMedia(activeMedia.id)
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  // Reload lyrics whenever activeMedia changes
  useEffect(() => {
    setLyricsData(getLyricsForMedia(activeMedia.id));
    setSearchQuery('');
  }, [activeMedia.id]);

  const lines = lyricsData?.lines || [];

  // Determine active lyric index
  const activeIndex = useMemo(() => {
    if (!lines || lines.length === 0) return -1;
    let index = -1;
    for (let i = 0; i < lines.length; i++) {
      if (currentTime >= lines[i].time) {
        index = i;
      } else {
        break;
      }
    }
    return index;
  }, [lines, currentTime]);

  // Smoothly center active lyric line
  useEffect(() => {
    if (!lyricsSettings.autoScroll || !activeLineRef.current || !containerRef.current) return;
    activeLineRef.current.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }, [activeIndex, lyricsSettings.autoScroll]);

  const filteredLines = useMemo(() => {
    if (!searchQuery.trim()) return lines;
    const q = searchQuery.toLowerCase();
    return lines.filter(
      (l) =>
        l.textEnglish.toLowerCase().includes(q) ||
        (l.textNative && l.textNative.toLowerCase().includes(q)) ||
        (l.textRomanized && l.textRomanized.toLowerCase().includes(q))
    );
  }, [lines, searchQuery]);

  const handleCopy = () => {
    if (!lyricsData) return;
    const lrc = exportLyricsAsLrc(lyricsData, lyricsSettings.languageMode);
    navigator.clipboard.writeText(lrc);
    onShowToast('Lyrics copied to clipboard!');
  };

  const handleImportSubmit = () => {
    if (!importText.trim()) return;
    try {
      const parsed = parseLrc(importText, activeMedia.id, activeMedia.title, activeMedia.artist);
      saveCustomLyrics(parsed);
      setLyricsData(parsed);
      setShowImportModal(false);
      setImportText('');
      onShowToast(`Imported ${parsed.lines.length} lyric lines successfully!`);
    } catch (e) {
      console.error(e);
      onShowToast('Failed to parse lyrics. Please check the format.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (content) {
        setImportText(content);
      }
    };
    reader.readAsText(file);
  };

  const fontClasses = {
    small: {
      primary: 'text-sm sm:text-base font-medium',
      secondary: 'text-xs sm:text-sm',
    },
    medium: {
      primary: 'text-base sm:text-lg md:text-xl font-semibold',
      secondary: 'text-xs sm:text-sm',
    },
    large: {
      primary: 'text-lg sm:text-2xl md:text-3xl font-bold',
      secondary: 'text-sm sm:text-base font-medium',
    },
  }[lyricsSettings.fontSize];

  return (
    <div
      id="audio-lyrics-container"
      className="w-full max-w-2xl mx-auto flex flex-col h-[380px] sm:h-[430px] rounded-3xl border shadow-xl overflow-hidden backdrop-blur-xl"
      style={{
        backgroundColor: isDark ? 'rgba(15, 18, 28, 0.88)' : 'rgba(255, 255, 255, 0.92)',
        borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
      }}
    >
      {/* Top Controls Bar */}
      <div
        className="p-3 sm:p-4 border-b flex items-center justify-between gap-2 flex-wrap shrink-0"
        style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
      >
        {/* Language Tabs */}
        <div
          className="flex items-center p-1 rounded-xl border text-xs font-semibold"
          style={{
            borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
          }}
        >
          <button
            onClick={() => onUpdateLyricsSettings({ languageMode: 'dual' })}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
              lyricsSettings.languageMode === 'dual'
                ? 'text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
            style={{
              backgroundColor: lyricsSettings.languageMode === 'dual' ? themeColors.primary : 'transparent',
            }}
            title="Display both Native script and English translation"
          >
            <Sparkles className="w-3 h-3" />
            <span>Dual</span>
          </button>

          <button
            onClick={() => onUpdateLyricsSettings({ languageMode: 'native' })}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
              lyricsSettings.languageMode === 'native'
                ? 'text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
            style={{
              backgroundColor: lyricsSettings.languageMode === 'native' ? themeColors.primary : 'transparent',
            }}
            title={lyricsData?.nativeLanguageLabel ? `Native language: ${lyricsData.nativeLanguageLabel}` : 'Native Script'}
          >
            <Languages className="w-3 h-3" />
            <span>{lyricsData?.nativeLanguageLabel?.split(' ')[0] || 'Native'}</span>
          </button>

          <button
            onClick={() => onUpdateLyricsSettings({ languageMode: 'english' })}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
              lyricsSettings.languageMode === 'english'
                ? 'text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
            style={{
              backgroundColor: lyricsSettings.languageMode === 'english' ? themeColors.primary : 'transparent',
            }}
          >
            English
          </button>

          {lyricsData?.lines.some((l) => l.textRomanized) && (
            <button
              onClick={() => onUpdateLyricsSettings({ languageMode: 'romanized' })}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                lyricsSettings.languageMode === 'romanized'
                  ? 'text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              style={{
                backgroundColor: lyricsSettings.languageMode === 'romanized' ? themeColors.primary : 'transparent',
              }}
              title="Phonetic Romanization / Romaji"
            >
              Romaji
            </button>
          )}
        </div>

        {/* Right Tools: Font Size, Auto-Scroll, Import, Search */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Font Size Selector */}
          <button
            onClick={() => {
              const sizes: ('small' | 'medium' | 'large')[] = ['small', 'medium', 'large'];
              const next = sizes[(sizes.indexOf(lyricsSettings.fontSize) + 1) % sizes.length];
              onUpdateLyricsSettings({ fontSize: next });
            }}
            className="p-1.5 rounded-xl border border-slate-700/30 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-0.5"
            title={`Font Size: ${lyricsSettings.fontSize}`}
          >
            <Type className="w-3.5 h-3.5" />
            <span className="text-[10px] uppercase font-bold">{lyricsSettings.fontSize[0]}</span>
          </button>

          {/* Auto-scroll toggle */}
          <button
            onClick={() => onUpdateLyricsSettings({ autoScroll: !lyricsSettings.autoScroll })}
            className={`p-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              lyricsSettings.autoScroll
                ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                : 'text-slate-500 border-slate-700/30 hover:text-slate-300'
            }`}
            title="Auto-scroll to current lyric line"
          >
            <ArrowDownCircle className="w-3.5 h-3.5" />
          </button>

          {/* Search button */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
              showSearch ? 'text-white bg-white/10 border-white/20' : 'text-slate-400 border-slate-700/30 hover:text-white'
            }`}
            title="Search lyrics"
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-xl border border-slate-700/30 text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Copy lyrics to clipboard"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          {/* Import / Edit button */}
          <button
            onClick={() => setShowImportModal(true)}
            className="px-2 py-1 rounded-xl text-xs font-semibold border border-slate-700/40 text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer flex items-center gap-1"
            title="Import or edit LRC lyrics"
          >
            <Upload className="w-3 h-3" />
            <span className="hidden sm:inline">Import</span>
          </button>
        </div>
      </div>

      {/* Search Input (conditionally visible) */}
      {showSearch && (
        <div className="px-4 py-2 border-b bg-black/20 flex items-center gap-2 shrink-0">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search lyrics lines..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 focus:outline-hidden"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="p-0.5 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Synchronized Lyrics Body */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-4 sm:px-8 py-8 space-y-5 text-center select-text"
      >
        {filteredLines.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-400">
            <Mic className="w-12 h-12 mb-3 opacity-40" />
            <h4 className="font-bold text-sm">No lyrics found</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {searchQuery
                ? `No lyric lines match "${searchQuery}".`
                : 'You can import or paste synchronized .lrc or plain text lyrics for this track.'}
            </p>
            <button
              onClick={() => setShowImportModal(true)}
              className="mt-4 px-4 py-1.5 rounded-xl text-xs font-bold text-white shadow-md cursor-pointer"
              style={{ backgroundColor: themeColors.primary }}
            >
              Add Lyrics Now
            </button>
          </div>
        ) : (
          filteredLines.map((line, idx) => {
            const originalIndex = lines.indexOf(line);
            const isActive = originalIndex === activeIndex;

            return (
              <div
                key={line.id}
                ref={isActive ? activeLineRef : null}
                onClick={() => onSeek(line.time)}
                className={`group py-2 px-3 rounded-2xl transition-all duration-300 cursor-pointer ${
                  isActive
                    ? 'scale-[1.03] shadow-md'
                    : 'opacity-40 hover:opacity-85 hover:scale-[1.01]'
                }`}
                style={{
                  backgroundColor: isActive
                    ? isDark
                      ? 'rgba(255, 255, 255, 0.07)'
                      : 'rgba(0, 0, 0, 0.04)'
                    : 'transparent',
                }}
              >
                {/* Time Indicator on Hover or Active */}
                <div className="flex items-center justify-center gap-1.5 mb-1 text-[10px] font-mono opacity-0 group-hover:opacity-80 transition-opacity">
                  <Play className="w-2.5 h-2.5 fill-current" />
                  <span>{formatTime(line.time)}</span>
                </div>

                {/* Dual Mode: Native on top, English translation below */}
                {lyricsSettings.languageMode === 'dual' ? (
                  <div className="space-y-1">
                    {line.textNative && (
                      <p
                        className={`${fontClasses.primary} transition-colors duration-200 tracking-wide`}
                        style={{
                          color: isActive ? '#FDE047' : isDark ? '#F3F4F6' : '#1F2937',
                          textShadow: isActive ? '0 0 16px rgba(253, 224, 71, 0.4)' : undefined,
                        }}
                      >
                        {line.textNative}
                      </p>
                    )}
                    <p
                      className={`${fontClasses.secondary} transition-colors duration-200 ${
                        isActive ? 'text-white font-medium' : 'text-slate-400'
                      }`}
                    >
                      {line.textEnglish}
                    </p>
                    {line.textRomanized && (
                      <p className="text-[11px] text-slate-400 italic font-mono">
                        {line.textRomanized}
                      </p>
                    )}
                  </div>
                ) : lyricsSettings.languageMode === 'native' ? (
                  /* Native Only */
                  <div className="space-y-0.5">
                    <p
                      className={`${fontClasses.primary} transition-colors duration-200 tracking-wide`}
                      style={{
                        color: isActive ? '#FDE047' : isDark ? '#F3F4F6' : '#1F2937',
                        textShadow: isActive ? '0 0 16px rgba(253, 224, 71, 0.4)' : undefined,
                      }}
                    >
                      {line.textNative || line.textEnglish}
                    </p>
                  </div>
                ) : lyricsSettings.languageMode === 'romanized' && line.textRomanized ? (
                  /* Romanized Only */
                  <div className="space-y-0.5">
                    <p
                      className={`${fontClasses.primary} transition-colors duration-200 italic font-mono`}
                      style={{
                        color: isActive ? '#FDE047' : isDark ? '#F3F4F6' : '#1F2937',
                      }}
                    >
                      {line.textRomanized}
                    </p>
                    <p className="text-xs text-slate-400">{line.textEnglish}</p>
                  </div>
                ) : (
                  /* English Only */
                  <p
                    className={`${fontClasses.primary} transition-colors duration-200`}
                    style={{
                      color: isActive ? themeColors.primary : isDark ? '#F3F4F6' : '#1F2937',
                      textShadow: isActive ? `0 0 14px ${themeColors.primary}66` : undefined,
                    }}
                  >
                    {line.textEnglish}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Import / Edit Lyrics Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="w-full max-w-lg rounded-3xl border shadow-2xl p-5 space-y-4"
            style={{
              backgroundColor: isDark ? '#131622' : '#FFFFFF',
              borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
            }}
          >
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-base">Import or Edit Lyrics</h4>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Upload an .lrc file or paste lyrics text below. You can include synchronized timestamps like <span className="font-mono text-emerald-400">[00:15.20]</span> and dual lines like <span className="font-mono text-amber-300">Native / English</span>!
            </p>

            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-300">Choose File (.lrc, .txt)</label>
              <input
                type="file"
                accept=".lrc,.txt"
                onChange={handleFileUpload}
                className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-white/10 file:text-white cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-300">Lyrics Content</label>
              <textarea
                rows={7}
                placeholder="[00:04.00]雨の音 / Sound of rain&#10;[00:12.00]ネオンの光 / Neon lights..."
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                className="w-full p-3 rounded-2xl bg-black/30 border text-xs font-mono text-white placeholder-slate-600 focus:outline-hidden"
                style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleImportSubmit}
                disabled={!importText.trim()}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50 cursor-pointer shadow-md"
                style={{ backgroundColor: themeColors.primary }}
              >
                Save Lyrics
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
