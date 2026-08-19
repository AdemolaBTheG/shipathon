import {
  Blur,
  Canvas,
  Fill,
  Group,
  Image as SkiaImage,
  rect,
  RoundedRect,
  rrect,
  Shader,
  Skia,
  useClock,
  useImage,
  vec,
} from "@shopify/react-native-skia";
import { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  Easing,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { colors } from "@/constants/theme";

type AnimatedCardGlowProps = {
  artworkUrl?: string | null;
  cardHeight?: number;
  cardWidth?: number;
  cornerRadius?: number;
  height: number;
  intensity?: number;
  revealed?: boolean;
  speed?: number;
  width: number;
};

const glowShader = Skia.RuntimeEffect.Make(`
  uniform float2 resolution;
  uniform float2 cardSize;
  uniform float cornerRadius;
  uniform float time;
  uniform float intensity;
  uniform float reveal;
  uniform float speed;
  uniform float motion;

  float roundedBoxDistance(float2 point, float2 halfSize, float radius) {
    float2 q = abs(point) - halfSize + float2(radius);
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius;
  }

  half3 colorRamp(float position) {
    float value = fract(position);
    half3 deepMint = half3(0.05, 0.55, 0.47);
    half3 mint = half3(0.39, 1.00, 0.85);
    half3 paleMint = half3(0.73, 1.00, 0.94);
    half3 teal = half3(0.08, 0.76, 0.67);

    if (value < 0.25) {
      return mix(deepMint, mint, smoothstep(0.0, 0.25, value));
    }
    if (value < 0.5) {
      return mix(mint, paleMint, smoothstep(0.25, 0.5, value));
    }
    if (value < 0.75) {
      return mix(paleMint, teal, smoothstep(0.5, 0.75, value));
    }
    return mix(teal, deepMint, smoothstep(0.75, 1.0, value));
  }

  half4 main(float2 position) {
    float2 center = resolution * 0.5;
    float2 point = position - center;
    float distanceToCard = roundedBoxDistance(
      point,
      cardSize * 0.5,
      cornerRadius
    );
    float seconds = time / 1000.0;
    float angle = atan(point.y, point.x) / 6.2831853 + 0.5;
    float drift = seconds * 0.10 * speed * motion;
    float wave = sin(
      point.x * 0.010 - point.y * 0.007 + seconds * 0.34 * speed
    ) * 0.025 * motion;
    half3 spectralColor = colorRamp(angle + drift + wave);

    float inside = 1.0 - smoothstep(-1.25, 1.25, distanceToCard);
    float outside = smoothstep(-1.25, 1.25, distanceToCard);
    float outsideDistance = max(distanceToCard, 0.0);
    float insideDistance = max(-distanceToCard, 0.0);

    float broadBloom = exp(
      -(outsideDistance * outsideDistance) / (2.0 * 52.0 * 52.0)
    ) * outside;
    float closeBloom = exp(
      -(outsideDistance * outsideDistance) / (2.0 * 17.0 * 17.0)
    ) * outside;
    float edgeLight = exp(-abs(distanceToCard) / 4.5);
    float innerSpill = exp(-insideDistance / 118.0) * inside;
    float collapse = smoothstep(0.02, 0.3, reveal) *
      (1.0 - smoothstep(0.36, 0.62, reveal));
    float glowExit = 1.0 - smoothstep(0.2, 0.58, reveal);

    float vertical = clamp(
      point.y / max(cardSize.y, 1.0) + 0.5,
      0.0,
      1.0
    );
    half3 surfaceTop = half3(0.12, 0.105, 0.145);
    half3 surfaceBottom = half3(0.075, 0.072, 0.09);
    half3 surface = mix(surfaceTop, surfaceBottom, vertical);
    float interiorBreath = 0.5 + 0.5 * sin(
      seconds * 0.42 * speed + point.x * 0.006 - point.y * 0.004
    );
    surface = mix(
      surface,
      spectralColor,
      innerSpill *
        (0.16 + interiorBreath * 0.07) *
        intensity *
        glowExit
    );
    surface = mix(
      surface,
      spectralColor * 0.78,
      collapse * (0.42 + innerSpill * 0.22) * intensity
    );

    float glowAlpha = clamp(
      broadBloom * (0.34 + collapse * 0.24) * intensity +
      closeBloom * (0.34 + collapse * 0.18) * intensity +
      edgeLight * (0.34 - collapse * 0.22) * intensity,
      0.0,
      0.94
    ) * glowExit;
    float canvasEdgeDistance = min(
      min(position.x, resolution.x - position.x),
      min(position.y, resolution.y - position.y)
    );
    glowAlpha *= smoothstep(4.0, 58.0, canvasEdgeDistance);
    half3 glow = spectralColor * glowAlpha;
    half3 card = surface * inside;
    card += spectralColor * edgeLight * inside * 0.26 * intensity * glowExit;

    float alpha = max(inside, glowAlpha);
    half3 result = card + glow * (1.0 - inside * 0.72);
    return half4(result, alpha);
  }
`);

const glintShader = Skia.RuntimeEffect.Make(`
  uniform float2 resolution;
  uniform float2 cardSize;
  uniform float cornerRadius;
  uniform float reveal;

  float roundedBoxDistance(float2 point, float2 halfSize, float radius) {
    float2 q = abs(point) - halfSize + float2(radius);
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius;
  }

  half4 main(float2 position) {
    float2 point = position - resolution * 0.5;
    float distanceToCard = roundedBoxDistance(
      point,
      cardSize * 0.5,
      cornerRadius
    );
    float inside = 1.0 - smoothstep(-1.0, 1.0, distanceToCard);
    float travel = smoothstep(0.54, 0.94, reveal);
    float envelope = smoothstep(0.5, 0.68, reveal) *
      (1.0 - smoothstep(0.86, 1.0, reveal));
    float span = (cardSize.x + cardSize.y) * 0.58;
    float center = mix(-span, span, travel);
    float diagonal = point.x + point.y;
    float band = exp(
      -((diagonal - center) * (diagonal - center)) / (2.0 * 26.0 * 26.0)
    );
    float alpha = band * envelope * inside * 0.34;
    return half4(alpha, alpha, alpha, alpha);
  }
`);

export function AnimatedCardGlow({
  artworkUrl = null,
  cardHeight: requestedCardHeight,
  cardWidth: requestedCardWidth,
  cornerRadius = 42,
  height,
  intensity = 1,
  revealed = false,
  speed = 1,
  width,
}: AnimatedCardGlowProps) {
  const { t } = useTranslation();
  const clock = useClock();
  const reduceMotion = useReducedMotion();
  const artwork = useImage(artworkUrl);
  const cardScale = useSharedValue(0.94);
  const intensityValue = useSharedValue(intensity);
  const revealProgress = useSharedValue(0);
  const speedValue = useSharedValue(speed);
  const cardWidth = requestedCardWidth ?? Math.min(width * 0.62, 260);
  const cardHeight = requestedCardHeight ?? Math.min(height * 0.63, 340);
  const cardX = (width - cardWidth) / 2;
  const cardY = (height - cardHeight) / 2;
  const cardClip = useMemo(
    () =>
      rrect(
        rect(cardX, cardY, cardWidth, cardHeight),
        cornerRadius,
        cornerRadius,
      ),
    [cardHeight, cardWidth, cardX, cardY, cornerRadius],
  );
  const cardCenter = useMemo(
    () => vec(width / 2, height / 2),
    [height, width],
  );

  useEffect(() => {
    intensityValue.set(
      withTiming(intensity, {
        duration: 320,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [intensity, intensityValue]);

  useEffect(() => {
    speedValue.set(
      withTiming(speed, {
        duration: 320,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [speed, speedValue]);

  useEffect(() => {
    const shouldReveal = revealed && artwork !== null;

    if (reduceMotion) {
      cardScale.set(shouldReveal ? 1 : 0.94);
      revealProgress.set(shouldReveal ? 1 : 0);
      return;
    }

    cardScale.set(
      shouldReveal
        ? withSequence(
            withTiming(1.022, {
              duration: 245,
              easing: Easing.out(Easing.cubic),
            }),
            withSpring(1, {
              damping: 17,
              mass: 0.72,
              stiffness: 210,
            }),
          )
        : withSpring(0.94, {
            damping: 18,
            mass: 0.75,
            stiffness: 190,
          }),
    );
    revealProgress.set(
      withTiming(shouldReveal ? 1 : 0, {
        duration: shouldReveal ? 360 : 320,
        easing: shouldReveal
          ? Easing.bezier(0.32, 0, 0.2, 1)
          : Easing.inOut(Easing.cubic),
      }),
    );
  }, [artwork, cardScale, reduceMotion, revealProgress, revealed]);

  const uniforms = useDerivedValue(() => ({
    cardSize: [cardWidth, cardHeight],
    cornerRadius,
    intensity: intensityValue.get(),
    motion: reduceMotion ? 0 : 1,
    reveal: revealProgress.get(),
    resolution: [width, height],
    speed: speedValue.get(),
    time: reduceMotion ? 0 : clock.get(),
  }));
  const artworkBlur = useDerivedValue(() => {
    const progress = revealProgress.get();

    if (progress < 0.28) {
      return 20;
    }
    if (progress < 0.62) {
      return 20 - ((progress - 0.28) / 0.34) * 12;
    }
    return 8 - ((progress - 0.62) / 0.38) * 8;
  });
  const artworkOpacity = useDerivedValue(() => {
    const reveal = revealProgress.get();

    if (reveal <= 0.2) {
      return 0;
    }

    const progress = Math.min(1, (reveal - 0.2) / 0.55);
    return 0.3 + progress * progress * (3 - 2 * progress) * 0.7;
  });
  const artworkTintOpacity = useDerivedValue(() => {
    const reveal = revealProgress.get();
    const enter = Math.min(1, Math.max(0, (reveal - 0.18) / 0.14));
    const exit = 1 - Math.min(1, Math.max(0, (reveal - 0.42) / 0.3));
    return enter * exit * 0.28;
  });
  const artworkTransform = useDerivedValue(() => [
    { scale: 0.985 + revealProgress.get() * 0.015 },
  ]);
  const cardTransform = useDerivedValue(() => [
    { scale: cardScale.get() },
  ]);

  return (
    <View
      accessibilityLabel={t("Animated mint card glow preview")}
      accessibilityRole="image"
      style={{ height, width }}
    >
      {glowShader ? (
        <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Group origin={cardCenter} transform={cardTransform}>
            <Fill>
              <Shader source={glowShader} uniforms={uniforms} />
            </Fill>
            {artwork ? (
              <Group clip={cardClip} opacity={artworkOpacity}>
                <Group origin={cardCenter} transform={artworkTransform}>
                  <SkiaImage
                    fit="cover"
                    height={cardHeight}
                    image={artwork}
                    width={cardWidth}
                    x={cardX}
                    y={cardY}
                  >
                    <Blur blur={artworkBlur} mode="clamp" />
                  </SkiaImage>
                </Group>
                <RoundedRect
                  blendMode="screen"
                  color={colors.success}
                  height={cardHeight}
                  opacity={artworkTintOpacity}
                  r={cornerRadius}
                  width={cardWidth}
                  x={cardX}
                  y={cardY}
                />
              </Group>
            ) : null}
            {artwork && glintShader ? (
              <Fill blendMode="screen">
                <Shader source={glintShader} uniforms={uniforms} />
              </Fill>
            ) : null}
          </Group>
        </Canvas>
      ) : (
        <View style={StyleSheet.absoluteFill}>
          <RoundedRectFallback
            height={cardHeight}
            radius={cornerRadius}
            width={cardWidth}
            x={cardX}
            y={cardY}
          />
        </View>
      )}
    </View>
  );
}

function RoundedRectFallback({
  height,
  radius,
  width,
  x,
  y,
}: {
  height: number;
  radius: number;
  width: number;
  x: number;
  y: number;
}) {
  return (
    <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
      <RoundedRect
        color={colors.surface}
        height={height}
        r={radius}
        width={width}
        x={x}
        y={y}
      />
    </Canvas>
  );
}
