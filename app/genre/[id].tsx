import { LegendList } from "@legendapp/list";
import * as Burnt from "burnt";
import {
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router";
import { SymbolView } from "expo-symbols";
import { useTranslation } from "react-i18next";
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  type NativeSyntheticEvent,
  StyleSheet,
  type TextInputChangeEventData,
  useWindowDimensions,
  View,
} from "react-native";

import { Text } from "@/components/Themed";
import { GamePaginationFooter } from "@/components/game-pagination-footer";
import { GameSearchResultRow } from "@/components/game-search-result";
import { GAME_GENRES } from "@/constants/game-genres";
import { colors, theme } from "@/constants/theme";
import { getBacklog, saveGameToBacklog } from "@/db/repository";
import type { BacklogStatus } from "@/db/schema";
import { useGameSearch } from "@/hooks/use-game-search";
import {
  createFilterAction,
  createFilterSubmenu,
  createHeaderFilterMenu,
} from "@/lib/header-filter-menu";
import { createHeaderRightOptions } from "@/lib/header-item-options";
import type { GameSearchResult } from "@/lib/igdb";
import type { TranslationKey } from "@/localization/resources";

type AvailabilityFilter = "all" | "tracked" | "untracked";
type ReleaseFilter = "all" | "released" | "upcoming";
type GenreSort = "popular" | "newest" | "oldest" | "title";

export default function GenreGamesScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const router = useRouter();
  const { id: idParam, sourceUrl } = useLocalSearchParams<{
    id?: string | string[];
    sourceUrl?: string;
  }>();
  const genreId = Number(Array.isArray(idParam) ? idParam[0] : idParam);
  const genre = GAME_GENRES.find((item) => item.id === genreId) ?? null;
  const genreLabel = genre ? t(genre.translationKey as TranslationKey) : null;
  const { width } = useWindowDimensions();
  const [availabilityFilter, setAvailabilityFilter] =
    useState<AvailabilityFilter>("all");
  const [releaseFilter, setReleaseFilter] =
    useState<ReleaseFilter>("all");
  const [sort, setSort] = useState<GenreSort>("popular");
  const [query, setQuery] = useState("");
  const [gameStatuses, setGameStatuses] = useState<Map<number, BacklogStatus>>(
    new Map(),
  );
  const [savingGameId, setSavingGameId] = useState<number | null>(null);
  const paginationRequestInFlight = useRef(false);
  const gameSearch = useGameSearch(query, genre?.id ?? null);
  const coverWidth = Math.min(84, Math.max(64, Math.round(width * 0.18)));
  const coverHeight = Math.round(coverWidth * (4 / 3));
  const visibleResults = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const filtered = gameSearch.results.filter((game) => {
      const tracked = gameStatuses.has(game.id);
      const matchesAvailability =
        availabilityFilter === "all" ||
        (availabilityFilter === "tracked" && tracked) ||
        (availabilityFilter === "untracked" && !tracked);
      const matchesRelease =
        releaseFilter === "all" ||
        (releaseFilter === "released" &&
          game.releaseDate !== null &&
          game.releaseDate <= today) ||
        (releaseFilter === "upcoming" &&
          (game.releaseDate === null || game.releaseDate > today));

      return matchesAvailability && matchesRelease;
    });

    if (sort === "popular") return filtered;
    return [...filtered].sort((left, right) => {
      if (sort === "title") return left.name.localeCompare(right.name);

      const leftDate = left.releaseDate ?? "";
      const rightDate = right.releaseDate ?? "";
      return sort === "newest"
        ? rightDate.localeCompare(leftDate)
        : leftDate.localeCompare(rightDate);
    });
  }, [
    availabilityFilter,
    gameSearch.results,
    gameStatuses,
    releaseFilter,
    sort,
  ]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerSearchBarOptions: genre
        ? {
            autoCapitalize: "none",
            hideWhenScrolling: false,
            onCancelButtonPress: () => setQuery(""),
            onChangeText: (
              event: NativeSyntheticEvent<TextInputChangeEventData>,
            ) => setQuery(event.nativeEvent.text),
            placeholder: t("Search {{label}}", {
              label: genreLabel ?? genre.label,
            }),
          }
        : undefined,
      title: genreLabel ?? t("Genre"),
      ...createHeaderRightOptions(
        genre
          ? () => [
            createHeaderFilterMenu({
              active:
                availabilityFilter !== "all" ||
                releaseFilter !== "all" ||
                sort !== "popular",
              items: [
                createFilterSubmenu({
                  label: t("Backlog"),
                  items: [
                    createFilterAction({
                      label: t("All games"),
                      onPress: () => setAvailabilityFilter("all"),
                      selected: availabilityFilter === "all",
                    }),
                    createFilterAction({
                      label: t("Not tracked"),
                      onPress: () => setAvailabilityFilter("untracked"),
                      selected: availabilityFilter === "untracked",
                    }),
                    createFilterAction({
                      label: t("Already tracked"),
                      onPress: () => setAvailabilityFilter("tracked"),
                      selected: availabilityFilter === "tracked",
                    }),
                  ],
                }),
                createFilterSubmenu({
                  label: t("Release"),
                  items: [
                    createFilterAction({
                      label: t("Any release"),
                      onPress: () => setReleaseFilter("all"),
                      selected: releaseFilter === "all",
                    }),
                    createFilterAction({
                      label: t("Released"),
                      onPress: () => setReleaseFilter("released"),
                      selected: releaseFilter === "released",
                    }),
                    createFilterAction({
                      label: t("Upcoming or TBA"),
                      onPress: () => setReleaseFilter("upcoming"),
                      selected: releaseFilter === "upcoming",
                    }),
                  ],
                }),
                createFilterSubmenu({
                  label: t("Sort"),
                  items: [
                    createFilterAction({
                      label: t("Popular"),
                      onPress: () => setSort("popular"),
                      selected: sort === "popular",
                    }),
                    createFilterAction({
                      label: t("Newest first"),
                      onPress: () => setSort("newest"),
                      selected: sort === "newest",
                    }),
                    createFilterAction({
                      label: t("Oldest first"),
                      onPress: () => setSort("oldest"),
                      selected: sort === "oldest",
                    }),
                    createFilterAction({
                      label: t("Title"),
                      onPress: () => setSort("title"),
                      selected: sort === "title",
                    }),
                  ],
                }),
              ],
              tintColor: colors.primary,
              title: t("{{label}} filters", {
                label: genreLabel ?? genre.label,
              }),
            }),
            ]
          : undefined,
      ),
    });
  }, [availabilityFilter, genre, genreLabel, navigation, releaseFilter, sort, t]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void getBacklog()
        .then((backlog) => {
          if (!active) return;
          setGameStatuses(
            new Map(backlog.map((item) => [item.igdbId, item.backlog.status])),
          );
        })
        .catch((error) => {
          console.warn("Unable to refresh backlog statuses", error);
        });

      return () => {
        active = false;
      };
    }, []),
  );

  const handleAdd = useCallback(
    async (game: GameSearchResult) => {
      if (gameStatuses.has(game.id) || savingGameId === game.id) return;

      setSavingGameId(game.id);
      setGameStatuses((current) => {
        const next = new Map(current);
        next.set(game.id, "want-to-play");
        return next;
      });

      try {
        await saveGameToBacklog(game, sourceUrl ? { sourceUrl } : undefined);
        if (sourceUrl) router.setParams({ sourceUrl: undefined });
        Burnt.toast({ title: t("Added to backlog") });
      } catch {
        setGameStatuses((current) => {
          const next = new Map(current);
          next.delete(game.id);
          return next;
        });
        Burnt.toast({
          preset: "error",
          title: t("Unable to add game"),
        });
      } finally {
        setSavingGameId(null);
      }
    },
    [gameStatuses, router, savingGameId, sourceUrl, t],
  );

  const loadNextPage = useCallback(
    (retryAfterError = false) => {
      if (
        paginationRequestInFlight.current ||
        !gameSearch.hasNextPage ||
        gameSearch.isFetchingNextPage ||
        (gameSearch.isFetchNextPageError && !retryAfterError)
      ) {
        return;
      }

      paginationRequestInFlight.current = true;
      void gameSearch
        .fetchNextPage({ cancelRefetch: false })
        .finally(() => {
          paginationRequestInFlight.current = false;
        });
    },
    [gameSearch],
  );

  if (!genre) {
    return (
      <View style={styles.invalidState}>
        <SymbolView
          name={{ android: "warning", ios: "exclamationmark.triangle" }}
          size={40}
          tintColor={colors.textMuted}
        />
        <Text style={styles.emptyTitle}>{t("Genre unavailable")}</Text>
        <Text style={styles.emptyDescription}>
          {t("Return to Search and choose another genre.")}
        </Text>
      </View>
    );
  }

  return (
    <LegendList
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      data={visibleResults}
      estimatedItemSize={coverHeight + 24}
      extraData={gameStatuses}
      keyExtractor={(game) => String(game.id)}
      ListEmptyComponent={
        <GenreEmptyState
          error={gameSearch.error}
          filtered={
            availabilityFilter !== "all" || releaseFilter !== "all"
          }
          isLoading={gameSearch.isLoading}
          t={t}
        />
      }
      ListFooterComponent={
        <GamePaginationFooter
          hasError={gameSearch.isFetchNextPageError}
          isFetching={gameSearch.isFetchingNextPage}
          onRetry={() => loadNextPage(true)}
        />
      }
      onEndReached={() => loadNextPage()}
      onEndReachedThreshold={0.35}
      renderItem={({ item, index }) => (
        <GameSearchResultRow
          coverHeight={coverHeight}
          coverWidth={coverWidth}
          game={item}
          index={index}
          isSaving={savingGameId === item.id}
          onAdd={handleAdd}
          status={gameStatuses.get(item.id) ?? null}
          total={visibleResults.length}
        />
      )}
      style={styles.container}
    />
  );
}

