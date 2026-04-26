// Crash handling test script for srkplayer
// Run this with `node crash_test.ts`

import { initDB, db } from '../services/database';
import { clearVideoCache, getAllVideos, upsertVideos } from '../services/videoService';
import { logCrash } from '../services/crashManager';




/// <reference types="node" />


// Global error handling for Node environment – ensures that uncaught exceptions
// and unhandled promise rejections are captured and logged via the existing
// crashManager utilities. This aligns the test script with the app's crash
// handling strategy.
(process as any).on('uncaughtException', async (err) => {
  await logCrash(err instanceof Error ? err : new Error(String(err)), 'process uncaughtException');
  console.error('Uncaught exception captured:', err);
});

(process as any).on('unhandledRejection', async (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  await logCrash(err, 'process unhandledRejection');
  console.error('Unhandled rejection captured:', reason);
});

async function testDatabaseIntegrity() {
  try {
    console.log('Testing database integrity check...');
    // Force an integrity check (will run the throttled check)
    await initDB();
    console.log('Database init completed without crash.');
  } catch (e) {
    await logCrash(e instanceof Error ? e : new Error(String(e)), 'Database integrity test');
    console.error('Database integrity test failed:', e);
  }
}

async function testCacheOverflow() {
  try {
    console.log('Testing video cache overflow...');
    // Insert many dummy videos to overflow the cache (limit is 500)
    const dummyVideos = [];
    for (let i = 0; i < 600; i++) {
      dummyVideos.push({
        id: `dummy-${i}`,
        uri: `file:///dummy${i}.mp4`,
        title: `Dummy Video ${i}`,
        path: `/dummy${i}.mp4`,
        duration: 60,
        thumbnail: null,
        thumbnailHash: null,
        folder: 'dummy',
        isDeleted: 0,
        isClip: 0,
        mediaType: 'video',
        size: 0,
        dateAdded: Date.now(),
        // other fields required by schema (use null/empty defaults)
        isFavorite: 0,
        lastPlayed: null,
        lastPosition: null,
        playCount: 0,
        mimeType: null,
        artist: null,
        album: null,
        watchedAt: null,
        clipStart: null,
        clipEnd: null,
      });
    }
    await upsertVideos(dummyVideos);
    console.log('Inserted dummy videos; cache should have evicted old entries without crashing.');
    // Verify we can still fetch videos
    const vids = await getAllVideos();
    console.log(`Fetched ${vids.length} videos after overflow test.`);
  } catch (e) {
    await logCrash(e instanceof Error ? e : new Error(String(e)), 'Cache overflow test');
    console.error('Cache overflow test failed:', e);
  } finally {
    // Cleanup the dummy entries to keep DB tidy
    try {
      await db.execAsync('DELETE FROM Videos WHERE id LIKE "dummy-%"');
      console.log('Cleaned up dummy videos.');
    } catch (cleanupErr) {
      console.warn('Failed to clean dummy videos:', cleanupErr);
    }
    // Clear in‑memory cache
    clearVideoCache();
  }
}

async function testUnhandledException() {
  try {
    console.log('Testing unhandled exception handling...');
    // Deliberately throw inside a promise without catching
    setTimeout(() => {
      throw new Error('Simulated uncaught exception');
    }, 0);
    // Give the event loop a chance to process the timeout
    await new Promise((resolve) => { setTimeout(() => resolve(undefined), 100); });
    console.log('If you see this, the uncaught exception was not fatal.');
  } catch (e) {
    // This block likely won't run because the error is uncaught
    await logCrash(e instanceof Error ? e : new Error(String(e)), 'Unhandled exception test');
    console.error('Caught unhandled exception (unexpected):', e);
  }
}

async function runAllTests() {
  console.log('Starting crash‑handling test suite...');
  await testDatabaseIntegrity();
  await testCacheOverflow();
  await testUnhandledException();
  console.log('All tests completed. Check crash logs for any recorded errors.');
}

runAllTests().catch((e) => {
  console.error('Fatal error during test execution:', e);
});
