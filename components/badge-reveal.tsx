import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  Mask,
  Path,
  RadialGradient,
  Skia,
  vec,
} from "@shopify/react-native-skia";
import { PressableScale } from "pressto";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { getBadgeAtmosphereColor } from "@/components/badge-medallion";
import { PolishableBadgeMedallion } from "@/components/polishable-badge-medallion";
import { colors, theme } from "@/constants/theme";
import type { BadgeTier } from "@/db/schema";
import type { BadgeDefinition } from "@/lib/badges";
import type { TranslationKey } from "@/localization/resources";

const RAY_COUNT = 6;
const FINAL_RAY_ROTATION = 128;

const RAY_COLORS = {
  bronze: "#E7A26D",
  gold: "#FFE08A",
  silver: "#F2F5F8",
  standard: "#C2C8D0",
} as const satisfies Record<BadgeTier, string>;

type BadgeRevealProps = {
  badge: BadgeDefinition;
  height: number;
  onContinue: () => void;
  tier: BadgeTier;
  width: number;
};

export function BadgeReveal({
  badge,
  height,
  onContinue,
  tier,
  width,
}: BadgeRevealProps) {
  const { t } = useTranslation();
  const title = t(badge.title as TranslationKey);
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [isInteractive, setIsInteractive] = useState(reduceMotion);
  const raySize = Math.min(620, width * 1.3, height * 0.54);
  const medallionSize = Math.min(250, width * 0.57, height * 0.28);
  const rayRotation = useSharedValue(10);
  const rayOpacity = useSharedValue(0);
  const badgeOpacity = useSharedValue(0);
  const badgeScale = useSharedValue(0.88);
  const badgeRotation = useSharedValue(-7);
  const copyOpacity = useSharedValue(0);
  const copyTranslateY = useSharedValue(12);
  const atmosphereColor = getBadgeAtmosphereColor({ locked: false, tier });

  const handlePolished = useCallback(() => {
    badgeScale.set(
      reduceMotion
        ? 1
        : withSequence(
            withTiming(1.04, {
              duration: 140,
              easing: Easing.out(Easing.cubic),
            }),
            withSpring(1, {
              damping: 19,
              mass: 0.82,
              stiffness: 210,
            }),
          ),
    );
    copyOpacity.set(withDelay(90, withTiming(1, { duration: 420 })));
    copyTranslateY.set(
      withDelay(
        90,
        withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }),
      ),
    );
  }, [badgeScale, copyOpacity, copyTranslateY, reduceMotion]);

  useEffect(() => {
    if (reduceMotion) {
      rayRotation.set(FINAL_RAY_ROTATION);
      rayOpacity.set(0.48);
      badgeOpacity.set(1);
      badgeScale.set(1);
      badgeRotation.set(0);
      copyOpacity.set(1);
      copyTranslateY.set(0);
      return;
    }

    rayRotation.set(
      withTiming(FINAL_RAY_ROTATION, {
        duration: 4200,
        easing: Easing.bezier(0.2, 0.68, 0.24, 1),
      }),
    );
    rayOpacity.set(withTiming(0.48, { duration: 700 }));
    badgeOpacity.set(withDelay(180, withTiming(1, { duration: 420 })));
    badgeScale.set(
      withDelay(180, withSpring(1, { damping: 16, mass: 0.9, stiffness: 135 })),
    );
    badgeRotation.set(
      withDelay(
        180,
        withTiming(0, { duration: 780, easing: Easing.out(Easing.cubic) }),
      ),
    );
    const interactionTimer = setTimeout(() => {
      setIsInteractive(true);
    }, 900);

    return () => {
      clearTimeout(interactionTimer);
      cancelAnimation(rayRotation);
      cancelAnimation(rayOpacity);
      cancelAnimation(badgeOpacity);
      cancelAnimation(badgeScale);
      cancelAnimation(badgeRotation);
      cancelAnimation(copyOpacity);
      cancelAnimation(copyTranslateY);
    };
  }, [
    badgeOpacity,
    badgeRotation,
    badgeScale,
    copyOpacity,
    copyTranslateY,
    rayOpacity,
    rayRotation,
    reduceMotion,
  ]);

  const raysAnimatedStyle = useAnimatedStyle(() => ({
    opacity: rayOpacity.get(),
    transform: [{ rotate: `${rayRotation.get()}deg` }],
  }));
  const badgeAnimatedStyle = useAnimatedStyle(() => ({
    opacity: badgeOpacity.get(),
    transform: [
      { scale: badgeScale.get() },
      { rotate: `${badgeRotation.get()}deg` },
    ],
  }));
  const copyAnimatedStyle = useAnimatedStyle(() => ({
    opacity: copyOpacity.get(),
    transform: [{ translateY: copyTranslateY.get() }],
  }));
  const polishHintAnimatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - copyOpacity.get(),
    transform: [{ translateY: -copyOpacity.get() * 6 }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: atmosphereColor }]}>
      <View
        style={[
          styles.content,
          {
            paddingBottom: Math.max(insets.bottom, theme.spacing.md),
            paddingTop: Math.max(insets.top, theme.spacing.lg),
          },
        ]}
      >
        <View style={[styles.revealStage, { height: raySize, width: raySize }]}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.rays,
              { height: raySize, width: raySize },
              raysAnimatedStyle,
            ]}
          >
            <BadgeRevealRays color={RAY_COLORS[tier]} size={raySize} />
          </Animated.View>

          <Animated.View style={[styles.medallion, badgeAnimatedStyle]}>
            <PolishableBadgeMedallion
              accessibilityLabel={t("{{title}}, {{state}}", {
                state: t("{{tier}} unlocked", {
                  tier: t(tier as TranslationKey),
                }),
                title,
              })}
              disabled={!isInteractive}
              initiallyPolished={reduceMotion}
              onPolished={handlePolished}
              size={medallionSize}
              symbol={badge.symbol}
              tier={tier}
            />
          </Animated.View>
        </View>

        <View style={styles.copyStage}>
          <Animated.Text style={[styles.polishHint, polishHintAnimatedStyle]}>
            {t("Rub to polish")}
          </Animated.Text>
          <Animated.View style={[styles.copy, copyAnimatedStyle]}>
            <Text selectable style={styles.title}>
              {title}
            </Text>
            <Text selectable style={styles.description}>
              {t(badge.description as TranslationKey)}
            </Text>
          </Animated.View>
        </View>

        <PressableScale
          accessibilityLabel={t("Continue")}
          accessibilityRole="button"
          onPress={onContinue}
          style={styles.continueButton}
        >
          <Text style={styles.continueButtonText}>{t("Continue")}</Text>
        </PressableScale>
      </View>
    </View>
  );
}

