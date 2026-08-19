export const colors = {
  background: "#121212",
  surface: "#1E1E1E",
  surfaceMuted: "rgba(255, 255, 255, 0.08)",
  text: "#F5F5F5",
  textMuted: "rgba(255, 255, 255, 0.62)",
  border: "rgba(255, 255, 255, 0.12)",
  primary: "#fff",
  primaryPressed: "#B388FF",
  success: "#64FFDA",
  warning: "#F4B860",
  danger: "#FF7272",
} as const;

export type ThemeColors = typeof colors;

export const theme = {
  colors,
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  size: {
    tiny: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 20,
    "2xl": 24,
    "3xl": 32,
  },
  radius: {
    sm: 8,
    md: 14,
    lg: 22,
    pill: 999,
  },
} as const;

export const navigationThemeColors = {
  primary: colors.primary,
  background: colors.background,
  card: colors.surface,
  text: colors.text,
  border: colors.border,
  notification: colors.primary,
} as const;

export type Theme = typeof theme;

export default theme;