function GenreEmptyState({
  error: hasError,
  filtered,
  isLoading,
  t,
}: {
  error: string | null;
  filtered: boolean;
  isLoading: boolean;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  if (isLoading) {
    return (
      <View style={styles.emptyState}>
        <ActivityIndicator color={colors.textMuted} />
      </View>
    );
  }

  if (hasError) {
    return <Text style={styles.error}>{t("Unable to load games")}</Text>;
  }

  return (
    <View style={styles.emptyState}>
      <SymbolView
        name={{ android: "collections_bookmark", ios: "rectangle.stack" }}
        size={40}
        tintColor={colors.textMuted}
      />
      <Text style={styles.emptyTitle}>
        {filtered ? t("No games match these filters") : t("No games found")}
      </Text>
      {filtered ? (
        <Text style={styles.emptyDescription}>
          {t("Try another release or backlog filter.")}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    paddingBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  emptyDescription: {
    color: colors.textMuted,
    fontSize: theme.size.sm,
    lineHeight: 20,
    maxWidth: 280,
    textAlign: "center",
  },
  emptyState: {
    alignItems: "center",
    flex: 1,
    gap: theme.spacing.sm,
    justifyContent: "center",
    paddingBottom: 96,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: theme.size.lg,
    fontWeight: "700",
    marginTop: theme.spacing.sm,
  },
  error: {
    color: colors.danger,
    marginTop: theme.spacing.xl,
    textAlign: "center",
  },
  invalidState: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
    gap: theme.spacing.sm,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.xl,
  },
});
