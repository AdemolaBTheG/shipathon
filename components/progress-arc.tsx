import {
  Canvas,
  Circle,
  interpolateColors,
  Path,
  Skia,
} from "@shopify/react-native-skia";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Presets, useRealtimeComposer } from "react-native-pulsar";
import {
  Easing,
  runOnJS,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { colors } from "@/constants/theme";
import { ProgressValue } from "@/components/progress-value";
import { useTranslation } from "react-i18next";

const ARC_START = 135;
const ARC_SWEEP = 270;
const HIT_SLOP = 54;
const COLOR_STOPS = ["#72A8FF", colors.primary, colors.success] as const;
const MAJOR_MILESTONES = [0, 0.25, 0.5, 0.75, 1] as const;
const TICK_HYSTERESIS = 0.015;

type ProgressArcProps = {
  initialValue: number;
  onCommit: (value: number) => void;
  size: number;
};

function clamp(value: number, minimum: number, maximum: number) {
  "worklet";
  return Math.min(maximum, Math.max(minimum, value));
}

function progressForPoint(x: number, y: number, center: number) {
  "worklet";
  let angle = (Math.atan2(y - center, x - center) * 180) / Math.PI;
  if (angle < 0) angle += 360;

  if (angle > 45 && angle < ARC_START) {
    return x < center ? 0 : 1;
  }

  if (angle <= 45) angle += 360;
  return clamp((angle - ARC_START) / ARC_SWEEP, 0, 1);
}

function crossedThreshold(previous: number, next: number, threshold: number) {
  "worklet";
  return (
    (previous < threshold && next >= threshold) ||
    (previous > threshold && next <= threshold)
  );
}

function crossedMajorMilestone(previous: number, next: number) {
  "worklet";
  return MAJOR_MILESTONES.some((milestone) =>
    crossedThreshold(previous, next, milestone),
  );
}

function crossedTenPercentStep(previous: number, next: number) {
  "worklet";
  const previousStep = Math.floor(clamp(previous, 0, 1) * 10 + 0.000001);
  const nextStep = Math.floor(clamp(next, 0, 1) * 10 + 0.000001);
  return previousStep !== nextStep;
}

export function ProgressArc({
  initialValue,
  onCommit,
  size,
}: ProgressArcProps) {
  const { t } = useTranslation();
  const center = size / 2;
  const strokeWidth = Math.max(30, size * 0.105);
  const radius = center - strokeWidth * 1.25;
  const progress = useSharedValue(clamp(initialValue / 100, 0, 1));
  const committedProgress = useSharedValue(progress.value);
  const lastScrubProgress = useSharedValue(progress.value);
  const lastTickProgress = useSharedValue(progress.value);
  const isScrubbing = useSharedValue(false);
  const realtimeHaptics = useRealtimeComposer();
  const reduceMotion = useReducedMotion();
  const arcPath = Skia.PathBuilder.Make()
    .addArc(
      Skia.XYWHRect(
        center - radius,
        center - radius,
        radius * 2,
        radius * 2,
      ),
      ARC_START,
      ARC_SWEEP,
    )
    .build();

  const progressColor = useDerivedValue(() =>
    interpolateColors(progress.value, [0, 0.5, 1], [...COLOR_STOPS]),
  );
  const thumbX = useDerivedValue(() => {
    const angle = ((ARC_START + progress.value * ARC_SWEEP) * Math.PI) / 180;
    return center + Math.cos(angle) * radius;
  });
  const thumbY = useDerivedValue(() => {
    const angle = ((ARC_START + progress.value * ARC_SWEEP) * Math.PI) / 180;
    return center + Math.sin(angle) * radius;
  });

  function commitAccessibilityValue(value: number) {
    const nextValue = clamp(value, 0, 100);
    if (nextValue === initialValue) return;

    progress.set(
      reduceMotion
        ? nextValue / 100
        : withTiming(nextValue / 100, {
            duration: 220,
            easing: Easing.out(Easing.cubic),
          }),
    );
    Presets.System.selection();
    onCommit(nextValue);
  }

  const scrubGesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((event) => {
      const distance = Math.hypot(event.x - center, event.y - center);
      isScrubbing.value = Math.abs(distance - radius) <= HIT_SLOP;
      if (!isScrubbing.value) return;

      const nextProgress = progressForPoint(event.x, event.y, center);
      progress.set(nextProgress);
      lastScrubProgress.value = nextProgress;
      lastTickProgress.value = nextProgress;
      realtimeHaptics.set(0.025, 0.36, true);
    })
    .onUpdate((event) => {
      if (!isScrubbing.value) return;

      const previousProgress = lastScrubProgress.value;
      const nextProgress = progressForPoint(event.x, event.y, center);
      progress.set(nextProgress);
      lastScrubProgress.value = nextProgress;
      const speed = Math.min(Math.hypot(event.velocityX, event.velocityY) / 1800, 1);
      realtimeHaptics.set(0.02 + speed * 0.05, 0.34 + nextProgress * 0.18);

      const crossedMajor = crossedMajorMilestone(
        previousProgress,
        nextProgress,
      );
      const crossedMinor = crossedTenPercentStep(
        previousProgress,
        nextProgress,
      );
      const isEndpoint = nextProgress === 0 || nextProgress === 1;
      const movedSinceLastTick = Math.abs(
        nextProgress - lastTickProgress.value,
      );

      if (
        (!crossedMajor && !crossedMinor) ||
        (!isEndpoint && movedSinceLastTick < TICK_HYSTERESIS)
      ) {
        return;
      }

      lastTickProgress.value = nextProgress;
      realtimeHaptics.playDiscrete(
        crossedMajor ? 0.2 : 0.1,
        crossedMajor ? 0.7 : 0.46,
      );
    })
    .onEnd(() => {
      if (!isScrubbing.value) return;
      realtimeHaptics.stop();
      realtimeHaptics.playDiscrete(0.17, 0.66);
      runOnJS(onCommit)(Math.round(progress.value * 100));
    })
    .onFinalize((_event, success) => {
      if (!isScrubbing.value) return;

      if (!success) {
        realtimeHaptics.stop();
        progress.set(
          reduceMotion
            ? committedProgress.value
            : withTiming(committedProgress.value, {
                duration: 160,
                easing: Easing.out(Easing.cubic),
              }),
        );
      }

      isScrubbing.value = false;
    });

  return (
    <GestureDetector gesture={scrubGesture}>
      <View
        accessibilityLabel={t("Game progress")}
        accessibilityRole="adjustable"
        accessibilityValue={{
          max: 100,
          min: 0,
          now: initialValue,
          text: t("{{current}} of {{total}} completed", {
            current: String(initialValue),
            total: "100%",
          }),
        }}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "increment") {
            commitAccessibilityValue(initialValue + 10);
          }
          if (event.nativeEvent.actionName === "decrement") {
            commitAccessibilityValue(initialValue - 10);
          }
        }}
        accessibilityActions={[
          { name: "increment", label: t("Increase progress") },
          { name: "decrement", label: t("Decrease progress") },
        ]}
        style={[styles.container, { height: size, width: size }]}
      >
        <Canvas style={StyleSheet.absoluteFill}>
          <Path
            color={colors.surfaceMuted}
            end={1}
            path={arcPath}
            start={0}
            strokeCap="round"
            strokeWidth={strokeWidth}
            style="stroke"
          />
          <Path
            color={progressColor}
            end={progress}
            path={arcPath}
            start={0}
            strokeCap="round"
            strokeWidth={strokeWidth}
            style="stroke"
          />

          {[0.25, 0.5, 0.75].map((milestone) => {
            const angle = ((ARC_START + milestone * ARC_SWEEP) * Math.PI) / 180;
            return (
              <Circle
                color={colors.background}
                cx={center + Math.cos(angle) * radius}
                cy={center + Math.sin(angle) * radius}
                key={milestone}
                r={4}
              />
            );
          })}

          <Circle
            color={colors.text}
            cx={thumbX}
            cy={thumbY}
            r={strokeWidth * 0.5}
          />
          <Circle
            color={progressColor}
            cx={thumbX}
            cy={thumbY}
            r={strokeWidth * 0.31}
          />

        </Canvas>
        <ProgressValue
          initialValue={initialValue}
          progress={progress}
          size={size}
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
});
