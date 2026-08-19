import { FriendPlayingGameCard } from "@/components/friend-currently-playing";
import { previewCurrentlyPlaying } from "@/constants/friend-preview";
import { colors, theme } from "@/constants/theme";
import { getFriendCurrentlyPlaying } from "@/services/sharing";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { SymbolView } from "expo-symbols";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  createFilterAction,
  createHeaderFilterMenu,
} from "@/lib/header-filter-menu";
import { createHeaderRightOptions } from "@/lib/header-item-options";

const GRID_GAP = 12;
type ProgressFilter = "all" | "early" | "mid" | "nearly-done";

export default function FriendCurrentlyPlayingScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { id: idParam } = useLocalSearchParams<{ id?: string | string[] }>();
  const friendId = Array.isArray(idParam) ? idParam[0] : idParam;
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState<ProgressFilter>("all");
  const playingQuery = useQuery({
    enabled: Boolean(friendId),
    queryFn: () => getFriendCurrentlyPlaying(friendId!, null),
    queryKey: ["friend-currently-playing", friendId, "all"],
  });
  const games = useMemo(
    () =>
      playingQuery.data?.length || !__DEV__
        ? (playingQuery.data ?? [])
        : previewCurrentlyPlaying,
    [playingQuery.data],
  );
  const visibleGames = useMemo(
    () =>
      games.filter((game) => {
        const progress =
          game.progressCurrent / Math.max(1, game.progressTotal);
        if (filter === "early") return progress < 0.25;
        if (filter === "mid") return progress >= 0.25 && progress < 0.75;
        if (filter === "nearly-done") return progress >= 0.75;
        return true;
      }),
    [filter, games],
  );
  const cardWidth =
    (width - theme.spacing.lg * 2 - GRID_GAP) / 2;

  useLayoutEffect(() => {
    navigation.setOptions({
      ...createHeaderRightOptions(() => [
        createHeaderFilterMenu({
          active: filter !== "all",
          items: [
            createFilterAction({
              label: t("All progress"),
              onPress: () => setFilter("all"),
              selected: filter === "all",
            }),
            createFilterAction({
              label: t("Just started"),
              description: t("Under 25%"),
              onPress: () => setFilter("early"),
              selected: filter === "early",
            }),
            createFilterAction({
              label: t("In progress"),
              description: "25–74%",
              onPress: () => setFilter("mid"),
              selected: filter === "mid",
            }),
            createFilterAction({
              label: t("Nearly done"),
              description: t("75% or more"),
              onPress: () => setFilter("nearly-done"),
              selected: filter === "nearly-done",
            }),
          ],
          tintColor: colors.primary,
          title: t("Progress"),
        }),
      ]),
    });
  }, [filter, navigation, t]);

  return (
    <FlatList
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      data={visibleGames}
      keyExtractor={(game) => String(game.igdbId)}
      ListEmptyComponent={
        playingQuery.isPending ? (
          <View style={styles.feedback}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : (
          <View style={styles.feedback}>
            <SymbolView
              name="gamecontroller"
              size={44}
              tintColor={colors.textMuted}
            />
            <Text style={styles.emptyTitle}>
              {filter === "all"
                ? t("Nothing currently playing")
                : t("No games in this progress range")}
            </Text>
          </View>
        )
      }
      numColumns={2}
      renderItem={({ item }) => (
        <FriendPlayingGameCard
          featured={false}
          game={item}
          width={cardWidth}
        />
      )}
      style={styles.screen}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    gap: theme.spacing.lg,
    paddingBottom: 120,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  row: {
    gap: GRID_GAP,
  },
  feedback: {
    alignItems: "center",
    flex: 1,
    gap: theme.spacing.md,
    justifyContent: "center",
    paddingVertical: 120,
  },
  emptyTitle: {
    color: colors.textMuted,
    fontSize: theme.size.lg,
    fontWeight: "600",
  },
});
