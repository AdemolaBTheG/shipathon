import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Burnt from "burnt";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import { useCallback, useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, StyleSheet, useWindowDimensions } from "react-native";

import { FriendsPlayingRail } from "@/components/friends-playing-rail";
import {
  GameRecommendationFeature,
  type RecommendationSeed,
} from "@/components/game-recommendation-feature";
import { QuickWinsRail } from "@/components/quick-wins-rail";
import { TonightsPick } from "@/components/tonights-pick";
import { UpcomingGamesRail } from "@/components/upcoming-games-rail";
import { colors, theme } from "@/constants/theme";
import {
  getBacklog,
  saveGameToBacklog,
  updateBacklogStatus,
} from "@/db/repository";
import { getWidgetState, setTonightPickGameId } from "@/db/widget-state";
import { homeQuickWinsBacklogQueryKey } from "@/hooks/use-quick-win-games";
import { useRevenueCat } from "@/hooks/use-revenuecat";
import {
  createHeaderLeftOptions,
  createHeaderRightOptions,
} from "@/lib/header-item-options";
import { getGame, type GameRecommendation } from "@/lib/igdb";
import { rankGamesByPlatformPreferences } from "@/lib/platform-preferences";
import { useOnboarding } from "@/providers/onboarding-provider";
import { syncSharedBacklog } from "@/services/sharing";
import {
  adoptTonightPickFromWidget,
  requestWidgetSync,
} from "@/services/widget-sync";

type BacklogGame = Awaited<ReturnType<typeof getBacklog>>[number];
type HomeBlock =
  | "coming-soon"
  | "recommendation"
  | "friends-playing"
  | "quick-wins";

const HOME_BLOCKS: HomeBlock[] = [
  "coming-soon",
  "recommendation",
  "friends-playing",
  "quick-wins",
];

