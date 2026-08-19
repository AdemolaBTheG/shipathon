import type {
  Friend,
  FriendCommonGame,
  FriendComparisonSummary,
  FriendLibraryGame,
  FriendPlayingGame,
  HomeFriendPlayingGame,
} from "@/services/sharing";

export const previewFriend: Friend = {
  avatarUrl: null,
  displayName: "Maya",
  friendsSince: "2026-05-18T12:00:00.000Z",
  id: "preview-friend-maya",
};

export function isPreviewFriend(friendId: string) {
  return __DEV__ && friendId === previewFriend.id;
}

export const previewCurrentlyPlaying: FriendPlayingGame[] = [
  {
    coverUrl:
      "https://images.igdb.com/igdb/image/upload/t_cover_big/co39vc.jpg",
    igdbId: 113112,
    name: "Hades",
    progressCurrent: 68,
    progressTotal: 100,
    rating: 5,
  },
  {
    coverUrl:
      "https://images.igdb.com/igdb/image/upload/t_cover_big/co4jni.jpg",
    igdbId: 119133,
    name: "Elden Ring",
    progressCurrent: 42,
    progressTotal: 100,
    rating: 4,
  },
  {
    coverUrl:
      "https://images.igdb.com/igdb/image/upload/t_cover_big/co4hk8.jpg",
    igdbId: 1877,
    name: "Cyberpunk 2077",
    progressCurrent: 21,
    progressTotal: 100,
    rating: null,
  },
];

export const previewCommonGames: FriendCommonGame[] = [
  {
    coverUrl:
      "https://images.igdb.com/igdb/image/upload/t_cover_big/co1r7f.jpg",
    friend: {
      progressCurrent: 100,
      progressTotal: 100,
      rating: 5,
      status: "completed",
    },
    igdbId: 1020,
    name: "The Legend of Zelda: Breath of the Wild",
    you: {
      progressCurrent: 100,
      progressTotal: 100,
      rating: 4,
      status: "completed",
    },
  },
  {
    coverUrl:
      "https://images.igdb.com/igdb/image/upload/t_cover_big/co2lbd.jpg",
    friend: {
      progressCurrent: 68,
      progressTotal: 100,
      rating: 4,
      status: "playing",
    },
    igdbId: 25076,
    name: "Red Dead Redemption 2",
    you: {
      progressCurrent: 100,
      progressTotal: 100,
      rating: 5,
      status: "completed",
    },
  },
  {
    coverUrl:
      "https://images.igdb.com/igdb/image/upload/t_cover_big/co5s5v.jpg",
    friend: {
      progressCurrent: 0,
      progressTotal: 100,
      rating: null,
      status: "want-to-play",
    },
    igdbId: 119171,
    name: "Baldur's Gate 3",
    you: {
      progressCurrent: 34,
      progressTotal: 100,
      rating: 4,
      status: "playing",
    },
  },
  {
    coverUrl:
      "https://images.igdb.com/igdb/image/upload/t_cover_big/co3p2d.jpg",
    friend: {
      progressCurrent: 100,
      progressTotal: 100,
      rating: 5,
      status: "completed",
    },
    igdbId: 118694,
    name: "It Takes Two",
    you: {
      progressCurrent: 0,
      progressTotal: 100,
      rating: null,
      status: "want-to-play",
    },
  },
  {
    coverUrl:
      "https://images.igdb.com/igdb/image/upload/t_cover_big/co39vc.jpg",
    friend: {
      progressCurrent: 68,
      progressTotal: 100,
      rating: 4,
      status: "playing",
    },
    igdbId: 113112,
    name: "Hades",
    you: {
      progressCurrent: 100,
      progressTotal: 100,
      rating: 5,
      status: "completed",
    },
  },
];

export const previewFriendRecommendations: FriendLibraryGame[] = [
  {
    coverUrl:
      "https://images.igdb.com/igdb/image/upload/t_cover_big/co4jni.jpg",
    igdbId: 119133,
    name: "Elden Ring",
    rating: 5,
    status: "completed",
  },
  {
    coverUrl:
      "https://images.igdb.com/igdb/image/upload/t_cover_big/co4hk8.jpg",
    igdbId: 1877,
    name: "Cyberpunk 2077",
    rating: 4,
    status: "completed",
  },
  {
    coverUrl:
      "https://images.igdb.com/igdb/image/upload/t_cover_big/co741o.jpg",
    igdbId: 250616,
    name: "Helldivers 2",
    rating: 4,
    status: "playing",
  },
];

export const previewFriendLibrary: FriendLibraryGame[] = [
  ...previewCommonGames.map((game) => ({
    coverUrl: game.coverUrl,
    igdbId: game.igdbId,
    name: game.name,
    rating: game.friend.rating,
    status: game.friend.status,
  })),
  ...previewFriendRecommendations,
];

export const previewComparisonSummary: FriendComparisonSummary = {
  bothCompleted: previewCommonGames.filter(
    (game) =>
      game.you.status === "completed" && game.friend.status === "completed",
  ).length,
  bothRated: previewCommonGames.filter(
    (game) => game.you.rating !== null && game.friend.rating !== null,
  ).length,
  inCommon: previewCommonGames.length,
};

export const previewFriendsCurrentlyPlaying: HomeFriendPlayingGame[] =
  previewCurrentlyPlaying.map((game) => ({
    coverUrl: game.coverUrl,
    friends: [
      {
        avatarUrl: previewFriend.avatarUrl,
        displayName: previewFriend.displayName,
        friendId: previewFriend.id,
        progress: (game.progressCurrent / game.progressTotal) * 100,
      },
    ],
    gameId: game.igdbId,
    gameName: game.name,
    platforms: [],
  }));
