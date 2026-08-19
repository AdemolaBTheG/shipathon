import { StyleSheet, Text } from "react-native";

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
    <Text
      pointerEvents="none"
      style={[styles.percentage, StyleSheet.absoluteFill, { lineHeight: size }]}
    >
      {percentage}%
    </Text>
  );
}

const styles = StyleSheet.create({
  percentage: {
    color: colors.text,
    fontSize: 15,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
    textAlign: "center",
  },
});
