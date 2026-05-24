/**
 * SRT/VTT formatting + parsing + post-processing rules.
 *
 * Pure functions only — no native calls, no IO. Easy to unit-test.
 * The production formatter is intentionally written so the *same* code can
 * run inside Kotlin (transpiled subset) and inside RN (for sideloaded files).
 */

import type { SubtitleSegment } from '@/types/subtitles';

const MAX_LINE_CHARS = 42;
const MAX_LINES = 2;
const MIN_DURATION_MS = 800;
const MAX_DURATION_MS = 7000;
const READ_SPEED_CPS = 17; // BBC guideline upper bound

// ─── Time formatting ─────────────────────────────────────────────────────────

function pad(n: number, width: number): string {
  const s = String(Math.floor(n));
  return s.length >= width ? s : '0'.repeat(width - s.length) + s;
}

export function formatSrtTime(ms: number): string {
  // 00:00:00,000
  const totalMs = Math.max(0, Math.floor(ms));
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMs % 60_000) / 1000);
  const millis = totalMs % 1000;
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)},${pad(millis, 3)}`;
}

export function formatVttTime(ms: number): string {
  // 00:00:00.000
  return formatSrtTime(ms).replace(',', '.');
}

// ─── Line splitting ──────────────────────────────────────────────────────────

/**
 * Break a single string into at most 2 lines of <= MAX_LINE_CHARS.
 * Uses last-space-before-limit; falls back to a hard cut for languages that
 * don't space (e.g., long Tamil compounds — we still try not to split inside
 * grapheme clusters by avoiding combining marks).
 */
export function balanceLines(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= MAX_LINE_CHARS) return compact;

  // Try to split at the midpoint nearest a clause boundary.
  const mid = Math.floor(compact.length / 2);
  const window = Math.min(20, mid);
  let bestIdx = -1;
  for (let off = 0; off <= window; off++) {
    for (const idx of [mid - off, mid + off]) {
      if (idx <= 0 || idx >= compact.length) continue;
      const ch = compact[idx];
      if (ch === ' ' || ch === ',' || ch === ';' || ch === '—') {
        bestIdx = idx;
        break;
      }
    }
    if (bestIdx !== -1) break;
  }

  if (bestIdx === -1) {
    // Fall back to last space before MAX_LINE_CHARS.
    bestIdx = compact.lastIndexOf(' ', MAX_LINE_CHARS);
    if (bestIdx === -1) bestIdx = MAX_LINE_CHARS;
  }

  let top = compact.slice(0, bestIdx).trim();
  let bottom = compact.slice(bestIdx).trim();

  if (top.length > MAX_LINE_CHARS) top = top.slice(0, MAX_LINE_CHARS);
  if (bottom.length > MAX_LINE_CHARS) bottom = bottom.slice(0, MAX_LINE_CHARS);

  return `${top}\n${bottom}`;
}

// ─── Segment-level rules ────────────────────────────────────────────────────

/**
 * Clamp a segment's duration to [MIN_DURATION_MS, MAX_DURATION_MS], without
 * crossing the next segment's start.
 */
export function clampDuration(
  seg: SubtitleSegment,
  next: SubtitleSegment | undefined,
): SubtitleSegment {
  let start = Math.max(0, seg.start);
  let end = Math.max(start + 1, seg.end);
  let duration = end - start;

  if (duration < MIN_DURATION_MS) {
    const cap = next ? next.start - 80 : start + MIN_DURATION_MS;
    end = Math.min(start + MIN_DURATION_MS, cap);
    duration = end - start;
  }
  if (duration > MAX_DURATION_MS) {
    end = start + MAX_DURATION_MS;
    duration = MAX_DURATION_MS;
  }

  // Enforce reading-speed cap by extending end (or trimming text — we choose
  // extend, since whisper timestamps are usually too tight, not too loose).
  const chars = seg.text.length;
  const minDurForRead = Math.ceil((chars / READ_SPEED_CPS) * 1000);
  if (duration < minDurForRead) {
    const cap = next ? next.start - 80 : end + minDurForRead;
    end = Math.min(start + minDurForRead, cap);
  }

  return { ...seg, start, end };
}

/**
 * Merge segments shorter than 300 ms into a neighbour to avoid sub-second
 * flickers. Idempotent.
 */
export function smoothShortSegments(segs: SubtitleSegment[]): SubtitleSegment[] {
  if (segs.length < 2) return segs;
  const out: SubtitleSegment[] = [];
  for (let i = 0; i < segs.length; i++) {
    const cur = segs[i];
    const dur = cur.end - cur.start;
    const prev = out[out.length - 1];
    if (dur < 300 && prev && cur.start - prev.end < 200) {
      prev.end = cur.end;
      prev.text = `${prev.text} ${cur.text}`.trim();
      prev.confidence = Math.min(prev.confidence ?? 1, cur.confidence ?? 1);
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

/**
 * Drop near-duplicate segments produced by chunk overlap regions. Two segments
 * are duplicates if they overlap in time and their text edit distance is <3.
 */
export function dedupeOverlap(segs: SubtitleSegment[]): SubtitleSegment[] {
  if (segs.length < 2) return segs;
  const out: SubtitleSegment[] = [];
  for (const seg of segs) {
    const last = out[out.length - 1];
    if (last && seg.start < last.end && editDistance(last.text, seg.text) < 3) {
      // Keep the longer text (more context); extend time range.
      if (seg.text.length > last.text.length) last.text = seg.text;
      last.end = Math.max(last.end, seg.end);
      continue;
    }
    out.push({ ...seg });
  }
  return out;
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  // Bounded Levenshtein — we only care whether distance is small.
  const max = Math.min(a.length, b.length) + 1;
  let prev = new Array(b.length + 1);
  let cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max; // bail early
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}

/** Full post-processing pipeline. */
export function postProcessSegments(segs: SubtitleSegment[]): SubtitleSegment[] {
  const sorted = [...segs].sort((a, b) => a.start - b.start);
  const deduped = dedupeOverlap(sorted);
  const smoothed = smoothShortSegments(deduped);
  return smoothed.map((seg, i) => {
    const next = smoothed[i + 1];
    const clamped = clampDuration(seg, next);
    return { ...clamped, text: balanceLines(clamped.text) };
  });
}

// ─── Serializers ────────────────────────────────────────────────────────────

export function toSrt(segments: SubtitleSegment[]): string {
  const out: string[] = [];
  segments.forEach((seg, i) => {
    out.push(String(i + 1));
    out.push(`${formatSrtTime(seg.start)} --> ${formatSrtTime(seg.end)}`);
    out.push(seg.text);
    out.push('');
  });
  return out.join('\r\n');
}

export function toVtt(segments: SubtitleSegment[]): string {
  const out: string[] = ['WEBVTT', ''];
  segments.forEach((seg) => {
    out.push(`${formatVttTime(seg.start)} --> ${formatVttTime(seg.end)}`);
    out.push(seg.text);
    out.push('');
  });
  return out.join('\n');
}

// ─── Parsers (for cached files + external sidecars) ─────────────────────────

const TIMECODE_RE =
  /(\d{1,2}):(\d{2}):(\d{2})[.,](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[.,](\d{1,3})/;

function parseTimecodes(line: string): { start: number; end: number } | null {
  const m = TIMECODE_RE.exec(line);
  if (!m) return null;
  const start =
    parseInt(m[1], 10) * 3_600_000 +
    parseInt(m[2], 10) * 60_000 +
    parseInt(m[3], 10) * 1000 +
    parseInt(m[4], 10);
  const end =
    parseInt(m[5], 10) * 3_600_000 +
    parseInt(m[6], 10) * 60_000 +
    parseInt(m[7], 10) * 1000 +
    parseInt(m[8], 10);
  return { start, end };
}

/**
 * Parse either SRT or VTT into segments. Tolerant of:
 *   - CRLF or LF
 *   - missing cue numbers (VTT)
 *   - "WEBVTT" header + metadata blocks
 *   - blank lines inside cues (rare but seen in sideloads)
 */
export function parseSubtitles(content: string): SubtitleSegment[] {
  // Strip optional BOM.
  const normalized = content.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  const segs: SubtitleSegment[] = [];

  let i = 0;
  while (i < lines.length) {
    const tc = parseTimecodes(lines[i] ?? '');
    if (!tc) {
      i++;
      continue;
    }
    i++;
    const textLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && !TIMECODE_RE.test(lines[i])) {
      textLines.push(lines[i]);
      i++;
    }
    const text = textLines.join('\n').trim();
    if (text) segs.push({ start: tc.start, end: tc.end, text });
  }

  return segs;
}

// ─── Active-segment lookup (used by the overlay) ────────────────────────────

/**
 * Binary search for the segment active at the given time. Returns -1 if no
 * segment is active (i.e., we're in a gap). Optional `hint` is the last
 * known index — when scrubbing through a video this drops the average cost
 * to O(1) for the common forward-playback case.
 */
export function findActiveSegment(
  segments: SubtitleSegment[],
  timeMs: number,
  hint?: number,
): number {
  if (segments.length === 0) return -1;

  // Hint fast-path: check current and next-N segments.
  if (typeof hint === 'number' && hint >= 0 && hint < segments.length) {
    const cur = segments[hint];
    if (timeMs >= cur.start && timeMs < cur.end) return hint;
    // Forward step is the common case during playback.
    if (timeMs >= cur.end) {
      for (let k = 1; k <= 4 && hint + k < segments.length; k++) {
        const seg = segments[hint + k];
        if (timeMs < seg.start) return -1;
        if (timeMs < seg.end) return hint + k;
      }
    }
  }

  // Binary search for the segment whose start <= timeMs.
  let lo = 0;
  let hi = segments.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (segments[mid].start > timeMs) {
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  const candidate = hi;
  if (candidate < 0) return -1;
  const seg = segments[candidate];
  return timeMs < seg.end ? candidate : -1;
}
