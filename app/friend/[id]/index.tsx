import { FriendBacklogRecommendations } from "@/components/friend-backlog-recommendations";
import { FriendComparisonSummary } from "@/components/friend-comparison-summary";
import { FriendCurrentlyPlaying } from "@/components/friend-currently-playing";
import { FriendGamesInCommon } from "@/components/friend-games-in-common";
import { FriendIdentity } from "@/components/friend-identity";
import { FriendLibrary } from "@/components/friend-library";
import {
  previewCommonGames,
  previewCurrentlyPlaying,
  previewFriendLibrary,
} from "@/constants/friend-preview";
import { colors, theme } from "@/constants/theme";
import { saveGameToBacklog } from "@/db/repository";
import { useRevenueCat } from "@/hooks/use-revenuecat";
import { getGame } from "@/lib/igdb";
import {
  blockFriend,
  type FriendLibraryGame,
  friendsQueryKey,
  getFriend,
  getFriendBacklogRecommendations,
  getFriendCommonGames,
  getFriendComparisonSummary,
  getFriendCurrentlyPlaying,
  getFriendLibrary,
  removeFriend,
} from "@/services/sharing";
import ExpoSegmentedControl from "@expo/ui/community/segmented-control";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Burnt from "burnt";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  type TextInputChangeEventData,
  View,
} from "react-native";
import type { BacklogStatus } from "@/db/schema";
import {
  createFilterAction,
  createFilterSubmenu,
  createHeaderFilterMenu,
} from "@/lib/header-filter-menu";
import { createHeaderRightOptions } from "@/lib/header-item-options";

type LibraryFilter = "all" | "rated" | BacklogStatus;
type LibrarySort = "default" | "rating" | "title";

type RelationshipAction = "block" | "remove";

