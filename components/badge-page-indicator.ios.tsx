import { Host } from "@expo/ui";
import { Text } from "@expo/ui/swift-ui";
import {
  animation,
  Animation,
  contentTransition,
  font,
  foregroundStyle,
  frame,
  kerning,
  monospacedDigit,
} from "@expo/ui/swift-ui/modifiers";
import { StyleSheet } from "react-native";
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
    <Host matchContents style={styles.host}>
      <Text
        modifiers={[
          frame({ alignment: "center" }),
          font({ size: 12, weight: "bold" }),
          kerning(1.4),
          monospacedDigit(),
          foregroundStyle(colors.textMuted),
          contentTransition("numericText"),
          animation(Animation.easeOut({ duration: 0.18 }), current),
        ]}
      >
          {t("{{current}} OF {{total}}", {
            current: String(current),
            total: String(total),
          })}
      </Text>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    alignSelf: "center",
    minHeight: 18,
    paddingTop: theme.spacing.md,
  },
});
