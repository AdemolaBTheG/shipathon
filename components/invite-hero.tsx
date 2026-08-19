import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { InviteCoverRail } from "@/components/invite-cover-rail";
import { colors, theme } from "@/constants/theme";

type InviteHeroProps = {
  avatarUrl: string | null;
  coverUrls: string[];
  displayName: string;
  showVisibleGames?: boolean;
  subtitle?: string;
  visibleGameCount: number;
};

export function InviteHero({
  avatarUrl,
  coverUrls = [],
  displayName,
  showVisibleGames = true,
  subtitle,
  visibleGameCount,
}: InviteHeroProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const avatarSize = Math.min(176, width * 0.42);
  const initial = displayName.trim().charAt(0).toUpperCase() || "S";

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.avatar,
          {
            borderRadius: avatarSize / 2,
            height: avatarSize,
            width: avatarSize,
          },
        ]}
      >
        {avatarUrl ? (
          <Image
            accessibilityLabel={t("{{name}}'s avatar", {
              name: displayName,
            })}
            contentFit="cover"
            source={avatarUrl}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            style={[styles.initial, { fontSize: avatarSize * 0.47 }]}
          >
            {initial}
          </Text>
        )}
      </View>

      <View style={styles.identity}>
        <Text numberOfLines={1} style={styles.name}>
          {displayName}
        </Text>
        <Text style={styles.invitationCopy}>
          {subtitle ?? t("invited you to compare backlogs")}
        </Text>
      </View>

      {showVisibleGames ? (
        <InviteCoverRail coverUrls={coverUrls} visibleGameCount={visibleGameCount} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: theme.spacing.md,
  },
  avatar: {
    alignItems: "center",
    borderColor: "rgba(255, 255, 255, 0.28)",
    borderWidth: 1,
    boxShadow:
      "inset 0 1px 1px rgba(255,255,255,0.35), 0 18px 45px rgba(0,0,0,0.28)",
    experimental_backgroundImage:
      "linear-gradient(145deg, rgba(255,255,255,0.26) 0%, rgba(100,255,218,0.12) 42%, rgba(255,255,255,0.08) 100%)",
    justifyContent: "center",
    overflow: "hidden",
  },
  initial: {
    color: colors.text,
    fontWeight: "500",
    textAlign: "center",
  },
  identity: {
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  name: {
    color: colors.text,
    fontSize: theme.size["3xl"],
    fontWeight: "800",
    textAlign: "center",
  },
  invitationCopy: {
    color: colors.textMuted,
    fontSize: theme.size.lg,
    fontWeight: "600",
    textAlign: "center",
  },
});
