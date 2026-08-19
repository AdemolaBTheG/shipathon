import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { getGamesByPlatform, type GameSearchResult } from "@/lib/igdb";

const MIN_QUERY_LENGTH = 2;
const PAGE_SIZE = 12;

type PlatformGamesPage = {
  games: GameSearchResult[];
  offset: number;
};

function getUniqueGames(pages: readonly PlatformGamesPage[]) {
  const games = new Map<number, GameSearchResult>();

  for (const page of pages) {
    for (const game of page.games) {
      if (!games.has(game.id)) games.set(game.id, game);
    }
  }

  return Array.from(games.values());
}

export function usePlatformGames(platformId: string | null, query: string) {
  const { t } = useTranslation();
  const normalizedQuery = query.trim();
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(normalizedQuery), 300);
    return () => clearTimeout(timeout);
  }, [normalizedQuery]);

  const gamesQuery = useInfiniteQuery({
    enabled:
      platformId !== null &&
      (debouncedQuery.length === 0 || debouncedQuery.length >= MIN_QUERY_LENGTH),
    queryFn: async ({ pageParam, signal }): Promise<PlatformGamesPage> => {
      const games = await getGamesByPlatform(platformId!, {
        limit: PAGE_SIZE,
        offset: pageParam,
        query: debouncedQuery,
        signal,
      });

      return { games, offset: pageParam };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.games.length === PAGE_SIZE
        ? lastPage.offset + PAGE_SIZE
        : undefined,
    queryKey: ["games", "platform", "browse-v2", platformId, debouncedQuery],
    retry: false,
    staleTime: 5 * 60 * 1_000,
  });

  const isCurrentQuery = normalizedQuery === debouncedQuery;

  return {
    error:
      isCurrentQuery && gamesQuery.error ? t("Unable to load games") : null,
    fetchNextPage: gamesQuery.fetchNextPage,
    hasNextPage: isCurrentQuery && gamesQuery.hasNextPage,
    isFetchNextPageError:
      isCurrentQuery && gamesQuery.isFetchNextPageError,
    isFetchingNextPage: isCurrentQuery && gamesQuery.isFetchingNextPage,
    isLoading:
      platformId !== null && (!isCurrentQuery || gamesQuery.isPending),
    results: isCurrentQuery
      ? getUniqueGames(gamesQuery.data?.pages ?? [])
      : [],
  };
}
