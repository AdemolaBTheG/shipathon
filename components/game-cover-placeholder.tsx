import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { colors, theme } from "@/constants/theme";

type GameCoverPlaceholderProps = {
  gameName: string;
  showTitle?: boolean;
  style?: StyleProp<ViewStyle>;
  variant?: "compact" | "hero";
};

export function GameCoverPlaceholder({
  gameName,
  showTitle = false,
  style,
  variant = "compact",
}: GameCoverPlaceholderProps) {
  const { t } = useTranslation();
  const isHero = variant === "hero";

  return (
    <View
      accessibilityLabel={t("{{name}} cover artwork unavailable", {
        name: gameName,
      })}
      accessibilityRole="image"
      style={[styles.container, style]}
    >
      <View pointerEvents="none" style={styles.glow} />
      <View pointerEvents="none" style={styles.diagonal} />
      <Text
        numberOfLines={1}
        style={[styles.initials, isHero ? styles.initialsHero : styles.initialsCompact]}
      >
        {getInitials(gameName)}
      </Text>
      {showTitle ? (
        <Text numberOfLines={3} style={styles.gameTitle}>
          {gameName}
        </Text>
      ) : null}
    </View>
  );
}

function getInitials(gameName: string) {
  const words = gameName.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toLocaleUpperCase();
  return `${words[0][0]}${words[1][0]}`.toLocaleUpperCase();
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: colors.surface,
    experimental_backgroundImage:
      "linear-gradient(145deg, #303030 0%, #1D1D1D 52%, #121212 100%)",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  glow: {
    backgroundColor: "rgba(255, 255, 255, 0.055)",
    borderRadius: theme.radius.pill,
    height: "58%",
    position: "absolute",
    right: "-18%",
    top: "-10%",
    width: "78%",
  },
  diagonal: {
    backgroundColor: "rgba(255, 255, 255, 0.035)",
    height: "160%",
    position: "absolute",
    right: "18%",
    top: "-30%",
    transform: [{ rotate: "24deg" }],
    width: "16%",
  },
  initials: {
    color: colors.text,
    fontWeight: "800",
    letterSpacing: -1,
    opacity: 0.9,
    textAlign: "center",
  },
  initialsCompact: { fontSize: 28 },
  initialsHero: { fontSize: 64, letterSpacing: -2 },
  gameTitle: {
    bottom: theme.spacing.md,
    color: colors.textMuted,
    fontSize: theme.size.sm,
    fontWeight: "600",
    left: theme.spacing.md,
    lineHeight: 16,
    position: "absolute",
    right: theme.spacing.md,
    textAlign: "center",
  },
});
