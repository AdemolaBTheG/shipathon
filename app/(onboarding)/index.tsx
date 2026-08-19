import { colors, theme } from "@/constants/theme";
import MaskedView from "@expo/ui/community/masked-view";
import { Image } from "expo-image";
import { Link, Redirect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { PressableScale, type AnimatedPressableOptions } from "pressto";
import { forwardRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Presets } from "react-native-pulsar";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  getOnboardingResumeHref,
  useOnboarding,
} from "@/providers/onboarding-provider";

const GRID_GAP = 8;
const GRID_OVERSCAN = 20;
const COLUMN_COUNT = 3;

const COVER_COLUMNS = [
  [
    "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co4jni.jpg",
    "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co1rs4.jpg",
    "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co2fca.jpg",
    "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co1uii.jpg",
    "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co2tw1.jpg",
  ],
  [
    "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co670h.jpg",
    "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co4rs3.jpg",
    "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co4v2z.jpg",
    "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co1uje.jpg",
    "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co3vzn.jpg",
  ],
  [
    "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/coaknx.jpg",
    "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co741o.jpg",
    "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/cob1ts.jpg",
    "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co2tw0.jpg",
    "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co1rs4.jpg",
  ],
] as const;

type MovingCoverColumnProps = {
  coverHeight: number;
  coverUrls: readonly string[];
  coverWidth: number;
  direction: "down" | "up";
  duration: number;
  pinnedZoomSourceIndex?: number;
};

