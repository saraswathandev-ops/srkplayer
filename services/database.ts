import SQLite from "react-native-sqlite-storage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { log } from "@/utils/logger";

const L = log('DB');

SQLite.enablePromise(true);

const DATABASE_NAME = "mxplayer.db";
const INTEGRITY_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // Once a day
const LAST_INTEGRITY_KEY = "@db_last_integrity_check";

let initPromise: Promise<void> | null = null;
let _dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getNativeDB(): Promise<SQLite.SQLiteDatabase> {
  if (!_dbPromise) {
    _dbPromise = SQLite.openDatabase({ name: DATABASE_NAME, location: "default" });
  }
  return _dbPromise;
}

// ---------------------------------------------------------------------------
// Serialization queue
//
// react-native-sqlite-storage uses a single connection. Running two async
// operations concurrently (e.g. position write + batch sync) can cause one
// to fire inside an open transaction begun by the other, crashing SQLite.
// Every public db method must be funnelled through enqueue() so operations
// run strictly one at a time.
//
// withTransactionAsync sets _txDb for the duration of its operation so that
// any db.* calls made inside the operation use the connection directly instead
// of re-entering enqueue(), which would deadlock (inner waits for outer,
// outer waits for inner).
// ---------------------------------------------------------------------------
let _dbQueue: Promise<unknown> = Promise.resolve();
let _txDb: SQLite.SQLiteDatabase | null = null;

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  // Attach to the tail of the queue. Errors from previous tasks are ignored
  // so the queue never gets permanently stuck.
  const next = _dbQueue.then(fn, fn) as Promise<T>;
  // Keep the chain alive even when the caller's promise rejects.
  _dbQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export const db = {
  databasePath: undefined as string | undefined,

  getAllAsync<T>(sql: string, params: any[] = []): Promise<T[]> {
    if (_txDb) {
      return _txDb.executeSql(sql, params).then(([results]) => {
        const rows: T[] = [];
        for (let i = 0; i < results.rows.length; i++) rows.push(results.rows.item(i));
        return rows;
      });
    }
    return enqueue(async () => {
      const database = await getNativeDB();
      const [results] = await database.executeSql(sql, params);
      const rows: T[] = [];
      for (let i = 0; i < results.rows.length; i++) {
        rows.push(results.rows.item(i));
      }
      return rows;
    });
  },

  getFirstAsync<T>(sql: string, params: any[] = []): Promise<T | null> {
    if (_txDb) {
      return _txDb.executeSql(sql, params).then(([results]) =>
        results.rows.length > 0 ? (results.rows.item(0) as T) : null
      );
    }
    return enqueue(async () => {
      const database = await getNativeDB();
      const [results] = await database.executeSql(sql, params);
      return results.rows.length > 0 ? (results.rows.item(0) as T) : null;
    });
  },

  runAsync(sql: string, params: any[] = []): Promise<{ lastInsertRowId: number; changes: number }> {
    if (_txDb) {
      return _txDb.executeSql(sql, params).then(([results]) => ({
        lastInsertRowId: results.insertId,
        changes: results.rowsAffected,
      }));
    }
    return enqueue(async () => {
      const database = await getNativeDB();
      const [results] = await database.executeSql(sql, params);
      return { lastInsertRowId: results.insertId, changes: results.rowsAffected };
    });
  },

  execAsync(sql: string): Promise<void> {
    return enqueue(async () => {
      const database = await getNativeDB();
      const statements = sql.split(";").map(s => s.trim()).filter(s => s.length > 0);
      for (const stmt of statements) {
        await database.executeSql(stmt, []);
      }
    });
  },

  withTransactionAsync<T>(operation: () => Promise<T>): Promise<T> {
    // The whole transaction (BEGIN … COMMIT/ROLLBACK) runs as one enqueued unit.
    // _txDb is set for the duration so that nested db.* calls bypass enqueue()
    // and go directly to the connection — avoiding a self-deadlock.
    return enqueue(async () => {
      const database = await getNativeDB();
      await database.executeSql("BEGIN TRANSACTION", []);
      _txDb = database;
      try {
        const result = await operation();
        _txDb = null;
        await database.executeSql("COMMIT", []);
        return result;
      } catch (err) {
        _txDb = null;
        await database.executeSql("ROLLBACK", []).catch((e) =>
          console.warn("DB rollback failed:", e),
        );
        throw err;
      }
    });
  },

  /**
   * Execute multiple parameterized statements inside a single transaction.
   * Much faster than calling runAsync in a loop — avoids per-row overhead.
   */
  runBatchAsync(statements: { sql: string; params: any[] }[]): Promise<void> {
    if (statements.length === 0) return Promise.resolve();
    return enqueue(async () => {
      const database = await getNativeDB();
      await database.executeSql("BEGIN TRANSACTION", []);
      try {
        for (const stmt of statements) {
          await database.executeSql(stmt.sql, stmt.params);
        }
        await database.executeSql("COMMIT", []);
      } catch (err) {
        await database.executeSql("ROLLBACK", []).catch((e) =>
          console.warn("DB rollback failed:", e),
        );
        throw err;
      }
    });
  },

  async checkpoint(): Promise<void> {
    return enqueue(async () => {
      const database = await getNativeDB();
      // TRUNCATE mode resets the WAL file to zero size
      await database.executeSql("PRAGMA wal_checkpoint(TRUNCATE)", []).catch(() => undefined);
    });
  },
};

