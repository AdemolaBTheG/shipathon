import { Host } from "@expo/ui";
import { Text } from "@expo/ui/swift-ui";
import {
  animation,
  Animation,
  contentTransition,
  font,
  foregroundStyle,
  frame,
  monospacedDigit,
} from "@expo/ui/swift-ui/modifiers";
import { StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";

import { colors, theme } from "@/constants/theme";

type GameProgressValueProps = {
  current: number;
  total: number;
};

export function GameProgressValue({ current, total }: GameProgressValueProps) {
  const { t } = useTranslation();
  return (
    <Host matchContents style={styles.host}>
      <Text
        modifiers={[
          frame({ alignment: "leading" }),
          font({ size: theme.size.lg + 2, weight: "semibold" }),
          monospacedDigit(),
          foregroundStyle(colors.text),
          contentTransition("numericText"),
          animation(Animation.easeOut({ duration: 0.18 }), current),
        ]}
      >
        {t("{{current}} of {{total}} completed", {
          current: String(current),
          total: String(total),
        })}
      </Text>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    minHeight: 28,
  },
});
