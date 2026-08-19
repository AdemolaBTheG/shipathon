import { useEffect, type ReactNode } from "react";
import {
  StyleSheet,
  type StyleProp,
  View,
  type ViewStyle,
} from "react-native";
import {
  cancelAnimation,
  Easing,
  type SharedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import Shimmer from "@/components/shimmer";
import { colors, theme } from "@/constants/theme";

type GameDetailSkeletonProps = {
  heroHeight: number;
  topInset: number;
  width: number;
};

type SkeletonMaskProps = {
  children: ReactNode;
  progress: SharedValue<number>;
  reduceMotion: boolean;
  style?: StyleProp<ViewStyle>;
};

export function GameDetailSkeleton({
  heroHeight,
  topInset,
  width,
}: GameDetailSkeletonProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const contentWidth = width - 40;
  const screenshotWidth = Math.min(300, Math.max(240, width * 0.72));
  const screenshotHeight = Math.round(screenshotWidth * (9 / 16));
  const trailerHeight = Math.round(contentWidth * (9 / 16));

  useEffect(() => {
    if (reduceMotion) return;

    progress.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1_450, easing: Easing.linear }),
          withDelay(450, withTiming(0, { duration: 0 })),
        ),
        -1,
      ),
    );

    return () => {
      cancelAnimation(progress);
      progress.set(0);
    };
  }, [progress, reduceMotion]);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.hero, { minHeight: heroHeight }]}>
        <View style={styles.heroAtmosphere} />
        <SkeletonMask progress={progress} reduceMotion={reduceMotion}>
          <View
            style={[
              styles.heroMask,
              {
                minHeight: heroHeight,
                paddingBottom: theme.spacing.xl + theme.spacing.sm,
                paddingTop: topInset + 72,
              },
            ]}
          >
            <SkeletonShape style={styles.cover} />
            <SkeletonShape
              style={[styles.heroTitle, { width: Math.min(310, width - 72) }]}
            />
            <SkeletonShape style={styles.heroAction} />
          </View>
        </SkeletonMask>
      </View>

      <View style={styles.body}>
        <SkeletonMask progress={progress} reduceMotion={reduceMotion}>
          <View style={styles.sectionGroup}>
            <SkeletonSection cardHeight={130} titleWidth={176} />
            <SkeletonSection cardHeight={296} titleWidth={84} />
            <SkeletonSection cardHeight={190} titleWidth={64} />
          </View>
        </SkeletonMask>

        <SkeletonMask
          progress={progress}
          reduceMotion={reduceMotion}
          style={styles.lowerGroup}
        >
          <View style={styles.sectionGroup}>
            <SkeletonSection cardHeight={170} titleWidth={124} />
            <View style={styles.section}>
              <SkeletonShape style={[styles.sectionTitle, { width: 112 }]} />
              <View style={styles.screenshotRow}>
                <SkeletonShape
                  style={{ height: screenshotHeight, width: screenshotWidth }}
                />
                <SkeletonShape
                  style={{ height: screenshotHeight, width: screenshotWidth }}
                />
              </View>
            </View>
            <SkeletonSection cardHeight={trailerHeight} titleWidth={72} />
          </View>
        </SkeletonMask>
      </View>
    </View>
  );
}

function SkeletonMask({
  children,
  progress,
  reduceMotion,
  style,
}: SkeletonMaskProps) {
  return (
    <Shimmer style={style}>
      <Shimmer.Mask
        background={<View style={styles.shimmerBase} />}
        overlay={
          reduceMotion ? null : (
            <Shimmer.Overlay
              overlayAngle={-8}
              progress={progress}
              trackAngle={8}
              width="58%"
            >
              <View style={styles.shimmerHighlight} />
            </Shimmer.Overlay>
          )
        }
      >
        <View>{children}</View>
      </Shimmer.Mask>
    </Shimmer>
  );
}

function SkeletonSection({
  cardHeight,
  titleWidth,
}: {
  cardHeight: number;
  titleWidth: number;
}) {
  return (
    <View style={styles.section}>
      <SkeletonShape style={[styles.sectionTitle, { width: titleWidth }]} />
      <SkeletonShape style={{ height: cardHeight }} />
    </View>
  );
}

function SkeletonShape({ style }: { style: StyleProp<ViewStyle> }) {
  return <View style={[styles.shape, style]} />;
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.background,
    overflow: "hidden",
    position: "relative",
  },
  heroAtmosphere: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    experimental_backgroundImage:
      "linear-gradient(180deg, #1d1d1d 0%, #181818 52%, #121212 100%)",
  },
  heroMask: {
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
  },
  cover: {
    borderRadius: theme.radius.lg + 8,
    height: 280,
    width: 210,
  },
  heroTitle: {
    height: 29,
    marginTop: theme.spacing.lg + theme.spacing.xs,
  },
  heroAction: {
    height: 50,
    marginTop: theme.spacing.md,
    width: "100%",
  },
  body: { paddingHorizontal: 20 },
  lowerGroup: { marginTop: 30 },
  sectionGroup: { gap: 30 },
  section: { gap: 12 },
  sectionTitle: { height: 21 },
  screenshotRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  shape: {
    backgroundColor: "#000000",
    borderCurve: "continuous",
    borderRadius: theme.radius.lg,
  },
  shimmerBase: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  shimmerHighlight: {
    flex: 1,
    experimental_backgroundImage:
      "linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.04) 24%, rgba(255, 255, 255, 0.14) 50%, rgba(255, 255, 255, 0.04) 76%, transparent 100%)",
  },
});
