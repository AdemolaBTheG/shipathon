import { PressableScale } from "pressto";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";

import { Text } from "@/components/Themed";
import { PlatformIcon } from "@/components/platform-icon";
import type { GamePlatform } from "@/constants/game-platforms";
import { colors, theme } from "@/constants/theme";
import type { TranslationKey } from "@/localization/resources";

type PlatformBrowseCardProps = {
  onPress: () => void;
  platform: GamePlatform;
  style?: StyleProp<ViewStyle>;
};

export function PlatformBrowseCard({
  onPress,
  platform,
  style,
}: PlatformBrowseCardProps) {
  const { t } = useTranslation();
  const [pressed, setPressed] = useState(false);
  const label = platform.translationKey
    ? t(platform.translationKey as TranslationKey)
    : platform.label;

  return (
    <PressableScale
      accessibilityLabel={t("Browse {{label}} games", { label })}
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[styles.card, style]}
    >
      <PlatformIcon
        color={pressed ? colors.success : colors.text}
        platform={platform.iconPlatform}
        size={24}
      />
      <Text numberOfLines={1} style={styles.label}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderCurve: "continuous",
    borderRadius: theme.radius.md,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
  },
  label: {
    color: colors.text,
    flex: 1,
    fontSize: theme.size.md,
    fontWeight: "600",
  },
});
