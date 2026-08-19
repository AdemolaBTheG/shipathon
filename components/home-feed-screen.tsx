import { LegendList } from "@legendapp/list";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Link, useLocalSearchParams, useNavigation } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  type TextInputChangeEventData,
  useWindowDimensions,
  View,
} from "react-native";

import { Text } from "@/components/Themed";
import { GameCoverPlaceholder } from "@/components/game-cover-placeholder";
import { colors, theme } from "@/constants/theme";
import { useFriendsPlayingGames } from "@/hooks/use-friends-playing-games";
import { useQuickWinGames } from "@/hooks/use-quick-win-games";
import {
  HOME_FEED_CONFIG,
  isHomeFeedType,
  type HomeFeedType,
} from "@/lib/home-feed";
import { getUpcomingGames } from "@/lib/igdb";
import { getIgdbImageUrl } from "@/lib/igdb-image";
import {
  getPlatformPreferenceScore,
  rankGamesByPlatformPreferences,
} from "@/lib/platform-preferences";
import { useOnboarding } from "@/providers/onboarding-provider";
import type { TranslationKey } from "@/localization/resources";
import {
  createFilterAction,
  createFilterSubmenu,
  createHeaderFilterMenu,
} from "@/lib/header-filter-menu";
import { createHeaderRightOptions } from "@/lib/header-item-options";

const UPCOMING_GAME_COUNT = 20;

type FeedGridGame = {
  coverUrl: string | null;
  focusMatch: boolean;
  id: number;
  metadata: string;
  name: string;
  platforms: string[];
  searchText: string;
  signal: number | null;
};

type FeedFilter = "all" | "focused" | "my-platforms";
type FeedSort = "default" | "signal" | "title";

const FEED_FILTER_LABELS: Record<HomeFeedType, TranslationKey> = {
  upcoming: "Next 90 days",
  "friends-playing": "Multiple friends",
  "quick-wins": "Under 5 hours",
};

const FEED_SORT_LABELS: Record<HomeFeedType, TranslationKey> = {
  upcoming: "Release date",
  "friends-playing": "Most friends",
  "quick-wins": "Shortest first",
};

