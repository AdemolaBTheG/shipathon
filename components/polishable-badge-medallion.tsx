import type { SkImage } from "@shopify/react-native-skia";
import {
  BlurMask,
  Canvas,
  Circle,
  ColorMatrix,
  Group,
  Image,
  ImageShader,
  makeImageFromView,
  Mask,
  Path,
  RadialGradient,
  rect,
  Rect,
  Shader,
  Skia,
} from "@shopify/react-native-skia";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AccessibilityActionEvent, LayoutChangeEvent } from "react-native";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Presets } from "react-native-pulsar";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import {
  BadgeMedallion,
  createBadgeMedallionShinePath,
} from "@/components/badge-medallion";
import type { BadgeTier } from "@/db/schema";
import type { BadgeDefinition } from "@/lib/badges";

const GRID_SIZE = 12;
const COMPLETION_THRESHOLD = 0.85;
const COMPLETION_SETTLE_DELAY = 560;
const COMPLETION_SHINE_DURATION = 1560;
const FIRST_RESISTANCE_THRESHOLD = 0.3;
const SECOND_RESISTANCE_THRESHOLD = 0.6;
const MEDALLION_POLYGON = [
  [0.5, 0.07],
  [0.91, 0.23],
  [0.95, 0.69],
  [0.5, 0.93],
  [0.05, 0.69],
  [0.09, 0.23],
] as const;

const TARNISH_MATRIX = [
  0.25, 0.25, 0.13, 0, 0,
  0.18, 0.23, 0.13, 0, 0,
  0.12, 0.16, 0.14, 0, 0,
  0, 0, 0, 1, 0,
];

const METALLIC_SHINE_SHADER = Skia.RuntimeEffect.Make(`
  uniform shader badge;
  uniform float2 resolution;
  uniform float2 origin;
  uniform float progress;

  float hash(float2 point) {
    return fract(sin(dot(point, float2(127.1, 311.7))) * 43758.5453);
  }

  half4 main(float2 position) {
    half4 sampled = badge.eval(position);
    if (sampled.a < 0.001) return half4(0.0);

    float2 uv = (position - origin) / resolution;
    float diagonal = uv.x + uv.y;
    float center = mix(-0.38, 2.38, progress);
    float distanceToSweep = diagonal - center;

    float broad = exp(-0.5 * pow(distanceToSweep / 0.13, 2.0));
    float core = exp(-0.5 * pow(distanceToSweep / 0.022, 2.0));
    float trailing = exp(-0.5 * pow((distanceToSweep + 0.095) / 0.045, 2.0));
    float leading = exp(-0.5 * pow((distanceToSweep - 0.075) / 0.032, 2.0));

    float grain = (hash(floor(position * 0.45)) - 0.5) * 0.08;
    float reflection = broad * 0.16 + trailing * 0.2 + leading * 0.12 + core * 0.72;
    reflection = clamp(reflection * (1.0 + grain), 0.0, 0.72);

    half3 source = sampled.rgb / sampled.a;
    float luminance = dot(source, half3(0.2126, 0.7152, 0.0722));
    half3 warmMetal = half3(1.0, 0.93, 0.72);
    float lift = reflection * mix(0.48, 0.3, luminance);
    half3 brightened = source + (half3(1.0) - source) * lift;
    brightened = mix(brightened, warmMetal, reflection * 0.04);

    return half4(brightened * sampled.a, sampled.a);
  }
`);

type PolishableBadgeMedallionProps = {
  accessibilityLabel: string;
  disabled?: boolean;
  initiallyPolished?: boolean;
  onPolished?: () => void;
  size: number;
  symbol: BadgeDefinition["symbol"];
  tier: BadgeTier;
};