export default function FriendDetailScreen() {
  const { t } = useTranslation();
  const { id: idParam } = useLocalSearchParams<{ id?: string | string[] }>();
  const friendId = Array.isArray(idParam) ? idParam[0] : idParam;
  const navigation = useNavigation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    isConfigured,
    isLoading: isRevenueCatLoading,
    isPro,
    presentPaywallIfNeeded,
  } = useRevenueCat();
  const [isUnlockingComparison, setIsUnlockingComparison] = useState(false);
  const [selectedSection, setSelectedSection] = useState(0);
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryFilter, setLibraryFilter] =
    useState<LibraryFilter>("all");
  const [librarySort, setLibrarySort] =
    useState<LibrarySort>("default");
  const friendQuery = useQuery({
    enabled: Boolean(friendId),
    queryFn: () => getFriend(friendId!),
    queryKey: [...friendsQueryKey, friendId],
  });
  const friend = friendQuery.data;
  const comparisonQuery = useQuery({
    enabled: Boolean(friend && friendId && selectedSection === 0),
    queryFn: () => getFriendComparisonSummary(friendId!),
    queryKey: ["friend-comparison-summary", friendId],
  });
  const currentlyPlayingQuery = useQuery({
    enabled: Boolean(friend && friendId && selectedSection === 0),
    queryFn: () => getFriendCurrentlyPlaying(friendId!),
    queryKey: ["friend-currently-playing", friendId],
  });
  const commonGamesQuery = useQuery({
    enabled: Boolean(friend && friendId && selectedSection === 0),
    queryFn: () => getFriendCommonGames(friendId!),
    queryKey: ["friend-common-games", friendId],
  });
  const backlogRecommendationsQuery = useQuery({
    enabled: Boolean(friend && friendId && selectedSection === 0),
    queryFn: () => getFriendBacklogRecommendations(friendId!),
    queryKey: ["friend-backlog-recommendations", friendId],
  });
  const libraryQuery = useQuery({
    enabled: Boolean(friend && friendId && selectedSection === 1),
    queryFn: () => getFriendLibrary(friendId!),
    queryKey: ["friend-library", friendId],
  });
  const currentlyPlayingGames =
    currentlyPlayingQuery.data?.length || !__DEV__
      ? (currentlyPlayingQuery.data ?? [])
      : previewCurrentlyPlaying;
  const commonGames =
    commonGamesQuery.data?.length || !__DEV__
      ? (commonGamesQuery.data ?? [])
      : previewCommonGames;
  const libraryGames = useMemo(
    () =>
      libraryQuery.data?.length || !__DEV__
        ? (libraryQuery.data ?? [])
        : previewFriendLibrary,
    [libraryQuery.data],
  );
  const normalizedLibrarySearch = librarySearch.trim().toLocaleLowerCase();
  const filteredLibraryGames = useMemo(() => {
    const filtered = libraryGames.filter((game) => {
      const matchesQuery =
        !normalizedLibrarySearch ||
        game.name.toLocaleLowerCase().includes(normalizedLibrarySearch);
      const matchesFilter =
        libraryFilter === "all" ||
        (libraryFilter === "rated" && game.rating !== null) ||
        game.status === libraryFilter;

      return matchesQuery && matchesFilter;
    });

    if (librarySort === "default") return filtered;
    return [...filtered].sort((left, right) =>
      librarySort === "title"
        ? left.name.localeCompare(right.name)
        : (right.rating ?? -1) - (left.rating ?? -1),
    );
  }, [libraryFilter, libraryGames, librarySort, normalizedLibrarySearch]);
  const relationshipMutation = useMutation({
    mutationFn: async (action: RelationshipAction) => {
      if (!friendId) throw new Error(t("Friend not found."));
      return action === "block"
        ? blockFriend(friendId)
        : removeFriend(friendId);
    },
    onError: (error) => {
      console.error("Unable to update friendship", error);
      Burnt.toast({
        preset: "error",
        title: t("Unable to update friendship"),
      });
    },
    onSuccess: (_, action) => {
      void queryClient.invalidateQueries({ queryKey: friendsQueryKey });
      Burnt.toast({
        title: action === "block" ? t("Player blocked") : t("Friend removed"),
      });
      router.back();
    },
  });
  const addRecommendationMutation = useMutation({
    mutationFn: async (recommendation: FriendLibraryGame) => {
      const game = await getGame(recommendation.igdbId);
      await saveGameToBacklog(game);
      return recommendation;
    },
    onError: (error) => {
      console.error("Unable to add friend recommendation", error);
      Burnt.toast({ preset: "error", title: t("Unable to add game") });
    },
    onSuccess: (recommendation) => {
      queryClient.setQueryData<FriendLibraryGame[]>(
        ["friend-backlog-recommendations", friendId],
        (current) =>
          current?.filter((game) => game.igdbId !== recommendation.igdbId),
      );
      void queryClient.invalidateQueries({
        queryKey: ["friend-backlog-recommendations", friendId],
      });
      Burnt.toast({
        title: t("{{name}} added to your backlog", { name: recommendation.name }),
      });
    },
  });
  const mutateRelationship = relationshipMutation.mutate;

  const unlockComparison = useCallback(async () => {
    if (isPro || isUnlockingComparison) return;
    if (!isConfigured || isRevenueCatLoading) {
      Burnt.toast({
        preset: "error",
        title: t("Joylogue Pro is still loading"),
      });
      return;
    }

    try {
      setIsUnlockingComparison(true);
      await presentPaywallIfNeeded();
    } catch (error) {
      console.error("Unable to open Joylogue Pro", error);
      Burnt.toast({
        preset: "error",
        title: t("Unable to open Joylogue Pro"),
      });
    } finally {
      setIsUnlockingComparison(false);
    }
  }, [
    isConfigured,
    isPro,
    isRevenueCatLoading,
    isUnlockingComparison,
    presentPaywallIfNeeded,
    t,
  ]);

  const confirmAction = useCallback(
    (action: RelationshipAction) => {
      if (!friend) return;

      const isBlock = action === "block";
      Alert.alert(
        isBlock
          ? t("Block {{name}}?", { name: friend.displayName })
          : t("Remove {{name}}?", { name: friend.displayName }),
        isBlock
          ? t("They will be removed as a friend and will no longer be able to interact with you.")
          : t("You will no longer be able to compare your backlogs."),
        [
          { style: "cancel", text: t("Cancel") },
          {
            onPress: () => mutateRelationship(action),
            style: "destructive",
            text: isBlock ? t("Block") : t("Remove Friend"),
          },
        ],
      );
    },
    [friend, mutateRelationship, t],
  );

  const openRelationshipMenu = useCallback(() => {
    if (!friend || relationshipMutation.isPending) return;

    if (process.env.EXPO_OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          cancelButtonIndex: 2,
          destructiveButtonIndex: [0, 1],
          options: [t("Remove Friend"), t("Block"), t("Cancel")],
          title: friend.displayName,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) confirmAction("remove");
          if (buttonIndex === 1) confirmAction("block");
        },
      );
      return;
    }

    Alert.alert(friend.displayName, undefined, [
      {
        onPress: () => confirmAction("remove"),
        style: "destructive",
        text: t("Remove Friend"),
      },
      {
        onPress: () => confirmAction("block"),
        style: "destructive",
        text: t("Block"),
      },
      { style: "cancel", text: t("Cancel") },
    ]);
  }, [confirmAction, friend, relationshipMutation.isPending, t]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "",
      headerSearchBarOptions:
        selectedSection === 1
          ? {
              autoCapitalize: "none",
              hideWhenScrolling: false,
              placeholder: friend
                ? t("Search {{name}}'s library", { name: friend.displayName })
                : t("Search library"),
              onCancelButtonPress: () => setLibrarySearch(""),
              onChangeText: (
                event: NativeSyntheticEvent<TextInputChangeEventData>,
              ) =>
                setLibrarySearch(event.nativeEvent.text),
            }
          : undefined,
      ...createHeaderRightOptions(() => [
        ...(selectedSection === 1
          ? [
              createHeaderFilterMenu({
                active:
                  libraryFilter !== "all" || librarySort !== "default",
                items: [
                  createFilterSubmenu({
                    icon: { name: "books.vertical", type: "sfSymbol" },
                    label: t("Status"),
                    items: [
                      ...([
                        ["all", t("All games")],
                        ["playing", t("Playing")],
                        ["want-to-play", t("Want to play")],
                        ["completed", t("Completed")],
                        ["shelved", t("Shelved")],
                        ["abandoned", t("Abandoned")],
                        ["rated", t("Rated")],
                      ] as const).map(([value, label]) =>
                        createFilterAction({
                          label,
                          onPress: () => setLibraryFilter(value),
                          selected: libraryFilter === value,
                        }),
                      ),
                    ],
                  }),
                  createFilterSubmenu({
                    icon: { name: "arrow.up.arrow.down", type: "sfSymbol" },
                    label: t("Sort by"),
                    items: [
                      createFilterAction({
                        label: t("Shared order"),
                        onPress: () => setLibrarySort("default"),
                        selected: librarySort === "default",
                      }),
                      createFilterAction({
                        label: t("Highest rated"),
                        onPress: () => setLibrarySort("rating"),
                        selected: librarySort === "rating",
                      }),
                      createFilterAction({
                        label: t("Title"),
                        onPress: () => setLibrarySort("title"),
                        selected: librarySort === "title",
                      }),
                    ],
                  }),
                ],
                tintColor: colors.primary,
                title: t("Library filters"),
              }),
            ]
          : []),
        {
          type: "button",
          label: t("More"),
          icon: { type: "sfSymbol", name: "ellipsis" },
          accessibilityLabel: t("Friend options"),
          onPress: openRelationshipMenu,
        },
      ]),
    });
  }, [
    friend,
    libraryFilter,
    librarySort,
    navigation,
    openRelationshipMenu,
    selectedSection,
    t,
  ]);

  if (friend) {
    const header = (
      <>
        <FriendIdentity
          avatarUrl={friend.avatarUrl}
          displayName={friend.displayName}
          friendsSince={friend.friendsSince}
        />
        <View style={styles.segmentedControlContainer}>
          <ExpoSegmentedControl
            appearance="dark"
            onChange={(event) => {
              const nextSection = event.nativeEvent.selectedSegmentIndex;
              setSelectedSection(nextSection);
              if (nextSection === 0) setLibrarySearch("");
            }}
            selectedIndex={selectedSection}
            style={styles.segmentedControl}
            values={[t("Details"), t("Library")]}
          />
        </View>
      </>
    );

    if (selectedSection === 1) {
      return (
        <FriendLibrary
          friendName={friend.displayName}
          games={filteredLibraryGames}
          header={header}
          hasActiveFilter={
            libraryFilter !== "all" || librarySort !== "default"
          }
          hasSearchQuery={Boolean(normalizedLibrarySearch)}
          isLoading={libraryQuery.isPending}
        />
      );
    }

    return (
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        style={styles.screen}
      >
        {header}
        <FriendComparisonSummary summary={comparisonQuery.data ?? null} />
        <FriendCurrentlyPlaying
          friendId={friend.id}
          games={currentlyPlayingGames}
        />
        <FriendGamesInCommon
          currentlyPlayingIds={currentlyPlayingGames.map(
            (game) => game.igdbId,
          )}
          friendId={friend.id}
          friendName={friend.displayName}
          games={commonGames}
          isLocked={!isPro && commonGames.length > 1}
          isUnlocking={isUnlockingComparison}
          onUnlock={() => void unlockComparison()}
        />
        <FriendBacklogRecommendations
          friendName={friend.displayName}
          games={backlogRecommendationsQuery.data ?? []}
          onAdd={(game) => addRecommendationMutation.mutate(game)}
          savingGameId={
            addRecommendationMutation.isPending
              ? (addRecommendationMutation.variables?.igdbId ?? null)
              : null
          }
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
    >
      {friendQuery.isPending ? (
        <View style={styles.feedback}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.feedbackText}>{t("Loading friend...")}</Text>
        </View>
      ) : null}

      {friendQuery.isError || !friendId ? (
        <View style={styles.feedback}>
          <SymbolView
            name="person.crop.circle.badge.exclamationmark"
            size={48}
            tintColor={colors.textMuted}
          />
          <Text selectable style={styles.feedbackTitle}>
            {t("Friend unavailable")}
          </Text>
          <Text selectable style={styles.feedbackText}>
            {friendQuery.error?.message ?? t("This friend link is incomplete.")}
          </Text>
        </View>
      ) : null}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    experimental_backgroundImage:
      "radial-gradient(circle at 50% 6%, rgba(83, 102, 102, 0.46) 0%, rgba(31, 42, 42, 0.22) 30%, #121212 62%)",
  },
  content: {
    paddingBottom: 120,
  },
  segmentedControlContainer: {
    paddingBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  segmentedControl: {
    height: 32,
  },
  feedback: {
    alignItems: "center",
    flex: 1,
    gap: theme.spacing.sm,
    justifyContent: "center",
    padding: theme.spacing.xl,
  },
  feedbackTitle: {
    color: colors.text,
    fontSize: theme.size.xl,
    fontWeight: "700",
  },
  feedbackText: {
    color: colors.textMuted,
    fontSize: theme.size.md,
    textAlign: "center",
  },
});
