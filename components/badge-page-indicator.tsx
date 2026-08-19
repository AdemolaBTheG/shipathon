import { StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";

import { colors, theme } from "@/constants/theme";

type BadgePageIndicatorProps = {
  current: number;
  total: number;
};

export function BadgePageIndicator({
  current,
  total,
}: BadgePageIndicatorProps) {
  const { t } = useTranslation();

  return (
    <Text style={styles.text}>
      {t("{{current}} OF {{total}}", {
        current: String(current),
        total: String(total),
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    color: colors.textMuted,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
    letterSpacing: 1.4,
    paddingTop: theme.spacing.md,
    textAlign: "center",
  },
});