function isPointInsideMedallion(x: number, y: number) {
  let inside = false;

  for (
    let current = 0, previous = MEDALLION_POLYGON.length - 1;
    current < MEDALLION_POLYGON.length;
    previous = current++
  ) {
    const [currentX, currentY] = MEDALLION_POLYGON[current];
    const [previousX, previousY] = MEDALLION_POLYGON[previous];
    const crossesEdge =
      currentY > y !== previousY > y &&
      x <
        ((previousX - currentX) * (y - currentY)) /
          (previousY - currentY) +
          currentX;

    if (crossesEdge) inside = !inside;
  }

  return inside;
}

const VALID_CELL_KEYS = new Set(
  Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, key) => key).filter(
    (key) => {
      const row = Math.floor(key / GRID_SIZE);
      const column = key % GRID_SIZE;
      return isPointInsideMedallion(
        (column + 0.5) / GRID_SIZE,
        (row + 0.5) / GRID_SIZE,
      );
    },
  ),
);
const REQUIRED_CELL_COUNT = Math.ceil(
  VALID_CELL_KEYS.size * COMPLETION_THRESHOLD,
);

function getBrushCells(row: number, column: number) {
  const cells: number[] = [];

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      const targetRow = row + rowOffset;
      const targetColumn = column + columnOffset;
      if (
        targetRow < 0 ||
        targetRow >= GRID_SIZE ||
        targetColumn < 0 ||
        targetColumn >= GRID_SIZE
      ) {
        continue;
      }

      const key = targetRow * GRID_SIZE + targetColumn;
      if (VALID_CELL_KEYS.has(key)) cells.push(key);
    }
  }

  return cells;
}

