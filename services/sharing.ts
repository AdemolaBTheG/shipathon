import type { User } from "@supabase/supabase-js";

import { getBacklog } from "@/db/repository";
import type { BacklogStatus } from "@/db/schema";
import {
  isPreviewFriend,
  previewCommonGames,
  previewComparisonSummary,
  previewFriend,
  previewFriendLibrary,
  previewFriendRecommendations,
  previewFriendsCurrentlyPlaying,
  previewCurrentlyPlaying,
} from "@/constants/friend-preview";
import { getSupabaseClient } from "@/lib/supabase";

const INVITE_LIFETIME_DAYS = 30;
const DEFAULT_SHARE_ORIGIN = "https://joylogue.app";

export const incomingFriendRequestsQueryKey = [
  "incoming-friend-requests",
] as const;
export const friendsQueryKey = ["friends"] as const;
export const currentProfileQueryKey = ["current-profile"] as const;

export type CurrentProfile = {
  avatarUrl: string | null;
  displayName: string;
  id: string;
};

export type InvitePreview = {
  avatarUrl: string | null;
  displayName: string;
  expiresAt: string | null;
  ownerId: string;
  relationshipStatus: InviteRelationshipStatus;
  sharedGameCount: number;
  visibleCoverUrls: string[];
};

export type InviteRelationshipStatus =
  | "available"
  | "friends"
  | "request-sent"
  | "self";

export type IncomingFriendRequest = {
  avatarUrl: string | null;
  createdAt: string;
  displayName: string;
  id: string;
  senderId: string;
};

export type Friend = {
  avatarUrl: string | null;
  displayName: string;
  friendsSince: string;
  id: string;
};

export type HomeFriendActivity = {
  avatarUrl: string | null;
  displayName: string;
  friendId: string;
  progress: number | null;
};

export type HomeFriendPlayingGame = {
  coverUrl: string | null;
  friends: HomeFriendActivity[];
  gameId: number;
  gameName: string;
  platforms: string[];
};

export type FriendComparisonSummary = {
  bothCompleted: number;
  bothRated: number;
  inCommon: number;
};

export type FriendPlayingGame = {
  coverUrl: string | null;
  igdbId: number;
  name: string;
  progressCurrent: number;
  progressTotal: number;
  rating: number | null;
};

export type FriendLibraryGame = {
  coverUrl: string | null;
  igdbId: number;
  name: string;
  rating: number | null;
  status: BacklogStatus;
};

export type FriendCommonGameState = {
  progressCurrent: number;
  progressTotal: number;
  rating: number | null;
  status: BacklogStatus;
};

export type FriendCommonGame = {
  coverUrl: string | null;
  friend: FriendCommonGameState;
  igdbId: number;
  name: string;
  you: FriendCommonGameState;
};

let pendingAnonymousSignIn: Promise<User> | null = null;
let pendingBacklogSync: Promise<void> | null = null;
let lastBacklogSyncAt = 0;

function getApiUrl() {
  return process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? null;
}

async function postAuthenticatedApi<T>(path: string, body: unknown) {
  const apiUrl = getApiUrl();
  if (!apiUrl) return null;

  const supabase = getSupabaseClient();
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.access_token) throw new Error("Authentication required.");

  const response = await fetch(`${apiUrl}${path}`, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;

  if (!response.ok) {
    throw new Error(
      payload?.error ?? `Request failed with status ${response.status}`,
    );
  }

  if (!payload) throw new Error("The server returned an empty response.");
  return payload;
}

function toIsoString(value: Date | null) {
  return value ? value.toISOString() : null;
}

function toDateOnly(value: string | null) {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function getInviteUrl(token: string) {
  const origin = (
    process.env.EXPO_PUBLIC_SHARE_ORIGIN ?? DEFAULT_SHARE_ORIGIN
  ).replace(/\/$/, "");

  return `${origin}/invite/${token}`;
}

export async function ensureCloudUser() {
  const supabase = getSupabaseClient();
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) throw sessionError;
  if (session?.user) return session.user;
  if (pendingAnonymousSignIn) return pendingAnonymousSignIn;

  pendingAnonymousSignIn = supabase.auth
    .signInAnonymously()
    .then(({ data, error }) => {
      if (error) throw error;
      if (!data.user) throw new Error("Supabase did not return an anonymous user.");
      return data.user;
    })
    .finally(() => {
      pendingAnonymousSignIn = null;
    });

  return pendingAnonymousSignIn;
}

