/**
 * subtitleService.ts
 *
 * TS facade for the SubtitleGenerator native module. Surfaces a small Promise
 * API + a DeviceEventEmitter stream, isolating the rest of the app from the
 * fact that this is a JNI/whisper.cpp pipeline.
 *
 * Phase 1: the native module is not yet wired. When `NativeModules.SubtitleGenerator`
 * is missing, the facade falls back to a deterministic *mock* job that progresses
 * over ~8 seconds and emits fake segments. This unblocks UI development and
 * makes the rest of the app testable on iOS / Metro / web before the Kotlin
 * module lands.
 */

import { DeviceEventEmitter, NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { log } from '@/utils/logger';
import { db, initDB } from '@/services/database';
import { parseSubtitles, postProcessSegments, toSrt, toVtt } from '@/services/subtitleParser';
import type {
  GenerateOptions,
  SubtitleDoneEvent,
  SubtitleErrorEvent,
  SubtitleJob,
  SubtitleJobStatus,
  SubtitleLang,
  SubtitleProgressEvent,
  SubtitleSegment,
  SubtitleSegmentsEvent,
  SubtitleTrack,
} from '@/types/subtitles';
import { LANG_LABELS } from '@/types/subtitles';

const L = log('Subtitles');

// ─── Native module resolution ───────────────────────────────────────────────

interface NativeSubtitleModule {
  generateSubtitles(videoUri: string, opts: GenerateOptions): Promise<{ jobId: string }>;
  cancelSubtitleGeneration(jobId: string): Promise<void>;
  getGenerationProgress(jobId: string): Promise<SubtitleProgressEvent>;
  /** Returns true if this device's ABI + memory class supports the feature. */
  isSupported(): Promise<boolean>;
}

const nativeModule: NativeSubtitleModule | undefined =
  (NativeModules as any).SubtitleGenerator;

const isNativeAvailable = !!nativeModule && Platform.OS === 'android';

if (__DEV__) {
  L.info('module_resolved', {
    hasNative: !!nativeModule,
    platform: Platform.OS,
    usingMock: !isNativeAvailable,
  });
}

// Native -> JS event channel. On Android we use NativeEventEmitter wired to the
// module; otherwise DeviceEventEmitter for the mock path.
const emitter = isNativeAvailable
  ? new NativeEventEmitter(NativeModules.SubtitleGenerator)
  : DeviceEventEmitter;

// ─── In-process job registry ────────────────────────────────────────────────

const jobs = new Map<string, SubtitleJob>();
const segmentBuffers = new Map<string, SubtitleSegment[]>();

function upsertJob(jobId: string, patch: Partial<SubtitleJob>): SubtitleJob {
  const prev = jobs.get(jobId);
  const next: SubtitleJob = {
    jobId,
    videoUri: prev?.videoUri ?? '',
    language: prev?.language ?? 'auto',
    model: prev?.model ?? 'base',
    status: prev?.status ?? 'queued',
    progress: prev?.progress ?? 0,
    startedAt: prev?.startedAt ?? Date.now(),
    updatedAt: Date.now(),
    ...patch,
  };
  jobs.set(jobId, next);
  return next;
}

export function getJob(jobId: string): SubtitleJob | undefined {
  return jobs.get(jobId);
}

export function getSegments(jobId: string): SubtitleSegment[] {
  return segmentBuffers.get(jobId) ?? [];
}

// ─── DB helpers ─────────────────────────────────────────────────────────────

async function listSubtitlesForHash(videoHash: string): Promise<SubtitleTrack[]> {
  await initDB();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM Subtitles WHERE videoHash = ? ORDER BY generatedAt DESC`,
    [videoHash],
  );
  return rows.map(rowToTrack);
}

async function listSubtitlesForUri(videoUri: string): Promise<SubtitleTrack[]> {
  await initDB();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM Subtitles WHERE videoUri = ? ORDER BY generatedAt DESC`,
    [videoUri],
  );
  return rows.map(rowToTrack);
}

function rowToTrack(row: any): SubtitleTrack {
  return {
    id: row.id,
    videoHash: row.videoHash,
    videoUri: row.videoUri ?? undefined,
    language: row.language as SubtitleLang,
    languageLabel: row.languageLabel,
    modelUsed: row.modelUsed,
    srtPath: row.srtPath,
    vttPath: row.vttPath,
    durationMs: row.durationMs,
    segmentCount: row.segmentCount,
    generatedAt: row.generatedAt,
  };
}

