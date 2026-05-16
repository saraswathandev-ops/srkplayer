/**
 * SubtitleOverlay.tsx
 *
 * Renders subtitle text as a separate overlay above the video surface.
 * Subtitles are NOT burned into the video — they are positioned Text components.
 *
 * Time-sync is managed externally by useSubtitles hook.
 * This component is purely presentational.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export interface SubtitleOverlayProps {
  text: string | null;
  /** Font size: 'small' | 'medium' | 'large' */
  fontSize?: 'small' | 'medium' | 'large';
  /** Bottom offset — adjust to avoid seekbar overlap */
  bottomOffset?: number;
}

const FONT_SIZE_MAP = {
  small: 14,
  medium: 17,
  large: 22,
} as const;

export function SubtitleOverlay({
  text,
  fontSize = 'medium',
  bottomOffset = 80,
}: SubtitleOverlayProps) {
  if (!text) return null;

  return (
    <View
      style={[styles.container, { bottom: bottomOffset }]}
      pointerEvents="none"
    >
      <View style={styles.pill}>
        <Text style={[styles.text, { fontSize: FONT_SIZE_MAP[fontSize] }]}>
          {text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  pill: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    maxWidth: '90%',
  },
  text: {
    color: '#fff',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 24,
  },
});
