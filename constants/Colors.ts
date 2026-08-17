const Colors = {
  dark: {
    primary: "#298F50",
    primaryDark: "#1E6B3B",
    primaryLight: "#4ADE80",
    primaryGlow: "rgba(41, 143, 80, 0.3)",
    background: "#0A0B0F",
    surface: "#161821",
    surfaceDarker: "#0D0E12",
    border: "#1F2937",
    text: "#FFFFFF",
    textSecondary: "#9CA3AF",
    textMuted: "#6B7280",
    error: "#EF4444",
    success: "#10B981",
    warning: "#F59E0B",
    white: "#FFFFFF",
    googleText: "#1F2937",
    googleBorder: "#E5E7EB",
  },
  light: {
    primary: "#298F50",
    primaryDark: "#1E6B3B",
    primaryLight: "#4ADE80",
    primaryGlow: "rgba(41, 143, 80, 0.15)",
    background: "#F3F4F6",
    surface: "#FFFFFF",
    surfaceDarker: "#F9FAFB",
    border: "#E5E7EB",
    text: "#111827",
    textSecondary: "#4B5563",
    textMuted: "#9CA3AF",
    error: "#EF4444",
    success: "#10B981",
    warning: "#F59E0B",
    white: "#FFFFFF",
    googleText: "#1F2937",
    googleBorder: "#E5E7EB",
  }
};

export default Colors;
export type ColorTheme = typeof Colors.dark;