function MovingCoverColumn({
  coverHeight,
  coverUrls,
  coverWidth,
  direction,
  duration,
  pinnedZoomSourceIndex,
}: MovingCoverColumnProps) {
  const reduceMotion = useReducedMotion();
  const isPinned = pinnedZoomSourceIndex !== undefined;
  const loopHeight = (coverHeight + GRID_GAP) * coverUrls.length;
  const translateY = useSharedValue(
    isPinned || direction === "up" ? 0 : -loopHeight,
  );

  useEffect(() => {
    if (isPinned) {
      translateY.value = 0;
      return () => cancelAnimation(translateY);
    }

    const start = direction === "down" ? -loopHeight : 0;
    const end = direction === "down" ? 0 : -loopHeight;

    translateY.value = start;
    if (!reduceMotion) {
      translateY.value = withRepeat(
        withTiming(end, { duration, easing: Easing.linear }),
        -1,
        false,
      );
    }

    return () => cancelAnimation(translateY);
  }, [direction, duration, isPinned, loopHeight, reduceMotion, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View style={[styles.columnViewport, { width: coverWidth }]}>
      <Animated.View style={animatedStyle}>
        {(isPinned ? [0] : [0, 1]).map((sequence) => (
          <View key={sequence}>
            {coverUrls.map((coverUrl, index) => {
              const key = `${sequence}-${coverUrl}-${index}`;
              const coverStyle = StyleSheet.flatten([
                styles.cover,
                {
                  height: coverHeight,
                  marginBottom: GRID_GAP,
                  width: coverWidth,
                },
              ]);
              const cover = (
                <View collapsable={false} key={key} style={coverStyle}>
                  <Image
                    cachePolicy="memory-disk"
                    contentFit="cover"
                    recyclingKey={`${coverUrl}-${sequence}`}
                    source={coverUrl}
                    style={StyleSheet.absoluteFill}
                    transition={180}
                  />
                </View>
              );
              const isZoomSource =
                isPinned &&
                sequence === 0 &&
                pinnedZoomSourceIndex === index;

              return isZoomSource ? (
                <Link.AppleZoom key={key}>{cover}</Link.AppleZoom>
              ) : (
                cover
              );
            })}
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

type WelcomeScreenContentProps = {
  onPress?: (options: AnimatedPressableOptions) => void;
};

const WelcomeScreenContent = forwardRef<View, WelcomeScreenContentProps>(
  function WelcomeScreenContent({ onPress }, ref) {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const gridWidth = width + GRID_OVERSCAN * 2;
    const coverWidth =
      (gridWidth - GRID_GAP * (COLUMN_COUNT - 1)) / COLUMN_COUNT;
    const coverHeight = coverWidth * 1.5;

    return (
      <View ref={ref} style={styles.screen}>
        <StatusBar style="dark" />

        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={[styles.coverWall, { left: -GRID_OVERSCAN, width: gridWidth }]}
        >
          {COVER_COLUMNS.map((coverUrls, index) => (
            <MovingCoverColumn
              key={index}
              coverHeight={coverHeight}
              coverUrls={coverUrls}
              coverWidth={coverWidth}
              direction={index === 1 ? "down" : "up"}
              duration={28_000 + index * 3_000}
              pinnedZoomSourceIndex={index === 1 ? 1 : undefined}
            />
          ))}
        </View>

        <View pointerEvents="none" style={styles.colorGrade} />
        <View pointerEvents="none" style={styles.topFade} />
        <View pointerEvents="none" style={styles.bottomFade} />

        <View
          style={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) },
          ]}
        >
          <View style={styles.eyebrow}>
            <Text style={[styles.eyebrowText, styles.eyebrowMeasure]}>
              JOYLOGUE
            </Text>
            <MaskedView
              maskElement={<Text style={styles.eyebrowText}>JOYLOGUE</Text>}
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
            >
              <View style={styles.eyebrowGradient} />
            </MaskedView>
          </View>
          <Text style={styles.title}>{t("Never lose your next game.")}</Text>
          <Text style={styles.subtitle}>
            {t(
              "Save games the moment you find them. Play, finish, rate, and compare your backlog with friends.",
            )}
          </Text>

          <PressableScale
            accessibilityHint={t("Opens platform selection")}
            accessibilityLabel={t("Start using Joylogue")}
            accessibilityRole="button"
            onPress={onPress}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>
              {t("Build my backlog")}
            </Text>
          </PressableScale>
        </View>
      </View>
    );
  },
);

export default function OnboardingWelcomeScreen() {
  const { setStep, state } = useOnboarding();

  if (state.currentStep !== "welcome") {
    return <Redirect href={getOnboardingResumeHref(state)} />;
  }

  return (
    <Link
      href="/(onboarding)/platforms"
      onPress={() => {
        Presets.snap();
        void setStep("platforms");
      }}
      asChild
    >
      <Link.Trigger>
        <WelcomeScreenContent />
      </Link.Trigger>
    </Link>
  );
}

const styles = StyleSheet.create({
  bottomFade: {
    bottom: 0,
    experimental_backgroundImage:
      "linear-gradient(to bottom, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.34) 20%, rgba(0, 0, 0, 0.82) 48%, #000 70%, #000 100%)",
    height: "62%",
    left: 0,
    position: "absolute",
    right: 0,
    zIndex: 2,
  },
  colorGrade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.18)",
    zIndex: 1,
  },
  columnViewport: {
    height: "120%",
    overflow: "hidden",
  },
  content: {
    bottom: 0,
    left: 0,
    paddingHorizontal: theme.spacing.lg,
    position: "absolute",
    right: 0,
    zIndex: 3,
  },
  cover: {
    backgroundColor: colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderCurve: "continuous",
  },
  coverWall: {
    flexDirection: "row",
    gap: GRID_GAP,
    height: "120%",
    position: "absolute",
    top: -72,
    transform: [{ rotate: "-2deg" }, { scale: 1.05 }],
  },
  eyebrow: {
    alignSelf: "center",
    marginBottom: theme.spacing.md,
  },
  eyebrowGradient: {
    ...StyleSheet.absoluteFill,
    experimental_backgroundImage: `linear-gradient(105deg, #22CFA9 0%, ${colors.success} 48%, #A1FFE8 100%)`,
  },
  eyebrowMeasure: {
    opacity: 0,
  },
  eyebrowText: {
    color: colors.text,
    fontSize: theme.size.md,
    fontWeight: "800",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: theme.radius.pill,
    justifyContent: "center",
    marginTop: theme.spacing.xl,
    minHeight: 58,
    paddingHorizontal: theme.spacing.lg,
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: 17,
    fontWeight: "800",
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
    overflow: "hidden",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: theme.size.lg,
    fontWeight: "600",
    paddingHorizontal: theme.spacing.sm,
    textAlign: "center",
  },
  title: {
    color: colors.text,
    fontSize: theme.size["3xl"],
    fontWeight: "800",
    textAlign: "center",
    marginBottom: theme.spacing.md,
  },
  topFade: {
    ...StyleSheet.absoluteFill,
    experimental_backgroundImage:
      "linear-gradient(to bottom, rgba(0, 0, 0, 0.62) 0%, rgba(0, 0, 0, 0.08) 18%, rgba(0, 0, 0, 0) 32%)",
    zIndex: 2,
  },
});