export function HomeFeedScreen() {
  const { i18n, t } = useTranslation();
  const { state } = useOnboarding();
  const params = useLocalSearchParams<{ type: string | string[] }>();
  const rawType = Array.isArray(params.type) ? params.type[0] : params.type;
  const feedType = isHomeFeedType(rawType) ? rawType : null;
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [sort, setSort] = useState<FeedSort>("default");
  const horizontalPadding = theme.spacing.md;
  const columnGap = 10;
  const coverWidth = Math.floor(
    (width - horizontalPadding * 2 - columnGap * 2) / 3,
  );
  const coverHeight = Math.round(coverWidth * 1.5);
  const upcomingGames = useQuery({
    enabled: feedType === "upcoming",
    gcTime: 24 * 60 * 60 * 1_000,
    queryFn: ({ signal }) =>
      getUpcomingGames({ limit: UPCOMING_GAME_COUNT, signal }),
    queryKey: ["games", "upcoming", UPCOMING_GAME_COUNT],
    staleTime: 6 * 60 * 60 * 1_000,
  });
  const friendsPlaying = useFriendsPlayingGames({
    enabled: feedType === "friends-playing",
    limit: 60,
  });
  const quickWins = useQuickWinGames({
    enabled: feedType === "quick-wins",
    limit: 60,
  });
  const games = useMemo(
    () =>
      rankGamesByPlatformPreferences(
        getFeedGames(
          feedType,
          upcomingGames.data,
          friendsPlaying.games,
          quickWins.games,
          i18n.resolvedLanguage ?? "en",
          t,
        ),
        state.selectedPlatformIds,
      ),
    [
      feedType,
      friendsPlaying.games,
      i18n.resolvedLanguage,
      quickWins.games,
      state.selectedPlatformIds,
      upcomingGames.data,
      t,
    ],
  );
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredGames = useMemo(() => {
    const nextGames = games.filter((game) => {
      const matchesQuery =
        !normalizedQuery || game.searchText.includes(normalizedQuery);
      const matchesFilter =
        filter === "all" ||
        (filter === "focused" && game.focusMatch) ||
        (filter === "my-platforms" &&
          getPlatformPreferenceScore(
            game.platforms,
            state.selectedPlatformIds,
          ) > 0);

      return matchesQuery && matchesFilter;
    });

    if (sort === "default") return nextGames;
    if (sort === "title") {
      return [...nextGames].sort((left, right) =>
        left.name.localeCompare(right.name),
      );
    }

    return [...nextGames].sort((left, right) => {
      if (left.signal === null) return 1;
      if (right.signal === null) return -1;
      return feedType === "friends-playing"
        ? right.signal - left.signal
        : left.signal - right.signal;
    });
  }, [feedType, filter, games, normalizedQuery, sort, state.selectedPlatformIds]);
  const config = feedType ? HOME_FEED_CONFIG[feedType] : null;
  const isLoading =
    (feedType === "upcoming" && upcomingGames.isPending) ||
    (feedType === "friends-playing" && friendsPlaying.isPending) ||
    (feedType === "quick-wins" && quickWins.isPending);
  const error =
    feedType === "upcoming"
      ? upcomingGames.error
      : feedType === "friends-playing"
        ? friendsPlaying.error
        : feedType === "quick-wins"
          ? quickWins.error
          : null;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: config ? t(config.title as TranslationKey) : t("Home"),
      ...createHeaderRightOptions(
        feedType
          ? () => [
            createHeaderFilterMenu({
              active: filter !== "all" || sort !== "default",
              items: [
                createFilterSubmenu({
                  items: [
                    createFilterAction({
                      label: t("All games"),
                      onPress: () => setFilter("all"),
                      selected: filter === "all",
                    }),
                    createFilterAction({
                      disabled: state.selectedPlatformIds.length === 0,
                      icon: { name: "gamecontroller", type: "sfSymbol" },
                      label: t("My platforms"),
                      onPress: () => setFilter("my-platforms"),
                      selected: filter === "my-platforms",
                    }),
                    createFilterAction({
                      label: t(FEED_FILTER_LABELS[feedType]),
                      onPress: () => setFilter("focused"),
                      selected: filter === "focused",
                    }),
                  ],
                  label: t("Show"),
                }),
                createFilterSubmenu({
                  items: [
                    createFilterAction({
                      label: t("Recommended order"),
                      onPress: () => setSort("default"),
                      selected: sort === "default",
                    }),
                    createFilterAction({
                      label: t(FEED_SORT_LABELS[feedType]),
                      onPress: () => setSort("signal"),
                      selected: sort === "signal",
                    }),
                    createFilterAction({
                      label: t("Title"),
                      onPress: () => setSort("title"),
                      selected: sort === "title",
                    }),
                  ],
                  label: t("Sort"),
                }),
              ],
              tintColor: colors.primary,
              title: t(
                HOME_FEED_CONFIG[feedType].title as TranslationKey,
              ),
            }),
            ]
          : undefined,
      ),
      headerSearchBarOptions: config
        ? {
            autoCapitalize: "none",
            hideWhenScrolling: false,
            placeholder: t(config.searchPlaceholder as TranslationKey),
            onCancelButtonPress: () => setQuery(""),
            onChangeText: (
              event: NativeSyntheticEvent<TextInputChangeEventData>,
            ) => setQuery(event.nativeEvent.text),
          }
        : undefined,
    });
  }, [
    config,
    feedType,
    filter,
    navigation,
    sort,
    state.selectedPlatformIds.length,
    t,
  ]);

  return (
    <LegendList
      columnWrapperStyle={{ gap: columnGap }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      data={filteredGames}
      extraData={coverWidth}
      keyExtractor={(game) => `${feedType ?? "invalid"}-${game.id}`}
      ListEmptyComponent={
        <FeedEmptyState
          error={error}
          feedType={feedType}
          isFiltered={filter !== "all"}
          isLoading={isLoading}
          isSearching={Boolean(normalizedQuery)}
          onRetry={() => {
            if (feedType === "upcoming") void upcomingGames.refetch();
            if (feedType === "friends-playing") {
              void friendsPlaying.refetch();
            }
            if (feedType === "quick-wins") void quickWins.refetch();
          }}
          t={t}
        />
      }
      numColumns={3}
      renderItem={({ item }) => (
        <FeedGameItem
          coverHeight={coverHeight}
          coverWidth={coverWidth}
          game={item}
        />
      )}
      style={styles.container}
    />
  );
}

