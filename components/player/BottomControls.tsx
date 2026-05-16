/**
 * BottomControls.tsx
 *
 * Bottom bar of the video player overlay.
 * Contains: Seekbar, current time / duration, playback speed pill, fullscreen toggle.
 */
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Seekbar } from '@/components/player/Seekbar';
import { formatDuration } from '@/utils/formatters';

export interface BottomControlsProps {
  isLocked: boolean;
  position: number;
  duration: number;
  seekPreviewPosition: number | null;
  playbackRate: number;
  contentFitMode: 'contain' | 'cover' | 'stretch';
  onSeekPreview: (time: number) => void;
  onSeekCommit: (time: number) => void;
  onSeekDragStart: () => void;
  onSeekDragEnd: () => void;
  onSpeedPress: () => void;
  onToggleContentFit: () => void;
  accentColor?: string;
}

export function BottomControls({
  isLocked,
  position,
  duration,
  seekPreviewPosition,
  playbackRate,
  contentFitMode,
  onSeekPreview,
  onSeekCommit,
  onSeekDragStart,
  onSeekDragEnd,
  onSpeedPress,
  onToggleContentFit,
  accentColor = '#FF3B30',
}: BottomControlsProps) {
  if (isLocked) return null;

  const fitIcon =
    contentFitMode === 'cover'
      ? 'crop-free'
      : contentFitMode === 'stretch'
      ? 'fit-to-screen-outline'
      : 'fullscreen';

  return (
    <View style={styles.container} pointerEvents="box-none">
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.32)', 'rgba(0,0,0,0.82)']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Seek preview time badge */}
      {seekPreviewPosition !== null && duration > 0 && (
        <View
          style={[
            styles.previewBadge,
            {
              left: `${Math.min(
                Math.max((seekPreviewPosition / duration) * 100, 0),
                100
              )}%` as any,
            },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.previewBadgeText}>
            {formatDuration(Math.floor(seekPreviewPosition))}
          </Text>
        </View>
      )}

      {/* Progress row */}
      <View style={styles.progressRow}>
        <Text style={styles.timeText}>{formatDuration(Math.floor(position))}</Text>
        <View style={styles.seekbarWrap}>
          <Seekbar
            position={position}
            duration={duration}
            seekPreviewPosition={seekPreviewPosition}
            onSeekPreview={onSeekPreview}
            onSeekCommit={onSeekCommit}
            onDragStart={onSeekDragStart}
            onDragEnd={onSeekDragEnd}
            accentColor={accentColor}
          />
        </View>
        <Text style={styles.durationText}>{formatDuration(Math.floor(duration))}</Text>
      </View>

      {/* Action row */}
      <View style={styles.actionRow}>
        {/* Speed pill — only show when not 1x */}
        {playbackRate !== 1 && (
          <Pressable
            onPress={onSpeedPress}
            style={({ pressed }) => [styles.speedPill, pressed && styles.pillPressed]}
          >
            <Text style={styles.speedPillText}>{playbackRate}x</Text>
          </Pressable>
        )}

        <View style={styles.spacer} />

        {/* Fullscreen / fit toggle */}
        <Pressable
          onPress={onToggleContentFit}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
          hitSlop={8}
        >
          <MaterialCommunityIcons name={fitIcon} size={23} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingBottom: 16,
    paddingTop: 32,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  seekbarWrap: {
    flex: 1,
  },
  timeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    minWidth: 40,
    textAlign: 'right',
  },
  durationText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    minWidth: 40,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  spacer: { flex: 1 },
  speedPill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  speedPillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  pillPressed: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  previewBadge: {
    position: 'absolute',
    bottom: 68,
    transform: [{ translateX: -22 }],
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  previewBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