export async function getCurrentProfile(): Promise<CurrentProfile> {
  const user = await ensureCloudUser();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;

  const metadataAvatar = user.user_metadata.avatar_url;
  const metadataName = user.user_metadata.display_name;

  return {
    avatarUrl:
      data?.avatar_url ??
      (typeof metadataAvatar === "string" ? metadataAvatar : null),
    displayName:
      data?.display_name ??
      (typeof metadataName === "string" && metadataName.trim()
        ? metadataName.trim()
        : "Player"),
    id: data?.id ?? user.id,
  };
}

export async function updateCurrentProfile(
  displayName: string,
): Promise<CurrentProfile> {
  const normalizedName = displayName.trim();
  if (normalizedName.length < 1 || normalizedName.length > 40) {
    throw new Error("Display name must contain between 1 and 40 characters.");
  }

  const user = await ensureCloudUser();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ display_name: normalizedName })
    .eq("id", user.id)
    .select("id, display_name, avatar_url")
    .single();

  if (error) throw error;

  return {
    avatarUrl: data.avatar_url,
    displayName: data.display_name,
    id: data.id,
  };
}

export async function publishBacklog(ownerId: string) {
  const supabase = getSupabaseClient();
  const backlog = await getBacklog();
  const syncedAt = new Date().toISOString();
  const rows = backlog.map((item) => ({
    added_at: item.backlog.addedAt.toISOString(),
    completed_at: toIsoString(item.backlog.completedAt),
    cover_url: item.coverUrl,
    game_modes: item.gameModes,
    game_name: item.name,
    genres: item.genres,
    igdb_id: item.igdbId,
    owner_id: ownerId,
    platforms: item.platforms,
    progress_current: item.backlog.progressCurrent,
    progress_total: item.backlog.progressTotal,
    rating: item.backlog.rating,
    release_date: toDateOnly(item.releaseDate),
    slug: item.slug,
    started_at: toIsoString(item.backlog.startedAt),
    status: item.backlog.status,
    synced_at: syncedAt,
  }));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("shared_library_items")
      .upsert(rows, { onConflict: "owner_id,igdb_id" });

    if (error) throw error;
  }

  const { data: remoteItems, error: remoteItemsError } = await supabase
    .from("shared_library_items")
    .select("igdb_id")
    .eq("owner_id", ownerId);

  if (remoteItemsError) throw remoteItemsError;

  const localIds = new Set(backlog.map((item) => item.igdbId));
  const staleIds = (remoteItems ?? [])
    .map((item) => Number(item.igdb_id))
    .filter((igdbId) => !localIds.has(igdbId));

  if (staleIds.length > 0) {
    const { error } = await supabase
      .from("shared_library_items")
      .delete()
      .eq("owner_id", ownerId)
      .in("igdb_id", staleIds);

    if (error) throw error;
  }
}

export function syncSharedBacklog(options?: { force?: boolean }): Promise<void> {
  const shouldReuseRecentSync =
    !options?.force && Date.now() - lastBacklogSyncAt < 60_000;

  if (shouldReuseRecentSync) return pendingBacklogSync ?? Promise.resolve();
  if (pendingBacklogSync) {
    return options?.force
      ? pendingBacklogSync.then(() => syncSharedBacklog({ force: true }))
      : pendingBacklogSync;
  }

  pendingBacklogSync = ensureCloudUser()
    .then((user) => publishBacklog(user.id))
    .then(() => {
      lastBacklogSyncAt = Date.now();
    })
    .finally(() => {
      pendingBacklogSync = null;
    });

  return pendingBacklogSync;
}

