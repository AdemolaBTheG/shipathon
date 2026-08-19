import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo } from "react";

import { getBacklog } from "@/db/repository";
import { getGamePlaytimes } from "@/lib/igdb";
import { rankGamesByPlatformPreferences } from "@/lib/platform-preferences";
import { useOnboarding } from "@/providers/onboarding-provider";

const MAX_PLAYTIME_CANDIDATES = 20;
const MAX_QUICK_WIN_HOURS = 12;

export const homeQuickWinsBacklogQueryKey = [
  "backlog",
  "home-quick-wins",
] as const;

export type QuickWinGame = {
  coverUrl: string | null;
  gameId: number;
  gameName: string;
  genre: string;
  mainStoryHours: number;
  platform: string;
  platforms: string[];
};

export function useQuickWinGames(options?: {
  enabled?: boolean;
  limit?: number;
}) {
  const enabled = options?.enabled ?? true;
  const limit = options?.limit ?? 20;
  const { state } = useOnboarding();
  const backlogQuery = useQuery({
    enabled,
    gcTime: 5 * 60 * 1_000,
    queryFn: getBacklog,
    queryKey: homeQuickWinsBacklogQueryKey,
    staleTime: 30_000,
  });
  const { refetch: refetchBacklog } = backlogQuery;

  useFocusEffect(
    useCallback(() => {
      if (enabled) void refetchBacklog();
    }, [enabled, refetchBacklog]),
  );

  const candidates = useMemo(
    () =>
      rankGamesByPlatformPreferences(
        (backlogQuery.data ?? []).filter(
          (game) => game.backlog.status === "want-to-play",
        ),
        state.selectedPlatformIds,
      ).slice(0, MAX_PLAYTIME_CANDIDATES),
    [backlogQuery.data, state.selectedPlatformIds],
  );
  const candidateIds = candidates.map((game) => game.igdbId);
  const playtimesQuery = useQuery({
    enabled: enabled && candidateIds.length > 0,
    gcTime: 24 * 60 * 60 * 1_000,
    queryFn: ({ signal }) => getGamePlaytimes(candidateIds, { signal }),
    queryKey: ["games", "playtimes", candidateIds.join(",")],
    staleTime: 6 * 60 * 60 * 1_000,
  });
  const { refetch: refetchPlaytimes } = playtimesQuery;
  const games = useMemo(() => {
    const playtimeByGameId = new Map(
      (playtimesQuery.data ?? []).map((playtime) => [
        playtime.gameId,
        playtime,
      ]),
    );

    return candidates
      .flatMap((game) => {
        const mainStorySeconds =
          playtimeByGameId.get(game.igdbId)?.mainStorySeconds ?? null;
        if (!mainStorySeconds) return [];

        const mainStoryHours = Math.round((mainStorySeconds / 3_600) * 2) / 2;
        if (mainStoryHours > MAX_QUICK_WIN_HOURS) return [];

        return [
          {
            coverUrl: game.coverUrl,
            gameId: game.igdbId,
            gameName: game.name,
            genre: game.genres[0] ?? "Game",
            mainStoryHours,
            platform: game.platforms[0] ?? "Platform TBA",
            platforms: game.platforms,
          } satisfies QuickWinGame,
        ];
      })
      .sort((left, right) => left.mainStoryHours - right.mainStoryHours)
      .slice(0, limit);
  }, [candidates, limit, playtimesQuery.data]);
  const error = backlogQuery.error ?? playtimesQuery.error;
  const isPending =
    enabled &&
    (backlogQuery.isPending ||
      (candidateIds.length > 0 && playtimesQuery.isPending));

  const refetch = useCallback(async () => {
    const backlogResult = await refetchBacklog();
    if (backlogResult.data?.length) await refetchPlaytimes();
  }, [refetchBacklog, refetchPlaytimes]);

  return { error, games, isPending, refetch };
}
