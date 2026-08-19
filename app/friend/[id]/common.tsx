import { LegendList } from "@legendapp/list";
import { useQuery } from "@tanstack/react-query";
import * as Burnt from "burnt";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { FriendCommonGameRow } from "@/components/friend-games-in-common";
import { ProBlurGate } from "@/components/pro-blur-gate";
import { previewCommonGames } from "@/constants/friend-preview";
import { colors, theme } from "@/constants/theme";
import { useRevenueCat } from "@/hooks/use-revenuecat";
import {
  friendsQueryKey,
  getFriend,
  getFriendCommonGames,
} from "@/services/sharing";
import {
  createFilterAction,
  createHeaderFilterMenu,
} from "@/lib/header-filter-menu";
import { createHeaderRightOptions } from "@/lib/header-item-options";

type ComparisonFilter = "all" | "both-completed" | "both-rated" | "different";

export default function FriendCommonGamesScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { id: idParam } = useLocalSearchParams<{ id?: string | string[] }>();
  const friendId = Array.isArray(idParam) ? idParam[0] : idParam;
  const [filter, setFilter] = useState<ComparisonFilter>("all");
  const [isUnlocking, setIsUnlocking] = useState(false);
  const {
    isConfigured,
    isLoading: isRevenueCatLoading,
    isPro,
    presentPaywallIfNeeded,
  } = useRevenueCat();
  const friendQuery = useQuery({
    enabled: Boolean(friendId),
    queryFn: () => getFriend(friendId!),
    queryKey: [...friendsQueryKey, friendId],
  });
  const gamesQuery = useQuery({
    enabled: Boolean(friendId),
    queryFn: () => getFriendCommonGames(friendId!),
    queryKey: ["friend-common-games", friendId],
  });
  const games = useMemo(
    () =>
      gamesQuery.data?.length || !__DEV__
        ? (gamesQuery.data ?? [])
        : previewCommonGames,
    [gamesQuery.data],
  );
  const visibleGames = useMemo(
    () =>
      games.filter((game) => {
        if (filter === "both-completed") {
          return (
            game.you.status === "completed" &&
            game.friend.status === "completed"
          );
        }
        if (filter === "both-rated") {
          return game.you.rating !== null && game.friend.rating !== null;
        }
        if (filter === "different") {
          return game.you.status !== game.friend.status;
        }
        return true;
      }),
    [filter, games],
  );
  const unlockComparison = useCallback(async () => {
    if (isPro || isUnlocking) return;
    if (!isConfigured || isRevenueCatLoading) {
      Burnt.toast({
        preset: "error",
        title: t("Joylogue Pro is still loading"),
      });
      return;
    }

    try {
      setIsUnlocking(true);
      await presentPaywallIfNeeded();
    } catch (error) {
      Burnt.toast({
        preset: "error",
        title:
          error instanceof Error ? error.message : t("Unable to open Joylogue Pro"),
      });
    } finally {
      setIsUnlocking(false);
    }
  }, [
    isConfigured,
    isPro,
    isRevenueCatLoading,
    isUnlocking,
    presentPaywallIfNeeded,
    t,
  ]);

  useLayoutEffect(() => {
    navigation.setOptions({
      ...createHeaderRightOptions(() =>
        isPro
          ? [createHeaderFilterMenu({
          active: filter !== "all",
          items: [
            createFilterAction({
              label: t("All shared games"),
              onPress: () => setFilter("all"),
              selected: filter === "all",
            }),
            createFilterAction({
              icon: { name: "checkmark.circle", type: "sfSymbol" },
              label: t("Completed by both"),
              onPress: () => setFilter("both-completed"),
              selected: filter === "both-completed",
            }),
            createFilterAction({
              icon: { name: "star", type: "sfSymbol" },
              label: t("Rated by both"),
              onPress: () => setFilter("both-rated"),
              selected: filter === "both-rated",
            }),
            createFilterAction({
              icon: { name: "arrow.left.arrow.right", type: "sfSymbol" },
              label: t("Different statuses"),
              onPress: () => setFilter("different"),
              selected: filter === "different",
            }),
          ],
          tintColor: colors.primary,
          title: t("Compare"),
            })]
          : [],
      ),
    });
  }, [filter, isPro, navigation, t]);

  if (!isPro && visibleGames.length > 0) {
    const lockedPreview = visibleGames.slice(0, 3);

    return (
      <View style={styles.screen}>
        <ProBlurGate
          isBusy={isUnlocking}
          message={t("See every shared game, rating, status, and progress comparison.")}
          onUnlock={() => void unlockComparison()}
          title={t("Unlock full comparison")}
        >
          {lockedPreview.map((game, index) => (
            <FriendCommonGameRow
              friendName={friendQuery.data?.displayName ?? t("Friend")}
              game={game}
              key={game.igdbId}
              showSeparator={index < lockedPreview.length - 1}
            />
          ))}
        </ProBlurGate>
      </View>
    );
  }

  return (
    <LegendList
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      data={visibleGames}
      keyExtractor={(game) => String(game.igdbId)}
      ListEmptyComponent={
        gamesQuery.isPending || friendQuery.isPending ? (
          <View style={styles.feedback}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : (
          <View style={styles.feedback}>
            <SymbolView
              name={{ android: "collections_bookmark", ios: "rectangle.stack" }}
              size={44}
              tintColor={colors.textMuted}
            />
            <Text style={styles.emptyTitle}>
              {filter === "all"
                ? t("No games in common yet")
                : t("No games match this comparison")}
            </Text>
          </View>
        )
      }
      renderItem={({ item, index }) => (
        <FriendCommonGameRow
          friendName={friendQuery.data?.displayName ?? t("Friend")}
          game={item}
          showSeparator={index < visibleGames.length - 1}
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
    paddingBottom: 120,
    paddingTop: theme.spacing.sm,
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
