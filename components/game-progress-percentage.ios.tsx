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

import { colors } from "@/constants/theme";

type GameProgressPercentageProps = {
  percentage: number;
  size: number;
};

export function GameProgressPercentage({
  percentage,
  size,
}: GameProgressPercentageProps) {
  return (
    <Host pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Text
        modifiers={[
          frame({ alignment: "center", height: size, width: size }),
          font({ size: 15, weight: "bold" }),
          monospacedDigit(),
          foregroundStyle(colors.text),
          contentTransition("numericText"),
          animation(Animation.easeOut({ duration: 0.18 }), percentage),
        ]}
      >
        {percentage}%
      </Text>
    </Host>
  );
}
