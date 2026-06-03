/**
 * SubtitleBottomSheet.tsx
 *
 * Manages the lifecycle of subtitle tracks for the current video:
 *   - lists cached AI-generated tracks (selectable)
 *   - exposes the offline generation flow (language picker → start)
 *   - surfaces live job progress + cancel + retry
 *   - hosts style controls (font size, sync nudge)
 */
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Feather from 'react-native-vector-icons/Feather';
import { usePlayer } from '@/context/PlayerContext';
import { isSupported as isSubtitleGenerationSupported } from '@/services/subtitleService';
import { usePlayerStore, type SubtitleFontSize } from '@/store/playerStore';
import {
  INDIC_LANGS,
  LANG_LABELS,
  type SubtitleLang,
  type SubtitleTrack,
} from '@/types/subtitles';
import { useSubtitleGeneration } from '@/hooks/useSubtitleGeneration';
import { log } from '@/utils/logger';

const L = log('SubtitleSheet');

export interface SubtitleBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  videoUri: string | null;
}

const LANG_ORDER: SubtitleLang[] = ['auto', 'en', 'ta', 'hi', 'te', 'ml'];
const FONT_OPTIONS: SubtitleFontSize[] = ['small', 'medium', 'large', 'xlarge'];
const FONT_LABEL: Record<SubtitleFontSize, string> = {
  small: 'S',
  medium: 'M',
  large: 'L',
  xlarge: 'XL',
};

