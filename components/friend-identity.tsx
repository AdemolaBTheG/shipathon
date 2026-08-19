import { Image } from "expo-image";
import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { colors, theme } from "@/constants/theme";

type FriendIdentityProps = {
  avatarUrl: string | null;
  displayName: string;
  friendsSince: string;
};

export function FriendIdentity({
  avatarUrl,
  displayName,
  friendsSince,
}: FriendIdentityProps) {
  const { i18n, t } = useTranslation();
  const initial = displayName.trim().charAt(0).toUpperCase() || "S";
  const friendshipDate = new Date(friendsSince);
  const friendshipCopy = Number.isNaN(friendshipDate.getTime())
    ? t("Friends")
    : t("Friends since {{date}}", {
        date: new Intl.DateTimeFormat(i18n.resolvedLanguage ?? "en", {
          month: "long",
          year: "numeric",
        }).format(friendshipDate),
      });

  return (
    <View style={styles.container}>
      <Link.AppleZoomTarget>
        <View collapsable={false} style={styles.avatarFrame}>
          {avatarUrl ? (
            <Image
              accessibilityLabel={t("{{name}}'s avatar", { name: displayName })}
              contentFit="cover"
              source={avatarUrl}
              style={StyleSheet.absoluteFill}
              transition={180}
            />
          ) : (
            <Text style={styles.initial}>{initial}</Text>
          )}
        </View>
      </Link.AppleZoomTarget>

      <View style={styles.copy}>
        <Text numberOfLines={2} selectable style={styles.name}>
          {displayName}
        </Text>
        <Text selectable style={styles.friendshipDate}>
          {friendshipCopy}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
  },
  avatarFrame: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: "rgba(255, 255, 255, 0.24)",
    borderCurve: "continuous",
    borderRadius: 52,
    borderWidth: StyleSheet.hairlineWidth,
    boxShadow: "0 18px 48px rgba(0, 0, 0, 0.34)",
    height: 104,
    justifyContent: "center",
    overflow: "hidden",
    width: 104,
  },
  initial: {
    color: colors.text,
    fontSize: 42,
    fontWeight: "600",
  },
  copy: {
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  name: {
    color: colors.text,
    fontSize: theme.size["2xl"],
    fontWeight: "700",
    textAlign: "center",
  },
  friendshipDate: {
    color: colors.textMuted,
    fontSize: theme.size.md,
    fontWeight: "500",
  },
});
