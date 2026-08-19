import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import {
  runOnJS,
  useAnimatedReaction,
  type SharedValue,
} from "react-native-reanimated";

import { colors } from "@/constants/theme";

type ProgressValueProps = {
  initialValue: number;
  progress: SharedValue<number>;
  size: number;
};

export function ProgressValue({
  initialValue,
  progress,
  size,
}: ProgressValueProps) {
  const [value, setValue] = useState(initialValue);

  useAnimatedReaction(
    () => Math.round(progress.value * 100),
    (nextValue, previousValue) => {
      if (nextValue === previousValue) return;
      runOnJS(setValue)(nextValue);
    },
    [progress],
  );

  return (
    <Text
      pointerEvents="none"
      style={[
        styles.value,
        StyleSheet.absoluteFill,
        { fontSize: Math.round(size * 0.18) },
      ]}
    >
      {value}%
    </Text>
  );
}

const styles = StyleSheet.create({
  value: {
    color: colors.primary,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
    textAlign: "center",
    textAlignVertical: "center",
  },
});
