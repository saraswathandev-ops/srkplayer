/**
 * @format
 * React Native Entry Point (Bare Workflow)
 */

import React from 'react';
import { AppRegistry, StyleSheet, Text, View } from 'react-native';
import TrackPlayer from 'react-native-track-player';
import App from './src/App';
import { name as appName } from './app.json';
import { logCrash, recordFatalCrash, setupGlobalCrashHandler } from './services/crashManager';
import { ErrorBoundary } from './components/ErrorBoundary';

// ── Dev-only bootstrap logger (stripped in release builds) ─────────────────
function devLog(tag, message, data) {
  if (__DEV__) {
    const ts = new Date().toISOString().slice(11, 23);
    const line = data !== undefined
      ? `🚀 [${ts}][Bootstrap/${tag}] ${message} ${JSON.stringify(data)}`
      : `🚀 [${ts}][Bootstrap/${tag}] ${message}`;
    console.log(line);
  }
}

function devError(tag, message, error) {
  if (__DEV__) {
    const ts = new Date().toISOString().slice(11, 23);
    console.error(`🔴 [${ts}][Bootstrap/${tag}] ${message}`, error);
  }
}

// ── Fallback UI when bootstrap itself crashes ───────────────────────────────
function BootstrapFallback() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>App failed to start</Text>
      <Text style={styles.message}>
        A startup error was logged. Close and reopen the app.
      </Text>
    </View>
  );
}

const Root = () => (
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

// ── Step 1: Register root component ────────────────────────────────────────
function registerRootComponent() {
  devLog('registerRootComponent', 'start', { appName });
  try {
    setupGlobalCrashHandler();
    devLog('registerRootComponent', 'global crash handler installed');

    AppRegistry.registerComponent(appName, () => Root);
    devLog('registerRootComponent', 'root component registered ✓');
  } catch (error) {
    devError('registerRootComponent', 'FAILED — falling back to BootstrapFallback', error);
    void recordFatalCrash(error, 'AppRegistry.registerComponent');
    AppRegistry.registerComponent(appName, () => BootstrapFallback);
  }
}

// ── Step 2: Register TrackPlayer playback service ──────────────────────────
function registerPlayback() {
  devLog('registerPlayback', 'start');
  try {
    TrackPlayer.registerPlaybackService(
      () => require('./services/trackPlayerService').PlaybackService
    );
    devLog('registerPlayback', 'TrackPlayer playback service registered ✓');
  } catch (error) {
    devError('registerPlayback', 'FAILED — audio background service unavailable', error);
    void logCrash(
      error instanceof Error ? error : new Error(String(error)),
      'TrackPlayer.registerPlaybackService'
    );
  }
}

devLog('entry', 'index.js executing', { appName });
registerRootComponent();
registerPlayback();
devLog('entry', 'bootstrap complete');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#0f1115',
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  message: {
    color: '#c8ced8',
    fontSize: 14,
    textAlign: 'center',
  },
});