function BadgeRevealRays({ color, size }: { color: string; size: number }) {
  const center = size / 2;
  const radius = size * 0.71;
  const paths = useMemo(
    () =>
      Array.from({ length: RAY_COUNT }, (_, index) => {
        const centerAngle = (index / RAY_COUNT) * Math.PI * 2;
        const halfWidth = index % 2 === 0 ? 0.17 : 0.12;
        const startAngle = centerAngle - halfWidth;
        const endAngle = centerAngle + halfWidth;
        const path = Skia.Path.Make();

        path.moveTo(center, center);
        path.lineTo(
          center + Math.cos(startAngle) * radius,
          center + Math.sin(startAngle) * radius,
        );
        path.lineTo(
          center + Math.cos(endAngle) * radius,
          center + Math.sin(endAngle) * radius,
        );
        path.close();
        return path;
      }),
    [center, radius],
  );

  return (
    <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Circle cx={center} cy={center} r={radius * 0.58}>
        <RadialGradient
          c={vec(center, center)}
          colors={[`${color}45`, `${color}17`, "transparent"]}
          positions={[0, 0.5, 1]}
          r={radius * 0.58}
        />
      </Circle>
      <Mask
        mask={
          <Circle cx={center} cy={center} r={radius}>
            <RadialGradient
              c={vec(center, center)}
              colors={[
                "rgba(255,255,255,0.96)",
                "rgba(255,255,255,0.82)",
                "rgba(255,255,255,0.26)",
                "rgba(255,255,255,0)",
              ]}
              positions={[0, 0.3, 0.72, 1]}
              r={radius}
            />
          </Circle>
        }
        mode="alpha"
      >
        <Group>
          <BlurMask blur={1.2} style="normal" />
          {paths.map((path, index) => (
            <Path
              color={index % 2 === 0 ? `${color}42` : `${color}2B`}
              key={index}
              path={path}
            />
          ))}
        </Group>
      </Mask>
    </Canvas>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
  },
  content: {
    alignItems: "center",
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  continueButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderCurve: "continuous",
    borderRadius: theme.radius.pill,
    paddingVertical: theme.spacing.md,
    justifyContent: "center",
    marginTop: "auto",
    width: "100%",
  },
  continueButtonText: {
    color: colors.background,
    fontSize: theme.size.lg,
    fontWeight: "700",
  },
  copy: {
    alignItems: "center",
    bottom: 0,
    gap: theme.spacing.sm,
    left: 0,
    paddingHorizontal: theme.spacing.lg,
    position: "absolute",
    right: 0,
    top: 0,
  },
  copyStage: {
    alignItems: "center",
    height: 112,
    justifyContent: "flex-start",
    marginTop: -theme.spacing.xl,
    position: "relative",
    width: "100%",
  },
  description: {
    color: colors.textMuted,
    fontSize: theme.size.lg,
    textAlign: "center",
  },
  eyebrow: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.8,
  },
  eyebrowRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.xs,
    minHeight: 30,
  },
  medallion: {
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
  },
  polishHint: {
    color: colors.textMuted,
    fontSize: theme.size.md,
    fontWeight: "700",
    letterSpacing: 0.2,
    marginTop: theme.spacing.sm,
    position: "absolute",
  },
  rays: {
    position: "absolute",
  },
  revealStage: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: -theme.spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: theme.size["2xl"],
    fontWeight: "700",
    textAlign: "center",
  },
});
