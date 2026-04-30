import { VolumeManager } from "react-native-volume-manager";

const MIN_UPDATE_INTERVAL_MS = 8;
const MIN_UPDATE_DELTA = 0.002;

let lastNativeCallAt = 0;
let lastNativeVolume = -1;

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 1);
}

export function resetVolumeGestureThrottle(initialVolume?: number) {
  lastNativeCallAt = 0;
  lastNativeVolume = initialVolume == null ? -1 : clamp01(initialVolume);
}

export async function setDeviceVolume(volume: number) {
  const safeVolume = clamp01(volume);
  lastNativeVolume = safeVolume;
  lastNativeCallAt = Date.now();
  await VolumeManager.setVolume(safeVolume, {
    type: "music",
    showUI: false,
    playSound: false,
  });
}

export function setDeviceVolumeForGesture(volume: number) {
  const safeVolume = clamp01(volume);
  const now = Date.now();

  if (
    now - lastNativeCallAt < MIN_UPDATE_INTERVAL_MS ||
    Math.abs(safeVolume - lastNativeVolume) <= MIN_UPDATE_DELTA
  ) {
    return Promise.resolve(false);
  }

  return setDeviceVolume(safeVolume)
    .then(() => true)
    .catch((error) => {
      console.warn("System volume set failed:", error);
      return false;
    });
}
