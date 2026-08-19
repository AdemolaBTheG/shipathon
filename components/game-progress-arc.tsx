import {
  Canvas,
  interpolateColors,
  Path,
  Skia,
} from "@shopify/react-native-skia";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import {
  Easing,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { GameProgressPercentage } from "@/components/game-progress-percentage";
import { colors } from "@/constants/theme";

const SIZE = 88;
const STROKE_WIDTH = 10;
const RADIUS = (SIZE - STROKE_WIDTH) / 2 - 3;
const ARC_START = -90;
const ARC_SWEEP = 360;

type GameProgressArcProps = {
  current: number;
  total: number;
};

export function GameProgressArc({ current, total }: GameProgressArcProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const targetProgress = Math.min(1, Math.max(0, current / Math.max(1, total)));
  const path = Skia.PathBuilder.Make()
    .addArc(
      Skia.XYWHRect(
        SIZE / 2 - RADIUS,
        SIZE / 2 - RADIUS,
        RADIUS * 2,
        RADIUS * 2,
      ),
      ARC_START,
      ARC_SWEEP,
    )
    .build();

  useEffect(() => {
    progress.set(
      reduceMotion
        ? targetProgress
        : withTiming(targetProgress, {
            duration: 420,
            easing: Easing.out(Easing.cubic),
          }),
    );
  }, [progress, reduceMotion, targetProgress]);

  const progressColor = useDerivedValue(() =>
    interpolateColors(
      progress.value,
      [0, 0.5, 1],
      ["#72A8FF", colors.primary, colors.success],
    ),
  );

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.container}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        <Path
          color={colors.background}
          end={1}
          path={path}
          start={0}
          strokeCap="round"
          strokeWidth={STROKE_WIDTH}
          style="stroke"
        />
        <Path
          color={progressColor}
          end={progress}
          path={path}
          start={0}
          strokeCap="round"
          strokeWidth={STROKE_WIDTH}
          style="stroke"
        />
      </Canvas>
      <GameProgressPercentage
        percentage={Math.round(targetProgress * 100)}
        size={SIZE}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: SIZE,
    width: SIZE,
  },
});
