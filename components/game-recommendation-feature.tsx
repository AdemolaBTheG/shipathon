import MaskedView from "@expo/ui/community/masked-view";
import { useQuery } from "@tanstack/react-query";
import { GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import { Text } from "@/components/Themed";
import { GameCoverPlaceholder } from "@/components/game-cover-placeholder";
import { colors, theme } from "@/constants/theme";
import { getGameRecommendations, type GameRecommendation } from "@/lib/igdb";
import { getIgdbImageUrl } from "@/lib/igdb-image";
import { rankGamesByPlatformPreferences } from "@/lib/platform-preferences";
import { useOnboarding } from "@/providers/onboarding-provider";

const RECOMMENDATION_COUNT = 12;

export type RecommendationSeed = {
  coverUrl: string | null;
  id: number;
  name: string;
};

type GameRecommendationFeatureProps = {
  excludedGameIds: ReadonlySet<number>;
  onAdd: (game: GameRecommendation) => void;
  savingGameId: number | null;
  seed: RecommendationSeed | null;
};

export function GameRecommendationFeature({
  excludedGameIds,
  onAdd,
  savingGameId,
  seed,
}: GameRecommendationFeatureProps) {
  const { state } = useOnboarding();
  const { width } = useWindowDimensions();
  const cardWidth = width - theme.spacing.lg * 2;
  const cardHeight = Math.round(cardWidth / 1.6);
  const recommendations = useQuery({
    enabled: Boolean(seed),
    gcTime: 24 * 60 * 60 * 1_000,
    queryFn: ({ signal }) =>
      getGameRecommendations(seed!.id, {
        limit: RECOMMENDATION_COUNT,
        signal,
      }),
    queryKey: ["games", "recommendations", seed?.id],
    staleTime: 6 * 60 * 60 * 1_000,
  });
  const game = rankGamesByPlatformPreferences(
    recommendations.data ?? [],
    state.selectedPlatformIds,
  ).find((candidate) => !excludedGameIds.has(candidate.id));
  const isPending = recommendations.isPending;

  if (!seed) return null;
  if (!isPending && !game) return null;

  return (
    <View style={styles.section}>
      <RecommendationHeading seed={seed} />

      {isPending ? (
        <View style={[styles.skeleton, { height: cardHeight }]} />
      ) : game ? (
        <RecommendationCard
          key={game.id}
          cardHeight={cardHeight}
          game={game}
          isSaving={savingGameId === game.id}
          isTracked={excludedGameIds.has(game.id)}
          onAdd={() => onAdd(game)}
        />
      ) : null}
    </View>
  );
}

function RecommendationHeading({ seed }: { seed: RecommendationSeed }) {
  const { t } = useTranslation();
  const seedCoverUrl = getIgdbImageUrl(seed.coverUrl, "cover_small_2x");

  return (
    <View style={styles.heading}>
      <View style={styles.seedCover}>
        {seedCoverUrl ? (
          <Image
            cachePolicy="memory-disk"
            contentFit="cover"
            source={seedCoverUrl}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <GameCoverPlaceholder
            gameName={seed.name}
            style={StyleSheet.absoluteFill}
          />
        )}
      </View>
      <View style={styles.headingCopy}>
        <Text style={styles.eyebrow}>{t("Because you liked")}</Text>
        <Text numberOfLines={1} style={styles.seedName}>
          {seed.name}
        </Text>
      </View>
    </View>
  );
}

function RecommendationCard({
  cardHeight,
  game,
  isSaving,
  isTracked,
  onAdd,
}: {
  cardHeight: number;
  game: GameRecommendation;
  isSaving: boolean;
  isTracked: boolean;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  const cardStyle = StyleSheet.flatten([styles.card, { height: cardHeight }]);
  const metadata = [game.genres[0], game.platforms[0]]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={styles.cardShell}>
      <Link
        asChild
        href={{ pathname: "/game/[id]", params: { id: String(game.id) } }}
      >
        <Link.Trigger>
          <Pressable accessibilityLabel={t("Open {{name}}", { name: game.name })}>
            <Link.AppleZoom>
              <View collapsable={false} style={cardStyle}>
                <RecommendationArtwork game={game} />
                <MaskedView
                  maskElement={<View style={styles.blurMask} />}
                  pointerEvents="none"
                  style={styles.blurMaskContainer}
                >
                  <RecommendationBlurredArtwork game={game} />
                </MaskedView>
                <View pointerEvents="none" style={styles.cardCopy}>
                  <Text numberOfLines={2} style={styles.gameTitle}>
                    {game.name}
                  </Text>
                  {metadata ? (
                    <Text numberOfLines={1} style={styles.metadata}>
                      {metadata}
                    </Text>
                  ) : null}
                </View>
              </View>
            </Link.AppleZoom>
          </Pressable>
        </Link.Trigger>
      </Link>

      <QuickAddButton
        gameName={game.name}
        isSaving={isSaving}
        isTracked={isTracked}
        onPress={onAdd}
      />
    </View>
  );
}

function RecommendationArtwork({ game }: { game: GameRecommendation }) {
  if (game.artworkUrl) {
    return (
      <Image
        cachePolicy="memory-disk"
        contentFit="cover"
        source={game.artworkUrl}
        style={StyleSheet.absoluteFill}
        transition={240}
      />
    );
  }

  const coverUrl = getIgdbImageUrl(game.coverUrl, "cover_big_2x");
  if (!coverUrl) {
    return (
      <View style={StyleSheet.absoluteFill}>
        <GameCoverPlaceholder
          gameName={game.name}
          style={StyleSheet.absoluteFill}
          variant="hero"
        />
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <Image
        blurRadius={60}
        contentFit="cover"
        source={coverUrl}
        style={[StyleSheet.absoluteFill, styles.fallbackBackdrop]}
      />
      <Image
        cachePolicy="memory-disk"
        contentFit="contain"
        source={coverUrl}
        style={styles.fallbackCover}
      />
    </View>
  );
}

function RecommendationBlurredArtwork({ game }: { game: GameRecommendation }) {
  const source =
    game.artworkUrl ?? getIgdbImageUrl(game.coverUrl, "cover_big_2x");

  if (!source) {
    return <View style={styles.blurFallback} />;
  }

  return (
    <Image
      blurRadius={60}
      cachePolicy="memory-disk"
      contentFit="cover"
      source={source}
      style={[StyleSheet.absoluteFill, styles.blurredArtwork]}
    />
  );
}

function QuickAddButton({
  gameName,
  isSaving,
  isTracked,
  onPress,
}: {
  gameName: string;
  isSaving: boolean;
  isTracked: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const isDisabled = isSaving || isTracked;
  const button = (
    <Pressable
      accessibilityLabel={
        isTracked
          ? t("{{name}} is in your backlog", { name: gameName })
          : t("Add {{name}}", { name: gameName })
      }
      accessibilityRole="button"
      accessibilityState={{ busy: isSaving, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      style={styles.addButtonContent}
    >
      {isSaving ? (
        <ActivityIndicator color={colors.text} size="small" />
      ) : isTracked ? (
        <>
          <SymbolView
            name={{ android: "check", ios: "checkmark" }}
            size={16}
            weight="semibold"
            tintColor={colors.text}
          />
          <Text style={styles.addButtonText}>{t("In backlog")}</Text>
        </>
      ) : (
        <>
          <SymbolView
            name={{ android: "add", ios: "plus" }}
            size={16}
            weight={"semibold"}
            tintColor={colors.text}
          />
          <Text style={styles.addButtonText}>{t("Add")}</Text>
        </>
      )}
    </Pressable>
  );

  if (process.env.EXPO_OS === "ios" && isGlassEffectAPIAvailable()) {
    return (
      <GlassView
        colorScheme="dark"
        glassEffectStyle={"clear"}
        isInteractive
        style={styles.addButton}
      >
        {button}
      </GlassView>
    );
  }

  return (
    <View style={[styles.addButton, styles.addButtonFallback]}>{button}</View>
  );
}

const styles = StyleSheet.create({
  addButton: {
    borderCurve: "continuous",
    borderRadius: theme.radius.pill,
    overflow: "hidden",
    position: "absolute",
    right: theme.spacing.md,
    top: theme.spacing.md,
    zIndex: 2,
  },
  addButtonContent: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    paddingVertical: theme.spacing.sm,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.md,
  },
  addButtonFallback: {
    backgroundColor: "rgba(0, 0, 0, 0.68)",
    borderColor: "rgba(255, 255, 255, 0.18)",
    borderWidth: StyleSheet.hairlineWidth,
  },
  addButtonText: {
    color: colors.text,
    fontSize: theme.size.md,
    fontWeight: "700",
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: "rgba(255, 255, 255, 0.2)",
    borderCurve: "continuous",
    borderRadius: theme.radius.lg,
    borderWidth: 0.5,
    overflow: "hidden",
  },
  cardCopy: {
    bottom: theme.spacing.md,
    left: theme.spacing.lg,
    position: "absolute",
    right: theme.spacing.lg,
  },
  blurMask: {
    experimental_backgroundImage:
      "linear-gradient(to bottom, transparent 34%, rgba(0, 0, 0, 0.42) 62%, black 100%)",
    flex: 1,
  },
  blurMaskContainer: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  blurredArtwork: {
    transform: [{ scale: 1.08 }],
  },
  blurFallback: {
    backgroundColor: "rgba(0, 0, 0, 0.46)",
    flex: 1,
  },
  cardShell: {
    position: "relative",
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: theme.size.sm,
    fontWeight: "600",
  },
  fallbackBackdrop: {
    opacity: 0.7,
    transform: [{ scale: 1.12 }],
  },
  fallbackCover: {
    height: "88%",
    left: "33%",
    position: "absolute",
    top: "6%",
    width: "34%",
  },
  gameTitle: {
    color: colors.text,
    fontSize: theme.size.lg,
    fontWeight: "700",
  },
  heading: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  headingCopy: {
    flex: 1,
  },
  matchLabel: {
    color: colors.success,
    fontSize: theme.size.tiny,
    fontWeight: "800",
    letterSpacing: 1.1,
    marginBottom: theme.spacing.xs,
  },
  metadata: {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: theme.size.sm,
    fontWeight: "600",
    marginTop: theme.spacing.xs,
  },
  section: {
    marginTop: theme.spacing.xl,
  },
  seedCover: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderCurve: "continuous",
    borderRadius: theme.radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    height: 52,
    overflow: "hidden",
    width: 36,
  },
  seedName: {
    color: colors.text,
    fontSize: theme.size.lg,
    fontWeight: "700",
    marginTop: 2,
  },
  skeleton: {
    backgroundColor: colors.surfaceMuted,
    borderCurve: "continuous",
    borderRadius: theme.radius.lg,
    width: "100%",
  },
});
