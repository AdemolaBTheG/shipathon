import type { getBacklog } from "@/db/repository";
import type { BacklogStatus } from "@/db/schema";

type BacklogGame = Awaited<ReturnType<typeof getBacklog>>[number];

type PreviewGameInput = {
  addedDaysAgo: number;
  completedDaysAgo?: number;
  coverId: string;
  genres: string[];
  id: number;
  name: string;
  platforms: string[];
  progress?: number;
  rating?: number;
  sourceUrl?: string;
  startedDaysAgo?: number;
  status: BacklogStatus;
};

const DAY_MS = 24 * 60 * 60 * 1_000;
const previewNow = Date.now();

function daysAgo(days: number) {
  return new Date(previewNow - days * DAY_MS);
}

function createPreviewGame(input: PreviewGameInput): BacklogGame {
  const progressCurrent =
    input.status === "completed" ? 100 : (input.progress ?? 0);
  const platformsJson = JSON.stringify(input.platforms);
  const genresJson = JSON.stringify(input.genres);
  const gameModes = ["Single player"];

  return {
    backlog: {
      addedAt: daysAgo(input.addedDaysAgo),
      completedAt:
        input.status === "completed"
          ? daysAgo(input.completedDaysAgo ?? input.addedDaysAgo - 1)
          : null,
      gameId: input.id,
      id: `preview-backlog-${input.id}`,
      notes: null,
      progressCurrent,
      progressTotal: 100,
      rating: input.rating ?? null,
      sourceUrl: input.sourceUrl ?? null,
      startedAt:
        input.startedDaysAgo === undefined
          ? null
          : daysAgo(input.startedDaysAgo),
      status: input.status,
    },
    coverUrl: `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${input.coverId}.jpg`,
    gameModes,
    gameModesJson: JSON.stringify(gameModes),
    genres: input.genres,
    genresJson,
    igdbId: input.id,
    name: input.name,
    platforms: input.platforms,
    platformsJson,
    releaseDate: null,
    slug: null,
    summary: null,
    updatedAt: daysAgo(0),
  };
}

export const previewBacklog: BacklogGame[] = [
  createPreviewGame({
    addedDaysAgo: 18,
    coverId: "co4jni",
    genres: ["Role-playing (RPG)", "Adventure"],
    id: 119133,
    name: "Elden Ring",
    platforms: ["PlayStation 5", "PC"],
    progress: 42,
    rating: 4,
    sourceUrl: "https://www.youtube.com/watch?v=preview",
    startedDaysAgo: 15,
    status: "playing",
  }),
  createPreviewGame({
    addedDaysAgo: 11,
    coverId: "co4hk8",
    genres: ["Role-playing (RPG)", "Shooter"],
    id: 1877,
    name: "Cyberpunk 2077",
    platforms: ["PlayStation 5", "PC"],
    progress: 21,
    sourceUrl: "https://www.tiktok.com/@joylogue/video/preview",
    startedDaysAgo: 8,
    status: "playing",
  }),
  createPreviewGame({
    addedDaysAgo: 32,
    coverId: "co670h",
    genres: ["Role-playing (RPG)", "Strategy"],
    id: 119171,
    name: "Baldur's Gate 3",
    platforms: ["PC"],
    progress: 67,
    rating: 5,
    startedDaysAgo: 29,
    status: "playing",
  }),
  createPreviewGame({
    addedDaysAgo: 2,
    coverId: "co741o",
    genres: ["Shooter", "Tactical"],
    id: 250616,
    name: "Helldivers 2",
    platforms: ["PlayStation 5", "PC"],
    sourceUrl: "https://www.instagram.com/reel/preview",
    status: "want-to-play",
  }),
  createPreviewGame({
    addedDaysAgo: 6,
    coverId: "co2lbd",
    genres: ["Adventure", "Shooter"],
    id: 25076,
    name: "Red Dead Redemption 2",
    platforms: ["Xbox Series X|S", "PC"],
    status: "want-to-play",
  }),
  createPreviewGame({
    addedDaysAgo: 9,
    coverId: "co3p2d",
    genres: ["Platform", "Adventure"],
    id: 118694,
    name: "It Takes Two",
    platforms: ["PlayStation 5"],
    sourceUrl: "https://example.com/games/it-takes-two",
    status: "want-to-play",
  }),
  createPreviewGame({
    addedDaysAgo: 44,
    completedDaysAgo: 12,
    coverId: "co4rs3",
    genres: ["Hack and slash/Beat 'em up", "Indie"],
    id: 80529,
    name: "Hades",
    platforms: ["Nintendo Switch", "PC"],
    rating: 5,
    startedDaysAgo: 38,
    status: "completed",
  }),
  createPreviewGame({
    addedDaysAgo: 78,
    completedDaysAgo: 55,
    coverId: "co1rs4",
    genres: ["Puzzle", "Platform"],
    id: 72,
    name: "Portal 2",
    platforms: ["PC"],
    rating: 5,
    startedDaysAgo: 62,
    status: "completed",
  }),
  createPreviewGame({
    addedDaysAgo: 26,
    completedDaysAgo: 20,
    coverId: "co2fca",
    genres: ["Puzzle", "Indie"],
    id: 7342,
    name: "Inside",
    platforms: ["Xbox Series X|S"],
    rating: 4,
    startedDaysAgo: 24,
    status: "completed",
  }),
  createPreviewGame({
    addedDaysAgo: 102,
    completedDaysAgo: 64,
    coverId: "co1r7f",
    genres: ["Adventure", "Role-playing (RPG)"],
    id: 1020,
    name: "The Legend of Zelda: Breath of the Wild",
    platforms: ["Nintendo Switch"],
    rating: 5,
    startedDaysAgo: 94,
    status: "completed",
  }),
  createPreviewGame({
    addedDaysAgo: 36,
    coverId: "co39vc",
    genres: ["Role-playing (RPG)", "Indie"],
    id: 113112,
    name: "Hades II",
    platforms: ["PC"],
    progress: 16,
    startedDaysAgo: 34,
    status: "shelved",
  }),
  createPreviewGame({
    addedDaysAgo: 88,
    coverId: "co1wyy",
    genres: ["Role-playing (RPG)", "Adventure"],
    id: 1942,
    name: "The Witcher 3: Wild Hunt",
    platforms: ["PlayStation 5", "PC"],
    progress: 28,
    rating: 3,
    startedDaysAgo: 80,
    status: "abandoned",
  }),
];

export function withPreviewBacklog(games: BacklogGame[]) {
  return __DEV__ && games.length === 0 ? previewBacklog : games;
}
