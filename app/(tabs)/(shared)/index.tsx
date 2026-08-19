import { LegendList } from "@legendapp/list";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Burnt from "burnt";
import { Image } from "expo-image";
import { Link, useFocusEffect, useNavigation, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { PressableOpacity, PressableScale } from "pressto";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  type TextInputChangeEventData,
  View,
} from "react-native";
import type { SearchBarCommands } from "react-native-screens";

import { colors, theme } from "@/constants/theme";
import {
  createFilterAction,
  createHeaderFilterMenu,
} from "@/lib/header-filter-menu";
import { createHeaderRightOptions } from "@/lib/header-item-options";
import {
  type Friend,
  friendsQueryKey,
  getFriends,
  getIncomingFriendRequests,
  type IncomingFriendRequest,
  incomingFriendRequestsQueryKey,
  respondToFriendRequest,
} from "@/services/sharing";

type RelationshipFilter = "all" | "friends" | "requests";

type SharedListItem =
  | { id: string; kind: "loading" }
  | { id: string; kind: "section"; title: string }
  | {
      first: boolean;
      id: string;
      kind: "request";
      last: boolean;
      request: IncomingFriendRequest;
    }
  | {
      first: boolean;
      friend: Friend;
      id: string;
      kind: "friend";
      last: boolean;
    }
  | { id: string; kind: "request-error" }
  | { id: string; kind: "friends-error" }
  | { id: string; kind: "search-empty" }
  | { id: string; kind: "onboarding" };

type ProfileRowShellProps = {
  avatarUrl: string | null;
  children?: React.ReactNode;
  displayName: string;
  first: boolean;
  last: boolean;
  zoomAvatar?: boolean;
};

function ProfileRowShell({
  avatarUrl,
  children,
  displayName,
  first,
  last,
  zoomAvatar = false,
}: ProfileRowShellProps) {
  const { t } = useTranslation();
  const initial = displayName.trim().charAt(0).toUpperCase() || "S";
  const avatar = (
    <View collapsable={false} style={styles.requestAvatar}>
      {avatarUrl ? (
        <Image
          accessibilityLabel={t("{{name}}'s avatar", { name: displayName })}
          contentFit="cover"
          source={avatarUrl}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <Text style={styles.requestInitial}>{initial}</Text>
      )}
    </View>
  );

  return (
    <View
      style={[
        styles.profileRow,
        first && styles.profileRowFirst,
        last && styles.profileRowLast,
      ]}
    >
      {zoomAvatar ? <Link.AppleZoom>{avatar}</Link.AppleZoom> : avatar}
      <View style={styles.requestCopy}>
        <Text numberOfLines={1} style={styles.requestName}>
          {displayName}
        </Text>
      </View>
      {children}
      {!last ? <View style={styles.requestSeparator} /> : null}
    </View>
  );
}