export function SubtitleBottomSheet({ visible, onClose, videoUri }: SubtitleBottomSheetProps) {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['65%', '92%'], []);
  const { settings } = usePlayer();

  const tracks = usePlayerStore((s) => s.subtitleTracks);
  const selectedSubtitleId = usePlayerStore((s) => s.selectedSubtitleId);
  const job = usePlayerStore((s) => s.subtitleJob);
  const enabled = usePlayerStore((s) => s.subtitlesEnabled);
  const fontSize = usePlayerStore((s) => s.subtitleFontSize);
  const syncMs = usePlayerStore((s) => s.subtitleSyncMs);
  const setFontSize = usePlayerStore((s) => s.setSubtitleFontSize);
  const setSyncMs = usePlayerStore((s) => s.setSubtitleSyncMs);
  const setSubtitlesEnabled = usePlayerStore((s) => s.setSubtitlesEnabled);

  const { start, cancel, retry, selectTrack, reloadTracks } = useSubtitleGeneration();
  const [generationSupported, setGenerationSupported] = React.useState<boolean | null>(
    Platform.OS === 'android' ? null : false
  );

  useEffect(() => {
    if (visible) {
      sheetRef.current?.expand();
      // Refresh listing when the sheet opens.
      if (videoUri) void reloadTracks(videoUri);
      void isSubtitleGenerationSupported()
        .then((supported) => setGenerationSupported(supported))
        .catch(() => setGenerationSupported(false));
    } else {
      sheetRef.current?.close();
    }
  }, [visible, videoUri, reloadTracks]);

  const handleSheetChanges = useCallback(
    (idx: number) => {
      if (idx === -1) onClose();
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

  const isJobActive =
    job &&
    job.status !== 'complete' &&
    job.status !== 'cancelled' &&
    job.status !== 'error';

  const handleSelectTrack = useCallback(
    async (track: SubtitleTrack | null) => {
      await selectTrack(track);
    },
    [selectTrack],
  );

  const handleStartLang = useCallback(
    async (lang: SubtitleLang) => {
      if (!settings.subtitleLiveGeneration || generationSupported !== true) {
        if (__DEV__) L.warn('start aborted: generation unavailable');
        return;
      }
      if (!videoUri) {
        if (__DEV__) L.warn('start aborted: no videoUri');
        return;
      }
      // For Indic languages, recommend `small`; otherwise `base`.
      const useSmall = INDIC_LANGS.includes(lang);
      if (__DEV__) L.info('handleStartLang', { lang, useSmall, videoUri: videoUri.slice(-60) });
      await start(videoUri, { language: lang, model: useSmall ? 'small' : 'base' });
    },
    [generationSupported, settings.subtitleLiveGeneration, start, videoUri],
  );

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      backdropComponent={renderBackdrop}
      enablePanDownToClose
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.indicator}
    >
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Subtitles</Text>
        <View style={styles.offlineBadge}>
          <Feather name="wifi-off" size={11} color="#10B981" />
          <Text style={styles.offlineBadgeText}>Offline AI</Text>
        </View>
      </View>

      <BottomSheetScrollView contentContainerStyle={styles.scroll}>
        {/* ── Active job section ───────────────────────────────────────── */}
        {isJobActive && job ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {job.status === 'extracting' ? 'Extracting audio…' :
               job.status === 'writing' ? 'Finalizing…' :
               job.status === 'queued' ? 'Starting…' :
               'Generating subtitles…'}
            </Text>
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${Math.round(job.progress * 100)}%` }]}
              />
            </View>
            <View style={styles.progressMeta}>
              <Text style={styles.progressMetaText}>
                {Math.round(job.progress * 100)}%{' '}
                {job.etaMs ? `· ~${Math.ceil(job.etaMs / 1000)}s left` : ''}
              </Text>
              <Pressable
                onPress={() => void cancel()}
                style={({ pressed }) => [styles.smallBtn, pressed && styles.pressed]}
              >
                <Feather name="x" size={14} color="#fff" />
                <Text style={styles.smallBtnText}>Cancel</Text>
              </Pressable>
            </View>
            <Text style={styles.helperText}>
              Captions appear live above the video as Whisper produces them. Keep the app
              open or allow background tasks to let generation finish.
            </Text>
          </View>
        ) : null}

        {/* ── Error retry ──────────────────────────────────────────────── */}
        {job?.status === 'error' ? (
          <View style={[styles.section, styles.errorSection]}>
            <Text style={styles.errorTitle}>Couldn't generate subtitles</Text>
            <Text style={styles.errorBody}>
              {job.errorMessage ?? 'Unknown error.'}
            </Text>
            <View style={styles.errorActions}>
              <Pressable
                onPress={() => void retry()}
                style={({ pressed }) => [styles.smallBtn, styles.primaryBtn, pressed && styles.pressed]}
              >
                <Feather name="refresh-cw" size={14} color="#fff" />
                <Text style={styles.smallBtnText}>Retry</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* ── Cached tracks ────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available</Text>

          <Pressable
            onPress={() => void handleSelectTrack(null)}
            style={({ pressed }) => [
              styles.item,
              !enabled && styles.itemSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.itemText, !enabled && styles.itemTextSelected]}>
              Off
            </Text>
            {!enabled && <Feather name="check" size={18} color="#FF3B30" />}
          </Pressable>

          {tracks.length === 0 ? (
            <Text style={styles.helperText}>
              No subtitles yet for this video. Generate one below.
            </Text>
          ) : (
            tracks.map((t) => {
              const isSelected = enabled && selectedSubtitleId === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => void handleSelectTrack(t)}
                  style={({ pressed }) => [
                    styles.item,
                    isSelected && styles.itemSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemText, isSelected && styles.itemTextSelected]}>
                      {t.languageLabel}
                    </Text>
                    <Text style={styles.itemMeta}>
                      {t.modelUsed.toUpperCase()} · {t.segmentCount} cues
                    </Text>
                  </View>
                  {isSelected && <Feather name="check" size={18} color="#FF3B30" />}
                </Pressable>
              );
            })
          )}
        </View>

        {/* ── Generate ─────────────────────────────────────────────────── */}
        {!isJobActive ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Generate (offline AI)</Text>
            {!settings.subtitleLiveGeneration ? (
              <Text style={styles.helperText}>
                Subtitle generation is disabled in Settings.
              </Text>
            ) : generationSupported === false ? (
              <Text style={styles.helperText}>
                Offline subtitle generation is unavailable on this build or device.
              </Text>
            ) : null}
            <View style={styles.langGrid}>
              {LANG_ORDER.map((lang) => (
                <Pressable
                  key={lang}
                  onPress={() => void handleStartLang(lang)}
                  disabled={!videoUri || !settings.subtitleLiveGeneration || generationSupported !== true}
                  style={({ pressed }) => [
                    styles.langChip,
                    pressed && styles.pressed,
                    (!videoUri || !settings.subtitleLiveGeneration || generationSupported !== true) && { opacity: 0.4 },
                  ]}
                >
                  <Text style={styles.langChipText}>{LANG_LABELS[lang]}</Text>
                  {INDIC_LANGS.includes(lang) ? (
                    <Text style={styles.langChipHint}>Small recommended</Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* ── Style controls ───────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Display</Text>

          <View style={styles.controlRow}>
            <Text style={styles.controlLabel}>Font size</Text>
            <View style={styles.segGroup}>
              {FONT_OPTIONS.map((opt) => (
                <Pressable
                  key={opt}
                  onPress={() => setFontSize(opt)}
                  style={[
                    styles.segItem,
                    fontSize === opt && styles.segItemActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.segItemText,
                      fontSize === opt && styles.segItemTextActive,
                    ]}
                  >
                    {FONT_LABEL[opt]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.controlRow}>
            <Text style={styles.controlLabel}>Sync ({(syncMs / 1000).toFixed(1)}s)</Text>
            <View style={styles.segGroup}>
              <Pressable
                onPress={() => setSyncMs(syncMs - settings.subtitleSyncStepMs)}
                style={styles.segItem}
              >
                <Text style={styles.segItemText}>−</Text>
              </Pressable>
              <Pressable
                onPress={() => setSyncMs(0)}
                style={styles.segItem}
              >
                <Text style={styles.segItemText}>0</Text>
              </Pressable>
              <Pressable
                onPress={() => setSyncMs(syncMs + settings.subtitleSyncStepMs)}
                style={styles.segItem}
              >
                <Text style={styles.segItemText}>+</Text>
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={() => setSubtitlesEnabled(!enabled)}
            style={({ pressed }) => [styles.toggleRow, pressed && styles.pressed]}
          >
            <Text style={styles.controlLabel}>Show captions</Text>
            <View style={[styles.toggleBox, enabled && styles.toggleBoxOn]}>
              <View style={[styles.toggleKnob, enabled && styles.toggleKnobOn]} />
            </View>
          </Pressable>
        </View>

        <Text style={styles.footnote}>
          Generated entirely on your phone. Nothing leaves the device.
        </Text>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  background: { backgroundColor: '#1C1C1E' },
  indicator: { backgroundColor: 'rgba(255,255,255,0.3)' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16,185,129,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  offlineBadgeText: { color: '#10B981', fontSize: 11, fontWeight: '600' },
  scroll: { paddingHorizontal: 16, paddingBottom: 36 },
  section: { marginBottom: 18 },
  sectionTitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#FF3B30' },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  progressMetaText: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  helperText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    marginTop: 8,
    lineHeight: 17,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 6,
  },
  itemSelected: { backgroundColor: 'rgba(255,59,48,0.15)' },
  itemText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  itemTextSelected: { color: '#FF3B30', fontWeight: '700' },
  itemMeta: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },
  pressed: { opacity: 0.7 },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  primaryBtn: { backgroundColor: '#FF3B30' },
  smallBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  errorSection: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: 10,
    padding: 12,
  },
  errorTitle: { color: '#F87171', fontWeight: '700', fontSize: 14, marginBottom: 4 },
  errorBody: { color: 'rgba(255,255,255,0.75)', fontSize: 12, lineHeight: 17 },
  errorActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  langGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  langChip: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 110,
  },
  langChipText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  langChipHint: { color: 'rgba(251,146,60,0.85)', fontSize: 10, marginTop: 2 },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  controlLabel: { color: '#fff', fontSize: 14 },
  segGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  segItem: { paddingHorizontal: 12, paddingVertical: 6 },
  segItemActive: { backgroundColor: '#FF3B30' },
  segItemText: { color: '#fff', fontWeight: '600' },
  segItemTextActive: { color: '#fff' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  toggleBox: {
    width: 42,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    padding: 2,
    justifyContent: 'center',
  },
  toggleBoxOn: { backgroundColor: '#FF3B30' },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  toggleKnobOn: { alignSelf: 'flex-end' },
  footnote: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
    ...(Platform.OS === 'ios' ? {} : {}),
  },
});
