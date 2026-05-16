/**
 * TopControls.tsx
 *
 * Top bar of the video player overlay.
 * Contains: back button, video title, subtitle button, audio track button, settings (⋮).
 */
import Feather from 'react-native-vector-icons/Feather';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

export interface TopControlsProps {
  title: string;
  isLocked: boolean;
  hasSubtitles: boolean;
  hasMultipleAudioTracks: boolean;
  audioTrackLabel?: string;
  onBack: () => void;
  onSubtitlePress: () => void;
  onAudioTrackPress: () => void;
  onMorePress: () => void;
}

export function TopControls({
  title,
  isLocked,
  hasSubtitles,
  hasMultipleAudioTracks,
  audioTrackLabel,
  onBack,
  onSubtitlePress,
  onAudioTrackPress,
  onMorePress,
}: TopControlsProps) {
  if (isLocked) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      <LinearGradient
        colors={['rgba(0,0,0,0.82)', 'rgba(0,0,0,0.24)', 'transparent']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.row}>
        {/* Back button */}
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
          hitSlop={12}
        >
          <Feather name="chevron-left" size={26} color="#fff" />
        </Pressable>

        {/* Title */}
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>

        {/* Subtitle button */}
        {hasSubtitles && (
          <Pressable
            onPress={onSubtitlePress}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
            hitSlop={8}
          >
            <MaterialCommunityIcons name="subtitles-outline" size={22} color="#fff" />
          </Pressable>
        )}

        {/* Audio track button */}
        {hasMultipleAudioTracks && (
          <Pressable
            onPress={onAudioTrackPress}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
            hitSlop={8}
          >
            <MaterialCommunityIcons name="translate" size={20} color="#fff" />
          </Pressable>
        )}

        {/* More / Settings */}
        <Pressable
          onPress={onMorePress}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
          hitSlop={8}
        >
          <Feather name="more-vertical" size={22} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 12,
    paddingHorizontal: 8,
    paddingBottom: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  title: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 4,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
});
