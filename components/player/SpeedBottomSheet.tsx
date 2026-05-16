/**
 * SpeedBottomSheet.tsx
 *
 * Bottom sheet for selecting playback speed.
 */
import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import Feather from 'react-native-vector-icons/Feather';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export interface SpeedBottomSheetProps {
  visible: boolean;
  currentSpeed: number;
  onSpeedSelect: (speed: number) => void;
  onClose: () => void;
}

export function SpeedBottomSheet({
  visible,
  currentSpeed,
  onSpeedSelect,
  onClose,
}: SpeedBottomSheetProps) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['50%'], []);

  useEffect(() => {
    if (visible) {
      bottomSheetRef.current?.expand();
    } else {
      bottomSheetRef.current?.close();
    }
  }, [visible]);

  const handleSheetChanges = useCallback(
    (index: number) => {
      if (index === -1) {
        onClose();
      }
    },
    [onClose]
  );

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        pressBehavior="close"
      />
    ),
    []
  );

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      backdropComponent={renderBackdrop}
      enablePanDownToClose
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.indicator}
    >
      <View style={styles.container}>
        <Text style={styles.headerTitle}>Playback Speed</Text>
        <View style={styles.list}>
          {SPEEDS.map((speed) => {
            const isSelected = currentSpeed === speed;
            return (
              <Pressable
                key={speed}
                style={[styles.item, isSelected && styles.itemSelected]}
                onPress={() => onSpeedSelect(speed)}
              >
                <Text
                  style={[styles.itemText, isSelected && styles.itemTextSelected]}
                >
                  {speed === 1 ? 'Normal' : `${speed}x`}
                </Text>
                {isSelected && (
                  <Feather name="check" size={20} color="#FF3B30" />
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: '#1C1C1E',
  },
  indicator: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  container: {
    flex: 1,
    padding: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  list: {
    flex: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  itemSelected: {
    backgroundColor: 'rgba(255,59,48,0.15)',
  },
  itemText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  itemTextSelected: {
    color: '#FF3B30',
    fontWeight: '700',
  },
});
