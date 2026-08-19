import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo } from "react";

import { rankGamesByPlatformPreferences } from "@/lib/platform-preferences";
import { useOnboarding } from "@/providers/onboarding-provider";
import { getFriendsCurrentlyPlaying } from "@/services/sharing";

export function useFriendsPlayingGames(options?: {
  enabled?: boolean;
  limit?: number;
}) {
  const enabled = options?.enabled ?? true;
  const limit = options?.limit ?? 20;
  const { state } = useOnboarding();
  const query = useQuery({
    enabled,
    gcTime: 10 * 60 * 1_000,
    queryFn: () => getFriendsCurrentlyPlaying(limit),
    queryKey: ["friends", "currently-playing", limit],
    staleTime: 60_000,
  });
  const { refetch } = query;

  useFocusEffect(
    useCallback(() => {
      if (enabled) void refetch();
    }, [enabled, refetch]),
  );

  const games = useMemo(
    () =>
      rankGamesByPlatformPreferences(
        query.data ?? [],
        state.selectedPlatformIds,
      ),
    [query.data, state.selectedPlatformIds],
  );

  return { ...query, games, isPending: enabled && query.isPending };
}
