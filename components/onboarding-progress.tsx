import { StyleSheet, type StyleProp, View, type ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";

import { colors, theme } from "@/constants/theme";

type OnboardingProgressProps = {
  step: number;
  style?: StyleProp<ViewStyle>;
  total: number;
};

export function OnboardingProgress({
  step,
  style,
  total,
}: OnboardingProgressProps) {
  const { t } = useTranslation();
  const percentage = `${Math.min(1, Math.max(0, step / total)) * 100}%` as const;

  return (
    <View
        accessibilityLabel={t("Onboarding step {{step}} of {{total}}", {
          step: String(step),
          total: String(total),
        })}
      accessibilityRole="progressbar"
      style={[styles.track, style]}
    >
      <View style={[styles.fill, { width: percentage }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    backgroundColor: colors.primary,
    borderRadius: theme.radius.pill,
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
  },
  track: {
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderRadius: theme.radius.pill,
    height: 7,
    overflow: "hidden",
  },
});
