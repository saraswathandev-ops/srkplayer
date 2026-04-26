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

function registerRootComponent() {
  try {
    setupGlobalCrashHandler();
    AppRegistry.registerComponent(appName, () => Root);
  } catch (error) {
    void recordFatalCrash(error, 'AppRegistry.registerComponent');
    AppRegistry.registerComponent(appName, () => BootstrapFallback);
  }
}

function registerPlayback() {
  try {
    TrackPlayer.registerPlaybackService(() => require('./services/trackPlayerService').PlaybackService);
  } catch (error) {
    void logCrash(
      error instanceof Error ? error : new Error(String(error)),
      'TrackPlayer.registerPlaybackService'
    );
  }
}

registerRootComponent();
registerPlayback();

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