async function getOrCreateInvite(ownerId: string) {
  const supabase = getSupabaseClient();
  const now = Date.now();
  const { data: invites, error: inviteError } = await supabase
    .from("invite_links")
    .select("token, expires_at, max_uses, use_count")
    .eq("owner_id", ownerId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(10);

  if (inviteError) throw inviteError;

  const reusableInvite = (invites ?? []).find((invite) => {
    const hasExpired =
      invite.expires_at !== null && new Date(invite.expires_at).getTime() <= now;
    const isExhausted =
      invite.max_uses !== null && invite.use_count >= invite.max_uses;

    return !hasExpired && !isExhausted;
  });

  if (reusableInvite) return reusableInvite.token as string;

  const expiresAt = new Date(
    now + INVITE_LIFETIME_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data: newInvite, error: createError } = await supabase
    .from("invite_links")
    .insert({ expires_at: expiresAt, owner_id: ownerId })
    .select("token")
    .single();

  if (createError) throw createError;
  return newInvite.token as string;
}

export async function prepareShareInvite() {
  const user = await ensureCloudUser();

  await publishBacklog(user.id);

  const token = await getOrCreateInvite(user.id);
  return { token, url: getInviteUrl(token), userId: user.id };
}

export async function getInvitePreview(token: string) {
  await ensureCloudUser();

  const { data, error } = await getSupabaseClient().rpc("get_invite_preview", {
    invite_token: token,
  });

  if (error) throw error;

  const preview = data?.[0];
  if (!preview) throw new Error("This invitation is invalid or has expired.");

  const relationshipStatus: InviteRelationshipStatus = [
    "friends",
    "request-sent",
    "self",
  ].includes(preview.relationship_status)
    ? preview.relationship_status
    : "available";

  return {
    avatarUrl: preview.avatar_url,
    displayName: preview.display_name,
    expiresAt: preview.expires_at,
    ownerId: preview.owner_id,
    relationshipStatus,
    sharedGameCount: Number(preview.shared_game_count),
    visibleCoverUrls: Array.isArray(preview.visible_cover_urls)
      ? preview.visible_cover_urls.filter(
          (coverUrl: unknown): coverUrl is string => typeof coverUrl === "string",
        )
      : [],
  } satisfies InvitePreview;
}

export async function sendFriendRequest(token: string) {
  await ensureCloudUser();

  const response = await postAuthenticatedApi<{
    friendRequestId: string | null;
  }>("/api/friends/request", { token });
  if (response) return response.friendRequestId;

  const { data, error } = await getSupabaseClient().rpc("request_friendship", {
    invite_token: token,
  });

  if (error) throw error;
  return data as string | null;
}

export async function getIncomingFriendRequests() {
  const user = await ensureCloudUser();
  const supabase = getSupabaseClient();
  const { data: requests, error: requestsError } = await supabase
    .from("friend_requests")
    .select("id, sender_id, created_at")
    .eq("receiver_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (requestsError) throw requestsError;
  if (!requests || requests.length === 0) return [];

  const senderIds = [...new Set(requests.map((request) => request.sender_id))];
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", senderIds);

  if (profilesError) throw profilesError;

  const profilesById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile]),
  );

  return requests.map((request) => {
    const profile = profilesById.get(request.sender_id);

    return {
      avatarUrl: profile?.avatar_url ?? null,
      createdAt: request.created_at,
      displayName: profile?.display_name ?? "Player",
      id: request.id,
      senderId: request.sender_id,
    } satisfies IncomingFriendRequest;
  });
}

export async function respondToFriendRequest(
  friendRequestId: string,
  acceptRequest: boolean,
) {
  await ensureCloudUser();

  const response = await postAuthenticatedApi<{ accepted: boolean }>(
    "/api/friends/respond",
    { accept: acceptRequest, friendRequestId },
  );
  if (response) return response.accepted;

  const { data, error } = await getSupabaseClient().rpc(
    "respond_to_friend_request",
    {
      accept_request: acceptRequest,
      friend_request_id: friendRequestId,
    },
  );

  if (error) throw error;
  return Boolean(data);
}

export async function getFriends() {
  const user = await ensureCloudUser();
  const supabase = getSupabaseClient();
  const { data: friendships, error: friendshipsError } = await supabase
    .from("friendships")
    .select("user_low, user_high, created_at")
    .or(`user_low.eq.${user.id},user_high.eq.${user.id}`)
    .order("created_at", { ascending: false });

  if (friendshipsError) throw friendshipsError;
  if (!friendships || friendships.length === 0) {
    return __DEV__ ? [previewFriend] : [];
  }

  const friendIds = friendships.map((friendship) =>
    friendship.user_low === user.id
      ? friendship.user_high
      : friendship.user_low,
  );
  const friendshipsByFriendId = new Map(
    friendships.map((friendship) => [
      friendship.user_low === user.id
        ? friendship.user_high
        : friendship.user_low,
      friendship,
    ]),
  );
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", friendIds);

  if (profilesError) throw profilesError;

  const profilesById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile]),
  );

  return friendIds.flatMap((friendId) => {
    const profile = profilesById.get(friendId);
    if (!profile) return [];

    return [
      {
        avatarUrl: profile.avatar_url,
        displayName: profile.display_name,
        friendsSince: friendshipsByFriendId.get(friendId)!.created_at,
        id: profile.id,
      } satisfies Friend,
    ];
  });
}

