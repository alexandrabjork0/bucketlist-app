import { useColorScheme } from "react-native";

export const Colors = {
  light: {
    background: "#FFFFFF",
    surface: "#F4F4F4",
    surfaceElevated: "#EEEEEE",
    border: "#EEEEEE",
    divider: "#F0F0F0",
    text: "#111111",
    textSecondary: "#777777",
    textTertiary: "#AAAAAA",
    buttonPrimary: "#111111",
    buttonPrimaryText: "#FFFFFF",
    inputBackground: "#F4F4F4",
    inputPlaceholder: "#999999",
    accent: "#16a34a",
    disabled: "#CCCCCC",
    overlay: "rgba(0,0,0,0.45)",
    handle: "#E0E0E0",
    avatarBg: "#222222",
  },
  dark: {
    background: "#0F0F0F",
    surface: "#1C1C1C",
    surfaceElevated: "#272727",
    border: "#2A2A2A",
    divider: "#1E1E1E",
    text: "#F0F0F0",
    textSecondary: "#909090",
    textTertiary: "#5A5A5A",
    buttonPrimary: "#F0F0F0",
    buttonPrimaryText: "#111111",
    inputBackground: "#222222",
    inputPlaceholder: "#666666",
    accent: "#22c55e",
    disabled: "#333333",
    overlay: "rgba(0,0,0,0.72)",
    handle: "#3A3A3A",
    avatarBg: "#2C2C2C",
  },
} as const;

export type ThemeColors = { [K in keyof typeof Colors.light]: string };

export function useTheme(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === "dark" ? Colors.dark : Colors.light;
}