async function ensureColumns(
  table: string,
  columns: { name: string; definition: string }[]
): Promise<void> {
  const existing = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  const existingNames = new Set(existing.map((c) => c.name));
  for (const col of columns) {
    if (!existingNames.has(col.name)) {
      await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${col.name} ${col.definition};`);
    }
  }
}

export function initDB() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      L.db('initDB start');
      const now = Date.now();
      const lastCheck = await AsyncStorage.getItem(LAST_INTEGRITY_KEY);
      const shouldCheck = !lastCheck || now - parseInt(lastCheck, 10) > INTEGRITY_CHECK_INTERVAL;

      // Integrity check: only run periodically or if reset is needed.
      if (shouldCheck) {
        try {
          const database = await getNativeDB();
          const [integrityResult] = await database.executeSql("PRAGMA integrity_check", []);
          const verdict = integrityResult.rows.item(0)?.integrity_check as string | undefined;
          
          await AsyncStorage.setItem(LAST_INTEGRITY_KEY, now.toString());

          if (verdict && verdict !== "ok") {
            console.warn("[DB] Integrity check failed:", verdict, "— resetting database.");
            _dbPromise = null;
            initPromise = null;
            const freshDb = await SQLite.openDatabase({ name: DATABASE_NAME, location: "default" });
            await freshDb.executeSql("PRAGMA foreign_keys = OFF", []);
            for (const table of ["PlaybackProgress", "PlaylistItems", "Playlists", "Videos", "Folders"]) {
              await freshDb.executeSql(`DROP TABLE IF EXISTS ${table}`, []);
            }
            await freshDb.executeSql("PRAGMA foreign_keys = ON", []);
            _dbPromise = Promise.resolve(freshDb);
            initPromise = null;
            return initDB();
          }
        } catch {
          // If integrity_check itself fails the DB is unusable — proceed to wipe below.
        }
      }

      // react-native-sqlite-storage wraps every executeSql in an implicit
      // transaction internally. SQLite rejects PRAGMA synchronous (and
      // journal_mode on some builds) when inside any transaction, so we run
      // each PRAGMA as a best-effort call — a failure here is non-fatal and
      // the app works correctly with SQLite's safe defaults.
      const rawDb = await getNativeDB();
      for (const pragma of [
        "PRAGMA foreign_keys = ON",
        "PRAGMA journal_mode = WAL",
        "PRAGMA synchronous = NORMAL",
        "PRAGMA cache_size = -8000",
        "PRAGMA temp_store = MEMORY",
      ]) {
        await rawDb.executeSql(pragma, []).catch(() => undefined);
      }

      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS Videos (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          path TEXT NOT NULL UNIQUE,
          sourceUri TEXT,
          sourceVideoId TEXT,
          duration INTEGER NOT NULL DEFAULT 0,
          thumbnail TEXT,
          thumbnailHash TEXT,
          folder TEXT,
          lastPlayed INTEGER,
          lastPosition INTEGER,
          playCount INTEGER NOT NULL DEFAULT 0,
          isFavorite INTEGER NOT NULL DEFAULT 0,
          size INTEGER NOT NULL DEFAULT 0,
          dateAdded INTEGER NOT NULL DEFAULT 0,
          mimeType TEXT,
          artist TEXT,
          album TEXT,
          watchedAt INTEGER,
          mediaType TEXT NOT NULL DEFAULT 'video',
          isClip INTEGER NOT NULL DEFAULT 0,
          clipStart REAL,
          clipEnd REAL,
          isDeleted INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS Playlists (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          createdAt INTEGER NOT NULL,
          coverUri TEXT
        );

        CREATE TABLE IF NOT EXISTS Folders (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL UNIQUE,
          coverUri TEXT,
          coverHash TEXT,
          videoCount INTEGER NOT NULL DEFAULT 0,
          unwatchedCount INTEGER NOT NULL DEFAULT 0,
          updatedAt INTEGER NOT NULL DEFAULT 0,
          isPrivate INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS PlaylistItems (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          playlistId TEXT NOT NULL,
          videoId TEXT NOT NULL,
          position INTEGER NOT NULL,
          addedAt INTEGER NOT NULL,
          FOREIGN KEY (playlistId) REFERENCES Playlists(id) ON DELETE CASCADE,
          FOREIGN KEY (videoId) REFERENCES Videos(id) ON DELETE CASCADE,
          UNIQUE(playlistId, videoId)
        );

        CREATE TABLE IF NOT EXISTS PlaybackProgress (
          video_id TEXT PRIMARY KEY NOT NULL,
          position_seconds REAL NOT NULL DEFAULT 0,
          duration_seconds REAL NOT NULL DEFAULT 0,
          progress_percent REAL NOT NULL DEFAULT 0,
          last_watched_at INTEGER NOT NULL,
          completed INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY (video_id) REFERENCES Videos(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist_id
          ON PlaylistItems(playlistId);

        CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist_position
          ON PlaylistItems(playlistId, position);

        CREATE INDEX IF NOT EXISTS idx_videos_path
          ON Videos(path);

        CREATE INDEX IF NOT EXISTS idx_videos_folder
          ON Videos(folder);

        CREATE INDEX IF NOT EXISTS idx_folders_updated_at
          ON Folders(updatedAt DESC);

        CREATE INDEX IF NOT EXISTS idx_videos_active_date
          ON Videos(isDeleted, dateAdded DESC);

        CREATE INDEX IF NOT EXISTS idx_videos_active_watched
          ON Videos(isDeleted, watchedAt DESC);

        CREATE INDEX IF NOT EXISTS idx_videos_active_position
          ON Videos(isDeleted, lastPosition);

        CREATE INDEX IF NOT EXISTS idx_videos_media_backfill
          ON Videos(isDeleted, mediaType, isClip);

        CREATE INDEX IF NOT EXISTS idx_videos_favorite
          ON Videos(isDeleted, isFavorite);
          
        CREATE INDEX IF NOT EXISTS idx_videos_folder_sync
          ON Videos(folder, mediaType, isDeleted, dateAdded DESC);

        CREATE INDEX IF NOT EXISTS idx_playback_progress_last_watched
          ON PlaybackProgress(last_watched_at DESC);
      `);

      await ensureColumns("Videos", [
        { name: "thumbnailHash",  definition: "TEXT" },
        { name: "sourceUri",      definition: "TEXT" },
        { name: "sourceVideoId",  definition: "TEXT" },
        { name: "artist",         definition: "TEXT" },
        { name: "album",          definition: "TEXT" },
        { name: "isClip",         definition: "INTEGER NOT NULL DEFAULT 0" },
        { name: "clipStart",      definition: "REAL" },
        { name: "clipEnd",        definition: "REAL" },
        { name: "isDeleted",      definition: "INTEGER NOT NULL DEFAULT 0" },
      ]);

      await ensureColumns("Folders", [
        { name: "coverHash",      definition: "TEXT" },
        { name: "unwatchedCount", definition: "INTEGER NOT NULL DEFAULT 0" },
        { name: "isPrivate",      definition: "INTEGER NOT NULL DEFAULT 0" },
      ]);

      await db.execAsync(`UPDATE Videos SET thumbnail = NULL WHERE thumbnail = 'failed';`);
      L.db('initDB complete');
    } catch (e) {
      // Reset promise so the next call retries instead of re-using the failed one.
      initPromise = null;
      L.error('initDB failed', e);
      console.error("Database initialization failed:", e);
      throw e;
    }
  })();

  return initPromise;
}

export async function resetDatabase() {
  try {
    const database = await getNativeDB();
    await database.executeSql("PRAGMA foreign_keys = OFF", []);
    await database.executeSql("DROP TABLE IF EXISTS PlaybackProgress", []);
    await database.executeSql("DROP TABLE IF EXISTS PlaylistItems", []);
    await database.executeSql("DROP TABLE IF EXISTS Playlists", []);
    await database.executeSql("DROP TABLE IF EXISTS Videos", []);
    await database.executeSql("DROP TABLE IF EXISTS Folders", []);
    await database.executeSql("PRAGMA foreign_keys = ON", []);
    initPromise = null;
    await initDB();
  } catch (e) {
    console.error("Failed to reset database:", e);
  }
}
