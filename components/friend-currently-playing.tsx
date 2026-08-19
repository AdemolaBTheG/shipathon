import { GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { SymbolView } from "expo-symbols";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import { GameCoverPlaceholder } from "@/components/game-cover-placeholder";
import { colors, theme } from "@/constants/theme";
import { formatRating } from "@/lib/rating";
import type { FriendPlayingGame } from "@/services/sharing";

type FriendCurrentlyPlayingProps = {
  friendId: string;
  games: FriendPlayingGame[];
};

export function FriendCurrentlyPlaying({
  friendId,
  games,
}: FriendCurrentlyPlayingProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  if (games.length === 0) return null;

  const featured = games.length === 1;
  const cardWidth = featured
    ? width - theme.spacing.lg * 2
    : Math.min(156, Math.max(132, (width - theme.spacing.lg * 2 - 15) / 2.25));

  return (
    <View style={styles.section}>
      <Link
        asChild
        href={{ pathname: "/friend/[id]/playing", params: { id: friendId } }}
      >
        <Pressable
          accessibilityLabel={t("Show all currently playing games")}
          accessibilityRole="button"
          style={styles.headingRow}
        >
          <Text style={styles.heading}>{t("Currently playing")}</Text>
          <SymbolView
            name="chevron.right"
            size={18}
            tintColor={colors.textMuted}
          />
        </Pressable>
      </Link>
      <ScrollView
        contentContainerStyle={styles.rail}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {games.map((game) => (
          <FriendPlayingGameCard
            featured={featured}
            game={game}
            key={game.igdbId}
            width={cardWidth}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export function FriendPlayingGameCard({
  featured,
  game,
  width,
}: {
  featured: boolean;
  game: FriendPlayingGame;
  width: number;
}) {
  const { t } = useTranslation();
  const progress = game.progressCurrent / game.progressTotal;
  const percentage = Math.round(progress * 100);
  const coverWidth = featured ? 112 : width;
  const coverHeight = coverWidth * 1.5;
  const coverStyle = StyleSheet.flatten([
    styles.cover,
    { height: coverHeight, width: coverWidth },
  ]);
  const cardStyle = StyleSheet.flatten([
    styles.card,
    featured && styles.featuredCard,
    { width },
  ]);

  return (
    <Link
      asChild
      href={{ pathname: "/game/[id]", params: { id: String(game.igdbId) } }}
    >
      <Pressable
        accessibilityLabel={t("{{name}}, {{percentage}}% complete{{rating}}", {
          name: game.name,
          percentage: String(percentage),
          rating:
            game.rating === null
              ? ""
              : t(", rated {{rating}} out of 5", {
                  rating: String(formatRating(game.rating)),
                }),
        })}
        accessibilityRole="button"
        style={cardStyle}
      >
        <Link.AppleZoom>
          <View collapsable={false} style={coverStyle}>
            {game.coverUrl ? (
              <Image
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
            {game.rating !== null ? <CoverRating rating={game.rating} /> : null}
          </View>
        </Link.AppleZoom>

        <View style={[styles.copy, featured && styles.featuredCopy]}>
          <Text numberOfLines={2} style={styles.title}>
            {game.name}
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${percentage}%` }]} />
          </View>
          <View style={styles.metadata}>
            <Text style={styles.percentage}>{percentage}%</Text>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

function CoverRating({ rating }: { rating: number }) {
  const content = (
    <>
      <SymbolView
        name="star.fill"
        size={12}
        style={styles.ratingSymbol}
        tintColor="#fff"
      />
      <Text style={styles.ratingText}>{formatRating(rating)}</Text>
    </>
  );

  if (process.env.EXPO_OS === "ios" && isGlassEffectAPIAvailable()) {
    return (
      <GlassView
        colorScheme="dark"
        glassEffectStyle="regular"
        style={styles.coverRating}
      >
        {content}
      </GlassView>
    );
  }

  return (
    <View style={[styles.coverRating, styles.coverRatingFallback]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: theme.spacing.md,
    paddingTop: theme.spacing.xl,
  },
  heading: {
    color: colors.text,
    fontSize: theme.size.lg + 2,
    fontWeight: "600",
  },
  headingRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
  },
  rail: {
    gap: 12,
    paddingHorizontal: theme.spacing.lg,
  },
  card: {
    gap: theme.spacing.sm,
  },
  featuredCard: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md,
  },
  cover: {
    backgroundColor: colors.surface,
    borderColor: "rgba(255, 255, 255, 0.16)",
    borderCurve: "continuous",
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    boxShadow: "0 12px 28px rgba(0, 0, 0, 0.32)",
    overflow: "hidden",
  },
  copy: {
    gap: 4,
  },
  featuredCopy: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: theme.size.md,
    fontWeight: "600",
    lineHeight: 18,
  },
  metadata: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  percentage: {
    color: colors.textMuted,
    fontSize: theme.size.sm,
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
    marginLeft: "auto",
  },
  coverRating: {
    alignItems: "center",
    borderRadius: theme.radius.pill,
    bottom: theme.spacing.sm,
    flexDirection: "row",
    gap: 4,
    height: 28,
    left: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    position: "absolute",
  },
  coverRatingFallback: {
    backgroundColor: "rgba(10, 10, 10, 0.72)",
    borderColor: "rgba(255, 255, 255, 0.16)",
    borderWidth: StyleSheet.hairlineWidth,
  },
  ratingSymbol: {
    backgroundColor: "transparent",
  },
  ratingText: {
    color: colors.textMuted,
    fontSize: theme.size.sm,
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
  },
  progressTrack: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: theme.radius.pill,
    height: 3,
    overflow: "hidden",
  },
  progressFill: {
    backgroundColor: "#fff",
    borderRadius: theme.radius.pill,
    height: "100%",
  },
});