function getFeedGames(
  feedType: HomeFeedType | null,
  upcomingGames: Awaited<ReturnType<typeof getUpcomingGames>> | undefined,
  friendsPlaying: ReturnType<typeof useFriendsPlayingGames>["games"],
  quickWins: ReturnType<typeof useQuickWinGames>["games"],
  locale: string,
  t: ReturnType<typeof useTranslation>["t"],
): FeedGridGame[] {
  if (feedType === "upcoming") {
    return (upcomingGames ?? []).map((game) => {
      const metadata = [
        formatReleaseDate(game.releaseDate, locale, t),
        game.platforms[0],
      ]
        .filter(Boolean)
        .join(" · ");

      return {
        coverUrl: getIgdbImageUrl(game.coverUrl, "cover_big_2x"),
        focusMatch: isWithinUpcomingWindow(game.releaseDate, 90),
        id: game.id,
        metadata,
        name: game.name,
        platforms: game.platforms,
        searchText: `${game.name} ${metadata}`.toLocaleLowerCase(),
        signal: game.releaseDate
          ? new Date(`${game.releaseDate}T12:00:00Z`).getTime()
          : null,
      };
    });
  }

  if (feedType === "friends-playing") {
    return friendsPlaying.map((game) => {
      const [friend] = game.friends;
      const metadata =
        game.friends.length === 1
          ? `${friend.displayName} · ${
              friend.progress === null
                ? t("Playing")
                : `${Math.round(friend.progress)}%`
            }`
          : t("{{count}} friends playing", {
              count: String(game.friends.length),
            });

      return {
        coverUrl: getIgdbImageUrl(game.coverUrl, "cover_big_2x"),
        focusMatch: game.friends.length > 1,
        id: game.gameId,
        metadata,
        name: game.gameName,
        platforms: game.platforms,
        searchText: `${game.gameName} ${metadata}`.toLocaleLowerCase(),
        signal: game.friends.length,
      };
    });
  }

  if (feedType === "quick-wins") {
    return quickWins.map((game) => {
      const metadata = `${t("{{hours}}h", {
        hours: String(game.mainStoryHours),
      })} · ${game.genre}`;

      return {
        coverUrl: getIgdbImageUrl(game.coverUrl, "cover_big_2x"),
        focusMatch: game.mainStoryHours <= 5,
        id: game.gameId,
        metadata,
        name: game.gameName,
        platforms: game.platforms,
        searchText:
          `${game.gameName} ${metadata} ${game.platform}`.toLocaleLowerCase(),
        signal: game.mainStoryHours,
      };
    });
  }

  return [];
}

function isWithinUpcomingWindow(value: string | null, days: number) {
  if (!value) return false;

  const releaseDate = new Date(`${value}T12:00:00Z`).getTime();
  const now = Date.now();
  return releaseDate >= now && releaseDate <= now + days * 24 * 60 * 60 * 1_000;
}

function formatReleaseDate(
  value: string | null,
  locale: string,
  t: ReturnType<typeof useTranslation>["t"],
) {
  if (!value) return t("Date TBA");

  const date = new Date(`${value}T12:00:00Z`);
  const includeYear = date.getUTCFullYear() !== new Date().getFullYear();

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    ...(includeYear ? { year: "numeric" } : {}),
  }).format(date);
}

