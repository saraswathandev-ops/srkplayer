import SQLite from "react-native-sqlite-storage";

SQLite.enablePromise(true);

let initPromise: Promise<void> | null = null;
let _dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getNativeDB(): Promise<SQLite.SQLiteDatabase> {
  if (!_dbPromise) {
    _dbPromise = SQLite.openDatabase({ name: "mxplayer.db", location: "default" });
  }
  return _dbPromise;
}

export const db = {
  async getAllAsync<T>(sql: string, params: any[] = []): Promise<T[]> {
    const database = await getNativeDB();
    const [results] = await database.executeSql(sql, params);
    const rows: T[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      rows.push(results.rows.item(i));
    }
    return rows;
  },

  async getFirstAsync<T>(sql: string, params: any[] = []): Promise<T | null> {
    const database = await getNativeDB();
    const [results] = await database.executeSql(sql, params);
    if (results.rows.length > 0) {
      return results.rows.item(0);
    }
    return null;
  },

  async runAsync(sql: string, params: any[] = []): Promise<{ lastInsertRowId: number; changes: number }> {
    const database = await getNativeDB();
    const [results] = await database.executeSql(sql, params);
    return {
      lastInsertRowId: results.insertId,
      changes: results.rowsAffected
    };
  },

  async execAsync(sql: string): Promise<void> {
    const database = await getNativeDB();
    const statements = sql
      .split(";")
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      await database.executeSql(stmt, []);
    }
  }
};

async function ensureColumn(
  table: string,
  column: string,
  definition: string
) {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  const hasColumn = columns.some((item) => item.name === column);

  if (hasColumn) return;

  await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
}

export function initDB() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    await db.execAsync(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;

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
        updatedAt INTEGER NOT NULL DEFAULT 0
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

      CREATE INDEX IF NOT EXISTS idx_videos_id 
      ON Videos(id);
    `);

    await ensureColumn("Videos", "thumbnailHash", "TEXT");
    await ensureColumn("Videos", "sourceUri", "TEXT");
    await ensureColumn("Videos", "sourceVideoId", "TEXT");
    await ensureColumn("Videos", "isClip", "INTEGER NOT NULL DEFAULT 0");
    await ensureColumn("Videos", "clipStart", "REAL");
    await ensureColumn("Videos", "clipEnd", "REAL");
    await ensureColumn("Videos", "isDeleted", "INTEGER NOT NULL DEFAULT 0");
    await ensureColumn("Folders", "coverHash", "TEXT");
  })();

  return initPromise;
}
