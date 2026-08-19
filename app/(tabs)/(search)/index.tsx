import * as Burnt from "burnt";
import {
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router";
import { SymbolView } from "expo-symbols";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  type NativeSyntheticEvent,
  StyleSheet,
  type TextInputChangeEventData,
  useWindowDimensions,
  View,
} from "react-native";
import type { SearchBarCommands } from "react-native-screens";

import { Text } from "@/components/Themed";
import { GameSearchResultRow } from "@/components/game-search-result";
import { PlatformBrowseCard } from "@/components/platform-browse-card";
import { GAME_GENRES } from "@/constants/game-genres";
import {
  FEATURED_GAME_PLATFORMS,
  type GamePlatform,
} from "@/constants/game-platforms";
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
import { PressableOpacity } from "pressto";
import { useTranslation } from "react-i18next";

type AvailabilityFilter = "all" | "tracked" | "untracked";
type ReleaseFilter = "all" | "released" | "upcoming";
type SearchSort = "relevance" | "newest" | "oldest";

export default function SearchScreen() {
  const { t } = useTranslation();
  const searchBarRef = useRef<SearchBarCommands | null>(null);
  const canLoadNextPage = useRef(false);
  const navigation = useNavigation();
  const router = useRouter();
  const {
    add,
    query: initialQuery,
    sourceUrl,
  } = useLocalSearchParams<{
    add?: string;
    query?: string;
    sourceUrl?: string;
  }>();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState("");
  const [availabilityFilter, setAvailabilityFilter] =
    useState<AvailabilityFilter>("all");
  const [releaseFilter, setReleaseFilter] = useState<ReleaseFilter>("all");
  const [sort, setSort] = useState<SearchSort>("relevance");
  const [gameStatuses, setGameStatuses] = useState<Map<number, BacklogStatus>>(
    new Map(),
  );
  const [savingGameId, setSavingGameId] = useState<number | null>(null);
  const gameSearch = useGameSearch(query);
  const { canSearch, error, isLoading, results } = gameSearch;
  const coverWidth = Math.min(84, Math.max(64, Math.round(width * 0.18)));
  const coverHeight = Math.round(coverWidth * (4 / 3));
  const visibleResults = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const filtered = results.filter((game) => {
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

    if (sort === "relevance") return filtered;

    return [...filtered].sort((left, right) => {
      const leftDate = left.releaseDate ?? "";
      const rightDate = right.releaseDate ?? "";
      return sort === "newest"
        ? rightDate.localeCompare(leftDate)
        : leftDate.localeCompare(rightDate);
    });
  }, [availabilityFilter, gameStatuses, releaseFilter, results, sort]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerSearchBarOptions: {
        autoCapitalize: "none",
        hideWhenScrolling: false,
        onCancelButtonPress: () => {
          setQuery("");
          if (sourceUrl) router.setParams({ sourceUrl: undefined });
        },
        onChangeText: (event: NativeSyntheticEvent<TextInputChangeEventData>) =>
          setQuery(event.nativeEvent.text),
        placeholder: t("Search games"),
        ref: searchBarRef,
      },
      headerShadowVisible: false,
      ...createHeaderRightOptions(() => [
        createHeaderFilterMenu({
          active:
            availabilityFilter !== "all" ||
            releaseFilter !== "all" ||
            sort !== "relevance",
          items: [
            createFilterSubmenu({
              icon: { name: "books.vertical", type: "sfSymbol" },
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
              icon: { name: "calendar", type: "sfSymbol" },
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
              icon: { name: "arrow.up.arrow.down", type: "sfSymbol" },
              label: t("Sort by"),
              items: [
                createFilterAction({
                  label: t("Relevance"),
                  onPress: () => setSort("relevance"),
                  selected: sort === "relevance",
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
              ],
            }),
          ],
          tintColor: colors.primary,
          title: t("Search filters"),
        }),
      ]),
    });
  }, [
    availabilityFilter,
    navigation,
    releaseFilter,
    router,
    sort,
    sourceUrl,
    t,
  ]);

  useEffect(() => {
    if (add !== "1") return;

    const frame = requestAnimationFrame(() => {
      const nextQuery = initialQuery?.trim() ?? "";
      if (nextQuery) {
        setQuery(nextQuery);
        searchBarRef.current?.setText(nextQuery);
      }
      searchBarRef.current?.focus();
      router.setParams({ add: undefined, query: undefined });
    });

    return () => cancelAnimationFrame(frame);
  }, [add, initialQuery, router]);

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
        .catch((refreshError) => {
          console.warn("Unable to refresh backlog statuses", refreshError);
        });

      return () => {
        active = false;
      };
    }, []),
  );

  async function handleAdd(game: GameSearchResult) {
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
    } catch (saveError) {
      setGameStatuses((current) => {
        const next = new Map(current);
        next.delete(game.id);
        return next;
      });
      Burnt.toast({
        preset: "error",
        title:
          saveError instanceof Error
            ? saveError.message
            : t("Unable to add game"),
      });
    } finally {
      setSavingGameId(null);
    }
  }

  return (
    <FlatList
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      data={canSearch ? visibleResults : []}
      extraData={gameStatuses}
      keyExtractor={(game) => String(game.id)}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={
        canSearch ? (
          <SearchEmptyState
            canSearch={canSearch}
            error={error}
            isLoading={isLoading}
          />
        ) : null
      }
      ListFooterComponent={
        gameSearch.isFetchingNextPage ? (
          <ActivityIndicator color={colors.primary} style={styles.feedback} />
        ) : null
      }
      ListHeaderComponent={
        canSearch ? null : (
          <BrowseHeader
            onOpenPlatforms={() =>
              router.push({
                pathname: "/platforms",
                params: sourceUrl ? { sourceUrl } : {},
              })
            }
            onSelectPlatform={(platform) =>
              router.push({
                pathname: "/platform/[id]",
                params: {
                  id: platform.id,
                  ...(sourceUrl ? { sourceUrl } : {}),
                },
              })
            }
            onSelect={(genreId) =>
              router.push({
                pathname: "/genre/[id]",
                params: {
                  id: String(genreId),
                  ...(sourceUrl ? { sourceUrl } : {}),
                },
              })
            }
          />
        )
      }
      onEndReached={() => {
        if (
          canLoadNextPage.current &&
          canSearch &&
          gameSearch.hasNextPage &&
          !gameSearch.isFetchingNextPage
        ) {
          canLoadNextPage.current = false;
          void gameSearch.fetchNextPage({ cancelRefetch: false });
        }
      }}
      onEndReachedThreshold={0.6}
      onScrollBeginDrag={() => {
        canLoadNextPage.current = true;
      }}
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

function BrowseHeader({
  onOpenPlatforms,
  onSelect,
  onSelectPlatform,
}: {
  onOpenPlatforms: () => void;
  onSelect: (genreId: number) => void;
  onSelectPlatform: (platform: GamePlatform) => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.browseHeader}>
      <View style={styles.platformSection}>
        <PressableOpacity
          accessibilityLabel={t("View all platforms")}
          accessibilityRole="button"
          onPress={onOpenPlatforms}
          style={styles.sectionHeading}
        >
          <Text style={styles.sectionTitle}>{t("Platforms")}</Text>
          <SymbolView
            name={{ android: "chevron_right", ios: "chevron.right" }}
            size={17}
            tintColor={colors.textMuted}
          />
        </PressableOpacity>
        <View style={styles.platformGrid}>
          {FEATURED_GAME_PLATFORMS.map((platform) => (
            <PlatformBrowseCard
              key={platform.id}
              onPress={() => onSelectPlatform(platform)}
              platform={platform}
              style={styles.platformCard}
            />
          ))}
        </View>
      </View>
      <GenreCloud onSelect={onSelect} />
    </View>
  );
}