function FeedGameItem({
  coverHeight,
  coverWidth,
  game,
}: {
  coverHeight: number;
  coverWidth: number;
  game: FeedGridGame;
}) {
  const { t } = useTranslation();
  const coverStyle = StyleSheet.flatten([
    styles.cover,
    { height: coverHeight, width: coverWidth },
  ]);

  return (
    <Link
      asChild
      href={{ pathname: "/game/[id]", params: { id: String(game.id) } }}
    >
      <Link.Trigger>
        <Pressable
          accessibilityLabel={t("Open {{name}}", { name: game.name })}
          accessibilityRole="link"
          style={({ pressed }) => [
            styles.gameItem,
            { width: coverWidth },
            pressed && styles.gameItemPressed,
          ]}
        >
          <Link.AppleZoom>
            <View collapsable={false} style={coverStyle}>
              {game.coverUrl ? (
                <Image
                  cachePolicy="memory-disk"
                  contentFit="cover"
                  source={game.coverUrl}
                  style={StyleSheet.absoluteFill}
                  transition={180}
                />
              ) : (
                <GameCoverPlaceholder
                  gameName={game.name}
                  style={StyleSheet.absoluteFill}
                />
              )}
            </View>
          </Link.AppleZoom>
          <Text numberOfLines={2} style={styles.gameTitle}>
            {game.name}
          </Text>
          <Text numberOfLines={1} style={styles.metadata}>
            {game.metadata}
          </Text>
        </Pressable>
      </Link.Trigger>
    </Link>
  );
}

function FeedEmptyState({
  error,
  feedType,
  isLoading,
  isFiltered,
  isSearching,
  onRetry,
  t,
}: {
  error: Error | null;
  feedType: HomeFeedType | null;
  isLoading: boolean;
  isFiltered: boolean;
  isSearching: boolean;
  onRetry: () => void;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  if (isLoading) {
    return (
      <View style={styles.emptyState}>
        <ActivityIndicator color={colors.text} size="large" />
        <Text style={styles.emptyText}>{t("Loading games…")}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.emptyState}>
        <SymbolView
          name={{ android: "cloud_off", ios: "wifi.exclamationmark" }}
          size={44}
          tintColor={colors.textMuted}
        />
        <Text style={styles.emptyTitle}>{t("Couldn’t load games")}</Text>
        <Pressable onPress={onRetry} style={styles.retryButton}>
          <Text style={styles.retryLabel}>{t("Try again")}</Text>
        </Pressable>
      </View>
    );
  }

  const title = !feedType
    ? t("Feed unavailable")
    : isSearching || isFiltered
      ? t("No matching games")
      : t("Nothing here yet");
  const description = !feedType
    ? t("Return Home and choose another section.")
    : isSearching || isFiltered
      ? isSearching
        ? t("Try searching with a different title.")
        : t("Try another filter to see more games.")
      : feedType === "friends-playing"
        ? t("Games appear here when friends share what they are currently playing.")
        : feedType === "quick-wins"
          ? t("Add shorter games to Want to Play and they will appear here when playtime data is available.")
          : t("Check back when more games are available.");

  return (
    <View style={styles.emptyState}>
      <SymbolView
        name={{ android: "search_off", ios: "magnifyingglass" }}
        size={44}
        tintColor={colors.textMuted}
      />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
  },
  cover: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderCurve: "continuous",
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  emptyState: {
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: 96,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: theme.size.md,
    textAlign: "center",
  },
  emptyTitle: {
    color: colors.text,
    fontSize: theme.size.xl,
    fontWeight: "700",
    paddingTop: theme.spacing.xs,
  },
  gameItem: {
    paddingBottom: theme.spacing.lg,
  },
  gameItemPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
  gameTitle: {
    color: colors.text,
    fontSize: theme.size.md,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: theme.spacing.sm,
  },
  metadata: {
    color: colors.textMuted,
    fontSize: theme.size.sm,
    marginTop: theme.spacing.xs,
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderCurve: "continuous",
    borderRadius: theme.radius.pill,
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 12,
  },
  retryLabel: {
    color: colors.background,
    fontSize: theme.size.md,
    fontWeight: "700",
  },
});
