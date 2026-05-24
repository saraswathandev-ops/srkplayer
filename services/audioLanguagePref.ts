/**
 * Persisted "preferred audio language" — MX Player-style stickiness.
 *
 * When `enabled`, the player auto-selects an embedded audio track matching
 * the saved BCP-47 code on first track-set per video. The user opts in via
 * the "Remember this language" toggle in AudioTrackBottomSheet.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { log } from '@/utils/logger';

const L = log('AudioPref');

const KEY_LANGUAGE = '@audio_pref_language';
const KEY_ENABLED = '@audio_pref_enabled';

export interface AudioPref {
  enabled: boolean;
  language: string | null;
}

const DEFAULT: AudioPref = { enabled: false, language: null };

export async function loadPreferredAudio(): Promise<AudioPref> {
  try {
    const [lang, enabled] = await Promise.all([
      AsyncStorage.getItem(KEY_LANGUAGE),
      AsyncStorage.getItem(KEY_ENABLED),
    ]);
    return {
      enabled: enabled === '1',
      language: lang && lang.length > 0 ? lang : null,
    };
  } catch (e) {
    L.warn('loadPreferredAudio failed', e);
    return DEFAULT;
  }
}

export async function setPreferredAudio(
  language: string | null,
  enabled: boolean,
): Promise<void> {
  try {
    await Promise.all([
      language
        ? AsyncStorage.setItem(KEY_LANGUAGE, language)
        : AsyncStorage.removeItem(KEY_LANGUAGE),
      AsyncStorage.setItem(KEY_ENABLED, enabled ? '1' : '0'),
    ]);
  } catch (e) {
    L.warn('setPreferredAudio failed', e);
  }
}
