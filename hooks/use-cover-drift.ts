import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const FULL_CIRCLE = Math.PI * 2;
const HORIZONTAL_TILT = 0.47;
const VERTICAL_TILT = 0.64;

export function useCoverDrift(disabled: boolean) {
  const phase = useSharedValue(0);
  const intensity = useSharedValue(0);
  const tiltX = useDerivedValue(
    () =>
      Math.sin(phase.value * FULL_CIRCLE) *
      HORIZONTAL_TILT *
      intensity.value,
  );
  const tiltY = useDerivedValue(
    () =>
      Math.cos(phase.value * FULL_CIRCLE) *
      VERTICAL_TILT *
      intensity.value,
  );

  useFocusEffect(
    useCallback(() => {
      phase.set(0);
      intensity.set(0);

      if (disabled) return;

      intensity.set(
        withTiming(1, {
          duration: 400,
          easing: Easing.out(Easing.cubic),
        }),
      );
      phase.set(
        withRepeat(
          withTiming(1, { duration: 10000, easing: Easing.linear }),
          -1,
          false,
        ),
      );

      return () => {
        cancelAnimation(phase);
        cancelAnimation(intensity);
        phase.set(0);
        intensity.set(0);
      };
    }, [disabled, intensity, phase]),
  );

  return { tiltX, tiltY };
}