export default function HomeScreen() {
  const { t } = useTranslation();
  const { state } = useOnboarding();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { isConfigured, isLoading, isPro, isSupported, presentPaywall } =
    useRevenueCat();
  const { width } = useWindowDimensions();
  const [startingGameId, setStartingGameId] = useState<number | null>(null);
  const [isPresentingPaywall, setIsPresentingPaywall] = useState(false);
  const [wantToPlayGames, setWantToPlayGames] = useState<BacklogGame[] | null>(
    null,
  );
  const [pickGameId, setPickGameId] = useState<number | null>(null);
  const [recommendationSeed, setRecommendationSeed] =
    useState<RecommendationSeed | null>(null);
  const [savingRecommendationId, setSavingRecommendationId] = useState<
    number | null
  >(null);
  const [trackedGameIds, setTrackedGameIds] = useState<Set<number>>(new Set());
  const heroTopInset = 0;
  const heroCoverWidth = Math.min(252, Math.max(220, width * 0.62));
  const heroHeight = Math.min(
    780,
    Math.max(700, Math.round(heroCoverWidth * 1.5) + 180),
  );
  const heroBackdropHeight = Math.min(440, Math.max(380, heroTopInset + 180));

  const handlePresentPaywall = useCallback(async () => {
    if (isLoading || isPresentingPaywall) return;

    if (!isSupported || !isConfigured) {
      Burnt.toast({
        preset: "error",
        title: t("Joylogue Pro is unavailable right now"),
      });
      return;
    }

    try {
      setIsPresentingPaywall(true);
      await presentPaywall();
    } catch {
      Burnt.toast({
        preset: "error",
        title: t("Unable to open Joylogue Pro"),
      });
    } finally {
      setIsPresentingPaywall(false);
    }
  }, [
    isConfigured,
    isLoading,
    isPresentingPaywall,
    isSupported,
    presentPaywall,
    t,
  ]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLargeTitle: false,
      headerShadowVisible: false,
      headerShown: true,
      headerTransparent: true,
      title: "Joylogue",
      ...createHeaderLeftOptions(() => [
        {
          accessibilityHint: t("Opens the Joylogue Pro paywall"),
          accessibilityLabel: "Joylogue Pro",
          disabled: isLoading || isPresentingPaywall,
          icon: { type: "sfSymbol", name: "crown.fill" },
          label: "Joylogue Pro",
          onPress: () => void handlePresentPaywall(),
          tintColor: colors.primary,
          type: "button",
        },
      ]),
      ...createHeaderRightOptions(() => [
        {
          accessibilityHint: t("Opens your badge collection"),
          accessibilityLabel: t("Badges"),
          icon: { type: "sfSymbol", name: "trophy.fill" },
          label: t("Badges"),
          onPress: () => router.push("/badges"),
          tintColor: colors.primary,
          type: "button",
        },
        {
          accessibilityHint: t("Opens game capture"),
          accessibilityLabel: t("Add game"),
          icon: { type: "sfSymbol", name: "plus" },
          label: t("Add game"),
          onPress: () => router.push("/add"),
          tintColor: colors.primary,
          type: "button",
        },
      ]),
    });
  }, [
    handlePresentPaywall,
    isLoading,
    isPresentingPaywall,
    navigation,
    router,
    t,
  ]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void adoptTonightPickFromWidget()
        .catch((widgetError) => {
          if (__DEV__) {
            console.warn(
              "Unable to read Tonight's Pick from the widget.",
              widgetError,
            );
          }
        })
        .then(() => Promise.all([getBacklog(), getWidgetState()]))
        .then(([backlog, widgetState]) => {
          if (!active) return;
          const rankedWantToPlay = rankGamesByPlatformPreferences(
            backlog.filter((item) => item.backlog.status === "want-to-play"),
            state.selectedPlatformIds,
          );
          const nextPickId = rankedWantToPlay.some(
            (game) => game.igdbId === widgetState.tonightPickGameId,
          )
            ? widgetState.tonightPickGameId
            : (rankedWantToPlay[0]?.igdbId ?? null);

          setWantToPlayGames(rankedWantToPlay);
          setPickGameId(nextPickId);
          if (nextPickId !== widgetState.tonightPickGameId) {
            void setTonightPickGameId(nextPickId)
              .then(() => requestWidgetSync({ isPro }))
              .catch((widgetError) => {
                if (__DEV__) {
                  console.warn(
                    "Unable to update Tonight's Pick widget.",
                    widgetError,
                  );
                }
              });
          }
          setTrackedGameIds(new Set(backlog.map((item) => item.igdbId)));

          const completedGames = backlog
            .filter((item) => item.backlog.status === "completed")
            .sort((left, right) => {
              const ratingDifference =
                (right.backlog.rating ?? 0) - (left.backlog.rating ?? 0);
              if (ratingDifference !== 0) return ratingDifference;

              return (
                (right.backlog.completedAt?.getTime() ?? 0) -
                (left.backlog.completedAt?.getTime() ?? 0)
              );
            });
          const seed = completedGames[0];
          setRecommendationSeed(
            seed
              ? {
                  coverUrl: seed.coverUrl,
                  id: seed.igdbId,
                  name: seed.name,
                }
              : null,
          );
        })
        .catch((refreshError) => {
          console.warn("Unable to refresh Tonight's Pick", refreshError);
        });

      void syncSharedBacklog().catch((syncError: unknown) => {
        console.warn("Unable to sync shared backlog", syncError);
      });

      return () => {
        active = false;
      };
    }, [isPro, state.selectedPlatformIds]),
  );

  const pickedGame =
    wantToPlayGames?.find((game) => game.igdbId === pickGameId) ??
    wantToPlayGames?.[0] ??
    null;
  const pickedGameDetails = useQuery({
    enabled: Boolean(pickedGame),
    gcTime: 24 * 60 * 60 * 1_000,
    queryFn: ({ signal }) => getGame(pickedGame!.igdbId, { signal }),
    queryKey: ["games", "detail", "websites-v1", pickedGame?.igdbId],
    staleTime: 6 * 60 * 60 * 1_000,
  });

  function handleShufflePick() {
    if (!wantToPlayGames || wantToPlayGames.length < 2) return;

    if (!isPro) {
      void handlePresentPaywall();
      return;
    }

    const currentIndex = wantToPlayGames.findIndex(
      (game) => game.igdbId === (pickGameId ?? pickedGame?.igdbId),
    );
    const nextPickId =
      wantToPlayGames[(currentIndex + 1) % wantToPlayGames.length].igdbId;

    setPickGameId(nextPickId);
    void setTonightPickGameId(nextPickId)
      .then(() => requestWidgetSync({ isPro }))
      .catch((widgetError) => {
        if (__DEV__) {
          console.warn("Unable to shuffle Tonight's Pick widget.", widgetError);
        }
      });
  }

  async function handleStartPick() {
    if (!pickedGame || startingGameId !== null) return;

    setStartingGameId(pickedGame.igdbId);
    try {
      await updateBacklogStatus(pickedGame.igdbId, "playing");
      void queryClient.invalidateQueries({
        queryKey: homeQuickWinsBacklogQueryKey,
      });
      void syncSharedBacklog({ force: true }).catch((syncError: unknown) => {
        console.warn("Unable to publish playing status", syncError);
      });
      const remainingGames =
        wantToPlayGames?.filter((game) => game.igdbId !== pickedGame.igdbId) ??
        [];
      const nextPickId = remainingGames[0]?.igdbId ?? null;
      setWantToPlayGames(remainingGames);
      setPickGameId(nextPickId);
      await setTonightPickGameId(nextPickId);
      await requestWidgetSync({ isPro });
      Burnt.toast({ title: t("Ready to play") });
    } catch {
      Burnt.toast({
        preset: "error",
        title: t("Unable to start game"),
      });
    } finally {
      setStartingGameId(null);
    }
  }

  async function handleAddRecommendation(game: GameRecommendation) {
    if (savingRecommendationId !== null || trackedGameIds.has(game.id)) return;

    setSavingRecommendationId(game.id);
    setTrackedGameIds((current) => new Set(current).add(game.id));
    try {
      await saveGameToBacklog(game);
      void queryClient.invalidateQueries({
        queryKey: homeQuickWinsBacklogQueryKey,
      });
      void syncSharedBacklog({ force: true }).catch((syncError: unknown) => {
        console.warn("Unable to publish backlog update", syncError);
      });
      Burnt.toast({ title: t("Added to backlog") });
    } catch {
      setTrackedGameIds((current) => {
        const next = new Set(current);
        next.delete(game.id);
        return next;
      });
      Burnt.toast({
        preset: "error",
        title: t("Unable to add game"),
      });
    } finally {
      setSavingRecommendationId(null);
    }
  }

  function renderHomeBlock({ item }: { item: HomeBlock }) {
    switch (item) {
      case "coming-soon":
        return <UpcomingGamesRail />;
      case "recommendation":
        return (
          <GameRecommendationFeature
            excludedGameIds={trackedGameIds}
            onAdd={handleAddRecommendation}
            savingGameId={savingRecommendationId}
            seed={recommendationSeed}
          />
        );
      case "friends-playing":
        return <FriendsPlayingRail />;
      case "quick-wins":
        return <QuickWinsRail />;
    }
  }

  return (
    <FlatList
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      data={HOME_BLOCKS}
      keyExtractor={(item) => item}
      ListHeaderComponent={
        <TonightsPick
          backdropHeight={heroBackdropHeight}
          game={pickedGame}
          heroHeight={heroHeight}
          isLoading={wantToPlayGames === null}
          isShuffleLocked={!isPro}
          isStarting={startingGameId === pickedGame?.igdbId}
          mainStorySeconds={
            pickedGameDetails.data?.estimatedPlaytime?.mainStorySeconds ?? null
          }
          onAdd={() => router.push("/add")}
          onShuffle={handleShufflePick}
          onStart={handleStartPick}
          topInset={heroTopInset}
        />
      }
      renderItem={renderHomeBlock}
      showsVerticalScrollIndicator={false}
      style={styles.container}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.md,
  },
});
