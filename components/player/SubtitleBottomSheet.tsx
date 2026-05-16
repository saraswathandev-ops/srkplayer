/**
 * SubtitleBottomSheet.tsx
 *
 * Bottom sheet for selecting subtitles (Phase 3 placeholder).
 */
import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import Feather from 'react-native-vector-icons/Feather';

export interface SubtitleBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  // In Phase 3, this will take a list of subtitles and handle selection
}

export function SubtitleBottomSheet({
  visible,
  onClose,
}: SubtitleBottomSheetProps) {
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
        <Text style={styles.headerTitle}>Subtitles</Text>
        <View style={styles.content}>
          <Feather name="info" size={32} color="rgba(255,255,255,0.5)" style={{ marginBottom: 12 }} />
          <Text style={styles.message}>
            Subtitle support will be implemented in Phase 3.
          </Text>
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
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  message: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    textAlign: 'center',
    maxWidth: '80%',
    lineHeight: 22,
  },
});
