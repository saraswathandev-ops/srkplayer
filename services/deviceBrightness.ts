import { Platform } from "react-native";
import BrightnessSetting from "@ttwrpz/react-native-brightness-setting";

const MIN_UPDATE_INTERVAL_MS = 8;
const MIN_UPDATE_DELTA = 0.002;

let lastNativeCallAt = 0;
let lastNativeBrightness = -1;

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(Math.max(value, 0), 1);
}

const isNativeBrightnessSupported =
  BrightnessSetting != null &&
  typeof BrightnessSetting.getBrightness === "function";

export function resetBrightnessGestureThrottle(initialBrightness?: number) {
  lastNativeCallAt = 0;
  lastNativeBrightness = initialBrightness == null ? -1 : clamp01(initialBrightness);
}

export async function getPlayerBrightness() {
  if (!isNativeBrightnessSupported) return 0.5;
  try {
    if (typeof BrightnessSetting.getAppBrightness === "function") {
      const appBrightness = await BrightnessSetting.getAppBrightness().catch(() => null);
      if (typeof appBrightness === "number" && Number.isFinite(appBrightness) && appBrightness >= 0) {
        return clamp01(appBrightness);
      }
    }
    return clamp01(await BrightnessSetting.getBrightness().catch(() => 0.5));
  } catch {
    return 0.5;
  }
}

export async function setPlayerBrightness(brightness: number) {
  const safeBrightness = clamp01(brightness);
  lastNativeBrightness = safeBrightness;
  lastNativeCallAt = Date.now();
  if (!isNativeBrightnessSupported) return;
  try {
    if (typeof BrightnessSetting.setAppBrightness === "function") {
      await Promise.resolve(BrightnessSetting.setAppBrightness(safeBrightness));
    } else if (typeof BrightnessSetting.setBrightness === "function") {
      await Promise.resolve(BrightnessSetting.setBrightness(safeBrightness));
    }
  } catch (error) {
    console.warn("setPlayerBrightness failed:", error);
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
  if (!isNativeBrightnessSupported) return;
  try {
    if (Platform.OS === "android") {
      if (typeof BrightnessSetting.setAppBrightness === "function") {
        await Promise.resolve(BrightnessSetting.setAppBrightness(-1 as any));
        return;
      }
    }
    if (typeof BrightnessSetting.restoreBrightness === "function") {
      BrightnessSetting.restoreBrightness();
    }
  } catch (error) {
    console.warn("restorePlayerBrightness failed:", error);
  }
}

