/**
 * GestureHUD.tsx
 *
 * Floating HUD indicators for gesture-driven controls.
 * Shows brightness bar (left), volume bar (right), or seek delta (center).
 * Driven by Reanimated shared values for 60fps opacity/slide animations.
 */
import Feather from 'react-native-vector-icons/Feather';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ReAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

// ─── Brightness HUD (left edge) ───────────────────────────────────────────────

interface SideHUDProps {
  visible: boolean;
  percent: number;
  type: 'brightness' | 'volume';
  direction?: 'up' | 'down' | null;
}

export function SideHUD({ visible, percent, type, direction }: SideHUDProps) {
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(type === 'brightness' ? -80 : 80);

  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: visible ? 80 : 280 });
    translateX.value = withTiming(visible ? 0 : (type === 'brightness' ? -80 : 80), {
      duration: visible ? 80 : 280,
    });
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  const isBrightness = type === 'brightness';
  const iconName = isBrightness
    ? percent <= 0
      ? 'moon'
      : 'sun'
    : percent <= 0
    ? 'volume-x'
    : 'volume-2';

  const color = isBrightness ? '#FDE68A' : '#93C5FD';
  const barColor = isBrightness ? '#F59E0B' : '#3B82F6';

  return (
    <ReAnimated.View
      style={[
        styles.sideHUD,
        isBrightness ? styles.sideHUDLeft : styles.sideHUDRight,
        animStyle,
      ]}
      pointerEvents="none"
    >
      <Feather name={iconName} size={18} color={color} />
      {/* Vertical bar */}
      <View style={styles.vertBar}>
        <View style={styles.vertBarTrack}>
          <View
            style={[
              styles.vertBarFill,
              { height: `${Math.min(percent, 100)}%` as any, backgroundColor: barColor },
            ]}
          />
        </View>
      </View>
      <Text style={[styles.sideHUDPct, { color }]}>{percent}%</Text>
    </ReAnimated.View>
  );
}

// ─── Seek HUD (center) ────────────────────────────────────────────────────────

interface SeekHUDProps {
  visible: boolean;
  label: string;
  direction: 'forward' | 'rewind';
}

export function SeekHUD({ visible, label, direction }: SeekHUDProps) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: visible ? 80 : 280 });
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const iconName = direction === 'forward' ? 'fast-forward' : 'rewind';

  return (
    <ReAnimated.View style={[styles.seekHUD, animStyle]} pointerEvents="none">
      <Feather name={iconName} size={22} color="#fff" />
      <Text style={styles.seekHUDLabel}>{label}</Text>
    </ReAnimated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sideHUD: {
    position: 'absolute',
    top: '30%',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.58)',
    minWidth: 64,
  },
  sideHUDLeft: { left: 16 },
  sideHUDRight: { right: 16 },
  sideHUDPct: {
    fontSize: 13,
    fontWeight: '700',
  },
  vertBar: {
    height: 80,
    justifyContent: 'flex-end',
  },
  vertBarTrack: {
    width: 6,
    height: 80,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  vertBarFill: {
    width: '100%',
    borderRadius: 3,
  },
  seekHUD: {
    position: 'absolute',
    top: '38%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.58)',
  },
  seekHUDLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
