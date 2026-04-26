import { useMemo } from "react";

import { usePlayer } from "@/context/PlayerContext";

const FONT_SIZE_SCALE = {
  small: 0.92,
  medium: 1,
  large: 1.1,
} as const;

export function useFontScale() {
  const { settings } = usePlayer();
  const scale = FONT_SIZE_SCALE[settings.appFontSize] ?? 1;

  return useMemo(
    () => ({
      scale,
      fontSize: settings.appFontSize,
      apply: (size: number) => Math.round(size * scale),
    }),
    [scale, settings.appFontSize]
  );
}
