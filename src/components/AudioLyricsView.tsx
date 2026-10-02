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
  RefreshCw,
  Info,
  Radio,
  Sliders,
  ChevronDown,
  ChevronUp,
  Music,
} from 'lucide-react';
import { VideoItem, LyricLine, TrackLyrics, LyricsSettings } from '../types';
import { AudioMetadataTags } from '../utils/audioMetadata';
import {
  getLyricsForMedia,
  saveCustomLyrics,
  parseLrc,
  getActiveLyricIndex,
  exportLyricsAsLrc,
} from '../services/transcriptService';
import {
  lyricsMatchingService,
  LyricsMatchResult,
} from '../services/lyricsMatchingService';
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
  embeddedTags?: AudioMetadataTags | null;
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
  embeddedTags,
}: AudioLyricsViewProps) {
  const [lyricsData, setLyricsData] = useState<TrackLyrics | null>(() =>
    getLyricsForMedia(activeMedia.id)
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');

  // Auto-matching & metadata analysis state
  const [matchResult, setMatchResult] = useState<LyricsMatchResult | null>(null);
  const [isMatching, setIsMatching] = useState(false);
  const [showMatchDetails, setShowMatchDetails] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  // Subscribe to real-time auto-matching events and kick off matching if needed
  useEffect(() => {
    const unsubscribe = lyricsMatchingService.subscribe(activeMedia.id, (result) => {
      setMatchResult(result);
      if (result.lyrics) {
        setLyricsData(result.lyrics);
      }
      setIsMatching(result.status === 'analyzing' || result.status === 'searching');
    });

    const existing = getLyricsForMedia(activeMedia.id);
    if (existing && existing.lines.length > 0) {
      setLyricsData(existing);
      setIsMatching(false);
    } else {
      // Automatically attempt metadata analysis and matching
      setIsMatching(true);
      lyricsMatchingService.autoMatchLyrics(activeMedia, embeddedTags || undefined);
    }

    setSearchQuery('');
    return () => unsubscribe();
  }, [activeMedia.id, embeddedTags]);

  const handleManualAutoMatch = async () => {
    setIsMatching(true);
    try {
      const res = await lyricsMatchingService.autoMatchLyrics(
        activeMedia,
        embeddedTags || undefined,
        true
      );
      if (res.lyrics) {
        onShowToast(`Auto-matched lyrics with ${res.confidence}% confidence!`);
      } else {
        onShowToast('No synchronized lyrics found for this track.');
      }
    } catch {
      onShowToast('Lyrics matching encountered an error.');
    } finally {
      setIsMatching(false);
    }
  };

  const handleSelectAlternative = (alt: any) => {
    if (alt.syncedLyrics) {
      const parsed = parseLrc(alt.syncedLyrics, activeMedia.id, alt.title, alt.artist);
      saveCustomLyrics(parsed);
      setLyricsData(parsed);
      onShowToast(`Switched to "${alt.artist} - ${alt.title}" synchronized lyrics!`);
    }
    setShowMatchDetails(false);
  };

  const lines = lyricsData?.lines || [];

  // Determine active lyric index
  const activeIndex = useMemo(() => {
    if (!lines || lines.length === 0) return -1;
    return getActiveLyricIndex(lines, currentTime);
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

  const fontClass = {
    small: {
      primary: 'text-xs sm:text-sm font-semibold',
      secondary: 'text-[11px] sm:text-xs',
    },
    medium: {
      primary: 'text-sm sm:text-lg md:text-xl font-bold',
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
      className="w-full max-w-2xl mx-auto flex flex-col h-[400px] sm:h-[450px] rounded-3xl border shadow-xl overflow-hidden backdrop-blur-xl relative"
      style={{
        backgroundColor: isDark ? 'rgba(15, 18, 28, 0.90)' : 'rgba(255, 255, 255, 0.92)',
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

        {/* Right Tools: Re-match, Font Size, Auto-Scroll, Search, Import */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Metadata Re-analyze & Match button */}
          <button
            onClick={handleManualAutoMatch}
            disabled={isMatching}
            className={`p-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              isMatching
                ? 'text-amber-400 border-amber-500/40 bg-amber-500/10'
                : 'text-slate-300 border-slate-700/40 hover:text-white hover:bg-white/10'
            }`}
            title="Auto-match lyrics using audio metadata analysis"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isMatching ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline text-[11px]">Match</span>
          </button>

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

      {/* Metadata Analysis & Match Status Header Banner */}
      <div
        className="px-3 sm:px-4 py-2 border-b flex items-center justify-between text-xs bg-slate-900/60 transition-colors"
        style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
      >
        <div className="flex items-center gap-2 overflow-hidden truncate">
          {isMatching ? (
            <div className="flex items-center gap-1.5 text-amber-300 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span className="truncate">Analyzing metadata & matching lyrics...</span>
            </div>
          ) : matchResult?.status === 'matched' ? (
            <div className="flex items-center gap-1.5 truncate text-emerald-400 font-medium">
              <Sparkles className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
              <span className="truncate">
                Auto-matched: <strong className="text-white">{matchResult.matchedTitle || activeMedia.title}</strong>
                {matchResult.matchedArtist && (
                  <span className="text-slate-400 ml-1">by {matchResult.matchedArtist}</span>
                )}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">
                {matchResult.confidence}% match
              </span>
            </div>
          ) : lines.length > 0 ? (
            <div className="flex items-center gap-1.5 text-indigo-300 font-medium truncate">
              <Check className="w-3.5 h-3.5 text-indigo-400" />
              <span className="truncate">Synchronized lyrics active ({lines.length} lines)</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-slate-400 truncate">
              <Info className="w-3.5 h-3.5" />
              <span className="truncate">No synchronized lyrics matched yet</span>
            </div>
          )}
        </div>

        {/* Inspect Metadata / Toggle Details */}
        <button
          onClick={() => setShowMatchDetails(!showMatchDetails)}
          className="text-[11px] font-semibold text-slate-400 hover:text-white flex items-center gap-1 shrink-0 ml-2 transition-colors cursor-pointer"
        >
          <span>Metadata Info</span>
          {showMatchDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Metadata Analysis Detailed Inspection Drawer */}
      {showMatchDetails && (
        <div
          className="p-3 sm:p-4 border-b bg-slate-950/80 backdrop-blur-md space-y-3 text-xs animate-in slide-in-from-top-2"
          style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-300">
            <div className="space-y-1">
              <p className="text-[10px] uppercase font-bold text-slate-500">Track Identification</p>
              <p><strong className="text-white">Cleaned Title:</strong> {matchResult?.metadataAnalysis.cleanedTitle || activeMedia.title}</p>
              <p><strong className="text-white">Cleaned Artist:</strong> {matchResult?.metadataAnalysis.cleanedArtist || activeMedia.artist || 'Unknown'}</p>
              <p><strong className="text-white">Duration:</strong> {formatTime(activeMedia.duration || 0)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase font-bold text-slate-500">Analysis Breakdown</p>
              <p><strong className="text-white">Match Source:</strong> {matchResult?.source?.toUpperCase() || 'LOCAL / AUTO'}</p>
              <p><strong className="text-white">Embedded ID3 Lyrics:</strong> {embeddedTags?.hasEmbeddedLyrics ? 'Detected in File' : 'None'}</p>
              <p><strong className="text-white">Match Confidence:</strong> {matchResult?.confidence || 0}%</p>
            </div>
          </div>

          {/* Alternative Candidates */}
          {matchResult?.alternativeMatches && matchResult.alternativeMatches.length > 1 && (
            <div className="pt-2 border-t border-white/10 space-y-1.5">
              <p className="text-[10px] uppercase font-bold text-slate-400">Alternative Matches Found</p>
              <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                {matchResult.alternativeMatches.slice(0, 4).map((alt, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs transition-colors"
                  >
                    <span className="truncate max-w-[200px] sm:max-w-xs text-slate-300">
                      {alt.artist} - {alt.title}
                    </span>
                    <button
                      onClick={() => handleSelectAlternative(alt)}
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer shrink-0"
                    >
                      Use ({alt.confidence}%)
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
        className="flex-1 overflow-y-auto px-4 sm:px-8 py-8 space-y-5 text-center select-text scroll-smooth"
      >
        {filteredLines.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400">
            <div className="relative mb-3">
              <Mic className="w-12 h-12 opacity-30 text-indigo-400" />
              {isMatching && (
                <Sparkles className="w-5 h-5 text-amber-400 absolute -top-1 -right-1 animate-spin" />
              )}
            </div>
            <h4 className="font-bold text-sm text-slate-200">
              {isMatching ? 'Analyzing metadata for lyrics...' : 'No lyrics found'}
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {searchQuery
                ? `No lyric lines match "${searchQuery}".`
                : isMatching
                ? 'Scanning embedded tags, audio duration, and open synced databases...'
                : 'Auto-matching did not find an exact match. You can retry with metadata analysis or import an .LRC file.'}
            </p>
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={handleManualAutoMatch}
                disabled={isMatching}
                className="px-4 py-1.5 rounded-xl text-xs font-bold text-white shadow-md cursor-pointer flex items-center gap-1.5"
                style={{ backgroundColor: themeColors.primary }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Auto-Match Lyrics</span>
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-700/50 text-slate-300 hover:text-white cursor-pointer"
              >
                Import .LRC
              </button>
            </div>
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
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'rgba(0, 0, 0, 0.05)'
                    : 'transparent',
                }}
              >
                {/* Dual Language View */}
                {lyricsSettings.languageMode === 'dual' ? (
                  <div className="space-y-1">
                    {line.textNative ? (
                      <>
                        <p
                          className={`${fontClass.primary} transition-colors ${
                            isActive ? 'text-white' : 'text-slate-300 group-hover:text-white'
                          }`}
                          style={{
                            color: isActive ? themeColors.primary : undefined,
                          }}
                        >
                          {line.textNative}
                        </p>
                        <p className={`${fontClass.secondary} text-slate-400 group-hover:text-slate-300`}>
                          {line.textEnglish}
                        </p>
                      </>
                    ) : (
                      <p
                        className={`${fontClass.primary} transition-colors ${
                          isActive ? 'text-white' : 'text-slate-300 group-hover:text-white'
                        }`}
                        style={{
                          color: isActive ? themeColors.primary : undefined,
                        }}
                      >
                        {line.textEnglish}
                      </p>
                    )}
                  </div>
                ) : lyricsSettings.languageMode === 'native' ? (
                  <p
                    className={`${fontClass.primary} transition-colors ${
                      isActive ? 'text-white' : 'text-slate-300 group-hover:text-white'
                    }`}
                    style={{
                      color: isActive ? themeColors.primary : undefined,
                    }}
                  >
                    {line.textNative || line.textEnglish}
                  </p>
                ) : lyricsSettings.languageMode === 'romanized' && line.textRomanized ? (
                  <p
                    className={`${fontClass.primary} transition-colors ${
                      isActive ? 'text-white' : 'text-slate-300 group-hover:text-white'
                    }`}
                    style={{
                      color: isActive ? themeColors.primary : undefined,
                    }}
                  >
                    {line.textRomanized}
                  </p>
                ) : (
                  <p
                    className={`${fontClass.primary} transition-colors ${
                      isActive ? 'text-white' : 'text-slate-300 group-hover:text-white'
                    }`}
                    style={{
                      color: isActive ? themeColors.primary : undefined,
                    }}
                  >
                    {line.textEnglish}
                  </p>
                )}

                {/* Timestamp tag shown on hover or when active */}
                <div
                  className={`text-[10px] font-mono mt-1 transition-opacity ${
                    isActive ? 'opacity-80 text-emerald-400 font-bold' : 'opacity-0 group-hover:opacity-60 text-slate-500'
                  }`}
                >
                  {formatTime(line.time)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Import / Edit Lyrics Modal */}
      {showImportModal && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-30 flex items-center justify-center p-4">
          <div
            className="w-full max-w-lg rounded-3xl border p-5 sm:p-6 space-y-4 shadow-2xl"
            style={{
              backgroundColor: isDark ? '#0f121c' : '#ffffff',
              borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5" style={{ color: themeColors.primary }} />
                <h3 className="font-extrabold text-sm sm:text-base text-slate-100">
                  Import Synchronized Lyrics (.LRC)
                </h3>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Upload an .lrc file or paste lyrics text below. You can include synchronized timestamps like <span className="font-mono text-emerald-400">[00:15.20]</span> and dual lines like <span className="font-mono text-amber-300">Native / English</span>!
            </p>

            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={`[00:12.50]First line of lyrics\n[00:18.20]Second line of lyrics\n[00:24.00]Native script / English translation`}
              className="w-full h-44 p-3 rounded-2xl border text-xs font-mono bg-black/40 text-slate-200 placeholder-slate-600 focus:outline-hidden"
              style={{
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              }}
            />

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="px-3 py-1.5 rounded-xl border border-slate-700/50 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload .lrc File</span>
                <input
                  type="file"
                  accept=".lrc,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportSubmit}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold text-white shadow-md cursor-pointer"
                  style={{ backgroundColor: themeColors.primary }}
                >
                  Save & Synchronize
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
