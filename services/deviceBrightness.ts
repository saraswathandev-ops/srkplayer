/**
 * deviceBrightness.ts
 *
 * Wrapper around react-native-screen-brightness.
 * We no longer use the custom native module from Phase 1, 
 * as the recommended standard library handles per-window brightness reliably.
 */
import ScreenBrightness from 'react-native-screen-brightness';
import { log } from '@/utils/logger';

const L = log('deviceBrightness');

export async function setPlayerBrightness(level: number): Promise<void> {
  const safeLevel = Math.max(0, Math.min(1, level));
  try {
    await ScreenBrightness.setBrightness(safeLevel);
  } catch (err) {
    L.warn('Failed to set brightness:', err);
  }
}

export async function getPlayerBrightness(): Promise<number> {
  try {
    return await ScreenBrightness.getBrightness();
  } catch (err) {
    L.warn('Failed to get brightness:', err);
    return 0.5; // fallback
  }
}

// These are kept for backward compatibility with older components
// that haven't migrated to Zustand yet.
export const setPlayerBrightnessForGesture = setPlayerBrightness;
export const restorePlayerBrightness = async (): Promise<void> => {}; // Handled by PlayerScreen cleanup
export const resetBrightnessGestureThrottle = (_level?: number): void => {};
