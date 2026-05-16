/**
 * CenterControls.tsx
 *
 * Center playback controls: Previous, Play/Pause, Next.
 * Also contains the lock/unlock button.
 */
import Ionicons from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Feather';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export interface CenterControlsProps {
  isPlaying: boolean;
  isLocked: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleLock: () => void;
}

export function CenterControls({
  isPlaying,
  isLocked,
  hasPrev,
  hasNext,
  onPlayPause,
  onPrev,
  onNext,
  onToggleLock,
}: CenterControlsProps) {
  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Lock button — always visible */}
      <Pressable
        onPress={onToggleLock}
        style={({ pressed }) => [styles.lockBtn, pressed && styles.lockBtnPressed]}
        hitSlop={8}
      >
        <Feather name={isLocked ? 'unlock' : 'lock'} size={18} color="#fff" />
        {isLocked && <Text style={styles.lockLabel}>Unlock</Text>}
      </Pressable>

      {/* Transport row — hidden when locked */}
      {!isLocked && (
        <View style={styles.transport}>
          <Pressable
            onPress={onPrev}
            disabled={!hasPrev}
            hitSlop={10}
            style={({ pressed }) => [
              styles.skipBtn,
              !hasPrev && styles.disabled,
              pressed && hasPrev && styles.skipBtnPressed,
            ]}
          >
            <Ionicons
              name="play-skip-back"
              size={28}
              color={hasPrev ? '#fff' : 'rgba(255,255,255,0.3)'}
            />
          </Pressable>

          <Pressable
            onPress={onPlayPause}
            hitSlop={10}
            style={({ pressed }) => [styles.playBtn, pressed && styles.playBtnPressed]}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={32}
              color="#fff"
              style={isPlaying ? undefined : styles.playIconOffset}
            />
          </Pressable>

          <Pressable
            onPress={onNext}
            disabled={!hasNext}
            hitSlop={10}
            style={({ pressed }) => [
              styles.skipBtn,
              !hasNext && styles.disabled,
              pressed && hasNext && styles.skipBtnPressed,
            ]}
          >
            <Ionicons
              name="play-skip-forward"
              size={28}
              color={hasNext ? '#fff' : 'rgba(255,255,255,0.3)'}
            />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 32,
  },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  playIconOffset: {
    marginLeft: 3,
  },
  skipBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  disabled: {
    opacity: 0.4,
  },
  lockBtn: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  lockBtnPressed: {
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  lockLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
});