export async function getFriendsCurrentlyPlaying(limit = 20) {
  const friends = await getFriends();
  if (friends.length === 0) return [];
  if (friends.length === 1 && isPreviewFriend(friends[0].id)) {
    return previewFriendsCurrentlyPlaying.slice(0, Math.max(1, limit));
  }

  const friendById = new Map(friends.map((friend) => [friend.id, friend]));
  const { data, error } = await getSupabaseClient()
    .from("shared_library_items")
    .select(
      "owner_id, igdb_id, game_name, cover_url, platforms, progress_current, progress_total, started_at",
    )
    .in("owner_id", friends.map((friend) => friend.id))
    .eq("is_visible", true)
    .eq("status", "playing")
    .order("started_at", { ascending: false, nullsFirst: false });

  if (error) throw error;

  const groupedGames = new Map<
    number,
    HomeFriendPlayingGame & { latestStartedAt: number }
  >();

  for (const item of data ?? []) {
    const friend = friendById.get(item.owner_id);
    const gameId = Number(item.igdb_id);
    if (!friend || !Number.isInteger(gameId) || gameId <= 0) continue;

    const progressTotal = Math.max(1, Number(item.progress_total));
    const progressCurrent = Math.min(
      progressTotal,
      Math.max(0, Number(item.progress_current)),
    );
    const activity = {
      avatarUrl: friend.avatarUrl,
      displayName: friend.displayName,
      friendId: friend.id,
      progress:
        progressCurrent > 0
          ? (progressCurrent / progressTotal) * 100
          : null,
    } satisfies HomeFriendActivity;
    const startedAt = item.started_at
      ? new Date(item.started_at).getTime()
      : 0;
    const existingGame = groupedGames.get(gameId);

    if (existingGame) {
      existingGame.friends.push(activity);
      existingGame.latestStartedAt = Math.max(
        existingGame.latestStartedAt,
        startedAt,
      );
      continue;
    }

    groupedGames.set(gameId, {
      coverUrl: item.cover_url,
      friends: [activity],
      gameId,
      gameName: item.game_name,
      latestStartedAt: startedAt,
      platforms: Array.isArray(item.platforms) ? item.platforms : [],
    });
  }

  return [...groupedGames.values()]
    .sort(
      (left, right) =>
        right.friends.length - left.friends.length ||
        right.latestStartedAt - left.latestStartedAt,
    )
    .slice(0, Math.max(1, limit))
    .map(({ latestStartedAt: _latestStartedAt, ...game }) => game);
}

export async function getFriend(friendId: string) {
  const friends = await getFriends();
  const friend = friends.find((candidate) => candidate.id === friendId);

  if (!friend) throw new Error("This player is no longer in your friends list.");
  return friend;
}

export async function getFriendComparisonSummary(friendId: string) {
  if (isPreviewFriend(friendId)) return previewComparisonSummary;

  await ensureCloudUser();

  const [localBacklog, { data: friendItems, error }] = await Promise.all([
    getBacklog(),
    getSupabaseClient()
      .from("shared_library_items")
      .select("igdb_id, status, rating")
      .eq("owner_id", friendId)
      .eq("is_visible", true),
  ]);

  if (error) throw error;

  const localByGameId = new Map(
    localBacklog.map((item) => [item.igdbId, item.backlog]),
  );
  const sharedItems = (friendItems ?? []).flatMap((friendItem) => {
    const localItem = localByGameId.get(Number(friendItem.igdb_id));
    return localItem ? [{ friendItem, localItem }] : [];
  });

  return sharedItems.reduce<FriendComparisonSummary>(
    (summary, { friendItem, localItem }) => ({
      bothCompleted:
        summary.bothCompleted +
        Number(
          friendItem.status === "completed" && localItem.status === "completed",
        ),
      bothRated:
        summary.bothRated +
        Number(friendItem.rating !== null && localItem.rating !== null),
      inCommon: summary.inCommon + 1,
    }),
    { bothCompleted: 0, bothRated: 0, inCommon: 0 },
  );
}

