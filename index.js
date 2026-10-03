/**
 * @format
 * React Native Entry Point (Bare Workflow)
 *
 * Keep this file intentionally small. Metro evaluates every static import
 * during bootstrap, so application services must not be loaded here unless
 * they are required by the native registration itself.
 */

import React from 'react';
import { AppRegistry } from 'react-native';
import TrackPlayer from 'react-native-track-player';
import { PlaybackService } from './services/playbackService';
import { name as appName } from './app.json';

function devLog(tag, message, data) {
  if (__DEV__) {
    const ts = new Date().toISOString().slice(11, 23);
    const suffix = data === undefined ? '' : ` ${JSON.stringify(data)}`;
    console.log(`🚀 [${ts}][Bootstrap/${tag}] ${message}${suffix}`);
  }
}

function registerRootComponent() {
  devLog('registerRootComponent', 'start', { appName });

  try {
    // Lazy-load the application graph only when React Native creates the root.
    // This prevents database/storage/player modules from executing during the
    // native bootstrap phase.
    AppRegistry.registerComponent(appName, () => {
      const App = require('./src/App').default;
      return App;
    });

    devLog('registerRootComponent', 'root component registered ✓');
  } catch (error) {
    console.error('🔴 [Bootstrap/registerRootComponent] FAILED', error);
    throw error;
  }
}

function registerPlayback() {
  devLog('registerPlayback', 'start');

  try {
    TrackPlayer.registerPlaybackService(() => PlaybackService);
    devLog('registerPlayback', 'TrackPlayer playback service registered ✓');
  } catch (error) {
    // Playback registration must not prevent the main application from
    // registering. The player service will simply be unavailable until the
    // native module is ready.
    console.error(
      '🔴 [Bootstrap/registerPlayback] TrackPlayer playback service unavailable',
      error,
    );
  }
}

devLog('entry', 'index.js executing', { appName });
registerRootComponent();
registerPlayback();
devLog('entry', 'bootstrap complete');
