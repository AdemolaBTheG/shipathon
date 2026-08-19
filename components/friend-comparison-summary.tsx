import { SymbolView } from "expo-symbols";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { colors, theme } from "@/constants/theme";
import type { FriendComparisonSummary as Summary } from "@/services/sharing";

type FriendComparisonSummaryProps = {
  summary: Summary | null;
};

const metrics = [
  {
    key: "inCommon",
    label: "In common",
    symbol: "rectangle.stack.fill",
  },
  {
    key: "bothCompleted",
    label: "Completed",
    symbol: "checkmark.circle.fill",
  },
  { key: "bothRated", label: "Both rated", symbol: "star.fill" },
] as const;

export function FriendComparisonSummary({
  summary,
}: FriendComparisonSummaryProps) {
  const { t } = useTranslation();
  return (
    <View
      accessibilityLabel={
        summary
          ? t("{{common}} games in common, {{completed}} completed by both, {{rated}} rated by both", {
              common: String(summary.inCommon),
              completed: String(summary.bothCompleted),
              rated: String(summary.bothRated),
            })
          : t("Loading game comparison")
      }
      style={styles.container}
    >
      {metrics.map((metric, index) => (
        <View key={metric.key} style={styles.metricSlot}>
          {index > 0 ? <View style={styles.separator} /> : null}
          <View style={styles.metric}>
            <SymbolView
              name={metric.symbol}
              size={22}
              tintColor={colors.textMuted}
            />
            <Text selectable style={styles.value}>
              {summary ? summary[metric.key] : "–"}
            </Text>
            <Text style={styles.label}>{t(metric.label)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: theme.spacing.md,
  },
  metricSlot: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    height: "100%",
  },
  metric: {
    alignItems: "center",
    flex: 1,
    gap: 3,
    justifyContent: "center",
  },
  separator: {
    backgroundColor: colors.border,
    height: 38,
    width: 1,
  },
  value: {
    color: colors.text,
    marginTop: 4,
    fontSize: theme.size["2xl"],
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
  },
  label: {
    color: colors.textMuted,
    fontSize: theme.size.sm + 1,
    fontWeight: "500",
  },
});
