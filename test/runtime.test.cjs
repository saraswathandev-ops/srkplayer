const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

// Run actual service code with isolated native dependencies, never a device DB.
function loadService(file, dependencies = {}, globals = {}) {
  const filename = path.join(__dirname, '..', file);
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports, __DEV__: false, console, setTimeout, clearTimeout,
    require(name) {
      assert.ok(Object.hasOwn(dependencies, name), `Unmocked dependency: ${name}`);
      return dependencies[name];
    },
    ...globals,
  }, { filename });
  return exports;
}

function crashHarness(count = 0) {
  const values = new Map([['@app_crash_count', String(count)], ['library', 'preserved']]);
  const timers = new Map();
  let timerId = 0;
  let resets = 0;
  const storage = {
    getItem: async key => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
    multiRemove: async keys => { keys.forEach(key => values.delete(key)); },
  };
  const service = loadService('services/crashManager.ts', {
    '@react-native-async-storage/async-storage': storage,
    'react-native-fs': { DocumentDirectoryPath: '/mock', appendFile: async () => {} },
    './database': { resetDatabase: async () => { resets += 1; } },
    '@/types/player': { DEFAULT_PLAYER_SETTINGS: {}, PLAYER_STORAGE_KEYS: { settings: 'settings' } },
  }, {
    setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
    clearTimeout(id) { timers.delete(id); },
  });
  return { service, values, timers, resets: () => resets };
}

const flush = () => new Promise(resolve => setImmediate(resolve));

for (const count of [1, 3, 4, 5]) {
  test(`healthy launch clears recovery at crash count ${count}, preserving library`, async () => {
    const h = crashHarness(count);
    assert.equal(await h.service.checkAndHandleCrashLoop(), count >= 3);
    assert.equal(h.timers.size, 0, 'initialization must finish before scheduling success');
    h.service.scheduleStartupHealthCheck();
    [...h.timers.values()][0]();
    await flush();
    assert.equal(h.values.has('@app_crash_count'), false);
    assert.equal(h.values.has('@app_crash_recovery_level'), false);
    assert.equal(h.values.get('library'), 'preserved');
    assert.equal(h.resets(), 0);
  });
}

test('fatal crash cancels success timer and survives an already queued callback', async () => {
  const h = crashHarness(3);
  h.service.scheduleStartupHealthCheck();
  const staleCallback = [...h.timers.values()][0];
  await h.service.recordFatalCrash('decoder crashed');
  staleCallback();
  await flush();
  assert.equal(h.values.get('@app_crash_count'), '4');
  h.service.scheduleStartupHealthCheck();
  assert.equal(h.timers.size, 0);
});

test('concurrent fatal reports do not lose increments', async () => {
  const h = crashHarness(1);
  await Promise.all([h.service.recordFatalCrash('one'), h.service.recordFatalCrash('two')]);
  assert.equal(h.values.get('@app_crash_count'), '3');
});

test('render failure cancels success without erasing recovery', async () => {
  const h = crashHarness(4);
  h.service.scheduleStartupHealthCheck();
  h.service.recordStartupFailure();
  assert.equal(h.timers.size, 0);
  assert.equal(h.values.get('@app_crash_count'), '4');
});

function audioHarness(overrides = {}) {
  const calls = [];
  const native = {
    setupPlayer: async () => { calls.push('setup'); },
    updateOptions: async () => { calls.push('options'); },
    setRepeatMode: async () => { calls.push('repeat'); },
    ...overrides,
  };
  const appState = { currentState: 'active' };
  const service = loadService('services/trackPlayerService.ts', {
    'react-native-track-player': {
      __esModule: true, default: native, Capability: {}, Event: {}, RepeatMode: { Off: 0 },
      AppKilledPlaybackBehavior: { ContinuePlayback: 1 },
    },
    'react-native': { NativeModules: {}, AppState: appState, Platform: { OS: 'android' } },
    '@/utils/thumbnailSource': { getThumbnailUri: () => null },
  });
  return { service, calls, native, appState };
}

test('audio setup is single-flight and ready only after all configuration completes', async () => {
  let finish;
  const h = audioHarness({ setupPlayer: () => new Promise(resolve => { finish = resolve; }) });
  const first = h.service.setupTrackPlayer();
  const second = h.service.setupTrackPlayer();
  assert.equal(h.service.isTrackPlayerReady(), false);
  finish();
  await Promise.all([first, second]);
  assert.deepEqual(h.calls, ['options', 'repeat']);
  assert.equal(h.service.isTrackPlayerReady(), true);
});

