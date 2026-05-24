/**
 * useSubtitleGeneration
 *
 * High-level hook for the player screen. Wires the subtitleService event
 * stream into the Zustand store and exposes a small imperative API
 * (start / cancel / retry) plus the current job state.
 *
 * Holding all this in a hook keeps player.tsx free of subscription
 * bookkeeping and lets the bottom-sheet UI consume the same status feed.
 */
import { useCallback, useEffect, useRef } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import * as subtitles from '@/services/subtitleService';
import { log } from '@/utils/logger';
import type { GenerateOptions, SubtitleTrack } from '@/types/subtitles';

const L = log('SubtitleGen');

export interface UseSubtitleGenerationApi {
  start: (videoUri: string, opts?: GenerateOptions) => Promise<void>;
  cancel: () => Promise<void>;
  retry: () => Promise<void>;
  reloadTracks: (videoUri?: string, videoHash?: string) => Promise<void>;
  selectTrack: (track: SubtitleTrack | null) => Promise<void>;
}

export function useSubtitleGeneration(): UseSubtitleGenerationApi {
  const setSubtitleJob = usePlayerStore((s) => s.setSubtitleJob);
  const setSubtitleTracks = usePlayerStore((s) => s.setSubtitleTracks);
  const setSelectedSubtitleId = usePlayerStore((s) => s.setSelectedSubtitleId);
  const setSubtitlesEnabled = usePlayerStore((s) => s.setSubtitlesEnabled);
  const appendSegments = usePlayerStore((s) => s.appendSubtitleSegments);
  const clearSegments = usePlayerStore((s) => s.clearSubtitleSegments);
  const setSubtitleSegments = usePlayerStore((s) => s.setSubtitleSegments);

  // Track the last requested job so retry() can use the same args.
  const lastRequestRef = useRef<{ videoUri: string; opts: GenerateOptions } | null>(null);
  const activeJobIdRef = useRef<string | null>(null);

  // ── Subscribe to native events ────────────────────────────────────────────
  useEffect(() => {
    const unsubProgress = subtitles.subscribe('subtitleProgress', (e) => {
      if (e.jobId !== activeJobIdRef.current) {
        if (__DEV__) L.warn('progress dropped: jobId mismatch', { e, active: activeJobIdRef.current });
        return;
      }
      if (__DEV__) L.info('progress', { jobId: e.jobId, status: e.status, p: e.progress });
      setSubtitleJob({
        jobId: e.jobId,
        videoUri: lastRequestRef.current?.videoUri ?? '',
        language: lastRequestRef.current?.opts.language ?? 'auto',
        model: lastRequestRef.current?.opts.model ?? 'base',
        status: e.status,
        progress: e.progress,
        etaMs: e.etaMs,
        startedAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const unsubSegments = subtitles.subscribe('subtitleSegments', (e) => {
      if (e.jobId !== activeJobIdRef.current) {
        if (__DEV__) L.warn('segments dropped: jobId mismatch', {
          eventJobId: e.jobId,
          active: activeJobIdRef.current,
          count: e.segments.length,
        });
        return;
      }
      if (__DEV__) {
        const first = e.segments[0];
        L.info('segments appended', {
          jobId: e.jobId,
          count: e.segments.length,
          firstStart: first?.start,
          firstEnd: first?.end,
          firstText: first?.text?.slice(0, 40),
        });
      }
      appendSegments(e.segments);
    });

    const unsubDone = subtitles.subscribe('subtitleDone', async (e) => {
      if (e.jobId !== activeJobIdRef.current) return;
      L.info('job done', { jobId: e.jobId, track: e.track.id });
      // Refresh tracks list for this video and auto-select the new one.
      const tracks = await subtitles.listSubtitles({ videoHash: e.track.videoHash });
      setSubtitleTracks(tracks);
      setSelectedSubtitleId(e.track.id);
      setSubtitlesEnabled(true);
      activeJobIdRef.current = null;
    });

    const unsubError = subtitles.subscribe('subtitleError', (e) => {
      if (e.jobId !== activeJobIdRef.current) return;
      L.error('job error', { jobId: e.jobId, code: e.code, message: e.message });
      setSubtitleJob({
        jobId: e.jobId,
        videoUri: lastRequestRef.current?.videoUri ?? '',
        language: lastRequestRef.current?.opts.language ?? 'auto',
        model: lastRequestRef.current?.opts.model ?? 'base',
        status: 'error',
        progress: 0,
        errorCode: e.code,
        errorMessage: e.message,
        startedAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    return () => {
      unsubProgress();
      unsubSegments();
      unsubDone();
      unsubError();
    };
  }, [appendSegments, setSelectedSubtitleId, setSubtitleJob, setSubtitleTracks, setSubtitlesEnabled]);

  const start = useCallback(
    async (videoUri: string, opts: GenerateOptions = {}) => {
      lastRequestRef.current = { videoUri, opts };
      clearSegments();
      setSubtitlesEnabled(true);
      if (__DEV__) L.info('start', { videoUri: videoUri.slice(-60), opts });
      try {
        const { jobId } = await subtitles.generateSubtitles(videoUri, opts);
        activeJobIdRef.current = jobId;
        if (__DEV__) L.info('start:jobId_set', { jobId });
        setSubtitleJob({
          jobId,
          videoUri,
          language: opts.language ?? 'auto',
          model: opts.model ?? 'base',
          status: 'queued',
          progress: 0,
          startedAt: Date.now(),
          updatedAt: Date.now(),
        });
      } catch (e: any) {
        L.error('start failed', e);
        setSubtitleJob({
          jobId: 'error-' + Date.now(),
          videoUri,
          language: opts.language ?? 'auto',
          model: opts.model ?? 'base',
          status: 'error',
          progress: 0,
          errorCode: 'NO_NATIVE_MODULE',
          errorMessage: String(e?.message ?? e),
          startedAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    },
    [clearSegments, setSubtitleJob, setSubtitlesEnabled],
  );

  const cancel = useCallback(async () => {
    const jobId = activeJobIdRef.current;
    if (!jobId) return;
    try {
      await subtitles.cancelSubtitleGeneration(jobId);
    } catch (e) {
      L.warn('cancel failed', e);
    }
    activeJobIdRef.current = null;
  }, []);

  const retry = useCallback(async () => {
    const last = lastRequestRef.current;
    if (!last) return;
    await start(last.videoUri, last.opts);
  }, [start]);

  const reloadTracks = useCallback(
    async (videoUri?: string, videoHash?: string) => {
      if (!videoUri && !videoHash) {
        setSubtitleTracks([]);
        return;
      }
      const tracks = await subtitles.listSubtitles({ videoUri, videoHash });
      setSubtitleTracks(tracks);
    },
    [setSubtitleTracks],
  );

  const selectTrack = useCallback(
    async (track: SubtitleTrack | null) => {
      if (!track) {
        setSelectedSubtitleId(null);
        setSubtitlesEnabled(false);
        setSubtitleSegments([]);
        return;
      }
      // Load cues from the .vtt (preferred — supports BOM-free, complex Indic).
      try {
        const RNFS = require('react-native-fs');
        const content: string = await RNFS.readFile(track.vttPath || track.srtPath, 'utf8');
        const { parseSubtitles } = require('@/services/subtitleParser');
        const parsed = parseSubtitles(content);
        setSubtitleSegments(parsed);
        setSelectedSubtitleId(track.id);
        setSubtitlesEnabled(true);
        await subtitles.markSubtitleUsed(track.id);
      } catch (e) {
        L.error('selectTrack failed', e);
      }
    },
    [setSelectedSubtitleId, setSubtitleSegments, setSubtitlesEnabled],
  );

  return { start, cancel, retry, reloadTracks, selectTrack };
}
