import { StyleSheet, View } from "react-native";

import { GameProgressArc } from "@/components/game-progress-arc";
import { GameProgressValue } from "@/components/game-progress-value";
import { Text } from "@/components/Themed";
import { colors, theme } from "@/constants/theme";
import { PressableScale } from "pressto";
import { useTranslation } from "react-i18next";

type GameProgressCardProps = {
  current: number;
  onPress: () => void;
  startedAt: Date | null;
  total: number;
};

function formatStartedAt(date: Date, language: string) {
  return new Intl.DateTimeFormat(language, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function GameProgressCard({
  current,
  onPress,
  startedAt,
  total,
}: GameProgressCardProps) {
  const { i18n, t } = useTranslation();
  const safeTotal = Math.max(1, total);
  const safeCurrent = Math.min(Math.max(0, current), safeTotal);

  return (
    <PressableScale
      accessibilityHint={t("Opens the progress control")}
      accessibilityLabel={t("Update game progress")}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.card}
    >
      <View style={styles.copy}>
        <GameProgressValue current={safeCurrent} total={safeTotal} />
        <Text selectable style={styles.startedAt}>
          {startedAt
            ? t("Playing since {{date}}", {
                date: formatStartedAt(startedAt, i18n.language),
              })
            : t("Playing now")}
        </Text>
      </View>

      <GameProgressArc current={safeCurrent} total={safeTotal} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    borderCurve: "continuous",
    borderRadius: theme.radius.lg,
    flexDirection: "row",
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  cardPressed: {
    opacity: 0.72,
  },
  copy: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  startedAt: {
    color: colors.textMuted,
    fontSize: theme.size.md,
    fontWeight: "500",
  },
});
