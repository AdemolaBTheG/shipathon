import type { SkImage } from "@shopify/react-native-skia";
import {
  Canvas,
  Group,
  Image,
  makeImageFromView,
  Paint,
  rect,
  Rect,
  RuntimeShader,
} from "@shopify/react-native-skia";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { LayoutChangeEvent } from "react-native";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Presets } from "react-native-pulsar";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { BadgeMedallion } from "@/components/badge-medallion";
import { directionalPageCurl } from "@/components/Riveo/directional-page-curl";
import type { BadgeTier } from "@/db/schema";
import type { BadgeDefinition } from "@/lib/badges";

type PeelableBadgeMedallionProps = {
  accessibilityLabel: string;
  disabled?: boolean;
  size: number;
  symbol: BadgeDefinition["symbol"];
  tier: BadgeTier;
};

function playDetachHaptic() {
  Presets.nudge();
}

export function PeelableBadgeMedallion({
  accessibilityLabel,
  disabled = false,
  size,
  symbol,
  tier,
}: PeelableBadgeMedallionProps) {
  const { t } = useTranslation();
  const overscan = Math.ceil(size * 0.28);
  const canvasSize = size + overscan * 2;
  const reduceMotion = useReducedMotion();
  const captureRef = useRef<View>(null);
  const captureRequestedRef = useRef(false);
  const captureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const [snapshot, setSnapshot] = useState<SkImage | null>(null);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const reappearScale = useSharedValue(1);
  const shineProgress = useSharedValue(2);

  useEffect(
    () => () => {
      mountedRef.current = false;
      if (captureTimerRef.current) clearTimeout(captureTimerRef.current);
    },
    [],
  );

  useEffect(
    () => () => {
      snapshot?.dispose();
    },
    [snapshot],
  );

  useEffect(() => {
    if (!snapshot || reduceMotion) {
      shineProgress.set(2);
      return;
    }

    shineProgress.set(-0.22);
    shineProgress.set(
      withDelay(
        620,
        withTiming(1.22, {
          duration: 1240,
          easing: Easing.bezier(0.42, 0, 0.24, 1),
        }),
      ),
    );

    return () => cancelAnimation(shineProgress);
  }, [reduceMotion, shineProgress, snapshot]);

  const captureMedallion = (_event: LayoutChangeEvent) => {
    if (captureRequestedRef.current) return;
    captureRequestedRef.current = true;

    requestAnimationFrame(() => {
      captureTimerRef.current = setTimeout(() => {
        void makeImageFromView(captureRef).then((image) => {
          if (mountedRef.current && image) setSnapshot(image);
          else image?.dispose();
        });
      }, 180);
    });
  };

  const uniforms = useDerivedValue(() => ({
    contentSize: [size, size],
    drag: [dragX.get(), dragY.get()],
    resolution: [canvasSize, canvasSize],
    shineProgress: shineProgress.get(),
  }));
  const canvasAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ scale: reappearScale.get() }],
  }));
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled && snapshot !== null)
        .minDistance(3)
        .onUpdate((event) => {
          dragX.set(event.translationX);
          dragY.set(event.translationY);
        })
        .onEnd((event) => {
          const distance = Math.hypot(event.translationX, event.translationY);
          const shouldDetach = distance > size * 0.38;

          if (!shouldDetach) {
            const spring = { damping: 18, mass: 0.72, stiffness: 190 };
            dragX.set(withSpring(0, spring));
            dragY.set(withSpring(0, spring));
            return;
          }

          const unitX = event.translationX / Math.max(distance, 1);
          const unitY = event.translationY / Math.max(distance, 1);
          const curlRadius = size * 0.18;
          const projectedBadgeWidth =
            size * (Math.abs(unitX) + Math.abs(unitY));
          const fullCurlDistance =
            (projectedBadgeWidth + curlRadius + 12) / 0.96;
          const targetDistance = Math.max(
            fullCurlDistance,
            distance + size * 0.24,
          );
          const remainingDistance = targetDistance - distance;
          const completionDuration = Math.min(
            640,
            Math.max(420, remainingDistance * 1.4),
          );
          const multiplier = targetDistance / Math.max(distance, 1);
          const timing = {
            duration: completionDuration,
            easing: Easing.bezier(0.22, 0.61, 0.36, 1),
          };
          opacity.set(
            withDelay(
              completionDuration * 0.62,
              withTiming(0, {
                duration: completionDuration * 0.38,
                easing: Easing.in(Easing.quad),
              }),
            ),
          );
          dragX.set(withTiming(event.translationX * multiplier, timing));
          dragY.set(
            withTiming(event.translationY * multiplier, timing, (finished) => {
              if (!finished) return;

              reappearScale.set(
                withDelay(
                  300,
                  withTiming(0.84, { duration: 1 }, (ready) => {
                    if (!ready) return;

                    opacity.set(1);
                    dragX.set(0);
                    dragY.set(0);
                    reappearScale.set(
                      reduceMotion
                        ? withTiming(1, { duration: 120 })
                        : withSpring(1, {
                            damping: 13,
                            mass: 0.72,
                            stiffness: 175,
                          }),
                    );

                    if (!reduceMotion) {
                      shineProgress.set(-0.22);
                      shineProgress.set(
                        withDelay(
                          260,
                          withTiming(1.22, {
                            duration: 1120,
                            easing: Easing.bezier(0.42, 0, 0.24, 1),
                          }),
                        ),
                      );
                    }
                  }),
                ),
              );
            }),
          );
          scheduleOnRN(playDetachHaptic);
        }),
    [
      disabled,
      dragX,
      dragY,
      opacity,
      reduceMotion,
      reappearScale,
      shineProgress,
      size,
      snapshot,
    ],
  );

  return (
    <View
      accessibilityHint={t("Drag in any direction to peel the badge")}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
      style={{ height: size, overflow: "visible", width: size }}
    >
      {snapshot ? (
        <GestureDetector gesture={gesture}>
          <Animated.View
            style={[
              styles.canvas,
              {
                height: canvasSize,
                left: -overscan,
                top: -overscan,
                width: canvasSize,
              },
              canvasAnimatedStyle,
            ]}
          >
            <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
              <Group
                layer={
                  <Paint>
                    <RuntimeShader
                      source={directionalPageCurl}
                      uniforms={uniforms}
                    />
                  </Paint>
                }
              >
                <Rect
                  color="rgba(0,0,0,0.001)"
                  rect={rect(0, 0, canvasSize, canvasSize)}
                />
                <Image
                  fit="contain"
                  image={snapshot}
                  rect={rect(overscan, overscan, size, size)}
                />
              </Group>
            </Canvas>
          </Animated.View>
        </GestureDetector>
      ) : (
        <View
          collapsable={false}
          onLayout={captureMedallion}
          ref={captureRef}
          style={StyleSheet.absoluteFill}
        >
          <BadgeMedallion
            accessibilityLabel={accessibilityLabel}
            locked={false}
            size={size}
            symbol={symbol}
            tier={tier}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    position: "absolute",
  },
});
