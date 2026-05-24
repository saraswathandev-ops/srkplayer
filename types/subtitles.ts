/**
 * Subtitle types — shared between the native bridge, RN service facade,
 * overlay renderer, and persistence layer.
 */

export type SubtitleLang =
  | 'auto'
  | 'en'
  | 'ta'
  | 'hi'
  | 'te'
  | 'ml';

export type SubtitleModel = 'base' | 'small';

export type SubtitleFormat = 'srt' | 'vtt';

/** Lifecycle of a generation job. */
export type SubtitleJobStatus =
  | 'queued'
  | 'extracting'
  | 'transcribing'
  | 'writing'
  | 'complete'
  | 'cancelled'
  | 'error'
  | 'interrupted';

/** A single subtitle cue, in-memory representation used by the overlay. */
export interface SubtitleSegment {
  /** Start time in ms, relative to video start. */
  start: number;
  /** End time in ms. */
  end: number;
  /** Rendered text (may contain "\n" between two visual lines). */
  text: string;
  /** 0..1 confidence; below ~0.45 the overlay dims the cue. */
  confidence?: number;
}

/** A persisted, completed subtitle track for a video. */
export interface SubtitleTrack {
  id: number;
  videoHash: string;
  videoUri?: string;
  language: SubtitleLang;
  languageLabel: string;
  modelUsed: SubtitleModel;
  srtPath: string;
  vttPath: string;
  durationMs: number;
  segmentCount: number;
  generatedAt: number;
}

export interface SubtitleJob {
  jobId: string;
  videoUri: string;
  videoHash?: string;
  language: SubtitleLang;
  model: SubtitleModel;
  status: SubtitleJobStatus;
  progress: number;
  etaMs?: number;
  errorCode?: SubtitleErrorCode;
  errorMessage?: string;
  startedAt: number;
  updatedAt: number;
}

export type SubtitleErrorCode =
  | 'UNSUPPORTED_ABI'
  | 'NO_NATIVE_MODULE'
  | 'EXTRACT_FAILED'
  | 'MODEL_MISSING'
  | 'MODEL_CORRUPT'
  | 'WHISPER_FAULT'
  | 'OOM'
  | 'LOW_STORAGE'
  | 'LOW_BATTERY'
  | 'NO_SPEECH'
  | 'CANCELLED'
  | 'UNKNOWN';

export interface GenerateOptions {
  language?: SubtitleLang;
  model?: SubtitleModel;
  /** Whisper translate-to-English mode. */
  translateToEnglish?: boolean;
  /** Run only when device is charging (mapped to WorkManager constraint). */
  requireCharging?: boolean;
}

/** Event payloads from the native bridge. */
export interface SubtitleProgressEvent {
  jobId: string;
  status: SubtitleJobStatus;
  progress: number;
  etaMs?: number;
}

export interface SubtitleSegmentsEvent {
  jobId: string;
  /** Newly produced delta — not the full list. */
  segments: SubtitleSegment[];
}

export interface SubtitleDoneEvent {
  jobId: string;
  track: SubtitleTrack;
}

export interface SubtitleErrorEvent {
  jobId: string;
  code: SubtitleErrorCode;
  message: string;
}

export const LANG_LABELS: Record<SubtitleLang, string> = {
  auto: 'Auto-detect',
  en: 'English',
  ta: 'Tamil',
  hi: 'Hindi',
  te: 'Telugu',
  ml: 'Malayalam',
};

/** Languages for which `small` is the recommended floor. */
export const INDIC_LANGS: SubtitleLang[] = ['ta', 'te', 'ml', 'hi'];
