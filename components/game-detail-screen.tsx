import { Galeria } from "@nandorojo/galeria";
import { useQuery } from "@tanstack/react-query";
import * as Burnt from "burnt";
import { Image } from "expo-image";
import {
  Link,
  router,
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
  usePreventZoomTransitionDismissal,
} from "expo-router";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import * as WebBrowser from "expo-web-browser";
import { PressableOpacity, PressableScale } from "pressto";
import { usePostHog } from "posthog-react-native";
import { type ReactNode, useCallback, useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  LinearTransition,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GameCoverPlaceholder } from "@/components/game-cover-placeholder";
import { GameCoverShine } from "@/components/game-cover-shine";
import { GameDetailSkeleton } from "@/components/game-detail-skeleton";
import { GameProgressCard } from "@/components/game-progress-card";
import { GameTrailerPlayer } from "@/components/game-trailer-player";
import { RatingStar } from "@/components/rating-star";
import { StatusMenu } from "@/components/status-menu";
import { Text } from "@/components/Themed";
import { WebsiteIcon, type WebsiteIconName } from "@/components/website-icon";
import { colors, theme } from "@/constants/theme";
import {
  getBacklog,
  saveGameToBacklog,
  updateBacklogStatus,
} from "@/db/repository";
import type { BacklogStatus } from "@/db/schema";
import { useCoverDrift } from "@/hooks/use-cover-drift";
import { createHeaderRightOptions } from "@/lib/header-item-options";
import type { GameWebsite } from "@/lib/igdb";
import { getGame } from "@/lib/igdb";
import { getIgdbImageUrl } from "@/lib/igdb-image";
import { formatRating, getRatingStarState } from "@/lib/rating";

type SymbolName = NonNullable<SymbolViewProps["name"]>;

const detailSymbols: Record<
  "release" | "developer" | "publisher" | "platforms" | "genres" | "gameModes",
  SymbolName
> = {
  release: { ios: "calendar", android: "calendar_month" },
  developer: { ios: "hammer.fill", android: "build" },
  publisher: { ios: "building.2.fill", android: "business" },
  platforms: { ios: "gamecontroller.fill", android: "sports_esports" },
  genres: { ios: "square.grid.2x2.fill", android: "category" },
  gameModes: { ios: "person.2.fill", android: "groups" },
};

type WebsitePresentation = {
  icon: WebsiteIconName;
  label: string;
  priority: number;
};

const websitePresentations: Record<string, WebsitePresentation> = {
  official: {
    icon: "official",
    label: "Official website",
    priority: 0,
  },
  steam: {
    icon: "steam",
    label: "Steam",
    priority: 1,
  },
  iphone: {
    icon: "app-store",
    label: "App Store",
    priority: 2,
  },
  ipad: {
    icon: "app-store",
    label: "App Store",
    priority: 2,
  },
  android: {
    icon: "google-play",
    label: "Google Play",
    priority: 3,
  },
  epicgames: {
    icon: "epic-games",
    label: "Epic Games Store",
    priority: 4,
  },
  xbox: {
    icon: "xbox",
    label: "Xbox",
    priority: 4,
  },
  playstation: {
    icon: "playstation",
    label: "PlayStation",
    priority: 4,
  },
  nintendo: {
    icon: "nintendo",
    label: "Nintendo",
    priority: 4,
  },
  gog: {
    icon: "gog",
    label: "GOG",
    priority: 5,
  },
  itch: {
    icon: "itch",
    label: "itch.io",
    priority: 6,
  },
  gamejolt: {
    icon: "game-jolt",
    label: "Game Jolt",
    priority: 6,
  },
  youtube: {
    icon: "youtube",
    label: "YouTube",
    priority: 7,
  },
  twitch: {
    icon: "twitch",
    label: "Twitch",
    priority: 8,
  },
  discord: {
    icon: "discord",
    label: "Discord",
    priority: 9,
  },
  meta: {
    icon: "meta",
    label: "Meta",
    priority: 9,
  },
  reddit: {
    icon: "reddit",
    label: "Reddit",
    priority: 10,
  },
  instagram: {
    icon: "instagram",
    label: "Instagram",
    priority: 11,
  },
  twitter: {
    icon: "x",
    label: "X",
    priority: 12,
  },
  bluesky: {
    icon: "bluesky",
    label: "Bluesky",
    priority: 13,
  },
  facebook: {
    icon: "facebook",
    label: "Facebook",
    priority: 14,
  },
  wikipedia: {
    icon: "wikipedia",
    label: "Wikipedia",
    priority: 15,
  },
  wikia: {
    icon: "community-wiki",
    label: "Community wiki",
    priority: 16,
  },
};