for (const method of ['setupPlayer', 'updateOptions', 'setRepeatMode']) {
  test(`audio ${method} failure remains retryable`, async () => {
    const h = audioHarness({ [method]: async () => { throw new Error('native failed'); } });
    await assert.rejects(h.service.setupTrackPlayer(), /native failed/);
    assert.equal(h.service.isTrackPlayerReady(), false);
    h.native[method] = async () => {};
    await h.service.setupTrackPlayer();
    assert.equal(h.service.isTrackPlayerReady(), true);
  });
}

test('existing native audio service can be configured after JS restart', async () => {
  const h = audioHarness({ setupPlayer: async () => { throw { code: 'player_already_initialized' }; } });
  await h.service.setupTrackPlayer();
  assert.equal(h.service.isTrackPlayerReady(), true);
});

test('background audio setup defers and succeeds on next foreground request', async () => {
  const h = audioHarness();
  h.appState.currentState = 'background';
  await h.service.setupTrackPlayer();
  assert.equal(h.calls.length, 0);
  assert.equal(h.service.isTrackPlayerReady(), false);
  h.appState.currentState = 'active';
  await h.service.setupTrackPlayer();
  assert.equal(h.service.isTrackPlayerReady(), true);
});

test('stale video cleanup cannot release the next video session', () => {
  const service = loadService('services/playerSession.ts');
  let released = 0;
  const previous = { release() { throw new Error('stale release'); } };
  const current = { release() { released += 1; } };
  service.setPlayerSession(current, 'next');
  service.releasePlayerSession(previous);
  assert.equal(released, 0);
  service.releasePlayerSession(current);
  assert.equal(released, 1);
  assert.equal(service.getPlayerSession(), null);
});

function playbackHarness() {
  const utils = loadService('app/player.utils.ts', {
    '@/services/trackPlayerService': { isTrackPlayerAvailable: false },
    './player.constants': { VERTICAL_GESTURE_SENSITIVITY_PX: 250 },
  });
  const resolver = loadService('app/player.resolver.ts', { './player.utils': utils });
  return { utils, resolver };
}

test('local paths normalize once and content URIs retain their access identity', () => {
  const { utils } = playbackHarness();
  const uri = utils.normalizePlaybackUri('/storage/emulated/0/My Videos/movie #1.mp4');
  assert.equal(uri, 'file:///storage/emulated/0/My%20Videos/movie%20%231.mp4');
  assert.equal(utils.normalizePlaybackUri(uri), uri);
  const content = 'content://media/external/video/media/42';
  assert.equal(utils.normalizePlaybackUri(content), content);
  const percentPath = '/storage/emulated/0/literal%20name.mp4';
  const percentUri = 'file:///storage/emulated/0/literal%2520name.mp4';
  assert.equal(utils.normalizePlaybackUri(percentPath), percentUri);
  assert.equal(utils.normalizePlaybackUri(percentUri), percentUri);
});

test('video selection rejects stale cached items and resolves selected clips to their source', () => {
  const { utils, resolver } = playbackHarness();
  const selected = { id: 'clip', uri: 'mxclip://clip', sourceUri: 'file:///movie.mp4', isClip: true };
  const active = resolver.resolveActivePlaybackVideo({
    activeVideoId: 'clip', videos: [], currentVideo: { id: 'old', uri: 'file:///old.mp4' }, storedVideo: selected,
  });
  assert.equal(active, selected);
  assert.equal(utils.getPlaybackUri(active), 'file:///movie.mp4');
  assert.equal(resolver.resolveActivePlaybackVideo({ activeVideoId: 'missing', videos: [], currentVideo: selected }), null);
});

test('next video uses its own URI instead of the previous route source', () => {
  const { resolver } = playbackHarness();
  const video = { id: 'next', uri: 'file:///next.mp4', mediaType: 'video' };
  const queue = resolver.resolvePlaybackQueue({
    folderQueueVideos: [], hydratedVideos: [video], videoId: 'next',
    activeVideoId: 'next', routeVideoId: 'old', routePlaybackUri: 'file:///old.mp4', video,
  });
  assert.equal(queue.playbackUri, video.uri);
  assert.equal(queue.currentIndex, 0);
});