function GenreCloud({ onSelect }: { onSelect: (genreId: number) => void }) {
  const { t } = useTranslation();

  return (
    <View style={styles.genreSection}>
      <Text style={styles.sectionTitle}>{t("Genres")}</Text>
      <View style={styles.genreCloud}>
        {GAME_GENRES.map((genre) => {
          return (
            <PressableOpacity
              accessibilityRole="button"
              key={genre.id}
              onPress={() => onSelect(genre.id)}
              style={styles.genrePill}
            >
              <Text style={styles.genrePillText}>
                {t(genre.translationKey as TranslationKey)}
              </Text>
            </PressableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function SearchEmptyState({
  canSearch,
  error,
  isLoading,
}: {
  canSearch: boolean;
  error: string | null;
  isLoading: boolean;
}) {
  const { t } = useTranslation();

  if (isLoading) {
    return <ActivityIndicator color={colors.primary} style={styles.feedback} />;
  }

  if (error) {
    return <Text style={styles.error}>{error}</Text>;
  }

  return (
    <View style={styles.emptyState}>
      <SymbolView
        name={{ android: "search", ios: "magnifyingglass" }}
        size={38}
        tintColor={colors.textMuted}
      />
      <Text style={styles.emptyTitle}>
        {canSearch ? t("No games found") : t("Find your next game")}
      </Text>
      <Text style={styles.emptyDescription}>
        {canSearch
          ? t("Try another title or check the spelling.")
          : t("Search by title, then add it directly to your backlog.")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  browseHeader: {
    gap: theme.spacing.sm,
  },
  container: {
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    paddingBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
  },
  emptyDescription: {
    color: colors.textMuted,
    fontSize: theme.size.sm,
    lineHeight: 20,
    marginTop: theme.spacing.xs,
    maxWidth: 280,
    textAlign: "center",
  },
  emptyState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingBottom: 96,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: theme.size.lg,
    fontWeight: "700",
    marginTop: theme.spacing.md,
  },
  error: {
    color: colors.danger,
    marginTop: theme.spacing.lg,
    textAlign: "center",
  },
  feedback: {
    marginTop: theme.spacing.lg,
  },
  genreCloud: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  genrePill: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: theme.radius.pill,
    justifyContent: "center",
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },

  genrePillText: {
    color: colors.text,
    fontSize: theme.size.md,
    fontWeight: "500",
  },
  genreSection: {
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  platformCard: {
    flexBasis: "47%",
    flexGrow: 1,
  },
  platformGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  platformSection: {
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.md,
  },
  sectionHeading: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: colors.text,
    fontSize: theme.size.lg,
    fontWeight: "700",
  },
});