const fallbackWebsitePresentation: WebsitePresentation = {
  icon: "generic",
  label: "Website",
  priority: 99,
};

const websiteTypeAliases: Record<string, string> = {
  officialwebsite: "official",
  communitywiki: "wikia",
  appstoreiphone: "iphone",
  appstoreipad: "ipad",
  googleplay: "android",
  subreddit: "reddit",
  epic: "epicgames",
};

const MIN_HERO_HEIGHT = 470;
const MAX_HERO_HEIGHT = 580;

function PreventZoomDismissal() {
  usePreventZoomTransitionDismissal();
  return null;
}

function ConditionalAppleZoomTarget({
  children,
  enabled,
}: {
  children: ReactNode;
  enabled: boolean;
}) {
  return enabled ? (
    <Link.AppleZoomTarget>{children}</Link.AppleZoomTarget>
  ) : (
    children
  );
}

type GameDetailScreenProps = {
  zoomTarget?: boolean;
};

export default function GameDetailScreen({
  zoomTarget = true,
}: GameDetailScreenProps) {
  const { i18n, t } = useTranslation();
  const posthog = usePostHog();
  const { id, sourceUrl } = useLocalSearchParams<{
    id: string;
    sourceUrl?: string;
  }>();
  const gameId = Number(id);
  const isValidGameId = Number.isInteger(gameId) && gameId > 0;
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scrollY = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const { tiltX, tiltY } = useCoverDrift(reduceMotion);
  const screenshotWidth = Math.min(300, Math.max(240, width * 0.72));
  const screenshotHeight = Math.round(screenshotWidth * (9 / 16));
  const heroHeight = Math.min(
    MAX_HERO_HEIGHT,
    Math.max(MIN_HERO_HEIGHT, width * 1.2),
  );
  const {
    data: game,
    error: gameRequestError,
    isLoading,
  } = useQuery({
    queryKey: ["games", "detail", "websites-v1", gameId],
    queryFn: ({ signal }) => getGame(gameId, { signal }),
    enabled: isValidGameId,
    staleTime: 6 * 60 * 60 * 1_000,
    gcTime: 24 * 60 * 60 * 1_000,
  });
  const highQualityCoverUrl = getIgdbImageUrl(game?.coverUrl, "cover_big_2x");
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [backlogStatus, setBacklogStatus] =
    useState<BacklogStatus>("want-to-play");
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(100);
  const [rating, setRating] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [expandedDescriptionId, setExpandedDescriptionId] = useState<
    number | null
  >(null);
  const [descriptionMeasurement, setDescriptionMeasurement] = useState({
    gameId: 0,
    lineCount: 0,
  });
  const isDescriptionExpanded = expandedDescriptionId === game?.id;
  const descriptionLineCount =
    descriptionMeasurement.gameId === game?.id
      ? descriptionMeasurement.lineCount
      : 0;
  const handleScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const coverParallaxStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 550 },
      {
        translateY:
          interpolate(
            scrollY.value,
            [-200, 400],
            [18, 24],
            Extrapolation.CLAMP,
          ) +
          tiltY.value * 4,
      },
      {
        translateX: tiltX.value * 6,
      },
      {
        rotateX: `${tiltY.value * -5.5}deg`,
      },
      {
        rotateY: `${tiltX.value * 7.5}deg`,
      },
      {
        scale: interpolate(
          scrollY.value,
          [-200, 0],
          [1.06, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
    ...(reduceMotion ? { transform: [{ translateY: 0 }, { scale: 1 }] } : {}),
  }));

  const heroBackdropStyle = useAnimatedStyle(() => {
    const translateY = reduceMotion
      ? 0
      : interpolate(
          scrollY.value,
          [-160, 0, heroHeight],
          [-18, 0, 42],
          Extrapolation.CLAMP,
        );
    const scale = reduceMotion
      ? 1.06
      : interpolate(
          scrollY.value,
          [-180, 0, heroHeight],
          [1.14, 1.08, 1.01],
          Extrapolation.CLAMP,
        );
    const opacity = interpolate(
      scrollY.value,
      [-40, 0, heroHeight * 0.7],
      [1, 1, 0.76],
      Extrapolation.CLAMP,
    );

    return {
      opacity,
      transform: [{ translateY }, { scale }],
    };
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      title: game?.name ?? t("Game"),
      ...createHeaderRightOptions(
        game && isSaved
          ? () => [
              {
                type: "button",
                label: t("Rate"),
                icon: {
                  type: "sfSymbol",
                  name: rating !== null ? "star.fill" : "star",
                },
                tintColor: colors.primary,
                accessibilityLabel: t("Rate {{name}}", { name: game.name }),
                accessibilityHint: t("Opens the game rating control"),
                onPress: () =>
                  router.push({
                    pathname: "/rating",
                    params: { id: String(game.id) },
                  }),
              },
            ]
          : undefined,
      ),
    });
  }, [game, isSaved, navigation, rating, t]);

  useFocusEffect(
    useCallback(() => {
      if (!game) return;

      let active = true;
      void getBacklog()
        .then((backlog) => {
          if (!active) return;

          const savedItem = backlog.find((item) => item.igdbId === game.id);
          setIsSaved(Boolean(savedItem));
          if (!savedItem) {
            setBacklogStatus("want-to-play");
            setProgressCurrent(0);
            setProgressTotal(100);
            setRating(null);
            setStartedAt(null);
            return;
          }

          setBacklogStatus(savedItem.backlog.status);
          setProgressCurrent(savedItem.backlog.progressCurrent);
          setProgressTotal(savedItem.backlog.progressTotal);
          setRating(savedItem.backlog.rating);
          setStartedAt(savedItem.backlog.startedAt);
        })
        .catch(() => {
          // The existing detail data remains usable if a focus refresh fails.
        });

      return () => {
        active = false;
      };
    }, [game]),
  );

  async function saveGame(status: BacklogStatus, showToast: boolean) {
    if (!game || isSaved || isSaving) return;

    setIsSaving(true);
    try {
      await saveGameToBacklog(game, {
        status,
        ...(sourceUrl ? { sourceUrl } : {}),
      });
      setIsSaved(true);
      setBacklogStatus(status);
      posthog.capture("game_saved", {
        game_id: game.id,
        status,
        source: sourceUrl ? "link_resolution" : "game_detail",
      });
      if (showToast) {
        Burnt.toast({ title: t("Added to backlog") });
      }
      return true;
    } catch (saveError) {
      Burnt.toast({
        title:
          saveError instanceof Error
            ? saveError.message
            : t("Unable to add game"),
        preset: "error",
      });
    } finally {
      setIsSaving(false);
    }

    return false;
  }

  async function handleSave() {
    await saveGame("want-to-play", true);
  }

  async function handleStatusChange(status: BacklogStatus) {
    if (!game || status === backlogStatus) return;

    try {
      const updatedItem = await updateBacklogStatus(game.id, status);
      posthog.capture("backlog_status_changed", {
        game_id: game.id,
        status,
      });
      setBacklogStatus(status);
      if (updatedItem) {
        setProgressCurrent(updatedItem.progressCurrent);
        setProgressTotal(updatedItem.progressTotal);
        setStartedAt(updatedItem.startedAt);
      }
    } catch (statusError) {
      Burnt.toast({
        title:
          statusError instanceof Error
            ? statusError.message
            : t("Unable to update status"),
        preset: "error",
      });
    }
  }

  function handleOpenProgress() {
    if (!game) return;

    router.push({
      pathname: "/progress",
      params: { id: String(game.id) },
    });
  }

  return (
    <Animated.ScrollView
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + theme.spacing.xl * 2 },
      ]}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      style={styles.container}
    >
      {zoomTarget ? <PreventZoomDismissal /> : null}
      {isLoading && isValidGameId ? (
        <GameDetailSkeleton
          heroHeight={heroHeight}
          topInset={insets.top}
          width={width}
        />
      ) : null}
      {!isValidGameId ? (
        <Text style={[styles.error, styles.feedbackState]}>
          {t("Invalid game")}
        </Text>
      ) : null}
      {!game && gameRequestError ? (
        <Text style={[styles.error, styles.feedbackState]}>
          {gameRequestError instanceof Error
            ? gameRequestError.message
            : t("Unable to load game")}
        </Text>
      ) : null}

      {game ? (
        <>
          <View style={[styles.heroSection, { minHeight: heroHeight }]}>
            {game.coverUrl ? (
              <Animated.View
                pointerEvents="none"
                style={[styles.heroBackdrop, heroBackdropStyle]}
              >
                <Image
                  blurRadius={40}
                  cachePolicy="memory-disk"
                  contentFit="cover"
                  source={game.coverUrl}
                  style={styles.heroBackdropImage}
                  transition={180}
                />
              </Animated.View>
            ) : null}
            <View pointerEvents="none" style={styles.heroTone} />
            <View pointerEvents="none" style={styles.heroAtmosphere} />
            <View pointerEvents="none" style={styles.heroFade} />
            <View
              style={[
                styles.heroContent,
                {
                  minHeight: heroHeight,
                  paddingBottom: theme.spacing.xl + theme.spacing.sm,
                  paddingTop: insets.top + 72,
                },
              ]}
            >
              {highQualityCoverUrl ? (
                <ConditionalAppleZoomTarget enabled={zoomTarget}>
                  <Animated.View
                    style={[styles.coverDepth, coverParallaxStyle]}
                  >
                    <View style={styles.coverFrame}>
                      <Galeria urls={[highQualityCoverUrl]} theme="dark">
                        <Galeria.Image style={styles.cover}>
                          <Image
                            cachePolicy="memory-disk"
                            source={highQualityCoverUrl}
                            contentFit="cover"
                            style={styles.cover}
                          />
                        </Galeria.Image>
                      </Galeria>
                      <GameCoverShine
                        disabled={reduceMotion}
                        height={280}
                        tiltX={tiltX}
                        tiltY={tiltY}
                        width={210}
                      />
                    </View>
                  </Animated.View>
                </ConditionalAppleZoomTarget>
              ) : (
                <ConditionalAppleZoomTarget enabled={zoomTarget}>
                  <Animated.View
                    style={[styles.coverDepth, coverParallaxStyle]}
                  >
                    <View style={styles.coverFrame}>
                      <GameCoverPlaceholder
                        gameName={game.name}
                        showTitle
                        style={styles.cover}
                        variant="hero"
                      />
                    </View>
                  </Animated.View>
                </ConditionalAppleZoomTarget>
              )}
              {rating !== null ? (
                <View
                  accessibilityLabel={t("{{rating}} out of 5 stars", {
                    rating: formatRating(rating),
                  })}
                  style={styles.ratingBadge}
                >
                  {[1, 2, 3, 4, 5].map((star) => (
                    <RatingStar
                      key={star}
                      size={22}
                      filledColor="rgba(255, 255, 255, 0.8)"
                      state={getRatingStarState(star, rating)}
                    />
                  ))}
                </View>
              ) : null}
              <Text style={styles.title}>{game.name}</Text>
              <View style={styles.heroActions}>
                {isSaved ? (
                  <StatusMenu
                    onChange={handleStatusChange}
                    status={backlogStatus}
                  />
                ) : (
                  <PressableScale
                    accessibilityRole="button"
                    disabled={isSaving}
                    onPress={handleSave}
                    style={styles.saveButton}
                  >
                    {isSaving ? (
                      <ActivityIndicator color={colors.background} />
                    ) : (
                      <Text style={styles.saveButtonText}>
                        {t("Save to backlog")}
                      </Text>
                    )}
                  </PressableScale>
                )}
              </View>
            </View>
          </View>

          <View style={styles.bodyContent}>
            {isSaved ? (
              <View style={styles.progressSection}>
                <View style={styles.progressSectionHeader}>
                  <Text
                    style={[styles.sectionTitle, styles.progressSectionTitle]}
                  >
                    {t("Progress")}
                  </Text>
                  <PressableScale
                    accessibilityHint={t("Opens the progress control")}
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={handleOpenProgress}
                    style={styles.progressUpdateButton}
                  >
                    <Text style={styles.progressUpdate}>{t("Update")}</Text>
                  </PressableScale>
                </View>
                <GameProgressCard
                  current={progressCurrent}
                  onPress={handleOpenProgress}
                  startedAt={startedAt}
                  total={progressTotal}
                />
              </View>
            ) : null}

            {game.estimatedPlaytime ? (
              <View style={styles.playtimeSection}>
                <Text style={styles.sectionTitle}>
                  {t("Estimated playtime")}
                </Text>
                <View style={styles.playtimeCard}>
                  {game.estimatedPlaytime.mainStorySeconds ? (
                    <PlaytimeRow
                      label={t("Main story")}
                      seconds={game.estimatedPlaytime.mainStorySeconds}
                    />
                  ) : null}
                  {game.estimatedPlaytime.mainPlusExtrasSeconds ? (
                    <PlaytimeRow
                      label={t("Main + extras")}
                      seconds={game.estimatedPlaytime.mainPlusExtrasSeconds}
                    />
                  ) : null}
                  {game.estimatedPlaytime.completionistSeconds ? (
                    <PlaytimeRow
                      label={t("Completionist")}
                      seconds={game.estimatedPlaytime.completionistSeconds}
                    />
                  ) : null}
                </View>
              </View>
            ) : null}

            {game.releaseDate ||
            game.developers?.length ||
            game.publishers?.length ||
            game.platforms.length ||
            game.genres.length ||
            game.gameModes.length ? (
              <View style={styles.detailsSection}>
                <Text style={styles.sectionTitle}>{t("Details")}</Text>
                <View style={styles.detailsCard}>
                  {game.releaseDate ? (
                    <DetailRow
                      icon={detailSymbols.release}
                      label={t("Release date")}
                      value={formatReleaseDate(
                        game.releaseDate,
                        i18n.resolvedLanguage,
                      )}
                    />
                  ) : null}
                  {game.developers?.length ? (
                    <DetailRow
                      icon={detailSymbols.developer}
                      label={
                        game.developers.length > 1
                          ? t("Developers")
                          : t("Developer")
                      }
                      value={game.developers.join(", ")}
                    />
                  ) : null}
                  {game.publishers?.length ? (
                    <DetailRow
                      icon={detailSymbols.publisher}
                      label={
                        game.publishers.length > 1
                          ? t("Publishers")
                          : t("Publisher")
                      }
                      value={game.publishers.join(", ")}
                    />
                  ) : null}
                  {game.platforms.length ? (
                    <DetailRow
                      icon={detailSymbols.platforms}
                      label={t("Platforms")}
                      value={game.platforms.join(", ")}
                    />
                  ) : null}
                  {game.genres.length ? (
                    <DetailRow
                      icon={detailSymbols.genres}
                      label={t("Genres")}
                      value={game.genres.join(", ")}
                    />
                  ) : null}
                  {game.gameModes.length ? (
                    <DetailRow
                      icon={detailSymbols.gameModes}
                      label={t("Game modes")}
                      value={game.gameModes.join(", ")}
                    />
                  ) : null}
                </View>
              </View>
            ) : null}
            {game.websites?.length ? (
              <View style={styles.linksSection}>
                <Text style={styles.sectionTitle}>{t("Links")}</Text>
                <View style={styles.linksCard}>
                  {[...game.websites]
                    .sort(
                      (left, right) =>
                        getWebsitePresentation(left).priority -
                        getWebsitePresentation(right).priority,
                    )
                    .map((website, index, websites) => (
                      <WebsiteRow
                        isLast={index === websites.length - 1}
                        key={`${website.type}-${website.url}`}
                        website={website}
                      />
                    ))}
                </View>
              </View>
            ) : null}
            {game.summary ? (
              <View style={styles.descriptionSection}>
                <Text style={styles.sectionTitle}>{t("Description")}</Text>
                <Animated.View
                  layout={
                    reduceMotion
                      ? undefined
                      : LinearTransition.damping(22).stiffness(220)
                  }
                  style={styles.descriptionCard}
                >
                  <Text
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    onTextLayout={(event) => {
                      const nextLineCount = event.nativeEvent.lines.length;
                      setDescriptionMeasurement((currentMeasurement) => {
                        if (
                          currentMeasurement.gameId === game.id &&
                          currentMeasurement.lineCount === nextLineCount
                        ) {
                          return currentMeasurement;
                        }

                        return {
                          gameId: game.id,
                          lineCount: nextLineCount,
                        };
                      });
                    }}
                    pointerEvents="none"
                    style={[styles.summary, styles.descriptionMeasurement]}
                  >
                    {game.summary}
                  </Text>
                  <Text
                    numberOfLines={isDescriptionExpanded ? undefined : 5}
                    style={styles.summary}
                  >
                    {game.summary}
                  </Text>
                  {descriptionLineCount > 5 ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isDescriptionExpanded }}
                      onPress={() =>
                        setExpandedDescriptionId((currentGameId) =>
                          currentGameId === game.id ? null : game.id,
                        )
                      }
                      style={styles.descriptionToggle}
                    >
                      <Text style={styles.descriptionToggleText}>
                        {isDescriptionExpanded
                          ? t("Read less")
                          : t("Read more")}
                      </Text>
                    </Pressable>
                  ) : null}
                </Animated.View>
              </View>
            ) : null}
            {game.screenshots?.length ? (
              <View style={styles.mediaSection}>
                <Text style={styles.sectionTitle}>{t("Screenshots")}</Text>
                <ScrollView
                  contentContainerStyle={styles.screenshotRail}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.screenshotScroller}
                >
                  <Galeria urls={game.screenshots} theme="dark">
                    {game.screenshots.map((screenshot, index) => (
                      <Galeria.Image index={index} key={screenshot}>
                        <Image
                          source={screenshot}
                          contentFit="cover"
                          style={[
                            styles.screenshot,
                            {
                              height: screenshotHeight,
                              width: screenshotWidth,
                            },
                          ]}
                        />
                      </Galeria.Image>
                    ))}
                  </Galeria>
                </ScrollView>
              </View>
            ) : null}
            {game.trailerVideoId ? (
              <View style={styles.mediaSection}>
                <Text style={styles.sectionTitle}>{t("Trailer")}</Text>
                <GameTrailerPlayer
                  height={Math.round((width - 40) * (9 / 16))}
                  videoId={game.trailerVideoId}
                  width={width - 40}
                  style={styles.trailerPlayer}
                />
              </View>
            ) : null}
          </View>
        </>
      ) : null}
    </Animated.ScrollView>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: SymbolName;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <SymbolView
        name={icon}
        size={22}
        style={styles.detailIcon}
        tintColor={colors.textMuted}
      />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function WebsiteRow({
  isLast,
  website,
}: {
  isLast: boolean;
  website: GameWebsite;
}) {
  const { t } = useTranslation();
  const presentation = getWebsitePresentation(website);
  const label = getLocalizedWebsiteLabel(presentation.label, t);
  const host = getWebsiteHost(website.url);

  async function openWebsite() {
    try {
      await WebBrowser.openBrowserAsync(website.url, {
        controlsColor: colors.primary,
        dismissButtonStyle: "close",
        enableBarCollapsing: true,
        toolbarColor: colors.background,
      });
    } catch {
      Burnt.toast({ preset: "error", title: t("Unable to open link") });
    }
  }

  return (
    <PressableOpacity
      accessibilityHint={t("Opens {{host}} in the browser", { host })}
      accessibilityLabel={label}
      accessibilityRole="link"
      onPress={openWebsite}
      style={[styles.websiteRow, !isLast && styles.websiteRowBorder]}
    >
      <WebsiteIcon color={colors.primary} name={presentation.icon} size={22} />
      <View style={styles.websiteText}>
        <Text numberOfLines={1} style={styles.websiteLabel}>
          {label}
        </Text>
        <Text numberOfLines={1} style={styles.websiteHost}>
          {host}
        </Text>
      </View>
      <SymbolView
        name={{ ios: "arrow.up.right", android: "open_in_new" }}
        size={16}
        tintColor={colors.textMuted}
      />
    </PressableOpacity>
  );
}

