import MaskedView from "@expo/ui/community/masked-view";
import { useQuery } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import { useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { PressableScale } from "pressto";
import { memo, useCallback, useState } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import {
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import type { SharedValue } from "react-native-reanimated";
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedProps,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import {
  BadgeMedallion,
  getBadgeAtmosphereColor,
} from "@/components/badge-medallion";
import { BadgePageIndicator } from "@/components/badge-page-indicator";
import { colors, theme } from "@/constants/theme";
import { getBadges } from "@/db/badges";
import type { BadgeProgress } from "@/lib/badges";
import type { TranslationKey } from "@/localization/resources";

const EMPTY_BADGES: BadgeProgress[] = [];
const MEDALLION_SIZE = 210;
const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);
export default function BadgeDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const badgesQuery = useQuery({
    queryFn: getBadges,
    queryKey: ["badges"],
  });
  const badges = badgesQuery.data ?? EMPTY_BADGES;
  const initialIndex = Math.max(
    0,
    badges.findIndex((badge) => badge.id === id),
  );

  if (badgesQuery.isLoading) {
    return <View style={styles.container} />;
  }

  if (badges.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>{t("Badges unavailable")}</Text>
        <Text style={styles.emptyCopy}>
          {badgesQuery.error instanceof Error
            ? badgesQuery.error.message
            : t("Your badge collection could not be loaded.")}
        </Text>
      </View>
    );
  }

  return (
    <BadgeCarousel badges={badges} initialIndex={initialIndex} width={width} />
  );
}

