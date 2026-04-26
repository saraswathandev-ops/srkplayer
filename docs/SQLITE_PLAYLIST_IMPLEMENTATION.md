# SQLite Playlist Implementation

This app now uses `expo-sqlite` for library and playlist persistence instead of storing large video and playlist blobs in `AsyncStorage`.

## What Changed

- `services/database.ts` initializes the local `mxplayer.db` database.
- `services/videoService.ts` stores videos with SQLite-backed insert, sync, favorite, and playback updates.
- `services/playlistService.ts` stores playlists and playlist items with indexed joins, pagination, and reorder support.
- `context/PlayerContext.tsx` now loads videos and playlists from SQLite and keeps settings in `AsyncStorage`.
- `services/playerStorage.ts` performs a one-time migration from the old `AsyncStorage` video and playlist data into SQLite.

## Schema

- `Videos`
  Stores media metadata, playback state, favorites, and folder/path information.
- `Playlists`
  Stores playlist metadata.
- `PlaylistItems`
  Stores ordered playlist membership with `playlistId`, `videoId`, and `position`.

Indexes:

- `idx_playlist_items_playlist_id`
- `idx_playlist_items_playlist_position`
- `idx_videos_path`

## Performance Notes

- WAL mode is enabled.
- Playlist queries use indexed joins instead of large in-memory `videoIds` arrays.
- Playlist detail loading is paginated with `LIMIT` and `OFFSET`.
- Removing a video from a playlist compacts item positions to keep ordering stable.
- Existing users are migrated once through `PLAYER_STORAGE_KEYS.sqliteMigrated`.

## Current UI Integration

- Library and search still work off the hydrated in-memory video list from `PlayerContext`.
- Playlist counts are read from SQLite aggregate queries.
- Playlist detail pages fetch paginated rows directly from SQLite.

## Next Useful Steps

- Move library screen to paginated SQLite reads for very large media collections.
- Add drag-and-drop UI on top of `reorderPlaylist`.
- Persist playback queue, shuffle, and repeat state in SQLite if you want full MX-style session recovery.
