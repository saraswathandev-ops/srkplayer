import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type UseScreenSpacingOptions = {
  webTopMin?: number;
  webBottomPad?: number;
  nativeBottomPad?: number;
};

export function useScreenSpacing(options: UseScreenSpacingOptions = {}) {
  const insets = useSafeAreaInsets();
  const {
    webTopMin = 67,
    webBottomPad = 118,
    nativeBottomPad = 90,
  } = options;

  const topPad =
    Platform.OS === "web" ? Math.max(insets.top, webTopMin) : insets.top;
  const bottomPad = Platform.OS === "web" ? webBottomPad : nativeBottomPad;

  return {
    insets,
    topPad,
    bottomPad,
  };
}
