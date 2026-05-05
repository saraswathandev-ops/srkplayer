import { NativeModules, Platform } from "react-native";

const { BrightnessModule } = NativeModules;

const MIN_UPDATE_INTERVAL_MS = 8;
const MIN_UPDATE_DELTA = 0.002;

let lastNativeCallAt = 0;
let lastNativeBrightness = -1;

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(Math.max(value, 0), 1);
}

export function resetBrightnessGestureThrottle(initialBrightness?: number) {
  lastNativeCallAt = 0;
  lastNativeBrightness = initialBrightness == null ? -1 : clamp01(initialBrightness);
}

export async function getPlayerBrightness() {
  if (Platform.OS !== "android" || !BrightnessModule) return 0.5;
  
  try {
    const brightness = await BrightnessModule.getWindowBrightness();
    return clamp01(brightness);
  } catch (error) {
    console.warn("Failed to get window brightness:", error);
    return 0.5;
  }
}

export async function setPlayerBrightness(brightness: number) {
  if (Platform.OS !== "android" || !BrightnessModule) return;

  const safeBrightness = clamp01(brightness);
  lastNativeBrightness = safeBrightness;
  lastNativeCallAt = Date.now();
  
  try {
    await BrightnessModule.setWindowBrightness(safeBrightness);
  } catch (error) {
    console.warn("Failed to set window brightness:", error);
  }
}

export function setPlayerBrightnessForGesture(brightness: number) {
  const safeBrightness = clamp01(brightness);
  const now = Date.now();

  if (
    now - lastNativeCallAt < MIN_UPDATE_INTERVAL_MS ||
    Math.abs(safeBrightness - lastNativeBrightness) <= MIN_UPDATE_DELTA
  ) {
    return Promise.resolve(false);
  }

  return setPlayerBrightness(safeBrightness)
    .then(() => true)
    .catch((error) => {
      console.warn("App brightness set failed:", error);
      return false;
    });
}

export async function restorePlayerBrightness() {
  resetBrightnessGestureThrottle();
  if (Platform.OS === "android" && BrightnessModule) {
     // -1.0 restores window brightness to follow system
     await BrightnessModule.setWindowBrightness(-1.0).catch(() => {});
  }
}