export default function SharedScreen() {
  const { i18n, t } = useTranslation();
  const navigation = useNavigation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchBarRef = useRef<SearchBarCommands | null>(null);
  const [query, setQuery] = useState("");
  const [relationshipFilter, setRelationshipFilter] =
    useState<RelationshipFilter>("all");
  const requestsQuery = useQuery({
    queryFn: getIncomingFriendRequests,
    queryKey: incomingFriendRequestsQueryKey,
  });
  const friendsQuery = useQuery({
    queryFn: getFriends,
    queryKey: friendsQueryKey,
  });
  const responseMutation = useMutation({
    mutationFn: ({
      accept,
      requestId,
    }: {
      accept: boolean;
      requestId: string;
    }) => respondToFriendRequest(requestId, accept),
    onError: (error) => {
      console.error("Unable to respond to friend request", error);
      Burnt.toast({
        preset: "error",
        title: t("Unable to respond to friend request"),
      });
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: incomingFriendRequestsQueryKey,
      });
      void queryClient.invalidateQueries({ queryKey: friendsQueryKey });
      Burnt.toast({
        title: variables.accept ? t("Friend added") : t("Request declined"),
      });
    },
  });

  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({
        queryKey: incomingFriendRequestsQueryKey,
      });
      void queryClient.invalidateQueries({ queryKey: friendsQueryKey });
    }, [queryClient]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      ...createHeaderRightOptions(() => [
        createHeaderFilterMenu({
          accessibilityLabel: t("Filter people"),
          active: relationshipFilter !== "all",
          items: [
            createFilterAction({
              label: t("Everyone"),
              onPress: () => setRelationshipFilter("all"),
              selected: relationshipFilter === "all",
            }),
            createFilterAction({
              icon: { name: "person.2", type: "sfSymbol" },
              label: t("Friends"),
              onPress: () => setRelationshipFilter("friends"),
              selected: relationshipFilter === "friends",
            }),
            createFilterAction({
              icon: { name: "person.crop.circle.badge.plus", type: "sfSymbol" },
              label: t("Requests"),
              onPress: () => setRelationshipFilter("requests"),
              selected: relationshipFilter === "requests",
            }),
          ],
          tintColor: colors.primary,
          title: t("Show"),
        }),
        {
          type: "button",
          label: t("Invite"),
          icon: { type: "sfSymbol", name: "person.badge.plus" },
          tintColor: colors.primary,
          accessibilityLabel: t("Invite friends"),
          accessibilityHint: t("Opens your share ticket"),
          onPress: () => router.push("/share"),
        },
      ]),
      headerSearchBarOptions: {
        ref: searchBarRef,
        autoCapitalize: "none",

        placeholder: t("Search friends"),
        onCancelButtonPress: () => setQuery(""),
        onChangeText: (event: NativeSyntheticEvent<TextInputChangeEventData>) =>
          setQuery(event.nativeEvent.text),
      },
    });
  }, [navigation, relationshipFilter, router, t]);

  const listItems: SharedListItem[] = [];
  const normalizedQuery = query.trim().toLocaleLowerCase(i18n.language);
  const allRequests = requestsQuery.data ?? [];
  const allFriends = friendsQuery.data ?? [];
  const requests =
    relationshipFilter === "friends"
      ? []
      : normalizedQuery
        ? allRequests.filter((request) =>
            request.displayName
              .toLocaleLowerCase(i18n.language)
              .includes(normalizedQuery),
          )
        : allRequests;
  const friends =
    relationshipFilter === "requests"
      ? []
      : normalizedQuery
        ? allFriends.filter((friend) =>
            friend.displayName
              .toLocaleLowerCase(i18n.language)
              .includes(normalizedQuery),
          )
        : allFriends;

  if (requestsQuery.isPending || friendsQuery.isPending) {
    listItems.push({ id: "loading", kind: "loading" });
  }

  if (requests.length > 0) {
    listItems.push({
      id: "requests-section",
      kind: "section",
      title: t("Friend requests"),
    });
    requests.forEach((request, index) => {
      listItems.push({
        first: index === 0,
        id: `request-${request.id}`,
        kind: "request",
        last: index === requests.length - 1,
        request,
      });
    });
  }

  if (requestsQuery.isError) {
    listItems.push({ id: "requests-error", kind: "request-error" });
  }

  if (friends.length > 0) {
    listItems.push({
      id: "friends-section",
      kind: "section",
      title: t("Friends"),
    });
    friends.forEach((friend, index) => {
      listItems.push({
        first: index === 0,
        friend,
        id: `friend-${friend.id}`,
        kind: "friend",
        last: index === friends.length - 1,
      });
    });
  }

  if (friendsQuery.isError) {
    listItems.push({ id: "friends-error", kind: "friends-error" });
  }

  if (
    (normalizedQuery || relationshipFilter !== "all") &&
    !requestsQuery.isPending &&
    !friendsQuery.isPending &&
    requests.length === 0 &&
    friends.length === 0
  ) {
    listItems.push({ id: "search-empty", kind: "search-empty" });
  }

  if (
    !normalizedQuery &&
    relationshipFilter === "all" &&
    friendsQuery.isSuccess &&
    allFriends.length === 0
  ) {
    listItems.push({ id: "onboarding", kind: "onboarding" });
  }

  return (
    <LegendList
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      data={listItems}
      extraData={responseMutation.variables}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => {
        if (item.kind === "loading") {
          return (
            <View style={styles.requestsLoading}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.requestsLoadingText}>
                {t("Loading Shared...")}
              </Text>
            </View>
          );
        }

        if (item.kind === "section") {
          return <Text style={styles.sectionTitle}>{item.title}</Text>;
        }

        if (item.kind === "request") {
          const isResponding =
            responseMutation.isPending &&
            responseMutation.variables?.requestId === item.request.id;

          return (
            <ProfileRowShell
              avatarUrl={item.request.avatarUrl}
              displayName={item.request.displayName}
              first={item.first}
              last={item.last}
            >
              <View style={styles.requestActions}>
                <PressableScale
                  accessibilityLabel={t("Accept {{name}}'s friend request", {
                    name: item.request.displayName,
                  })}
                  accessibilityRole="button"
                  disabled={responseMutation.isPending}
                  onPress={() =>
                    responseMutation.mutate({
                      accept: true,
                      requestId: item.request.id,
                    })
                  }
                  style={styles.acceptButton}
                >
                  {isResponding ? (
                    <ActivityIndicator color={colors.background} size="small" />
                  ) : (
                    <Text style={styles.acceptButtonText}>{t("Accept")}</Text>
                  )}
                </PressableScale>
                <PressableOpacity
                  accessibilityLabel={t("Decline {{name}}'s friend request", {
                    name: item.request.displayName,
                  })}
                  accessibilityRole="button"
                  disabled={responseMutation.isPending}
                  onPress={() =>
                    responseMutation.mutate({
                      accept: false,
                      requestId: item.request.id,
                    })
                  }
                  style={styles.declineButton}
                >
                  <SymbolView
                    name={{ android: "close", ios: "xmark" }}
                    size={15}
                    tintColor={colors.textMuted}
                  />
                </PressableOpacity>
              </View>
            </ProfileRowShell>
          );
        }

        if (item.kind === "friend") {
          return (
            <Link
              asChild
              href={{
                pathname: "/friend/[id]",
                params: { id: item.friend.id },
              }}
            >
              <Pressable
                accessibilityHint={t(
                  "Opens this friend's backlog comparison",
                )}
                accessibilityLabel={t("View {{name}}", {
                  name: item.friend.displayName,
                })}
                accessibilityRole="button"
              >
                <ProfileRowShell
                  avatarUrl={item.friend.avatarUrl}
                  displayName={item.friend.displayName}
                  first={item.first}
                  last={item.last}
                  zoomAvatar
                >
                  <SymbolView
                    name={{ android: "chevron_right", ios: "chevron.right" }}
                    size={17}
                    tintColor={colors.textMuted}
                  />
                </ProfileRowShell>
              </Pressable>
            </Link>
          );
        }

        if (item.kind === "request-error" || item.kind === "friends-error") {
          const isRequestError = item.kind === "request-error";
          return (
            <PressableScale
              accessibilityLabel={t(
                isRequestError
                  ? "Retry loading friend requests"
                  : "Retry loading friends",
              )}
              accessibilityRole="button"
              onPress={() =>
                isRequestError
                  ? requestsQuery.refetch()
                  : friendsQuery.refetch()
              }
              style={styles.requestsError}
            >
              <Text style={styles.requestsErrorText}>
                {t(
                  isRequestError
                    ? "Couldn't load requests. Tap to retry."
                    : "Couldn't load friends. Tap to retry.",
                )}
              </Text>
            </PressableScale>
          );
        }

        if (item.kind === "search-empty") {
          const emptyTitle = normalizedQuery
            ? t("No people found")
            : relationshipFilter === "requests"
              ? t("No friend requests")
              : t("No friends yet");

          return (
            <View style={styles.searchEmpty}>
              <SymbolView
                name={{
                  android: "person_search",
                  ios: "person.crop.circle.badge.questionmark",
                }}
                size={42}
                tintColor={colors.textMuted}
              />
              <Text style={styles.searchEmptyTitle}>{emptyTitle}</Text>
            </View>
          );
        }

        return (
          <View style={styles.onboardingCard}>
            <SymbolView
              name={{ android: "group", ios: "person.2.fill" }}
              size={80}
              tintColor={colors.primary}
              type="hierarchical"
            />
            <View style={styles.copy}>
              <Text style={styles.cardTitle}>
                {t("Games are better shared.")}
              </Text>
              <Text style={styles.cardDescription}>
                {t(
                  "Share your backlog, compare progress, and give friends their next game to play.",
                )}
              </Text>
            </View>
            <PressableScale
              accessibilityHint={t("Opens your share ticket")}
              accessibilityLabel={t("Create share ticket")}
              accessibilityRole="button"
              onPress={() => router.push("/share")}
              style={styles.button}
            >
              <SymbolView
                name={{ android: "add", ios: "plus" }}
                size={18}
                tintColor={colors.background}
              />
              <Text style={styles.buttonText}>{t("Add Friends")}</Text>
            </PressableScale>
          </View>
        );
      }}
      style={styles.screen}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: 120,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: theme.size.lg + 2,
    fontWeight: "600",
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  profileRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    flexDirection: "row",
    gap: theme.spacing.sm,
    minHeight: 76,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    position: "relative",
  },
  profileRowFirst: {
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    borderCurve: "continuous",
  },
  profileRowLast: {
    borderBottomLeftRadius: theme.radius.lg,
    borderBottomRightRadius: theme.radius.lg,
    borderCurve: "continuous",
  },
  requestAvatar: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderCurve: "continuous",
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    overflow: "hidden",
    width: 48,
  },
  requestInitial: {
    color: colors.text,
    fontSize: theme.size.xl,
    fontWeight: "700",
  },
  requestCopy: {
    flex: 1,
    justifyContent: "center",
    minWidth: 0,
  },
  requestName: {
    color: colors.text,
    fontSize: theme.size.lg,
    fontWeight: "700",
  },
  requestActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md,
  },
  declineButton: {
    alignItems: "center",
    borderRadius: theme.radius.pill,
    justifyContent: "center",
    minHeight: 36,
    minWidth: 24,
  },
  acceptButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderCurve: "continuous",
    borderRadius: theme.radius.pill,
    justifyContent: "center",
    minWidth: 68,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  acceptButtonText: {
    color: colors.background,
    fontSize: theme.size.md,
    fontWeight: "600",
  },
  requestSeparator: {
    backgroundColor: colors.border,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    left: 80,
    position: "absolute",
    right: 0,
  },
  requestsLoading: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
  },
  requestsLoadingText: {
    color: colors.textMuted,
    fontSize: theme.size.md,
  },
  requestsError: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: theme.radius.md,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
  },
  requestsErrorText: {
    color: colors.textMuted,
    fontSize: theme.size.md,
    textAlign: "center",
  },
  searchEmpty: {
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xl * 2,
  },
  searchEmptyTitle: {
    color: colors.textMuted,
    fontSize: theme.size.lg,
    fontWeight: "600",
  },
  onboardingCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderCurve: "continuous",
    borderRadius: 28,
    gap: theme.spacing.lg,
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
  },
  copy: {
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  cardTitle: {
    color: colors.text,
    fontSize: theme.size.xl,
    fontWeight: "600",
    textAlign: "center",
  },
  cardDescription: {
    color: colors.textMuted,
    fontSize: theme.size.md,
    textAlign: "center",
  },
  button: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: colors.primary,
    borderRadius: theme.radius.pill,
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm + 6,
  },
  buttonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "600",
  },
});
