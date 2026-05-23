import { NativeModules, Platform } from 'react-native';

import { log } from '@/utils/logger';

const L = log('deviceBrightness');

type BrightnessNativeModule = {
  setWindowBrightness: (brightness: number) => Promise<void>;
  getWindowBrightness: () => Promise<number>;
};

function getBrightnessModule(): BrightnessNativeModule | null {
  if (Platform.OS !== 'android') return null;
  return (NativeModules.BrightnessModule as BrightnessNativeModule | undefined) ?? null;
}

export async function setPlayerBrightness(level: number): Promise<boolean> {
  const safeLevel = Math.max(0, Math.min(1, level));
  const brightnessModule = getBrightnessModule();

  if (!brightnessModule) {
    return false;
  }

  try {
    await brightnessModule.setWindowBrightness(safeLevel);
    return true;
  } catch (err) {
    L.warn('Failed to set window brightness:', err);
    return false;
  }
}

export async function getPlayerBrightness(): Promise<number> {
  const brightnessModule = getBrightnessModule();

  if (!brightnessModule) {
    return 0.5;
  }

  try {
    return await brightnessModule.getWindowBrightness();
  } catch (err) {
    L.warn('Failed to get window brightness:', err);
    return 0.5;
  }
}

// These are kept for backward compatibility with older components
// that haven't migrated to Zustand yet.
export const setPlayerBrightnessForGesture = setPlayerBrightness;
export async function restorePlayerBrightness(): Promise<void> {
  const brightnessModule = getBrightnessModule();

  if (!brightnessModule) {
    return;
  }

  try {
    await brightnessModule.setWindowBrightness(-1);
  } catch (err) {
    L.warn('Failed to restore window brightness:', err);
  }
}

export const resetBrightnessGestureThrottle = (_level?: number): void => {};
