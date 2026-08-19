import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  getGamesByGenre,
  type GameSearchResult,
  searchGames,
} from "@/lib/igdb";
import { rankGamesByPlatformPreferences } from "@/lib/platform-preferences";
import { useOnboarding } from "@/providers/onboarding-provider";

export const MIN_GAME_SEARCH_QUERY_LENGTH = 2;
const SEARCH_PAGE_SIZE = 12;

type GameSearchPage = {
  games: GameSearchResult[];
  offset: number;
};

function getUniqueSearchResults(pages: GameSearchResult[][]) {
  const gamesById = new Map<number, GameSearchResult>();

  for (const page of pages) {
    for (const game of page) {
      if (!gamesById.has(game.id)) gamesById.set(game.id, game);
    }
  }

  return Array.from(gamesById.values());
}

export function useGameSearch(query: string, genreId: number | null = null) {
  const { t } = useTranslation();
  const { state } = useOnboarding();
  const normalizedQuery = query.trim();
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const canSearch =
    normalizedQuery.length >= MIN_GAME_SEARCH_QUERY_LENGTH || genreId !== null;

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(normalizedQuery), 300);
    return () => clearTimeout(timeout);
  }, [normalizedQuery]);

  const searchQuery = useInfiniteQuery({
    enabled:
      debouncedQuery.length >= MIN_GAME_SEARCH_QUERY_LENGTH || genreId !== null,
    queryFn: async ({ pageParam, signal }): Promise<GameSearchPage> => {
      const games =
        genreId === null
          ? await searchGames(debouncedQuery, {
              limit: SEARCH_PAGE_SIZE,
              offset: pageParam,
              signal,
            })
          : await getGamesByGenre(genreId, {
              limit: SEARCH_PAGE_SIZE,
              offset: pageParam,
              query: debouncedQuery,
              signal,
            });

      return { games, offset: pageParam };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.games.length === SEARCH_PAGE_SIZE
        ? lastPage.offset + SEARCH_PAGE_SIZE
        : undefined,
    queryKey:
      genreId === null
        ? ["games", "search", debouncedQuery]
        : ["games", "genre", "browse-v2", genreId, debouncedQuery],
    retry: genreId === null ? 1 : false,
    staleTime: 5 * 60 * 1_000,
  });

  const isCurrentQuery = normalizedQuery === debouncedQuery;
  const results = isCurrentQuery
    ? rankGamesByPlatformPreferences(
        getUniqueSearchResults(
          searchQuery.data?.pages.map((page) => page.games) ?? [],
        ),
        state.selectedPlatformIds,
      )
    : [];
  const error =
    isCurrentQuery && searchQuery.error ? t("Unable to load games") : null;

  return {
    canSearch,
    error,
    fetchNextPage: searchQuery.fetchNextPage,
    hasNextPage: isCurrentQuery && searchQuery.hasNextPage,
    isFetchNextPageError:
      isCurrentQuery && searchQuery.isFetchNextPageError,
    isFetchingNextPage: isCurrentQuery && searchQuery.isFetchingNextPage,
    isLoading: canSearch && (!isCurrentQuery || searchQuery.isPending),
    results,
  };
}
