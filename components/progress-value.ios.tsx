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
import { useState } from "react";
import { StyleSheet } from "react-native";
import {
  runOnJS,
  useAnimatedReaction,
  type SharedValue,
} from "react-native-reanimated";

type ProgressValueProps = {
  initialValue: number;
  progress: SharedValue<number>;
  size: number;
};

function mix(start: number, end: number, amount: number) {
  return Math.round(start + (end - start) * amount);
}

function progressColor(value: number) {
  const progress = Math.min(1, Math.max(0, value / 100));
  if (progress <= 0.5) {
    const amount = progress * 2;
    return `rgb(${mix(114, 179, amount)}, ${mix(168, 136, amount)}, 255)`;
  }

  const amount = (progress - 0.5) * 2;
  return `rgb(${mix(179, 100, amount)}, ${mix(136, 255, amount)}, ${mix(255, 218, amount)})`;
}

export function ProgressValue({
  initialValue,
  progress,
  size,
}: ProgressValueProps) {
  const [display, setDisplay] = useState({
    countsDown: false,
    value: initialValue,
  });

  function updateDisplay(value: number, previousValue: number) {
    setDisplay({ countsDown: value < previousValue, value });
  }

  useAnimatedReaction(
    () => Math.round(progress.value * 100),
    (value, previousValue) => {
      if (value === previousValue) return;
      runOnJS(updateDisplay)(value, previousValue ?? value);
    },
    [progress],
  );

  return (
    <Host pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Text
        modifiers={[
          frame({ alignment: "center", height: size, width: size }),
          font({ size: Math.round(size * 0.15), weight: "bold" }),
          monospacedDigit(),
          foregroundStyle(progressColor(display.value)),
          contentTransition("numericText", {
            countsDown: display.countsDown,
          }),
          animation(Animation.easeOut({ duration: 0.12 }), display.value),
        ]}
      >
        {display.value}%
      </Text>
    </Host>
  );
}