function BadgeCarousel({
  badges,
  initialIndex,
  width,
}: {
  badges: BadgeProgress[];
  initialIndex: number;
  width: number;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const itemWidth = Math.min(220, width * 0.5);
  const copyWidth = Math.min(360, width - theme.spacing.lg * 2);
  const sidePadding = (width - itemWidth) / 2;
  const scrollX = useSharedValue(initialIndex * itemWidth);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const activeBadge = badges[activeIndex] ?? badges[0];
  const activeTitle = t(activeBadge.title as TranslationKey);
  const handleScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.set(event.contentOffset.x);
    },
  });
  const backgroundInputRange = badges.map((_, index) => index * itemWidth);
  const backgroundOutputRange = badges.map((badge) => {
    const highestMilestone = badge.milestones
      .filter((milestone) => milestone.unlocked)
      .at(-1);

    return getBadgeAtmosphereColor({
      locked: !highestMilestone,
      tier: highestMilestone?.tier ?? badge.milestones[0].tier,
    });
  });
  const backgroundStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      scrollX.get(),
      backgroundInputRange,
      backgroundOutputRange,
      "RGB",
    ),
  }));
  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.max(
        0,
        Math.min(
          badges.length - 1,
          Math.round(event.nativeEvent.contentOffset.x / itemWidth),
        ),
      );
      setActiveIndex(index);
    },
    [badges.length, itemWidth],
  );
  const handleShare = async () => {
    const target =
      activeBadge.nextMilestone?.target ??
      activeBadge.milestones.at(-1)?.target ??
      1;
    const current = Math.min(activeBadge.current, target);

    await Share.share({
      message: t("My {{title}} badge progress on Joylogue: {{current}} / {{target}}.", {
        current: String(current),
        target: String(target),
        title: activeTitle,
      }),
    });
  };

  return (
    <View style={styles.container}>
      <MaskedView
        maskElement={<View style={styles.badgeAtmosphereMask} />}
        pointerEvents="none"
        style={styles.badgeAtmosphere}
      >
        <Animated.View style={[StyleSheet.absoluteFill, backgroundStyle]} />
      </MaskedView>
      <Animated.ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 104 + insets.bottom },
        ]}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <BadgePageIndicator current={activeIndex + 1} total={badges.length} />

        <Animated.ScrollView
          contentContainerStyle={{ paddingHorizontal: sidePadding }}
          contentOffset={{ x: initialIndex * itemWidth, y: 0 }}
          decelerationRate="fast"
          disableIntervalMomentum
          horizontal
          onMomentumScrollEnd={handleMomentumScrollEnd}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator={false}
          snapToAlignment="start"
          snapToInterval={itemWidth}
          style={[styles.carousel, { width }]}
        >
          {badges.map((badge, index) => (
            <BadgeCarouselItem
              badge={badge}
              copyWidth={copyWidth}
              index={index}
              itemWidth={itemWidth}
              key={badge.id}
              scrollX={scrollX}
            />
          ))}
        </Animated.ScrollView>
      </Animated.ScrollView>

      <View
        pointerEvents="box-none"
        style={[
          styles.shareFooter,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        <PressableScale
          accessibilityLabel={t("Share {{title}} badge", { title: activeTitle })}
          accessibilityRole="button"
          onPress={handleShare}
          style={styles.shareButton}
        >
          <SymbolView
            name={{ android: "share", ios: "square.and.arrow.up" }}
            size={22}
            tintColor={colors.background}
          />
          <Text style={styles.shareButtonText}>{t("Share badge")}</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const BadgeCarouselItem = memo(function BadgeCarouselItem({
  badge,
  copyWidth,
  index,
  itemWidth,
  scrollX,
}: {
  badge: BadgeProgress;
  copyWidth: number;
  index: number;
  itemWidth: number;
  scrollX: SharedValue<number>;
}) {
  const { t } = useTranslation();
  const title = t(badge.title as TranslationKey);
  const highestMilestone = badge.milestones
    .filter((milestone) => milestone.unlocked)
    .at(-1);
  const locked = !highestMilestone;
  const tier = highestMilestone?.tier ?? badge.milestones[0].tier;
  const inputRange = [
    (index - 1) * itemWidth,
    index * itemWidth,
    (index + 1) * itemWidth,
  ];
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollX.get(),
      inputRange,
      [0.68, 1, 0.68],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          scrollX.get(),
          inputRange,
          [0.76, 1, 0.76],
          Extrapolation.CLAMP,
        ),
      },
      {
        translateY: interpolate(
          scrollX.get(),
          inputRange,
          [18, 0, 18],
          Extrapolation.CLAMP,
        ),
      },
    ],
    zIndex: Math.round(
      interpolate(scrollX.get(), inputRange, [0, 10, 0], Extrapolation.CLAMP),
    ),
  }));
  const copyAnimatedStyle = useAnimatedStyle(() => {
    const proximity = interpolate(
      scrollX.get(),
      inputRange,
      [0, 1, 0],
      Extrapolation.CLAMP,
    );

    return {
      opacity: proximity * proximity,
      transform: [
        {
          translateY: interpolate(
            scrollX.get(),
            inputRange,
            [4, 0, 4],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });
  const progressWidth = Math.min(300, copyWidth);
  const badgeProgress = badge.progress;
  const progressTarget =
    badge.nextMilestone?.target ?? badge.milestones.at(-1)?.target ?? 1;
  const progressValue = `${Math.min(badge.current, progressTarget)} / ${progressTarget}`;
  const progressFillAnimatedStyle = useAnimatedStyle(() => {
    const proximity = interpolate(
      scrollX.get(),
      inputRange,
      [0, 1, 0],
      Extrapolation.CLAMP,
    );

    return {
      width: progressWidth * badgeProgress * proximity,
    };
  });
  const blurProps = useAnimatedProps(() => ({
    intensity: interpolate(
      scrollX.get(),
      inputRange,
      [16, 0, 16],
      Extrapolation.CLAMP,
    ),
  }));
  return (
    <View style={[styles.carouselItem, { width: itemWidth }]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.itemTitleBlock, { width: copyWidth }, copyAnimatedStyle]}
      >
        <Text numberOfLines={2} style={styles.itemTitle}>
          {title}
        </Text>
      </Animated.View>

      <Animated.View style={[styles.medallionStage, animatedStyle]}>
        <View style={styles.medallionGlow} />
        <BadgeMedallion
          accessibilityLabel={t("{{title}}, {{state}}", {
            state: locked ? t("locked") : t("unlocked"),
            title,
          })}
          locked={locked}
          size={MEDALLION_SIZE}
          symbol={badge.symbol}
          tier={tier}
        />
        {process.env.EXPO_OS === "ios" ? (
          <AnimatedBlurView
            animatedProps={blurProps}
            intensity={0}
            pointerEvents="none"
            style={styles.badgeBlur}
            tint="systemUltraThinMaterialDark"
          />
        ) : null}
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.itemProgressBlock,
          { width: progressWidth },
          copyAnimatedStyle,
        ]}
      >
        <View style={styles.progressHeader}>
          <Text style={styles.progressValue}>{progressValue}</Text>
        </View>
        <View
          accessibilityLabel={t("{{title}}, {{percentage}} percent complete", {
            percentage: String(Math.round(badge.progress * 100)),
            title,
          })}
          accessibilityRole="progressbar"
          accessibilityValue={{
            max: 100,
            min: 0,
            now: Math.round(badge.progress * 100),
          }}
          style={styles.progressTrack}
        >
          <Animated.View
            style={[styles.progressFill, progressFillAnimatedStyle]}
          />
        </View>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.itemDescriptionBlock,
          { width: copyWidth },
          copyAnimatedStyle,
        ]}
      >
        <Text numberOfLines={2} style={styles.itemDescription}>
          {t(badge.description as TranslationKey)}
        </Text>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  badgeAtmosphere: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  badgeAtmosphereMask: {
    experimental_backgroundImage:
      "linear-gradient(to bottom, black 0%, black 44%, rgba(0,0,0,0.78) 60%, transparent 84%)",
    flex: 1,
  },
  badgeBlur: {
    bottom: 8,
    left: 8,
    position: "absolute",
    right: 8,
    top: 8,
  },
  carousel: { alignSelf: "center", flexGrow: 0, overflow: "visible" },
  carouselItem: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  container: { backgroundColor: colors.background, flex: 1 },
  content: { paddingBottom: 36, paddingHorizontal: theme.spacing.lg },
  emptyContainer: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  emptyCopy: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
    marginTop: theme.spacing.sm,
    textAlign: "center",
  },
  emptyTitle: { color: colors.text, fontSize: 22, fontWeight: "800" },
  medallionGlow: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    boxShadow: "0 20px 60px rgba(255, 255, 255, 0.08)",
    height: 168,
    position: "absolute",
    width: 168,
  },
  medallionStage: {
    alignItems: "center",
    height: 240,
    justifyContent: "center",
    overflow: "visible",
    width: MEDALLION_SIZE + 24,
  },
  itemDescription: {
    color: colors.textMuted,
    fontSize: theme.size.lg,
    textAlign: "center",
  },
  itemDescriptionBlock: {
    alignItems: "center",
    height: 48,
    justifyContent: "flex-start",
  },
  itemProgressBlock: {
    gap: theme.spacing.sm,
    height: 48,
    justifyContent: "center",
  },
  itemTitle: {
    color: colors.text,
    fontSize: theme.size["2xl"],
    fontWeight: "700",
    textAlign: "center",
  },
  itemTitleBlock: {
    alignItems: "center",
    height: 58,
    justifyContent: "center",
    marginTop: theme.spacing.md,
  },
  progressFill: {
    backgroundColor: colors.primary,
    borderRadius: theme.radius.pill,
    height: "100%",
  },
  progressHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  progressLabel: {
    color: colors.text,
    fontSize: theme.size.md,
    fontWeight: "700",
  },
  progressTrack: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: theme.radius.pill,
    height: 6,
    overflow: "hidden",
    width: "100%",
  },
  progressValue: {
    color: colors.textMuted,
    fontSize: theme.size.sm,
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
  },
  shareButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderCurve: "continuous",
    borderRadius: theme.radius.pill,
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    justifyContent: "center",
  },
  shareButtonText: {
    color: colors.background,
    fontSize: theme.size.lg,
    fontWeight: "700",
  },
  shareFooter: {
    bottom: 0,
    left: 0,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    position: "absolute",
    right: 0,
  },
  scroll: { backgroundColor: "transparent", flex: 1 },
  swipeHint: {
    color: colors.textMuted,
    fontSize: 13,
    paddingTop: theme.spacing.xl,
    textAlign: "center",
  },
});
