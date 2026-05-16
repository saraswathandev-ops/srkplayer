/**
 * AudioTrackBottomSheet.tsx
 *
 * Bottom sheet for selecting audio tracks.
 */
import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Feather from 'react-native-vector-icons/Feather';
import { PlayerAudioTrack } from '@/store/playerStore';

export interface AudioTrackBottomSheetProps {
  visible: boolean;
  tracks: PlayerAudioTrack[];
  currentTrackIndex: number | null;
  onTrackSelect: (index: number) => void;
  onClose: () => void;
}

export function AudioTrackBottomSheet({
  visible,
  tracks,
  currentTrackIndex,
  onTrackSelect,
  onClose,
}: AudioTrackBottomSheetProps) {
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

  if (!tracks || tracks.length === 0) {
    return null;
  }

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
        <Text style={styles.headerTitle}>Audio Tracks</Text>
        <BottomSheetScrollView contentContainerStyle={styles.scrollContent}>
          {tracks.map((track) => {
            const isSelected = currentTrackIndex === track.index;
            const label = track.title || track.language?.toUpperCase() || `Track ${track.index + 1}`;
            
            return (
              <Pressable
                key={`audio-${track.index}`}
                style={[styles.item, isSelected && styles.itemSelected]}
                onPress={() => onTrackSelect(track.index)}
              >
                <Text
                  style={[styles.itemText, isSelected && styles.itemTextSelected]}
                >
                  {label}
                </Text>
                {isSelected && (
                  <Feather name="check" size={20} color="#FF3B30" />
                )}
              </Pressable>
            );
          })}
        </BottomSheetScrollView>
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
    paddingTop: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
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