async function insertSubtitleTrack(track: Omit<SubtitleTrack, 'id'>): Promise<SubtitleTrack> {
  await initDB();
  const now = Date.now();
  const res = await db.runAsync(
    `INSERT OR REPLACE INTO Subtitles
       (videoHash, videoUri, language, languageLabel, modelUsed,
        srtPath, vttPath, durationMs, segmentCount, generatedAt, lastUsedAt, isEnabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      track.videoHash,
      track.videoUri ?? null,
      track.language,
      track.languageLabel,
      track.modelUsed,
      track.srtPath,
      track.vttPath,
      track.durationMs,
      track.segmentCount,
      track.generatedAt,
      now,
    ],
  );
  return { ...track, id: res.lastInsertRowId };
}

// ─── Public listing API ─────────────────────────────────────────────────────

export async function listSubtitles(opts: {
  videoUri?: string;
  videoHash?: string;
}): Promise<SubtitleTrack[]> {
  if (opts.videoHash) return listSubtitlesForHash(opts.videoHash);
  if (opts.videoUri) return listSubtitlesForUri(opts.videoUri);
  return [];
}

export async function deleteSubtitle(id: number): Promise<void> {
  await initDB();
  const row = await db.getFirstAsync<any>(`SELECT srtPath, vttPath FROM Subtitles WHERE id = ?`, [id]);
  await db.runAsync(`DELETE FROM Subtitles WHERE id = ?`, [id]);
  if (row?.srtPath) {
    try {
      const RNFS = require('react-native-fs');
      await RNFS.unlink(row.srtPath).catch(() => undefined);
      await RNFS.unlink(row.vttPath).catch(() => undefined);
    } catch {
      /* ignore — module not installed in test env */
    }
  }
}

export async function markSubtitleUsed(id: number): Promise<void> {
  await initDB();
  await db.runAsync(`UPDATE Subtitles SET lastUsedAt = ? WHERE id = ?`, [Date.now(), id]);
}

// ─── Generation ─────────────────────────────────────────────────────────────

export async function isSupported(): Promise<boolean> {
  if (!isNativeAvailable) return false;
  try {
    return await nativeModule!.isSupported();
  } catch {
    return false;
  }
}

export async function generateSubtitles(
  videoUri: string,
  opts: GenerateOptions = {},
): Promise<{ jobId: string }> {
  const resolvedOpts: GenerateOptions = {
    language: opts.language ?? 'auto',
    model: opts.model ?? 'base',
    translateToEnglish: opts.translateToEnglish ?? false,
    requireCharging: opts.requireCharging ?? false,
  };

  if (!isNativeAvailable) {
    throw new Error("Offline subtitle generation is unavailable: native SubtitleGenerator module is not installed.");
  }
  const supported = await isSupported();
  if (!supported) {
    throw new Error("Offline subtitle generation is unavailable on this device or build.");
  }

  // ── Mock path ───────────────────────────────────────────────────────────
  const { jobId } = await nativeModule!.generateSubtitles(videoUri, resolvedOpts);
  upsertJob(jobId, {
    videoUri,
    language: resolvedOpts.language!,
    model: resolvedOpts.model!,
    status: 'queued',
    progress: 0,
  });
  return { jobId };
}

export async function cancelSubtitleGeneration(jobId: string): Promise<void> {
  if (!isNativeAvailable) {
    throw new Error("Offline subtitle generation is unavailable: native SubtitleGenerator module is not installed.");
  }
  await nativeModule!.cancelSubtitleGeneration(jobId);
}

export async function getGenerationProgress(jobId: string): Promise<SubtitleProgressEvent | null> {
  if (!isNativeAvailable) return null;
  try {
    return await nativeModule!.getGenerationProgress(jobId);
  } catch {
    return null;
  }
}

// ─── Event subscription helpers ─────────────────────────────────────────────

type EventName = 'subtitleProgress' | 'subtitleSegments' | 'subtitleDone' | 'subtitleError';

type EventPayloads = {
  subtitleProgress: SubtitleProgressEvent;
  subtitleSegments: SubtitleSegmentsEvent;
  subtitleDone: SubtitleDoneEvent;
  subtitleError: SubtitleErrorEvent;
};

export function subscribe<E extends EventName>(
  event: E,
  handler: (payload: EventPayloads[E]) => void,
): () => void {
  const wrapped = (payload: EventPayloads[E]) => {
    if (__DEV__) L.info(`subscribe:${event}:received`, payload as any);
    handler(payload);
  };
  const sub = emitter.addListener(event, wrapped as any);
  if (__DEV__) L.info(`subscribe:${event}:attached`);
  return () => {
    if (__DEV__) L.info(`subscribe:${event}:detached`);
    sub.remove();
  };
}

function emit<E extends EventName>(event: E, payload: EventPayloads[E]): void {
  if (__DEV__) L.info(`emit:${event}`, payload as any);
  // DeviceEventEmitter accepts arbitrary names; NativeEventEmitter is read-only
  // from JS so we only emit in the mock path.
  (DeviceEventEmitter as any).emit(event, payload);
}

// ─── Mock generator (Phase 1 stand-in for the native pipeline) ──────────────

const mockTimers = new Map<string, ReturnType<typeof setInterval>>();

const MOCK_LINES: Record<SubtitleLang, string[]> = {
  auto: [
    'Welcome to SRK Player.',
    'This is a simulated subtitle stream.',
    'Native generation will replace this in Phase 4.',
    'Captions appear word-by-word as Whisper produces them.',
  ],
  en: [
    'Welcome to SRK Player.',
    'This is an English caption preview.',
    'Real subtitles will run fully offline.',
    'Drag this caption to reposition it.',
  ],
  ta: [
    'வரவேற்கிறோம்.',
    'இது தமிழ் வசன முன்னோட்டம்.',
    'உங்கள் சாதனத்தில் முற்றிலும் ஆஃப்லைனில் இயங்கும்.',
    'நகர்த்த, கேப்ஷனை இழுக்கவும்.',
  ],
  hi: [
    'स्वागत है।',
    'यह हिंदी कैप्शन का पूर्वावलोकन है।',
    'सब कुछ आपके फ़ोन पर चलता है।',
    'कैप्शन को खींचकर स्थिति बदलें।',
  ],
  te: [
    'స్వాగతం.',
    'ఇది తెలుగు ఉపశీర్షిక ప్రివ్యూ.',
    'మీ ఫోన్లో పూర్తిగా ఆఫ్‌లైన్‌గా నడుస్తుంది.',
    'క్యాప్షన్‌ను లాగి కదిలించండి.',
  ],
  ml: [
    'സ്വാഗതം.',
    'ഇത് മലയാളം സബ്‌ടൈറ്റിൽ പ്രിവ്യൂ ആണ്.',
    'നിങ്ങളുടെ ഫോണിൽ പൂർണ്ണമായും ഓഫ്‌ലൈൻ.',
    'കാപ്ഷൻ വലിച്ച് സ്ഥാനം മാറ്റാം.',
  ],
};

function startMockGeneration(
  jobId: string,
  videoUri: string,
  opts: GenerateOptions,
): void {
  const lang: SubtitleLang = opts.language ?? 'auto';
  const lines = MOCK_LINES[lang] ?? MOCK_LINES.auto;
  const totalSteps = 16;
  let step = 0;
  const startMs = Date.now();
  const segments: SubtitleSegment[] = [];
  segmentBuffers.set(jobId, segments);

  // Anchor mock cues at the user's CURRENT playback position so captions
  // actually become active immediately — otherwise mock cues live in the
  // 0–32 s range and never align with the player if the user is past 32 s.
  let anchorMs = 0;
  try {
    // Lazy require to avoid circular import (playerStore -> subtitles types).
    const { usePlayerStore } = require('@/store/playerStore');
    anchorMs = Math.floor(usePlayerStore.getState().currentTime * 1000);
  } catch (e) {
    L.warn('mock anchor failed, defaulting to 0', e);
  }
  if (__DEV__) L.info('mock_start', { jobId, lang, anchorMs, lines: lines.length });

  // Extracting phase (10%) — quick.
  upsertJob(jobId, { status: 'extracting', progress: 0.02 });
  emit('subtitleProgress', { jobId, status: 'extracting', progress: 0.02 });

  const timer = setInterval(() => {
    step++;
    const progress = Math.min(0.95, step / totalSteps);
    const eta = Math.max(0, ((totalSteps - step) / totalSteps) * 6000);
    const status: SubtitleJobStatus = step < totalSteps ? 'transcribing' : 'writing';

    // Emit one fake segment per tick, anchored at the playback time at
    // start so cues land where the user is actually watching.
    const lineIdx = step % lines.length;
    const segStart = anchorMs + (step - 1) * 2500;
    const newSeg: SubtitleSegment = {
      start: segStart,
      end: segStart + 2200,
      text: lines[lineIdx],
      confidence: 0.7 + Math.random() * 0.25,
    };
    segments.push(newSeg);
    emit('subtitleSegments', { jobId, segments: [newSeg] });

    upsertJob(jobId, { status, progress, etaMs: eta });
    emit('subtitleProgress', { jobId, status, progress, etaMs: eta });

    if (step >= totalSteps) {
      clearInterval(timer);
      mockTimers.delete(jobId);
      if (__DEV__) L.info('mock_done', { jobId, total: segments.length });
      void finalizeMockJob(jobId, videoUri, opts, segments, Date.now() - startMs);
    }
  }, 500);

  mockTimers.set(jobId, timer);
}

async function finalizeMockJob(
  jobId: string,
  videoUri: string,
  opts: GenerateOptions,
  rawSegments: SubtitleSegment[],
  durationMs: number,
): Promise<void> {
  try {
    const processed = postProcessSegments(rawSegments);
    const lang = opts.language ?? 'auto';

    // Write files. Mock path uses RNFS DocumentDirectoryPath/subtitles.
    let srtPath = '';
    let vttPath = '';
    try {
      const RNFS = require('react-native-fs');
      const dir = `${RNFS.DocumentDirectoryPath}/subtitles`;
      await RNFS.mkdir(dir).catch(() => undefined);
      const base = `mock-${jobId}`;
      srtPath = `${dir}/${base}.${lang}.srt`;
      vttPath = `${dir}/${base}.${lang}.vtt`;
      await RNFS.writeFile(srtPath, toSrt(processed), 'utf8');
      await RNFS.writeFile(vttPath, toVtt(processed), 'utf8');
    } catch (e) {
      L.warn('mock finalize: RNFS unavailable, skipping file write', e);
    }

    const videoHash = `mock-hash-${videoUri.length}-${rawSegments.length}`;
    const track = await insertSubtitleTrack({
      videoHash,
      videoUri,
      language: lang,
      languageLabel: LANG_LABELS[lang],
      modelUsed: opts.model ?? 'base',
      srtPath,
      vttPath,
      durationMs,
      segmentCount: processed.length,
      generatedAt: Date.now(),
    });

    upsertJob(jobId, { status: 'complete', progress: 1, videoHash });
    emit('subtitleProgress', { jobId, status: 'complete', progress: 1 });
    emit('subtitleDone', { jobId, track });
  } catch (e: any) {
    L.error('finalizeMockJob failed', e);
    upsertJob(jobId, { status: 'error', errorCode: 'UNKNOWN', errorMessage: String(e?.message ?? e) });
    emit('subtitleError', {
      jobId,
      code: 'UNKNOWN',
      message: String(e?.message ?? e),
    });
  }
}

// ─── External sidecar loading (e.g. user picked a .srt) ─────────────────────

export async function loadSidecarFile(
  videoUri: string,
  videoHash: string,
  filePath: string,
  lang: SubtitleLang = 'auto',
): Promise<SubtitleTrack> {
  const RNFS = require('react-native-fs');
  const content: string = await RNFS.readFile(filePath, 'utf8');
  const parsed = parseSubtitles(content);
  if (parsed.length === 0) {
    throw new Error('No cues parsed from subtitle file');
  }
  const last = parsed[parsed.length - 1];
  return insertSubtitleTrack({
    videoHash,
    videoUri,
    language: lang,
    languageLabel: LANG_LABELS[lang],
    modelUsed: 'base',
    srtPath: filePath,
    vttPath: filePath,
    durationMs: last.end,
    segmentCount: parsed.length,
    generatedAt: Date.now(),
  });
}
