import { useQuery } from "@tanstack/react-query";
import * as Burnt from "burnt";
import { Image } from "expo-image";
import { Link, router, useLocalSearchParams } from "expo-router";
import { PressableScale } from "pressto";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Presets } from "react-native-pulsar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GameCoverPlaceholder } from "@/components/game-cover-placeholder";
import { OnboardingProgress } from "@/components/onboarding-progress";
import { RatingScrubber } from "@/components/rating-scrubber";
import { colors, theme } from "@/constants/theme";
import { saveGameToBacklog } from "@/db/repository";
import { getGame, type GameSearchResult } from "@/lib/igdb";
import { getIgdbImageUrl } from "@/lib/igdb-image";
import { useOnboarding } from "@/providers/onboarding-provider";

export function OnboardingRatingScreen() {
  const { t } = useTranslation();
  const {
    id,
    coverUrl: routeCoverUrl,
    name: routeName,
  } = useLocalSearchParams<{
    coverUrl?: string;
    id: string;
    name?: string;
  }>();
  const gameId = Number(id);
  const isValidGameId = Number.isInteger(gameId) && gameId > 0;
  const insets = useSafeAreaInsets();
  const { saveSelectedGame, setStep } = useOnboarding();
  const { width } = useWindowDimensions();
  const [rating, setRating] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const gameQuery = useQuery({
    queryKey: ["games", "detail", "websites-v1", gameId],
    queryFn: ({ signal }) => getGame(gameId, { signal }),
    enabled: isValidGameId,
    staleTime: 6 * 60 * 60 * 1_000,
    gcTime: 24 * 60 * 60 * 1_000,
  });
  const fallbackGame: GameSearchResult | null = isValidGameId
    ? {
        id: gameId,
        name: routeName ?? t("Selected game"),
        slug: null,
        summary: null,
        releaseDate: null,
        coverUrl: routeCoverUrl ?? null,
        platforms: [],
        genres: [],
        gameModes: [],
      }
    : null;
  const game = gameQuery.data ?? fallbackGame;
  const coverUrl = getIgdbImageUrl(
    game?.coverUrl || routeCoverUrl,
    "cover_big_2x",
  );
  const gameName = game?.name || routeName || t("Selected game");
  const coverWidth = Math.min(210, Math.max(168, width * 0.48));
  const coverStyle = StyleSheet.flatten([
    styles.cover,
    { height: coverWidth * 1.5, width: coverWidth },
  ]);

  useEffect(() => {
    if (!isValidGameId) return;

    void saveSelectedGame({
      coverUrl: game?.coverUrl ?? routeCoverUrl ?? null,
      id: gameId,
      name: game?.name ?? routeName ?? t("Selected game"),
    });
  }, [
    game?.coverUrl,
    game?.name,
    gameId,
    isValidGameId,
    routeCoverUrl,
    routeName,
    saveSelectedGame,
    t,
  ]);

  async function completeOnboarding() {
    if (!game || isSaving) return;

    setIsSaving(true);
    try {
      await saveGameToBacklog(game, {
        rating,
        status: rating === null ? "want-to-play" : "completed",
      });
      await setStep("notifications");
      Presets.snap();
      router.replace("/(onboarding)/notifications");
    } catch (error) {
      console.error("Unable to add onboarding game", error);
      Presets.System.notificationError();
      Burnt.toast({
        preset: "error",
        title: t("Unable to add game"),
      });
      setIsSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 132 },
        ]}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <OnboardingProgress step={3} style={styles.progress} total={4} />

        <Link.AppleZoomTarget>
          <View collapsable={false} style={coverStyle}>
            {coverUrl ? (
              <Image
                cachePolicy="memory-disk"
                contentFit="cover"
                source={coverUrl}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <GameCoverPlaceholder
                gameName={gameName}
                style={StyleSheet.absoluteFill}
              />
            )}
          </View>
        </Link.AppleZoomTarget>

        <Text numberOfLines={2} style={styles.gameTitle}>
          {gameName}
        </Text>
        <Text style={styles.prompt}>{t("Played it already?")}</Text>
        <Text style={styles.supportingCopy}>
          {t(
            "Give it a rating, or leave it empty to start in Want to play.",
          )}
        </Text>
        <RatingScrubber
          disabled={isSaving}
          onChange={setRating}
          value={rating}
        />

        {gameQuery.error ? (
          <Text style={styles.error}>{t("Unable to load this game.")}</Text>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, theme.spacing.md) },
        ]}
      >
        <PressableScale
          accessibilityHint={t("Adds this game and completes onboarding")}
          accessibilityLabel={t("Continue")}
          accessibilityRole="button"
          disabled={!game || isSaving}
          onPress={() => void completeOnboarding()}
          style={[
            styles.continueButton,
            (!game || isSaving) && styles.continueButtonDisabled,
          ]}
        >
          {isSaving || gameQuery.isPending ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.continueButtonText}>{t("Continue")}</Text>
          )}
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  continueButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderCurve: "continuous",
    borderRadius: theme.radius.pill,
    justifyContent: "center",
    paddingVertical: theme.spacing.md,
  },
  continueButtonDisabled: {
    opacity: 0.42,
  },
  continueButtonText: {
    color: colors.background,
    fontSize: 17,
    fontWeight: "800",
  },
  cover: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderCurve: "continuous",
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: theme.spacing.xl,
    overflow: "hidden",
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    marginTop: theme.spacing.lg,
  },
  footer: {
    backgroundColor: colors.background,
    bottom: 0,
    left: 0,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    position: "absolute",
    right: 0,
  },
  gameTitle: {
    color: colors.text,
    fontSize: theme.size["2xl"],
    fontWeight: "800",
    letterSpacing: -0.7,
    marginTop: theme.spacing.lg,
    textAlign: "center",
  },
  progress: {
    width: "58%",
  },
  prompt: {
    color: colors.text,
    fontSize: theme.size.lg,
    fontWeight: "800",
    marginTop: theme.spacing.xl,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  supportingCopy: {
    color: colors.textMuted,
    fontSize: theme.size.md,
    lineHeight: 21,
    marginTop: theme.spacing.xs,
    maxWidth: 330,
    textAlign: "center",
  },
});
