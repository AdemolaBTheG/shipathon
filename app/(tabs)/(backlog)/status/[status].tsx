import { Text } from "@/components/Themed";
import { statusOptions } from "@/components/status-options";
import { colors, theme } from "@/constants/theme";
import { withPreviewBacklog } from "@/constants/backlog-preview";
import { getBacklog } from "@/db/repository";
import type { BacklogStatus } from "@/db/schema";
import { LegendList } from "@legendapp/list";
import { Image } from "expo-image";
import { Link, useLocalSearchParams, useNavigation } from "expo-router";
import { useIsFocused } from "expo-router/react-navigation";
import { SymbolView } from "expo-symbols";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  type TextInputChangeEventData,
  useWindowDimensions,
  View,
} from "react-native";
import {
  type BacklogSourceFilter,
  matchesBacklogSource,
} from "@/lib/backlog-filters";
import {
  createFilterAction,
  createFilterSubmenu,
  createHeaderFilterMenu,
} from "@/lib/header-filter-menu";
import { createHeaderRightOptions } from "@/lib/header-item-options";

type BacklogGame = Awaited<ReturnType<typeof getBacklog>>[number];
type RatingFilter = "all" | "rated" | "unrated";
type LibrarySort = "added" | "rating" | "title";

function isBacklogStatus(value: string | undefined): value is BacklogStatus {
  return statusOptions.some((option) => option.value === value);
}