export async function getFriendCommonGames(friendId: string) {
  if (isPreviewFriend(friendId)) return previewCommonGames;

  await ensureCloudUser();

  const [localBacklog, { data: friendItems, error }] = await Promise.all([
    getBacklog(),
    getSupabaseClient()
      .from("shared_library_items")
      .select(
        "igdb_id, game_name, cover_url, status, rating, progress_current, progress_total, added_at",
      )
      .eq("owner_id", friendId)
      .eq("is_visible", true)
      .order("added_at", { ascending: false }),
  ]);

  if (error) throw error;

  const localByGameId = new Map(
    localBacklog.map((item) => [item.igdbId, item]),
  );

  return (friendItems ?? []).flatMap((friendItem) => {
    const igdbId = Number(friendItem.igdb_id);
    const localItem = localByGameId.get(igdbId);
    if (!localItem) return [];

    return [
      {
        coverUrl: friendItem.cover_url ?? localItem.coverUrl,
        friend: {
          progressCurrent: Number(friendItem.progress_current),
          progressTotal: Math.max(1, Number(friendItem.progress_total)),
          rating:
            friendItem.rating === null ? null : Number(friendItem.rating),
          status: friendItem.status as BacklogStatus,
        },
        igdbId,
        name: friendItem.game_name,
        you: {
          progressCurrent: localItem.backlog.progressCurrent,
          progressTotal: Math.max(1, localItem.backlog.progressTotal),
          rating: localItem.backlog.rating,
          status: localItem.backlog.status,
        },
      } satisfies FriendCommonGame,
    ];
  });
}

export async function getFriendLibrary(friendId: string) {
  if (isPreviewFriend(friendId)) return previewFriendLibrary;

  await ensureCloudUser();

  const { data, error } = await getSupabaseClient()
    .from("shared_library_items")
    .select("igdb_id, game_name, cover_url, status, rating")
    .eq("owner_id", friendId)
    .eq("is_visible", true)
    .order("added_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map(
    (item) =>
      ({
        coverUrl: item.cover_url,
        igdbId: Number(item.igdb_id),
        name: item.game_name,
        rating: item.rating === null ? null : Number(item.rating),
        status: item.status as BacklogStatus,
      }) satisfies FriendLibraryGame,
  );
}

export async function getFriendBacklogRecommendations(
  friendId: string,
  limit = 3,
) {
  const [localBacklog, friendLibrary] = await Promise.all([
    getBacklog(),
    isPreviewFriend(friendId)
      ? Promise.resolve(previewFriendRecommendations)
      : getFriendLibrary(friendId),
  ]);
  const localGameIds = new Set(localBacklog.map((game) => game.igdbId));

  return friendLibrary
    .filter((game) => !localGameIds.has(game.igdbId))
    .sort((left, right) => (right.rating ?? -1) - (left.rating ?? -1))
    .slice(0, Math.max(1, limit));
}

export async function getFriendCurrentlyPlaying(
  friendId: string,
  limit: number | null = 3,
) {
  if (isPreviewFriend(friendId)) {
    return limit === null
      ? previewCurrentlyPlaying
      : previewCurrentlyPlaying.slice(0, limit);
  }

  await ensureCloudUser();

  let query = getSupabaseClient()
    .from("shared_library_items")
    .select(
      "igdb_id, game_name, cover_url, progress_current, progress_total, rating",
    )
    .eq("owner_id", friendId)
    .eq("is_visible", true)
    .eq("status", "playing")
    .order("started_at", { ascending: false, nullsFirst: false });

  if (limit !== null) query = query.limit(limit);

  const { data, error } = await query;

  if (error) throw error;

  return (data ?? []).map((item) => {
    const progressTotal = Math.max(1, Number(item.progress_total));
    const progressCurrent = Math.min(
      progressTotal,
      Math.max(0, Number(item.progress_current)),
    );

    return {
      coverUrl: item.cover_url,
      igdbId: Number(item.igdb_id),
      name: item.game_name,
      progressCurrent,
      progressTotal,
      rating: item.rating === null ? null : Number(item.rating),
    } satisfies FriendPlayingGame;
  });
}

export async function removeFriend(friendId: string) {
  await ensureCloudUser();

  const { error } = await getSupabaseClient().rpc("remove_friend", {
    other_user: friendId,
  });

  if (error) throw error;
}

export async function blockFriend(friendId: string) {
  await ensureCloudUser();

  const { error } = await getSupabaseClient().rpc("block_user", {
    other_user: friendId,
  });

  if (error) throw error;
}
