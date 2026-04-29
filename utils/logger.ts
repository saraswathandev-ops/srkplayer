/**
 * Centralized debug logger.
 * All output goes to the Metro/React Native terminal (LogBox / ADB logcat).
 *
 * Usage:
 *   import { log } from '@/utils/logger';
 *   const L = log('MyScreen');
 *   L.info('mounted');
 *   L.warn('slow render', { ms: 200 });
 *   L.error('failed', err);
 *   L.nav('navigate', { to: 'player', id: '123' });
 *   L.db('query', { sql: '...' });
 *   L.player('play', { uri });
 */

const ENABLED = __DEV__;   // strip in production

type Tag =
  | 'NAV'
  | 'DB'
  | 'PLAYER'
  | 'AUDIO'
  | 'SYNC'
  | 'UI'
  | 'INFO'
  | 'WARN'
  | 'ERR';

const TAG_COLORS: Record<Tag, string> = {
  NAV:    '🔵',
  DB:     '🟤',
  PLAYER: '🟢',
  AUDIO:  '🎵',
  SYNC:   '🔄',
  UI:     '🟡',
  INFO:   '⚪',
  WARN:   '🟠',
  ERR:    '🔴',
};

function fmt(tag: Tag, scope: string, event: string, data?: unknown): string {
  const ts = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
  const icon = TAG_COLORS[tag];
  const base = `${icon} [${ts}][${scope}] ${event}`;
  if (data === undefined) return base;
  try {
    return `${base} ${typeof data === 'object' ? JSON.stringify(data) : data}`;
  } catch {
    return `${base} [unstringifiable]`;
  }
}

export interface Logger {
  info: (event: string, data?: unknown) => void;
  warn: (event: string, data?: unknown) => void;
  error: (event: string, data?: unknown) => void;
  nav: (event: string, data?: unknown) => void;
  db: (event: string, data?: unknown) => void;
  player: (event: string, data?: unknown) => void;
  audio: (event: string, data?: unknown) => void;
  sync: (event: string, data?: unknown) => void;
}

export function log(scope: string): Logger {
  if (!ENABLED) {
    const noop = () => {};
    return { info: noop, warn: noop, error: noop, nav: noop, db: noop, player: noop, audio: noop, sync: noop };
  }
  return {
    info:   (e, d?) => console.log(fmt('INFO', scope, e, d)),
    warn:   (e, d?) => console.warn(fmt('WARN', scope, e, d)),
    error:  (e, d?) => console.error(fmt('ERR', scope, e, d)),
    nav:    (e, d?) => console.log(fmt('NAV', scope, e, d)),
    db:     (e, d?) => console.log(fmt('DB', scope, e, d)),
    player: (e, d?) => console.log(fmt('PLAYER', scope, e, d)),
    audio:  (e, d?) => console.log(fmt('AUDIO', scope, e, d)),
    sync:   (e, d?) => console.log(fmt('SYNC', scope, e, d)),
  };
}
