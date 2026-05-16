/**
 * LoadingOverlay.tsx
 *
 * Buffering spinner shown ONLY after 500ms of continuous buffering.
 * This prevents the flicker seen when seeking or switching videos quickly.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

const BUFFERING_DEBOUNCE_MS = 500;

export interface LoadingOverlayProps {
  isBuffering: boolean;
  color?: string;
}

export function LoadingOverlay({ isBuffering, color = '#fff' }: LoadingOverlayProps) {
  const [showSpinner, setShowSpinner] = useState(false);

  useEffect(() => {
    if (!isBuffering) {
      setShowSpinner(false);
      return;
    }
    // Only show after 500ms to avoid flicker on quick operations
    const t = setTimeout(() => setShowSpinner(true), BUFFERING_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [isBuffering]);

  if (!showSpinner) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      <ActivityIndicator size="large" color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.20)',
  },
});
