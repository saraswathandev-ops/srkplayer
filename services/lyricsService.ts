import * as FileSystem from '@/utils/FileSystem';

export type LyricLine = {
    time: number;
    text: string;
};

export type LyricsResult = {
    lines: LyricLine[];
    source: 'local' | 'lrclib' | 'search';
    synced: boolean;
};

const BASE_URL = 'https://lrclib.net/api';

function normalize(value: string): string {
    return value
        .replace(/[\(\[\{].*?[\)\]\}]/g, '')
        .replace(/\b(?:official|audio|video|lyrics|lyric video|remastered|hd|4k)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function parseTimestamp(value: string): number | null {
    const match = /^(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?$/.exec(value.trim());
    if (!match) return null;
    const minutes = Number(match[1]);
    const seconds = Number(match[2]);
    const fraction = match[3] ?? '0';
    const fractionSeconds = Number(fraction) / (fraction.length === 1 ? 10 : fraction.length === 2 ? 100 : 1000);
    return minutes * 60 + seconds + fractionSeconds;
}

export function parseLrc(raw: string): LyricLine[] {
    const result: LyricLine[] = [];
    for (const sourceLine of raw.replace(/\r/g, '').split('\n')) {
        const matches = [...sourceLine.matchAll(/\[([^\]]+)\]/g)];
        if (!matches.length) continue;
        const text = sourceLine.replace(/\[[^\]]+\]/g, '').trim();
        if (!text) continue;

        for (const match of matches) {
            const time = parseTimestamp(match[1]);
            if (time !== null) result.push({ time, text });
        }
    }
    return result.sort((a, b) => a.time - b.time);
}

function buildCachePath(trackId: string): string | null {
    const root = FileSystem.documentDirectory;
    return root ? `${root}lyrics/${encodeURIComponent(trackId)}.lrc` : null;
}

async function readLocal(path: string | null): Promise<LyricsResult | null> {
    if (!path) return null;
    try {
        const info = await FileSystem.getInfoAsync(path);
        if (!info.exists || info.isDirectory) return null;
        const raw = await FileSystem.readAsStringAsync(path);
        const lines = parseLrc(raw);
        return lines.length ? { lines, source: 'local', synced: true } : null;
    } catch {
        return null;
    }
}

async function saveLocal(path: string | null, raw: string): Promise<void> {
    if (!path) return;
    try {
        await FileSystem.makeDirectoryAsync(path.slice(0, path.lastIndexOf('/') + 1), { intermediates: true });
        await FileSystem.writeAsStringAsync(path, raw);
    } catch (error) {
        console.warn('[lyricsService] local save failed:', error);
    }
}

export async function getLyrics(
    track: { id: string; title: string; artist?: string | null; duration?: number | null },
    forceRefresh = false,
): Promise<LyricsResult | null> {
    const path = buildCachePath(track.id);
    if (!forceRefresh) {
        const local = await readLocal(path);
        if (local) return local;
    }

    const title = normalize(track.title);
    const artist = normalize(track.artist ?? '');
    const duration = Number(track.duration ?? 0);
    const durationSeconds = duration > 10000 ? duration / 1000 : duration;

    try {
        const response = await fetch(`${BASE_URL}/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}&duration=${Math.round(durationSeconds)}`);
        if (response.ok) {
            const data = await response.json();
            const syncedLyrics = typeof data?.syncedLyrics === 'string' ? data.syncedLyrics : '';
            if (syncedLyrics) {
                const lines = parseLrc(syncedLyrics);
                if (lines.length) {
                    await saveLocal(path, syncedLyrics);
                    return { lines, source: 'lrclib', synced: true };
                }
            }
            const plainLyrics = typeof data?.plainLyrics === 'string' ? data.plainLyrics : '';
            if (plainLyrics) {
                const lines = plainLyrics.split(/\r?\n/).map((text: string) => text.trim()).filter(Boolean).map((text: string) => ({ time: 0, text }));
                return { lines, source: 'lrclib', synced: false };
            }
        }
    } catch (error) {
        console.warn('[lyricsService] exact lookup failed:', error);
    }

    try {
        const query = encodeURIComponent([artist, title].filter(Boolean).join(' '));
        const response = await fetch(`${BASE_URL}/search?q=${query}`);
        if (!response.ok) return null;
        const results = await response.json();
        const candidate = Array.isArray(results)
            ? results.find((item: any) => typeof item?.syncedLyrics === 'string' && item.syncedLyrics.trim())
            : null;
        if (!candidate) return null;
        const lines = parseLrc(candidate.syncedLyrics);
        if (!lines.length) return null;
        await saveLocal(path, candidate.syncedLyrics);
        return { lines, source: 'search', synced: true };
    } catch (error) {
        console.warn('[lyricsService] fallback search failed:', error);
        return null;
    }
}
