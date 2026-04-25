import Feather from 'react-native-vector-icons/Feather';
import React from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/hooks/useAppTheme';

type Action = {
  icon: string;
  label: string;
  onPress: () => void;
  color?: string;
  destructive?: boolean;
};

type Props = {
  visible: boolean;
  selectedCount: number;
  actions: Action[];
  onCancel: () => void;
  onSelectAll?: () => void;
};

export function MultiSelectActionBar({
  visible,
  selectedCount,
  actions,
  onCancel,
  onSelectAll,
}: Props) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = React.useRef(new Animated.Value(100)).current;

  React.useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : 100,
      useNativeDriver: true,
      tension: 60,
      friction: 10,
    }).start();
  }, [visible, slideAnim]);

  if (!visible && slideAnim._value === 100) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, 16),
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.left}>
          <Pressable
            onPress={onCancel}
            style={({ pressed }) => [
              styles.iconBtn,
              { backgroundColor: pressed ? colors.backgroundTertiary : 'transparent' },
            ]}
          >
            <Feather name="x" size={20} color={colors.text} />
          </Pressable>
          <Text style={[styles.countText, { color: colors.text }]}>
            {selectedCount} selected
          </Text>
        </View>

        {onSelectAll && (
          <Pressable
            onPress={onSelectAll}
            style={({ pressed }) => [
              styles.textBtn,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.textBtnLabel, { color: colors.primary }]}>
              Select All
            </Text>
          </Pressable>
        )}
      </View>

      <View style={styles.actions}>
        {actions.map((action, index) => (
          <Pressable
            key={index}
            onPress={action.onPress}
            style={({ pressed }) => [
              styles.actionBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <View
              style={[
                styles.actionIconWrap,
                { backgroundColor: action.destructive ? `${colors.error}15` : `${colors.primary}15` },
              ]}
            >
              <Feather
                name={action.icon as any}
                size={20}
                color={action.destructive ? colors.error : (action.color ?? colors.primary)}
              />
            </View>
            <Text
              style={[
                styles.actionLabel,
                { color: action.destructive ? colors.error : colors.textSecondary },
              ]}
            >
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    zIndex: 1000,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  textBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  textBtnLabel: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 6,
    minWidth: 80,
  },
  actionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
});
