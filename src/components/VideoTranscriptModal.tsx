import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Search,
  Check,
  Copy,
  Download,
  Upload,
  Play,
  Languages,
  Subtitles,
  Sparkles,
  ArrowDownCircle,
  FileText,
} from 'lucide-react';
import { CaptionCue, MediaTranscript, SubtitleSettings } from '../types';
import {
  exportTranscriptAsSrt,
  exportTranscriptAsTxt,
  parseSrtOrVtt,
  saveCustomTranscript,
} from '../services/transcriptService';
import { formatTime } from '../utils/formatters';

interface VideoTranscriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transcript: MediaTranscript | null;
  currentTime: number;
  duration: number;
  onSeek: (seconds: number) => void;
  subtitleSettings: SubtitleSettings;
  onUpdateSubtitleSettings: (partial: Partial<SubtitleSettings>) => void;
  themeColors: {
    primary: string;
    cardDark: string;
    cardLight: string;
    borderDark: string;
    borderLight: string;
  };
  isDark: boolean;
  onShowToast: (msg: string) => void;
  onTranscriptUpdated?: (updated: MediaTranscript) => void;
}

export function VideoTranscriptModal({
  isOpen,
  onClose,
  transcript,
  currentTime,
  onSeek,
  subtitleSettings,
  onUpdateSubtitleSettings,
  themeColors,
  isDark,
  onShowToast,
  onTranscriptUpdated,
}: VideoTranscriptModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');

  const activeCueRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Active cue matching current video time
  const activeCueId = useMemo(() => {
    if (!transcript) return null;
    const current = transcript.cues.find(
      (c) => c.start <= currentTime && currentTime <= c.end
    );
    return current ? current.id : null;
  }, [transcript, currentTime]);

  // Auto-scroll to active cue
  useEffect(() => {
    if (!isOpen || !autoScroll || !activeCueRef.current || !containerRef.current) return;
    activeCueRef.current.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }, [activeCueId, autoScroll, isOpen]);

  if (!isOpen) return null;

  const cues = transcript?.cues || [];

  // Filter cues by search query
  const filteredCues = cues.filter((cue) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      cue.textEnglish.toLowerCase().includes(q) ||
      (cue.textNative && cue.textNative.toLowerCase().includes(q)) ||
      (cue.speaker && cue.speaker.toLowerCase().includes(q))
    );
  });

  const handleCopyTranscript = () => {
    if (!transcript) return;
    const txt = exportTranscriptAsTxt(transcript, subtitleSettings.languageMode);
    navigator.clipboard.writeText(txt);
    onShowToast('Transcript copied to clipboard!');
  };

  const handleDownloadSrt = () => {
    if (!transcript) return;
    const srt = exportTranscriptAsSrt(transcript, subtitleSettings.languageMode);
    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${transcript.title || 'video'}_captions.srt`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast('Downloaded captions as .SRT file');
  };

  const handleImportSubmit = () => {
    if (!importText.trim() || !transcript) return;
    try {
      const parsed = parseSrtOrVtt(importText, transcript.mediaId, transcript.title);
      saveCustomTranscript(parsed);
      if (onTranscriptUpdated) onTranscriptUpdated(parsed);
      setShowImportModal(false);
      setImportText('');
      onShowToast(`Imported ${parsed.cues.length} subtitle cues successfully!`);
    } catch (e) {
      console.error(e);
      onShowToast('Failed to parse subtitle text. Please verify SRT or VTT format.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !transcript) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (content) {
        setImportText(content);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      id="video-transcript-drawer"
      className="absolute top-0 right-0 bottom-0 w-full sm:w-[480px] md:w-[540px] z-50 flex flex-col shadow-2xl border-l backdrop-blur-2xl transition-all duration-300"
      style={{
        backgroundColor: isDark ? 'rgba(10, 14, 24, 0.96)' : 'rgba(255, 255, 255, 0.97)',
        borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div
        className="p-4 sm:p-5 border-b flex items-center justify-between gap-3 shrink-0"
        style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5" style={{ color: themeColors.primary }} />
            <h3 className="font-bold text-base sm:text-lg truncate">Video Transcript</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 truncate">
            {cues.length} cues • {transcript?.nativeLanguageLabel || 'English & Native Dual Script'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Closed Caption on-screen toggle */}
          <button
            onClick={() => onUpdateSubtitleSettings({ enabled: !subtitleSettings.enabled })}
            className={`p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              subtitleSettings.enabled
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'text-slate-400 hover:text-white border-transparent'
            }`}
            title="Toggle On-Screen Video Captions (CC)"
          >
            <Subtitles className="w-4 h-4" />
            <span className="hidden sm:inline">{subtitleSettings.enabled ? 'CC On' : 'CC Off'}</span>
          </button>

          <button
            id="close-transcript-btn"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close Transcript"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Controls & Search Bar */}
      <div
        className="p-3 sm:p-4 border-b space-y-3 shrink-0"
        style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
      >
        {/* Language selector tabs */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div
            className="flex items-center p-1 rounded-xl border text-xs font-semibold"
            style={{
              borderColor: isDark ? themeColors.borderDark : themeColors.borderLight,
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
            }}
          >
            <button
              onClick={() => onUpdateSubtitleSettings({ languageMode: 'dual' })}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                subtitleSettings.languageMode === 'dual'
                  ? 'text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              style={{
                backgroundColor: subtitleSettings.languageMode === 'dual' ? themeColors.primary : 'transparent',
              }}
            >
              <Sparkles className="w-3 h-3" />
              <span>Dual Script</span>
            </button>

            <button
              onClick={() => onUpdateSubtitleSettings({ languageMode: 'native' })}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                subtitleSettings.languageMode === 'native'
                  ? 'text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              style={{
                backgroundColor: subtitleSettings.languageMode === 'native' ? themeColors.primary : 'transparent',
              }}
            >
              <Languages className="w-3 h-3" />
              <span>Native</span>
            </button>

            <button
              onClick={() => onUpdateSubtitleSettings({ languageMode: 'english' })}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                subtitleSettings.languageMode === 'english'
                  ? 'text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              style={{
                backgroundColor: subtitleSettings.languageMode === 'english' ? themeColors.primary : 'transparent',
              }}
            >
              English
            </button>
          </div>

          {/* Auto-scroll toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
              autoScroll
                ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                : 'text-slate-400 border-slate-700/40 hover:text-white'
            }`}
            title="Automatically scroll to follow playback"
          >
            <ArrowDownCircle className="w-3.5 h-3.5" />
            <span>Follow Video</span>
          </button>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search words, phrases, or speakers in transcript..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 rounded-xl text-xs sm:text-sm bg-black/20 border text-white placeholder-slate-500 focus:outline-hidden transition-all"
            style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Cue List */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
        {filteredCues.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-xs">
            {searchQuery ? `No transcript lines found matching "${searchQuery}"` : 'No transcript cues found.'}
          </div>
        ) : (
          filteredCues.map((cue) => {
            const isActive = cue.id === activeCueId;
            return (
              <div
                key={cue.id}
                ref={isActive ? activeCueRef : null}
                onClick={() => onSeek(cue.start)}
                className={`group p-3 rounded-2xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                  isActive
                    ? 'shadow-lg ring-1'
                    : 'hover:bg-white/5 opacity-80 hover:opacity-100'
                }`}
                style={{
                  backgroundColor: isActive
                    ? isDark
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(0,0,0,0.05)'
                    : 'transparent',
                  borderColor: isActive
                    ? themeColors.primary
                    : isDark
                    ? 'rgba(255,255,255,0.07)'
                    : 'rgba(0,0,0,0.07)',
                }}
              >
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${
                        isActive
                          ? 'bg-amber-400/20 text-amber-300 font-bold'
                          : 'bg-white/5 text-slate-400 group-hover:text-white'
                      }`}
                    >
                      {formatTime(cue.start)} - {formatTime(cue.end)}
                    </span>

                    {cue.speaker && (
                      <span className="text-xs font-bold text-amber-400 truncate max-w-[140px]">
                        {cue.speaker}
                      </span>
                    )}
                  </div>

                  {isActive && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded-md">
                      <Play className="w-2.5 h-2.5 fill-emerald-400" />
                      PLAYING
                    </span>
                  )}
                </div>

                {/* Subtitle Lines */}
                {subtitleSettings.languageMode === 'dual' && cue.textNative ? (
                  <div className="space-y-1 mt-0.5">
                    <p
                      className="text-xs sm:text-sm font-semibold"
                      style={{ color: isActive ? '#FDE047' : '#FBBF24' }}
                    >
                      {cue.textNative}
                    </p>
                    <p className={`text-xs sm:text-sm ${isActive ? 'text-white font-medium' : 'text-slate-300'}`}>
                      {cue.textEnglish}
                    </p>
                  </div>
                ) : subtitleSettings.languageMode === 'native' && cue.textNative ? (
                  <p
                    className="text-xs sm:text-sm font-semibold"
                    style={{ color: isActive ? '#FDE047' : '#FBBF24' }}
                  >
                    {cue.textNative}
                  </p>
                ) : (
                  <p className={`text-xs sm:text-sm ${isActive ? 'text-white font-medium' : 'text-slate-300'}`}>
                    {cue.textEnglish}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Actions Toolbar */}
      <div
        className="p-3 sm:p-4 border-t flex items-center justify-between gap-2 shrink-0 bg-black/20"
        style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyTranscript}
            className="px-2.5 py-1.5 rounded-xl border border-slate-700/40 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer flex items-center gap-1.5"
            title="Copy full transcript text to clipboard"
          >
            <Copy className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Copy</span>
          </button>

          <button
            onClick={handleDownloadSrt}
            className="px-2.5 py-1.5 rounded-xl border border-slate-700/40 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer flex items-center gap-1.5"
            title="Export as standard .SRT subtitle file"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export SRT</span>
          </button>
        </div>

        <button
          onClick={() => setShowImportModal(true)}
          className="px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
          style={{ backgroundColor: themeColors.primary }}
          title="Import or paste custom SRT / VTT subtitle file"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Import Subtitles</span>
        </button>
      </div>

      {/* Import / Edit Subtitles Modal */}
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
              <h4 className="font-bold text-base">Import or Edit Subtitles</h4>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Upload a .srt or .vtt subtitle file, or paste raw subtitle text below. English and native lines will be automatically parsed!
            </p>

            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-300">Choose File (.srt, .vtt, .txt)</label>
              <input
                type="file"
                accept=".srt,.vtt,.txt"
                onChange={handleFileUpload}
                className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-white/10 file:text-white cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-300">Raw Subtitle Content</label>
              <textarea
                rows={7}
                placeholder="1&#10;00:00:01,000 --> 00:00:05,000&#10;Native script line&#10;English translation line&#10;..."
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
                Parse & Save Captions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