export default function StatusGamesScreen() {
  const { i18n, t } = useTranslation();
  const { status: statusParam } = useLocalSearchParams<{ status: string }>();
  const status = isBacklogStatus(statusParam) ? statusParam : null;
  const statusOption = statusOptions.find((option) => option.value === status);
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { width } = useWindowDimensions();
  const [games, setGames] = useState<BacklogGame[]>([]);
  const [query, setQuery] = useState("");
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all");
  const [sort, setSort] = useState<LibrarySort>("added");
  const [sourceFilter, setSourceFilter] =
    useState<BacklogSourceFilter>("all");
  const horizontalPadding = 16;
  const columnGap = 10;
  const coverWidth = Math.floor(
    (width - horizontalPadding * 2 - columnGap * 2) / 3,
  );
  const coverHeight = Math.round(coverWidth * (4 / 3));
  const normalizedQuery = query.trim().toLocaleLowerCase(i18n.language);
  const filteredGames = useMemo(() => {
    const filtered = games.filter((game) => {
      const matchesQuery =
        !normalizedQuery ||
        game.name.toLocaleLowerCase(i18n.language).includes(normalizedQuery);
      const matchesRating =
        ratingFilter === "all" ||
        (ratingFilter === "rated" && game.backlog.rating !== null) ||
        (ratingFilter === "unrated" && game.backlog.rating === null);

      return (
        matchesQuery &&
        matchesRating &&
        matchesBacklogSource(game.backlog.sourceUrl, sourceFilter)
      );
    });

    return [...filtered].sort((left, right) => {
      if (sort === "title") {
        return left.name.localeCompare(right.name, i18n.language);
      }
      if (sort === "rating") {
        return (right.backlog.rating ?? -1) - (left.backlog.rating ?? -1);
      }
      return right.backlog.addedAt.getTime() - left.backlog.addedAt.getTime();
    });
  }, [games, i18n.language, normalizedQuery, ratingFilter, sort, sourceFilter]);

  useLayoutEffect(() => {
    const label = statusOption ? t(statusOption.label) : t("Library");

    navigation.setOptions({
      title: label,
      headerSearchBarOptions: {
        autoCapitalize: "none",
        hideWhenScrolling: false,
        placeholder: t("Search {{label}}", { label }),
        onCancelButtonPress: () => setQuery(""),
        onChangeText: (event: NativeSyntheticEvent<TextInputChangeEventData>) =>
          setQuery(event.nativeEvent.text),
      },
      ...createHeaderRightOptions(() => [
        createHeaderFilterMenu({
          active:
            ratingFilter !== "all" ||
            sort !== "added" ||
            sourceFilter !== "all",
          items: [
            createFilterSubmenu({
              icon: { name: "star", type: "sfSymbol" },
              label: t("Rating"),
              items: [
                createFilterAction({
                  label: t("All games"),
                  onPress: () => setRatingFilter("all"),
                  selected: ratingFilter === "all",
                }),
                createFilterAction({
                  label: t("Rated"),
                  onPress: () => setRatingFilter("rated"),
                  selected: ratingFilter === "rated",
                }),
                createFilterAction({
                  label: t("Not rated"),
                  onPress: () => setRatingFilter("unrated"),
                  selected: ratingFilter === "unrated",
                }),
              ],
            }),
            createFilterSubmenu({
              icon: { name: "link", type: "sfSymbol" },
              label: t("Source"),
              items: [
                ...([
                  ["all", t("All sources")],
                  ["tiktok", "TikTok"],
                  ["youtube", "YouTube"],
                  ["instagram", "Instagram"],
                  ["other-link", t("Other links")],
                  ["manual", t("Added manually")],
                ] as const).map(([value, label]) =>
                  createFilterAction({
                    label,
                    onPress: () => setSourceFilter(value),
                    selected: sourceFilter === value,
                  }),
                ),
              ],
            }),
            createFilterSubmenu({
              icon: { name: "arrow.up.arrow.down", type: "sfSymbol" },
              label: t("Sort by"),
              items: [
                createFilterAction({
                  label: t("Recently added"),
                  onPress: () => setSort("added"),
                  selected: sort === "added",
                }),
                createFilterAction({
                  label: t("Highest rated"),
                  onPress: () => setSort("rating"),
                  selected: sort === "rating",
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
          title: t("{{label}} filters", { label }),
        }),
      ]),
    });
  }, [
    navigation,
    ratingFilter,
    sort,
    sourceFilter,
    statusOption,
    t,
  ]);

  useEffect(() => {
    if (!isFocused || !status) return;

    let active = true;

    void getBacklog().then((items) => {
      if (!active) return;
      setGames(
        withPreviewBacklog(items).filter(
          (game) => game.backlog.status === status,
        ),
      );
    });

    return () => {
      active = false;
    };
  }, [isFocused, status]);

  return (
    <LegendList
      columnWrapperStyle={{ gap: columnGap }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      data={filteredGames}
      extraData={coverWidth}
      keyExtractor={(game) => String(game.igdbId)}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          {normalizedQuery ? (
            <>
              <SymbolView
                name={{ android: "search_off", ios: "magnifyingglass" }}
                size={40}
                tintColor={colors.textMuted}
              />
              <Text style={styles.emptyTitle}>{t("No matching games")}</Text>
              <Text style={styles.emptyText}>
                {t("Try searching with a different title.")}
              </Text>
            </>
          ) : (
            <>
              <SymbolView
                name={
                  statusOption?.icon ?? {
                    android: "bookmark",
                    ios: "bookmark",
                  }
                }
                size={64}
                tintColor={colors.textMuted}
              />
              <Text style={styles.emptyTitle}>{t("No games here yet")}</Text>
              <Text style={styles.emptyText}>
                {t("Change a game’s status and it will appear here.")}
              </Text>
            </>
          )}
        </View>
      }
      numColumns={3}
      renderItem={({ item }) => (
        <GameGridItem
          coverHeight={coverHeight}
          coverWidth={coverWidth}
          game={item}
        />
      )}
      style={styles.container}
    />
  );
}

function GameGridItem({
  coverHeight,
  coverWidth,
  game,
}: {
  coverHeight: number;
  coverWidth: number;
  game: BacklogGame;
}) {
  const coverStyle = StyleSheet.flatten([
    styles.cover,
    { height: coverHeight, width: coverWidth },
  ]);

  return (
    <Link
      href={{ pathname: "/game/[id]", params: { id: String(game.igdbId) } }}
      asChild
    >
      <Link.Trigger>
        <Pressable
          accessibilityLabel={game.name}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.gameItem,
            { width: coverWidth },
            pressed && styles.gameItemPressed,
          ]}
        >
          <Link.AppleZoom>
            {game.coverUrl ? (
              <Image
                contentFit="cover"
                source={game.coverUrl}
                style={coverStyle}
                transition={180}
              />
            ) : (
              <View style={[coverStyle, styles.coverPlaceholder]} />
            )}
          </Link.AppleZoom>
        </Pressable>
      </Link.Trigger>
    </Link>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: 32,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  gameItem: {
    gap: 7,
    paddingBottom: 16,
  },
  gameItemPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
  cover: {
    backgroundColor: colors.surface,
    borderCurve: "continuous",
    borderRadius: 16,
  },
  coverPlaceholder: {
    borderColor: "rgba(255, 255, 255, 0.24)",
    borderStyle: "dashed",
    borderWidth: 1.5,
  },
  gameTitle: {
    marginTop: 8,
    color: colors.text,
    fontSize: theme.size.md,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 32,
    paddingTop: 96,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: theme.size.xl,
    fontWeight: "700",
    paddingTop: 4,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: theme.size.md,
    textAlign: "center",
  },
});
