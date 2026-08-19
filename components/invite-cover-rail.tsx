import { Image } from "expo-image";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { colors, theme } from "@/constants/theme";

const COVER_RATIO = 1.5;
const COVER_OVERLAP = 8;
const RAIL_PADDING = 22;

// Temporary invite preview data until the shared-library query returns five covers.
const DUMMY_COVER_URLS = [
  "https://images.igdb.com/igdb/image/upload/t_cover_big/co1uii.jpg",
  "https://images.igdb.com/igdb/image/upload/t_cover_big/co1uje.jpg",
  "https://images.igdb.com/igdb/image/upload/t_cover_big/co2tw1.jpg",
  "https://images.igdb.com/igdb/image/upload/t_cover_big/co2tw0.jpg",
  "https://images.igdb.com/igdb/image/upload/t_cover_big/co3vzn.jpg",
] as const;

type InviteCoverRailProps = {
  completedByBoth?: number;
  coverUrls?: string[];
  gamesInCommon?: number;
  visibleGameCount?: number;
};

type RailCoverProps = {
  entrance: SharedValue<number>;
  height: number;
  index: number;
  url: string;
  width: number;
};

function RailCover({ entrance, height, index, url, width }: RailCoverProps) {
  const distanceFromCenter = Math.abs(index - 2);
  const inwardOffset =
    index < 2 ? 18 * (2 - index) : index > 2 ? -18 * (index - 2) : 0;
  const depthLift = distanceFromCenter * 10;
  const animatedStyle = useAnimatedStyle(() => {
    const progress = entrance.value;

    return {
      opacity: 0.72 + progress * 0.28,
      transform: [
        { translateX: inwardOffset * (1 - progress) },
        { translateY: -depthLift + (index === 2 ? 8 * (1 - progress) : 0) },
        { scale: index === 2 ? 0.94 + progress * 0.06 : 1 },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.coverFrame,
        {
          height,
          marginLeft: index === 0 ? 0 : -COVER_OVERLAP,
          width,
          zIndex: 3 - distanceFromCenter,
        },
        index === 2 ? styles.centerCoverFrame : styles.sideCoverFrame,
        animatedStyle,
      ]}
    >
      <Image
        contentFit="cover"
        source={url}
        style={styles.cover}
        transition={160}
      />
    </Animated.View>
  );
}

export function InviteCoverRail({
  completedByBoth = 3,
  coverUrls = [],
  gamesInCommon = 8,
  visibleGameCount = 0,
}: InviteCoverRailProps) {
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const entrance = useSharedValue(reduceMotion ? 1 : 0);
  const centerWidth = Math.min(96, screenWidth * 0.225);
  const neighborWidth = centerWidth * 0.88;
  const outerWidth = centerWidth * 0.78;
  const widths = [
    outerWidth,
    neighborWidth,
    centerWidth,
    neighborWidth,
    outerWidth,
  ];
  const covers =
    coverUrls.length >= 5 ? coverUrls.slice(0, 5) : [...DUMMY_COVER_URLS];

  useEffect(() => {
    if (reduceMotion) {
      entrance.value = 1;
      return;
    }

    entrance.value = withTiming(1, {
      duration: 300,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
    });
  }, [entrance, reduceMotion]);

  return (
    <View
      accessibilityLabel={`${t("{{count}} games in common", {
        count: gamesInCommon,
      })}, ${t("{{count}} completed by both", {
        count: completedByBoth,
      })}, ${t("from {{count}} visible games", { count: visibleGameCount })}`}
      style={styles.container}
    >
      <Text style={styles.commonCount}>
        {t("{{count}} games in common", { count: gamesInCommon })}
      </Text>

      <View style={[styles.viewport, { width: screenWidth }]}>
        <View style={[styles.coverRow, { width: screenWidth }]}>
          {covers.map((url, index) => (
            <RailCover
              entrance={entrance}
              height={widths[index] * COVER_RATIO}
              index={index}
              key={`${url}-${index}`}
              url={url}
              width={widths[index]}
            />
          ))}
        </View>
      </View>

      <Text style={styles.completedCount}>
        {t("{{count}} completed by both", { count: completedByBoth })}
      </Text>

      <Text style={styles.supportingCopy}>
        {t("Compare your progress, ratings, and backlog.")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginTop: theme.spacing.sm,
    width: "100%",
  },
  commonCount: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.35,
    marginBottom: theme.spacing.sm,
  },
  metricNumber: {
    color: colors.success,
    fontVariant: ["tabular-nums"],
  },
  viewport: {
    alignSelf: "center",
    overflow: "hidden",
  },
  coverRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: RAIL_PADDING,
    paddingTop: theme.spacing.md,
    position: "relative",
  },
  coverFrame: {
    backgroundColor: colors.surface,
    borderColor: "#fff",
    borderCurve: "continuous",
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  centerCoverFrame: {
    boxShadow: "0 14px 34px rgba(0, 0, 0, 0.52)",
  },
  sideCoverFrame: {
    boxShadow: "0 8px 22px rgba(0, 0, 0, 0.34)",
  },
  cover: {
    height: "100%",
    width: "100%",
  },
  completedCount: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: "600",
    marginTop: theme.spacing.sm,
  },
  completedNumber: {
    color: colors.success,
    fontVariant: ["tabular-nums"],
  },
  supportingCopy: {
    color: colors.textMuted,
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 24,
    marginTop: theme.spacing.md,
    maxWidth: 340,
    textAlign: "center",
  },
});
