import { GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";
import { Image } from "expo-image";
import { Link } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import { Text } from "@/components/Themed";
import { useTranslation } from "react-i18next";
import { GameCoverPlaceholder } from "@/components/game-cover-placeholder";
import { HomeRailHeading } from "@/components/home-rail-heading";
import { colors, theme } from "@/constants/theme";
import {
  type QuickWinGame,
  useQuickWinGames,
} from "@/hooks/use-quick-win-games";
import { getHomeRailCoverMetrics } from "@/lib/home-rail-layout";
import { getIgdbImageUrl } from "@/lib/igdb-image";

export function QuickWinsRail() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const { games, isPending } = useQuickWinGames({ limit: 12 });
  const { height: coverHeight, width: cardWidth } =
    getHomeRailCoverMetrics(width);

  if (isPending) {
    return (
      <View style={styles.section}>
        <HomeRailHeading
          feed="quick-wins"
          subtitle={t("Games you could finish this weekend")}
          title={t("Quick wins")}
        />
        <ActivityIndicator color={colors.textMuted} style={styles.loader} />
      </View>
    );
  }

  if (!games.length) return null;

  return (
    <View style={styles.section}>
      <HomeRailHeading
        feed="quick-wins"
        subtitle={t("Games you could finish this weekend")}
        title={t("Quick wins")}
      />

      <FlatList
        contentContainerStyle={styles.railContent}
        data={games}
        horizontal
        ItemSeparatorComponent={RailSeparator}
        keyExtractor={(game) => String(game.gameId)}
        renderItem={({ item }) => (
          <QuickWinCard
            cardWidth={cardWidth}
            coverHeight={coverHeight}
            game={item}
          />
        )}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
}

function RailSeparator() {
  return <View style={styles.separator} />;
}

function QuickWinCard({
  cardWidth,
  coverHeight,
  game,
}: {
  cardWidth: number;
  coverHeight: number;
  game: QuickWinGame;
}) {
  const coverStyle = StyleSheet.flatten([
    styles.cover,
    { height: coverHeight, width: cardWidth },
  ]);

  return (
    <Link
      asChild
      href={{ pathname: "/game/[id]", params: { id: String(game.gameId) } }}
    >
      <Link.Trigger>
        <Pressable
          accessibilityLabel={`Open ${game.gameName}`}
          style={{ width: cardWidth }}
        >
          <Link.AppleZoom>
            <View collapsable={false} style={coverStyle}>
              {game.coverUrl ? (
                <Image
                  cachePolicy="memory-disk"
                  contentFit="cover"
                  source={getIgdbImageUrl(game.coverUrl, "cover_big_2x")}
                  style={StyleSheet.absoluteFill}
                  transition={180}
                />
              ) : (
                <GameCoverPlaceholder
                  gameName={game.gameName}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <DurationBadge hours={game.mainStoryHours} />
            </View>
          </Link.AppleZoom>

          <Text numberOfLines={2} style={styles.gameTitle}>
            {game.gameName}
          </Text>
          <Text numberOfLines={2} style={styles.metadata}>
            {game.genre} · {game.platform}
          </Text>
        </Pressable>
      </Link.Trigger>
    </Link>
  );
}

function DurationBadge({ hours }: { hours: number }) {
  const { t } = useTranslation();
  const content = (
    <Text numberOfLines={1} style={styles.duration}>
      {t("{{count}}h", { count: hours })}
    </Text>
  );

  if (process.env.EXPO_OS === "ios" && isGlassEffectAPIAvailable()) {
    return (
      <GlassView
        colorScheme="dark"
        glassEffectStyle="regular"
        style={styles.durationBadge}
      >
        {content}
      </GlassView>
    );
  }

  return (
    <View style={[styles.durationBadge, styles.durationBadgeFallback]}>
      {content}
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
  duration: {
    color: colors.text,
    fontSize: theme.size.sm,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  durationBadge: {
    borderCurve: "continuous",
    borderRadius: theme.radius.pill,
    bottom: theme.spacing.sm,
    left: theme.spacing.sm,
    overflow: "hidden",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    position: "absolute",
  },
  durationBadgeFallback: {
    backgroundColor: "rgba(0, 0, 0, 0.68)",
    borderColor: "rgba(255, 255, 255, 0.16)",
    borderWidth: StyleSheet.hairlineWidth,
  },
  gameTitle: {
    color: colors.text,
    fontSize: theme.size.md,
    fontWeight: "700",
    marginTop: theme.spacing.xs,
  },
  metadata: {
    color: colors.textMuted,
    fontSize: theme.size.sm,
    lineHeight: 17,
    marginTop: theme.spacing.xs,
  },
  loader: {
    height: 120,
  },
  railContent: {
    paddingHorizontal: theme.spacing.md,
  },
  section: {
    marginHorizontal: -theme.spacing.md,
    marginTop: theme.spacing.xl,
  },
  separator: {
    width: theme.spacing.md,
  },
});
