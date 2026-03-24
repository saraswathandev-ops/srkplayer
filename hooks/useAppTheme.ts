import { useColorScheme } from "react-native";

import { getThemeColors } from "@/constants/colors";
import { usePlayer } from "@/context/PlayerContext";

export function useAppTheme() {
  const systemColorScheme = useColorScheme();
  const { settings } = usePlayer();
  const colorScheme =
    settings.theme === "system" ? systemColorScheme : settings.theme;
  const isDark = colorScheme !== "light";

  return {
    isDark,
    colorScheme,
    colors: getThemeColors(isDark, settings.themePreset),
  };
}