export function PolishableBadgeMedallion({
  accessibilityLabel,
  disabled = false,
  initiallyPolished = false,
  onPolished,
  size,
  symbol,
  tier,
}: PolishableBadgeMedallionProps) {
  const reduceMotion = useReducedMotion();
  const startsPolished = initiallyPolished || reduceMotion;
  const overscan = 0;
  const canvasSize = size;
  const cellSize = size / GRID_SIZE;
  const captureRef = useRef<View>(null);
  const captureRequestedRef = useRef(false);
  const captureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const [snapshot, setSnapshot] = useState<SkImage | null>(null);
  const [revealedCells, setRevealedCells] = useState<number[]>([]);
  const previousCoverageCountRef = useRef(0);
  const [isPolished, setIsPolished] = useState(startsPolished);
  const completionStarted = useSharedValue(startsPolished);
  const polished = useSharedValue(startsPolished);
  const tarnishOpacity = useSharedValue(startsPolished ? 0 : 1);
  const shineProgress = useSharedValue(2);
  const shineHapticPlayed = useSharedValue(startsPolished);
  const lightX = useSharedValue(0.34);
  const lightY = useSharedValue(0.24);
  const lightStrength = useSharedValue(startsPolished ? 0.045 : 0);
  const tiltX = useSharedValue(0);
  const tiltY = useSharedValue(0);
  const lastGridCell = useSharedValue(-1);

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

  useEffect(
    () => () => {
      cancelAnimation(tarnishOpacity);
      cancelAnimation(shineProgress);
      cancelAnimation(lightStrength);
      cancelAnimation(tiltX);
      cancelAnimation(tiltY);
    },
    [lightStrength, shineProgress, tarnishOpacity, tiltX, tiltY],
  );

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

  const notifyPolished = useCallback(() => {
    if (!mountedRef.current) return;
    Presets.rebound();
    setIsPolished(true);
    onPolished?.();
  }, [onPolished]);

  const completePolish = useCallback(() => {
    if (completionStarted.get()) return;
    completionStarted.set(true);

    tarnishOpacity.set(
      withTiming(
        0,
        {
          duration: reduceMotion ? 1 : 460,
          easing: Easing.out(Easing.cubic),
        },
        (finished) => {
          if (!finished) return;

          polished.set(true);
          lightStrength.set(withTiming(0.05, { duration: 360 }));
          scheduleOnRN(notifyPolished);

          if (!reduceMotion) {
            shineHapticPlayed.set(false);
            shineProgress.set(0);
            shineProgress.set(
              withDelay(
                COMPLETION_SETTLE_DELAY,
                withTiming(1, {
                  duration: COMPLETION_SHINE_DURATION,
                  easing: Easing.bezier(0.42, 0, 0.24, 1),
                }),
              ),
            );
          }
        },
      ),
    );
  }, [
    completionStarted,
    lightStrength,
    notifyPolished,
    polished,
    reduceMotion,
    shineProgress,
    shineHapticPlayed,
    tarnishOpacity,
  ]);

  useAnimatedReaction(
    () => shineProgress.get(),
    (currentProgress, previousProgress) => {
      if (
        reduceMotion ||
        shineHapticPlayed.get() ||
        currentProgress < 0.5 ||
        currentProgress > 1 ||
        (previousProgress !== null && previousProgress >= 0.5)
      ) {
        return;
      }

      shineHapticPlayed.set(true);
      Presets.pip();
    },
    [reduceMotion],
  );

  const markCoverage = useCallback(
    (row: number, column: number) => {
      if (completionStarted.get()) return;
      setRevealedCells((currentCells) => {
        const nextCells = new Set(currentCells);
        for (const key of getBrushCells(row, column)) nextCells.add(key);

        return nextCells.size === currentCells.length
          ? currentCells
          : [...nextCells];
      });
    },
    [completionStarted],
  );

  useEffect(() => {
    const previousCount = previousCoverageCountRef.current;
    const nextCount = revealedCells.length;
    if (nextCount === previousCount) return;

    previousCoverageCountRef.current = nextCount;
    const previousProgress = previousCount / VALID_CELL_KEYS.size;
    const nextProgress = nextCount / VALID_CELL_KEYS.size;

    if (previousCount === 0) Presets.System.selection();
    if (
      previousProgress < FIRST_RESISTANCE_THRESHOLD &&
      nextProgress >= FIRST_RESISTANCE_THRESHOLD
    ) {
      Presets.flick();
    }
    if (
      previousProgress < SECOND_RESISTANCE_THRESHOLD &&
      nextProgress >= SECOND_RESISTANCE_THRESHOLD
    ) {
      Presets.peck();
    }
    if (nextCount >= REQUIRED_CELL_COUNT) completePolish();
  }, [completePolish, revealedCells.length]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled && snapshot !== null)
        .maxPointers(1)
        .minDistance(0)
        .onBegin((event) => {
          lastGridCell.set(-1);

          if (polished.get()) {
            const normalizedX = Math.min(
              1,
              Math.max(0, (event.x - overscan) / size),
            );
            const normalizedY = Math.min(
              1,
              Math.max(0, (event.y - overscan) / size),
            );
            lightX.set(normalizedX);
            lightY.set(normalizedY);
            lightStrength.set(withTiming(0.085, { duration: 140 }));
          }
        })
        .onUpdate((event) => {
          const localX = event.x - overscan;
          const localY = event.y - overscan;
          const normalizedX = Math.min(1, Math.max(0, localX / size));
          const normalizedY = Math.min(1, Math.max(0, localY / size));

          if (polished.get()) {
            tiltX.set((0.5 - normalizedY) * 7);
            tiltY.set((normalizedX - 0.5) * 7);
            lightX.set(normalizedX);
            lightY.set(normalizedY);
            return;
          }

          if (localX < 0 || localX >= size || localY < 0 || localY >= size) {
            return;
          }

          const column = Math.min(
            GRID_SIZE - 1,
            Math.floor(localX / cellSize),
          );
          const row = Math.min(GRID_SIZE - 1, Math.floor(localY / cellSize));
          const key = row * GRID_SIZE + column;
          if (key === lastGridCell.get() || !VALID_CELL_KEYS.has(key)) return;

          lastGridCell.set(key);
          scheduleOnRN(markCoverage, row, column);
        })
        .onEnd(() => {
          lastGridCell.set(-1);
          if (!polished.get()) return;

          const spring = { damping: 17, mass: 0.75, stiffness: 165 };
          tiltX.set(withSpring(0, spring));
          tiltY.set(withSpring(0, spring));
          lightX.set(withTiming(0.34, { duration: 360 }));
          lightY.set(withTiming(0.24, { duration: 360 }));
          lightStrength.set(withTiming(0.045, { duration: 320 }));
        })
        .onFinalize(() => {
          lastGridCell.set(-1);
        }),
    [
      cellSize,
      disabled,
      lastGridCell,
      lightStrength,
      lightX,
      lightY,
      markCoverage,
      overscan,
      polished,
      size,
      snapshot,
      tiltX,
      tiltY,
    ],
  );

  const shineUniforms = useDerivedValue(() => ({
    origin: [overscan, overscan],
    progress: shineProgress.get(),
    resolution: [size, size],
  }));
  const shineMaskPath = useMemo(
    () => createBadgeMedallionShinePath(size, overscan),
    [overscan, size],
  );
  const lightCenter = useDerivedValue(() => ({
    x: overscan + lightX.get() * size,
    y: overscan + lightY.get() * size,
  }));
  const canvasAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: size * 8 },
      { rotateX: `${tiltX.get()}deg` },
      { rotateY: `${tiltY.get()}deg` },
    ],
  }));
  const brushRadius = cellSize * 0.78;
  const brushBlur = cellSize * 0.72;

  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === "activate") completePolish();
  };

  return (
    <View
      accessibilityActions={[
        {
          label: isPolished ? "Move the light across the badge" : "Polish badge",
          name: "activate",
        },
      ]}
      accessibilityHint={
        isPolished
          ? "Drag to tilt the badge and move its light"
          : "Rub across different parts of the badge to remove the tarnish"
      }
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="imagebutton"
      accessibilityState={{ disabled }}
      onAccessibilityAction={handleAccessibilityAction}
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
              <Image
                fit="contain"
                image={snapshot}
                rect={rect(overscan, overscan, size, size)}
              />

              {METALLIC_SHINE_SHADER ? (
                <Path path={shineMaskPath}>
                  <Shader
                    source={METALLIC_SHINE_SHADER}
                    uniforms={shineUniforms}
                  >
                    <ImageShader
                      fit="fill"
                      image={snapshot}
                      rect={rect(overscan, overscan, size, size)}
                    />
                  </Shader>
                </Path>
              ) : null}
              <Path
                blendMode="screen"
                opacity={lightStrength}
                path={shineMaskPath}
              >
                <RadialGradient
                  c={lightCenter}
                  colors={["rgba(255,255,255,0.92)", "transparent"]}
                  positions={[0, 1]}
                  r={size * 0.62}
                />
              </Path>

              <Mask
                clip={false}
                mask={
                  <Group>
                    <Rect
                      color="white"
                      rect={rect(0, 0, canvasSize, canvasSize)}
                    />
                    {revealedCells.map((key) => {
                      const row = Math.floor(key / GRID_SIZE);
                      const column = key % GRID_SIZE;

                      return (
                        <Circle
                          color="black"
                          cx={overscan + (column + 0.5) * cellSize}
                          cy={overscan + (row + 0.5) * cellSize}
                          key={key}
                          r={brushRadius}
                        >
                          <BlurMask blur={brushBlur} style="normal" />
                        </Circle>
                      );
                    })}
                  </Group>
                }
                mode="luminance"
              >
                <Group opacity={tarnishOpacity}>
                  <Image
                    fit="contain"
                    image={snapshot}
                    rect={rect(overscan, overscan, size, size)}
                  >
                    <ColorMatrix matrix={TARNISH_MATRIX} />
                  </Image>
                </Group>
              </Mask>
            </Canvas>
          </Animated.View>
        </GestureDetector>
      ) : (
        <View style={StyleSheet.absoluteFill}>
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
          {!startsPolished ? (
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <BadgeMedallion
                accessibilityLabel={accessibilityLabel}
                locked
                size={size}
                symbol={symbol}
                tier={tier}
              />
            </View>
          ) : null}
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
