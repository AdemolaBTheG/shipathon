import { StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";

import { colors, theme } from "@/constants/theme";

type GameProgressValueProps = {
  current: number;
  total: number;
};

export function GameProgressValue({
  current,
  total,
}: GameProgressValueProps) {
  const { t } = useTranslation();
  return (
    <Text selectable style={styles.value}>
      {t("{{current}} of {{total}} completed", {
        current: String(current),
        total: String(total),
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  value: {
    color: colors.text,
    fontSize: theme.size.xl,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
  },
});
