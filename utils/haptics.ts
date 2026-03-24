import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import { Platform } from "react-native";

const options = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

export function triggerLightImpact() {
  if (Platform.OS === "web") {
    return;
  }

  try {
    ReactNativeHapticFeedback.trigger("impactLight", options);
  } catch {
    // Ignore haptic failures on unsupported devices.
  }
}