function getWebsitePresentation(website: GameWebsite) {
  const normalizedType = website.type
    .toLowerCase()
    .replaceAll(/[^a-z0-9]/g, "");
  const presentationKey = websiteTypeAliases[normalizedType] ?? normalizedType;
  return websitePresentations[presentationKey] ?? fallbackWebsitePresentation;
}

function getLocalizedWebsiteLabel(
  label: string,
  t: ReturnType<typeof useTranslation>["t"],
) {
  if (label === "Official website") return t("Official website");
  if (label === "Community wiki") return t("Community wiki");
  if (label === "Website") return t("Website");
  return label;
}

function getWebsiteHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function PlaytimeRow({ label, seconds }: { label: string; seconds: number }) {
  return (
    <View style={styles.playtimeRow}>
      <Text style={styles.playtimeLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.playtimeLeader}>
        ................................................................
      </Text>
      <Text style={styles.playtimeValue}>{formatPlaytime(seconds)}</Text>
    </View>
  );
}

function formatPlaytime(seconds: number) {
  if (seconds < 3_600) return `${Math.max(1, Math.round(seconds / 60))}m`;
  return `${Math.max(1, Math.round(seconds / 3_600))}h`;
}

function formatReleaseDate(value: string, locale?: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  content: { backgroundColor: colors.background },
  feedbackState: {
    marginTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.md,
  },
  heroSection: {
    overflow: "hidden",
    position: "relative",
  },
  heroBackdrop: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  heroBackdropImage: {
    flex: 1,
    width: "100%",
  },
  heroTone: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    backgroundColor: "rgba(0, 0, 0, 0.28)",
  },
  heroAtmosphere: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    experimental_backgroundImage:
      "linear-gradient(180deg, rgba(6, 6, 6, 0.12) 0%, rgba(6, 6, 6, 0.4) 42%, rgba(6, 6, 6, 0.7) 100%)",
  },
  heroFade: {
    bottom: 0,
    height: 190,
    left: 0,
    position: "absolute",
    right: 0,
    experimental_backgroundImage:
      "linear-gradient(180deg, rgba(18, 18, 18, 0) 0%, rgba(18, 18, 18, 0.3) 58%, rgba(18, 18, 18, 0.78) 82%, #121212 100%)",
  },
  heroContent: {
    justifyContent: "flex-end",
    paddingHorizontal: 20,
  },
  bodyContent: {
    paddingHorizontal: 20,
  },
  coverDepth: {
    alignSelf: "center",
    borderCurve: "continuous",
    borderRadius: theme.radius.lg,
    boxShadow: "0 12px 24px rgba(0, 0, 0, 0.28)",
    height: 280,
    width: 210,
  },
  coverFrame: {
    borderCurve: "continuous",
    borderRadius: theme.radius.lg + 8,
    flex: 1,
    overflow: "hidden",
    borderColor: "rgba(255, 255, 255, 0.2)",
    borderWidth: 1,
  },
  cover: { height: 280, width: 210 },
  ratingBadge: {
    alignItems: "center",
    alignSelf: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xl + theme.spacing.xs,
  },
  heroActions: {
    alignItems: "center",
    marginTop: theme.spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: theme.size["2xl"],
    fontWeight: "700",
    marginTop: theme.spacing.lg + theme.spacing.xs,
    textAlign: "center",
  },
  mediaSection: { marginTop: theme.spacing.lg },
  screenshotScroller: { marginHorizontal: -theme.spacing.md },
  screenshotRail: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  screenshot: { borderRadius: theme.radius.md },
  trailerPlayer: {
    borderRadius: theme.radius.lg,
    overflow: "hidden",
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: theme.radius.pill,
    justifyContent: "center",
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    width: "100%",
  },
  saveButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "700",
  },
  detailsSection: { marginTop: 30 },
  linksSection: { marginTop: 30 },
  linksCard: {
    backgroundColor: colors.surface,
    borderCurve: "continuous",
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    paddingHorizontal: theme.spacing.md,
  },
  websiteRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  websiteRowBorder: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  websiteText: { flex: 1, minWidth: 0 },
  websiteLabel: {
    color: colors.text,
    fontSize: theme.size.md,
    fontWeight: "600",
  },
  websiteHost: {
    color: colors.textMuted,
    fontSize: theme.size.sm,
    marginTop: 2,
  },
  playtimeSection: { marginTop: 30 },
  playtimeCard: {
    backgroundColor: colors.surface,
    borderCurve: "continuous",
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  playtimeRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
    minHeight: 38,
  },
  playtimeLabel: {
    color: colors.text,
    fontSize: theme.size.md,
    fontWeight: "500",
  },
  playtimeLeader: {
    color: colors.textMuted,
    flex: 1,
    fontSize: theme.size.sm,
    letterSpacing: 1,
    lineHeight: 16,
    overflow: "hidden",
  },
  playtimeValue: {
    color: colors.text,
    fontSize: theme.size.lg,
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
  },
  progressSection: { marginTop: 30 },
  progressSectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  progressSectionTitle: { marginBottom: 0 },
  progressUpdateButton: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: theme.radius.sm + 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  progressUpdate: {
    color: "#FFFFFF",
    fontSize: theme.size.md,
    fontWeight: "600",
  },
  detailsCard: {
    backgroundColor: colors.surface,
    borderCurve: "continuous",
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  detailRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    paddingVertical: 12,
  },
  detailIcon: { marginTop: 1 },
  detailLabel: {
    color: colors.textMuted,
    fontSize: theme.size.md,
    fontWeight: "500",
    flexShrink: 0,
    lineHeight: 20,
    width: 88,
  },
  detailValue: {
    color: colors.text,
    flex: 1,
    flexShrink: 1,
    fontSize: theme.size.md,
    fontWeight: "600",
    lineHeight: 20,
    minWidth: 0,
    textAlign: "right",
  },
  descriptionSection: { marginTop: 30 },
  sectionTitle: {
    color: colors.text,
    fontSize: theme.size.lg + 2,
    fontWeight: "600",
    marginBottom: 12,
  },
  descriptionCard: {
    backgroundColor: colors.surface,
    borderRadius: theme.radius.lg,
    borderCurve: "continuous",
    padding: theme.spacing.md,
  },
  summary: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
  },
  descriptionMeasurement: {
    left: theme.spacing.md,
    opacity: 0,
    position: "absolute",
    right: theme.spacing.md,
  },
  descriptionToggle: { marginTop: 12 },
  descriptionToggleText: {
    color: colors.primary,
    fontSize: theme.size.md,
    fontWeight: "600",
  },
  error: { color: colors.danger, marginTop: 20 },
});
