import {
  THEME_PRESET_OPTIONS,
  type ThemePreset,
} from "@/types/player";

type ThemePalette = {
  primary: string;
  primaryDark: string;
  accent: string;
};

type ThemeScale = {
  text: string;
  textSecondary: string;
  textTertiary: string;
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  card: string;
  border: string;
  tabIconDefault: string;
  overlay: string;
  success: string;
  warning: string;
  error: string;
};

type ThemeDefinition = ThemePalette & {
  light: ThemeScale;
  dark: ThemeScale;
};

export type ThemeColors = {
  text: string;
  textSecondary: string;
  textTertiary: string;
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  card: string;
  border: string;
  tint: string;
  tabIconDefault: string;
  tabIconSelected: string;
  primary: string;
  primaryDark: string;
  accent: string;
  overlay: string;
  success: string;
  warning: string;
  error: string;
};

const PRESETS: Record<ThemePreset, ThemeDefinition> = {
  violet: {
    primary: "#6E60FF",
    primaryDark: "#5647E8",
    accent: "#FF5B78",
    light: {
      text: "#1A1633",
      textSecondary: "#6D688B",
      textTertiary: "#9A95B5",
      background: "#F5F3FF",
      backgroundSecondary: "#FFFFFF",
      backgroundTertiary: "#E9E5FF",
      card: "#FFFFFF",
      border: "#DDD7FF",
      tabIconDefault: "#9CA3AF",
      overlay: "rgba(0,0,0,0.5)",
      success: "#17C58A",
      warning: "#F0A229",
      error: "#EF4E62",
    },
    dark: {
      text: "#F7F7FB",
      textSecondary: "#9A97B6",
      textTertiary: "#6E6B88",
      background: "#090A10",
      backgroundSecondary: "#11131C",
      backgroundTertiary: "#1D1F2B",
      card: "#1B1D28",
      border: "#2A2D3F",
      tabIconDefault: "#6B7280",
      overlay: "rgba(0,0,0,0.7)",
      success: "#20C997",
      warning: "#F0A229",
      error: "#FF5468",
    },
  },
  ocean: {
    primary: "#1E88E5",
    primaryDark: "#1565C0",
    accent: "#00B8A9",
    light: {
      text: "#102033",
      textSecondary: "#587086",
      textTertiary: "#7F97AA",
      background: "#EEF7FF",
      backgroundSecondary: "#FFFFFF",
      backgroundTertiary: "#DDEEFF",
      card: "#FFFFFF",
      border: "#CBE2F8",
      tabIconDefault: "#8A98A8",
      overlay: "rgba(4,17,31,0.46)",
      success: "#1DBF73",
      warning: "#F1A53B",
      error: "#E85B5B",
    },
    dark: {
      text: "#F2F8FF",
      textSecondary: "#9AB6D0",
      textTertiary: "#67809A",
      background: "#07131D",
      backgroundSecondary: "#0C1B28",
      backgroundTertiary: "#142B3D",
      card: "#102334",
      border: "#1E3951",
      tabIconDefault: "#70869C",
      overlay: "rgba(0,0,0,0.7)",
      success: "#21C58D",
      warning: "#F1A53B",
      error: "#FF6A67",
    },
  },
  sunset: {
    primary: "#F46B45",
    primaryDark: "#DD5A36",
    accent: "#FFB347",
    light: {
      text: "#2A1913",
      textSecondary: "#846659",
      textTertiary: "#A4887A",
      background: "#FFF4ED",
      backgroundSecondary: "#FFFDFB",
      backgroundTertiary: "#FFE3D3",
      card: "#FFFDFB",
      border: "#F2D6C7",
      tabIconDefault: "#A09791",
      overlay: "rgba(25,9,4,0.44)",
      success: "#2EB67D",
      warning: "#F1A53B",
      error: "#E85B5B",
    },
    dark: {
      text: "#FFF6F0",
      textSecondary: "#CCAA98",
      textTertiary: "#8F7367",
      background: "#160C0A",
      backgroundSecondary: "#231311",
      backgroundTertiary: "#36201B",
      card: "#281713",
      border: "#463028",
      tabIconDefault: "#86736C",
      overlay: "rgba(0,0,0,0.74)",
      success: "#2ECC8F",
      warning: "#F1A53B",
      error: "#FF6A67",
    },
  },
  emerald: {
    primary: "#159A6A",
    primaryDark: "#117A54",
    accent: "#5FE0A8",
    light: {
      text: "#10251D",
      textSecondary: "#537066",
      textTertiary: "#7F9A90",
      background: "#ECFCF5",
      backgroundSecondary: "#FFFFFF",
      backgroundTertiary: "#D4F6E6",
      card: "#FBFFFD",
      border: "#C6EEDC",
      tabIconDefault: "#83958D",
      overlay: "rgba(7,24,17,0.48)",
      success: "#169A6A",
      warning: "#D89B2C",
      error: "#D95B63",
    },
    dark: {
      text: "#F1FFF9",
      textSecondary: "#99C9B6",
      textTertiary: "#5F8F7C",
      background: "#071611",
      backgroundSecondary: "#0D2018",
      backgroundTertiary: "#143327",
      card: "#11271E",
      border: "#214737",
      tabIconDefault: "#6F877D",
      overlay: "rgba(0,0,0,0.72)",
      success: "#39D69A",
      warning: "#F1B24B",
      error: "#FF6B73",
    },
  },
  rose: {
    primary: "#E34A82",
    primaryDark: "#C8376B",
    accent: "#FF9CC2",
    light: {
      text: "#311725",
      textSecondary: "#875E73",
      textTertiary: "#AF8399",
      background: "#FFF1F6",
      backgroundSecondary: "#FFFCFD",
      backgroundTertiary: "#FFDDE9",
      card: "#FFFFFF",
      border: "#F6CADB",
      tabIconDefault: "#A58E9A",
      overlay: "rgba(33,10,20,0.45)",
      success: "#24B981",
      warning: "#E3A33A",
      error: "#D9485C",
    },
    dark: {
      text: "#FFF3F8",
      textSecondary: "#D1A2B8",
      textTertiary: "#946A7F",
      background: "#170A10",
      backgroundSecondary: "#231119",
      backgroundTertiary: "#381A29",
      card: "#2A1520",
      border: "#4A2637",
      tabIconDefault: "#8E7280",
      overlay: "rgba(0,0,0,0.72)",
      success: "#39D79B",
      warning: "#F0B14B",
      error: "#FF7086",
    },
  },
  amber: {
    primary: "#D8891C",
    primaryDark: "#B26D14",
    accent: "#FFCA5C",
    light: {
      text: "#30210D",
      textSecondary: "#86684A",
      textTertiary: "#AB8B69",
      background: "#FFF8E8",
      backgroundSecondary: "#FFFDF8",
      backgroundTertiary: "#FFE9BE",
      card: "#FFFFFF",
      border: "#F1DBA6",
      tabIconDefault: "#A29883",
      overlay: "rgba(34,20,0,0.42)",
      success: "#1AA978",
      warning: "#D8891C",
      error: "#D95A4B",
    },
    dark: {
      text: "#FFF8EC",
      textSecondary: "#D2B58B",
      textTertiary: "#947854",
      background: "#171005",
      backgroundSecondary: "#241909",
      backgroundTertiary: "#38270E",
      card: "#2C1F0B",
      border: "#513A16",
      tabIconDefault: "#8F7A5C",
      overlay: "rgba(0,0,0,0.72)",
      success: "#32D19A",
      warning: "#FFBC45",
      error: "#FF715F",
    },
  },
  mint: {
    primary: "#12B89A",
    primaryDark: "#0D957D",
    accent: "#72E9D4",
    light: {
      text: "#0F2925",
      textSecondary: "#4E7670",
      textTertiary: "#7AA19A",
      background: "#EDFFFB",
      backgroundSecondary: "#FCFFFE",
      backgroundTertiary: "#D8F7F0",
      card: "#FFFFFF",
      border: "#BFECE2",
      tabIconDefault: "#879A96",
      overlay: "rgba(5,25,22,0.45)",
      success: "#11B889",
      warning: "#E1A03D",
      error: "#D95F62",
    },
    dark: {
      text: "#F2FFFD",
      textSecondary: "#9BD2C8",
      textTertiary: "#62948C",
      background: "#071714",
      backgroundSecondary: "#0D2320",
      backgroundTertiary: "#143732",
      card: "#112B26",
      border: "#214741",
      tabIconDefault: "#6C8580",
      overlay: "rgba(0,0,0,0.72)",
      success: "#3CE0A8",
      warning: "#F2B24D",
      error: "#FF7074",
    },
  },
  cobalt: {
    primary: "#345CFF",
    primaryDark: "#2647D1",
    accent: "#7AA2FF",
    light: {
      text: "#121B3D",
      textSecondary: "#5B6995",
      textTertiary: "#8290BA",
      background: "#EEF2FF",
      backgroundSecondary: "#FFFFFF",
      backgroundTertiary: "#DCE4FF",
      card: "#FFFFFF",
      border: "#CAD6FF",
      tabIconDefault: "#8D97B0",
      overlay: "rgba(7,15,40,0.48)",
      success: "#1BBE84",
      warning: "#E3A33B",
      error: "#DC5863",
    },
    dark: {
      text: "#F3F6FF",
      textSecondary: "#A4B4E8",
      textTertiary: "#6877A5",
      background: "#081022",
      backgroundSecondary: "#0F1830",
      backgroundTertiary: "#18264A",
      card: "#13203B",
      border: "#24375F",
      tabIconDefault: "#6D7D9F",
      overlay: "rgba(0,0,0,0.72)",
      success: "#38D59A",
      warning: "#F1B34B",
      error: "#FF6E78",
    },
  },
  orchid: {
    primary: "#9A4DFF",
    primaryDark: "#7D37D8",
    accent: "#FF8BCE",
    light: {
      text: "#241238",
      textSecondary: "#715A8A",
      textTertiary: "#9B84B5",
      background: "#F8F0FF",
      backgroundSecondary: "#FFFCFF",
      backgroundTertiary: "#ECD9FF",
      card: "#FFFFFF",
      border: "#DEC6F8",
      tabIconDefault: "#9A8EA8",
      overlay: "rgba(24,6,37,0.46)",
      success: "#27BF88",
      warning: "#E4A23C",
      error: "#DD4E73",
    },
    dark: {
      text: "#FBF5FF",
      textSecondary: "#C0A6DB",
      textTertiary: "#86679F",
      background: "#13081D",
      backgroundSecondary: "#1D102B",
      backgroundTertiary: "#301746",
      card: "#241335",
      border: "#41235A",
      tabIconDefault: "#7F6F8F",
      overlay: "rgba(0,0,0,0.74)",
      success: "#39D99F",
      warning: "#F2B44B",
      error: "#FF6C91",
    },
  },
  crimson: {
    primary: "#D63852",
    primaryDark: "#B92940",
    accent: "#FF8A88",
    light: {
      text: "#341218",
      textSecondary: "#86555F",
      textTertiary: "#AD7E85",
      background: "#FFF1F3",
      backgroundSecondary: "#FFFDFD",
      backgroundTertiary: "#FFDADF",
      card: "#FFFFFF",
      border: "#F5C3CB",
      tabIconDefault: "#A49094",
      overlay: "rgba(36,8,12,0.46)",
      success: "#22BC82",
      warning: "#E1A03B",
      error: "#D63852",
    },
    dark: {
      text: "#FFF4F5",
      textSecondary: "#D6A1A9",
      textTertiary: "#96656D",
      background: "#18080B",
      backgroundSecondary: "#260F14",
      backgroundTertiary: "#3A1820",
      card: "#2C1218",
      border: "#4C212A",
      tabIconDefault: "#8C7176",
      overlay: "rgba(0,0,0,0.74)",
      success: "#38D79B",
      warning: "#F1B24B",
      error: "#FF6C7F",
    },
  },
  slate: {
    primary: "#596A80",
    primaryDark: "#445367",
    accent: "#95A9C2",
    light: {
      text: "#1A2029",
      textSecondary: "#667487",
      textTertiary: "#8B98AA",
      background: "#F3F6FA",
      backgroundSecondary: "#FFFFFF",
      backgroundTertiary: "#E1E8F0",
      card: "#FFFFFF",
      border: "#D0D8E1",
      tabIconDefault: "#9099A5",
      overlay: "rgba(10,15,21,0.45)",
      success: "#23B983",
      warning: "#D9A13C",
      error: "#D75E65",
    },
    dark: {
      text: "#F5F8FC",
      textSecondary: "#A8B5C5",
      textTertiary: "#728094",
      background: "#0B0F14",
      backgroundSecondary: "#121922",
      backgroundTertiary: "#1C2532",
      card: "#17202B",
      border: "#283648",
      tabIconDefault: "#6E7B8C",
      overlay: "rgba(0,0,0,0.72)",
      success: "#38D39A",
      warning: "#F1B34B",
      error: "#FF7278",
    },
  },
  aurora: {
    primary: "#5BC96B",
    primaryDark: "#43A454",
    accent: "#1ED2C1",
    light: {
      text: "#112616",
      textSecondary: "#58745C",
      textTertiary: "#809A83",
      background: "#F2FFF2",
      backgroundSecondary: "#FDFFFC",
      backgroundTertiary: "#DCF7DE",
      card: "#FFFFFF",
      border: "#C7ECCB",
      tabIconDefault: "#8A998B",
      overlay: "rgba(9,23,11,0.44)",
      success: "#24B87C",
      warning: "#D7A13A",
      error: "#D95F67",
    },
    dark: {
      text: "#F3FFF4",
      textSecondary: "#A8D9AB",
      textTertiary: "#6F9B74",
      background: "#09150A",
      backgroundSecondary: "#102111",
      backgroundTertiary: "#18351A",
      card: "#122816",
      border: "#24492A",
      tabIconDefault: "#738675",
      overlay: "rgba(0,0,0,0.72)",
      success: "#46E09E",
      warning: "#F1B44D",
      error: "#FF727A",
    },
  },
};

function buildThemeColors(
  scale: ThemeScale,
  palette: ThemePalette
): ThemeColors {
  return {
    ...scale,
    tint: palette.primary,
    tabIconSelected: palette.primary,
    primary: palette.primary,
    primaryDark: palette.primaryDark,
    accent: palette.accent,
  };
}

function getThemeDefinition(preset: ThemePreset) {
  return PRESETS[preset];
}

export function createLightTheme(preset: ThemePreset): ThemeColors {
  const definition = getThemeDefinition(preset);
  return buildThemeColors(definition.light, definition);
}

export function createDarkTheme(preset: ThemePreset): ThemeColors {
  const definition = getThemeDefinition(preset);
  return buildThemeColors(definition.dark, definition);
}

export function getThemeColors(isDark: boolean, preset: ThemePreset): ThemeColors {
  return isDark ? createDarkTheme(preset) : createLightTheme(preset);
}

export const AVAILABLE_THEME_PRESETS = THEME_PRESET_OPTIONS;
