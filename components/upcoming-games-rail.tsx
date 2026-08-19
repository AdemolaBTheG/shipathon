import { useQuery } from "@tanstack/react-query";
import { GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  FlatList,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import { Text } from "@/components/Themed";
import { GameCoverPlaceholder } from "@/components/game-cover-placeholder";
import { HomeRailHeading } from "@/components/home-rail-heading";
import { colors, theme } from "@/constants/theme";
import { getHomeRailCoverMetrics } from "@/lib/home-rail-layout";
import type { GameSearchResult } from "@/lib/igdb";
import { getUpcomingGames } from "@/lib/igdb";
import { getIgdbImageUrl } from "@/lib/igdb-image";
import { rankGamesByPlatformPreferences } from "@/lib/platform-preferences";
import { useOnboarding } from "@/providers/onboarding-provider";

const UPCOMING_GAME_COUNT = 12;
const skeletonItems = [0, 1, 2, 3];

function formatReleaseDate(value: string, language: string) {
  const date = new Date(`${value}T12:00:00Z`);
  const includeYear = date.getUTCFullYear() !== new Date().getFullYear();

  return new Intl.DateTimeFormat(language, {
    day: "numeric",
    month: "short",
    ...(includeYear ? { year: "numeric" } : {}),
  }).format(date);
}

export function UpcomingGamesRail() {
  const { t } = useTranslation();
  const { state } = useOnboarding();
  const { width } = useWindowDimensions();
  const { height: coverHeight, width: cardWidth } =
    getHomeRailCoverMetrics(width);
  const upcomingGames = useQuery({
    gcTime: 24 * 60 * 60 * 1_000,
    queryFn: ({ signal }) =>
      getUpcomingGames({ limit: UPCOMING_GAME_COUNT, signal }),
    queryKey: ["games", "upcoming", UPCOMING_GAME_COUNT],
    staleTime: 6 * 60 * 60 * 1_000,
  });
  const rankedGames = useMemo(
    () =>
      rankGamesByPlatformPreferences(
        upcomingGames.data ?? [],
        state.selectedPlatformIds,
      ),
    [state.selectedPlatformIds, upcomingGames.data],
  );

  if (!upcomingGames.isPending && !upcomingGames.data?.length) return null;

  return (
    <View style={styles.section}>
      <HomeRailHeading
        feed="upcoming"
        subtitle={t("Games worth keeping on your radar")}
        title={t("Coming Soon")}
      />

      {upcomingGames.isPending ? (
        <FlatList
          contentContainerStyle={styles.railContent}
          data={skeletonItems}
          horizontal
          ItemSeparatorComponent={RailSeparator}
          keyExtractor={(item) => String(item)}
          renderItem={() => (
            <UpcomingGameSkeleton
              cardWidth={cardWidth}
              coverHeight={coverHeight}
            />
          )}
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
        />
      ) : (
        <FlatList
          contentContainerStyle={styles.railContent}
          data={rankedGames}
          horizontal
          ItemSeparatorComponent={RailSeparator}
          keyExtractor={(game) => String(game.id)}
          renderItem={({ item }) => (
            <UpcomingGameCard
              cardWidth={cardWidth}
              coverHeight={coverHeight}
              game={item}
            />
          )}
          showsHorizontalScrollIndicator={false}
        />
      )}
    </View>
  );
}

function RailSeparator() {
  return <View style={styles.separator} />;
}

function UpcomingGameCard({
  cardWidth,
  coverHeight,
  game,
}: {
  cardWidth: number;
  coverHeight: number;
  game: GameSearchResult;
}) {
  const { t } = useTranslation();
  const coverUrl = getIgdbImageUrl(game.coverUrl, "cover_big_2x");
  const coverStyle = StyleSheet.flatten([
    styles.cover,
    { height: coverHeight, width: cardWidth },
  ]);

  return (
    <Link
      asChild
      href={{ pathname: "/game/[id]", params: { id: String(game.id) } }}
    >
      <Link.Trigger>
        <Pressable
          accessibilityLabel={t("Open {{name}}", { name: game.name })}
        >
          <Link.AppleZoom>
            <View collapsable={false} style={coverStyle}>
              {coverUrl ? (
                <Image
                  cachePolicy="memory-disk"
                  contentFit="cover"
                  source={coverUrl}
                  style={StyleSheet.absoluteFill}
                  transition={180}
                />
              ) : (
                <GameCoverPlaceholder
                  gameName={game.name}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <ReleaseDateBadge value={game.releaseDate} />
            </View>
          </Link.AppleZoom>
          <Text
            numberOfLines={2}
            style={[styles.gameTitle, { width: cardWidth }]}
          >
            {game.name}
          </Text>
        </Pressable>
      </Link.Trigger>
    </Link>
  );
}

function ReleaseDateBadge({ value }: { value: string | null }) {
  const { i18n, t } = useTranslation();
  const content = (
    <Text numberOfLines={1} style={styles.releaseDate}>
      {value ? formatReleaseDate(value, i18n.language) : t("Date TBA")}
    </Text>
  );

  if (process.env.EXPO_OS === "ios" && isGlassEffectAPIAvailable()) {
    return (
      <GlassView
        colorScheme="dark"
        glassEffectStyle="regular"
        style={styles.releaseBadge}
      >
        {content}
      </GlassView>
    );
  }

  return (
    <View style={[styles.releaseBadge, styles.releaseBadgeFallback]}>
      {content}
    </View>
  );
}

function UpcomingGameSkeleton({
  cardWidth,
  coverHeight,
}: {
  cardWidth: number;
  coverHeight: number;
}) {
  return (
    <View style={{ width: cardWidth }}>
      <View
        style={[
          styles.skeletonCover,
          { height: coverHeight, width: cardWidth },
        ]}
      />
      <View style={styles.skeletonTitle} />
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderCurve: "continuous",
    borderRadius: theme.radius.md + 2,
    borderWidth: 0.5,
    overflow: "hidden",
  },
  gameTitle: {
    color: colors.text,
    fontSize: theme.size.md,
    fontWeight: "700",
    marginTop: theme.spacing.xs,
  },
  railContent: {
    paddingHorizontal: theme.spacing.md,
  },
  releaseDate: {
    color: colors.text,
    fontSize: theme.size.tiny,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  releaseBadge: {
    borderCurve: "continuous",
    borderRadius: theme.radius.pill,
    bottom: theme.spacing.sm,
    left: theme.spacing.sm,
    overflow: "hidden",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    position: "absolute",
  },
  releaseBadgeFallback: {
    backgroundColor: "rgba(0, 0, 0, 0.68)",
    borderColor: "rgba(255, 255, 255, 0.16)",
    borderWidth: StyleSheet.hairlineWidth,
  },
  section: {
    marginHorizontal: -theme.spacing.md,
  },
  separator: {
    width: theme.spacing.md,
  },
  skeletonCover: {
    backgroundColor: colors.surfaceMuted,
    borderCurve: "continuous",
    borderRadius: theme.radius.md,
  },
  skeletonTitle: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: theme.radius.pill,
    height: 12,
    marginTop: theme.spacing.md,
    width: "86%",
  },
});
