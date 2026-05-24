/**
 * AudioTrackBottomSheet.tsx
 *
 * Bottom sheet for selecting an embedded audio track.
 *
 * Behaviour:
 *   - Always opens if there is at least one track — even a single-track file
 *     shows that track marked as the active selection. Users want to *see*
 *     what language they're hearing, not be silently dismissed.
 *   - Labels resolve BCP-47 codes (`ta`) to human names (`Tamil · தமிழ்`)
 *     via utils/languageNames.ts.
 *   - "Remember this language" toggle persists the chosen language so the
 *     next file with that language auto-selects it.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Feather from 'react-native-vector-icons/Feather';
import { PlayerAudioTrack } from '@/store/playerStore';
import { getLanguageName } from '@/utils/languageNames';
import { loadPreferredAudio, setPreferredAudio } from '@/services/audioLanguagePref';

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
  const snapPoints = useMemo(() => ['55%', '88%'], []);
  const [rememberEnabled, setRememberEnabled] = useState(false);

  useEffect(() => {
    if (!visible) {
      bottomSheetRef.current?.close();
      return;
    }
    bottomSheetRef.current?.expand();
    // Refresh the toggle from storage every time the sheet opens — the user
    // may have toggled it during a previous video and we want to reflect it.
    void loadPreferredAudio().then((p) => setRememberEnabled(p.enabled));
  }, [visible]);

  const handleSheetChanges = useCallback(
    (index: number) => {
      if (index === -1) onClose();
    },
    [onClose],
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
    [],
  );

  const currentTrack = useMemo(
    () => tracks.find((t) => t.index === currentTrackIndex) ?? null,
    [tracks, currentTrackIndex],
  );

  const handleSelect = useCallback(
    async (track: PlayerAudioTrack) => {
      onTrackSelect(track.index);
      // If "Remember" is on and the track has a language, save it.
      if (rememberEnabled && track.language) {
        await setPreferredAudio(track.language, true);
      }
    },
    [onTrackSelect, rememberEnabled],
  );

  const handleToggleRemember = useCallback(async () => {
    const next = !rememberEnabled;
    setRememberEnabled(next);
    // Persist the toggle state along with the currently active track's
    // language (so flipping it on captures the current choice).
    const lang = next ? currentTrack?.language ?? null : null;
    await setPreferredAudio(lang, next);
  }, [rememberEnabled, currentTrack]);

  // Don't render the sheet if literally zero tracks — caller (`handleCycleAudioTrack`)
  // already shows the "No audio tracks" HUD in that case.
  if (!tracks || tracks.length === 0) {
    return null;
  }

  const showRememberToggle = !!currentTrack?.language;

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
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Audio</Text>
          <Text style={styles.headerCount}>
            {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}
          </Text>
        </View>

        <BottomSheetScrollView contentContainerStyle={styles.scrollContent}>
          {tracks.map((track) => {
            const isSelected = currentTrackIndex === track.index;
            const { english, native } = getLanguageName(track.language);
            const primary =
              track.title ||
              english ||
              `Track ${track.index + 1}`;

            // Secondary line: native name + bitrate when available.
            const subParts: string[] = [];
            if (native && native !== english) subParts.push(native);
            if (typeof track.bitrate === 'number' && track.bitrate > 0) {
              const kbps = Math.round(track.bitrate / 1000);
              if (kbps > 0) subParts.push(`${kbps} kbps`);
            }
            const subline = subParts.join(' · ');

            return (
              <Pressable
                key={`audio-${track.index}`}
                style={({ pressed }) => [
                  styles.item,
                  isSelected && styles.itemSelected,
                  pressed && styles.itemPressed,
                ]}
                onPress={() => void handleSelect(track)}
              >
                <View style={styles.itemTextBlock}>
                  <Text
                    style={[styles.itemText, isSelected && styles.itemTextSelected]}
                    numberOfLines={1}
                  >
                    {primary}
                  </Text>
                  {subline ? (
                    <Text style={styles.itemSubText} numberOfLines={1}>
                      {subline}
                    </Text>
                  ) : null}
                </View>
                {isSelected && <Feather name="check" size={20} color="#FF3B30" />}
              </Pressable>
            );
          })}

          {showRememberToggle ? (
            <Pressable
              onPress={() => void handleToggleRemember()}
              style={({ pressed }) => [styles.toggleRow, pressed && { opacity: 0.7 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>
                  Remember {getLanguageName(currentTrack?.language).english}
                </Text>
                <Text style={styles.toggleHint}>
                  Auto-select this language on future videos when available.
                </Text>
              </View>
              <View style={[styles.toggleBox, rememberEnabled && styles.toggleBoxOn]}>
                <View style={[styles.toggleKnob, rememberEnabled && styles.toggleKnobOn]} />
              </View>
            </Pressable>
          ) : null}
        </BottomSheetScrollView>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  background: { backgroundColor: '#1C1C1E' },
  indicator: { backgroundColor: 'rgba(255,255,255,0.3)' },
  container: { flex: 1, paddingTop: 12 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerCount: { color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '500' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 36 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  itemSelected: { backgroundColor: 'rgba(255,59,48,0.15)' },
  itemPressed: { opacity: 0.7 },
  itemTextBlock: { flex: 1, paddingRight: 12 },
  itemText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  itemTextSelected: { color: '#FF3B30', fontWeight: '700' },
  itemSubText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  toggleLabel: { color: '#fff', fontSize: 14, fontWeight: '600' },
  toggleHint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  toggleBox: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.18)',
    padding: 2,
    justifyContent: 'center',
  },
  toggleBoxOn: { backgroundColor: '#FF3B30' },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
  },
  toggleKnobOn: { alignSelf: 'flex-end' },
});
