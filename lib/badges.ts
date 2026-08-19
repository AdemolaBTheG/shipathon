import type { BadgeTier } from "@/db/schema";

export type BadgeId =
  | "first-save"
  | "press-start"
  | "backlog-builder"
  | "roll-credits"
  | "critic"
  | "masterpiece"
  | "found-in-the-wild"
  | "genre-explorer";

export type BadgeMetric =
  | "savedGames"
  | "startedGames"
  | "completedGames"
  | "ratedGames"
  | "fiveStarGames"
  | "linkedGames"
  | "completedGenres";

export type BadgeMilestone = {
  target: number;
  tier: BadgeTier;
};

export type BadgeDefinition = {
  description: string;
  id: BadgeId;
  metric: BadgeMetric;
  milestones: readonly BadgeMilestone[];
  symbol:
    | "bookmark"
    | "checkmark"
    | "dice"
    | "gamecontroller"
    | "link"
    | "play"
    | "star";
  title: string;
};

export type BadgeSnapshot = Record<BadgeMetric, number>;

export type BadgeSourceItem = {
  backlog: {
    completedAt: Date | null;
    rating: number | null;
    sourceUrl: string | null;
    startedAt: Date | null;
  };
  genres: readonly string[];
};

export type BadgeUnlock = {
  badgeId: BadgeId;
  key: string;
  tier: BadgeTier;
};

export type BadgeProgress = Omit<BadgeDefinition, "milestones"> & {
  current: number;
  milestones: readonly (BadgeMilestone & {
    unlocked: boolean;
    unlockedAt: Date | null;
  })[];
  nextMilestone: BadgeMilestone | null;
  progress: number;
};

const standard = (target: number): readonly BadgeMilestone[] => [
  { target, tier: "standard" },
];

const progressive = (
  bronze: number,
  silver: number,
  gold: number,
): readonly BadgeMilestone[] => [
  { target: bronze, tier: "bronze" },
  { target: silver, tier: "silver" },
  { target: gold, tier: "gold" },
];

export const badgeDefinitions = [
  {
    description: "Save your first game.",
    id: "first-save",
    metric: "savedGames",
    milestones: standard(1),
    symbol: "bookmark",
    title: "First Save",
  },
  {
    description: "Start playing a game from your backlog.",
    id: "press-start",
    metric: "startedGames",
    milestones: standard(1),
    symbol: "play",
    title: "Press Start",
  },
  {
    description: "Build a backlog worth coming back to.",
    id: "backlog-builder",
    metric: "savedGames",
    milestones: progressive(5, 25, 100),
    symbol: "gamecontroller",
    title: "Backlog Builder",
  },
  {
    description: "Finish games and roll the credits.",
    id: "roll-credits",
    metric: "completedGames",
    milestones: progressive(1, 10, 50),
    symbol: "checkmark",
    title: "Roll Credits",
  },
  {
    description: "Rate the games you have played.",
    id: "critic",
    metric: "ratedGames",
    milestones: progressive(5, 25, 100),
    symbol: "star",
    title: "Critic",
  },
  {
    description: "Give a game a five-star rating.",
    id: "masterpiece",
    metric: "fiveStarGames",
    milestones: standard(1),
    symbol: "star",
    title: "Masterpiece",
  },
  {
    description: "Save a game from a link someone shared.",
    id: "found-in-the-wild",
    metric: "linkedGames",
    milestones: standard(1),
    symbol: "link",
    title: "Found in the Wild",
  },
  {
    description: "Complete games across different genres.",
    id: "genre-explorer",
    metric: "completedGenres",
    milestones: progressive(3, 6, 10),
    symbol: "dice",
    title: "Genre Explorer",
  },
] as const satisfies readonly BadgeDefinition[];

export function getBadgeUnlockKey(badgeId: BadgeId, tier: BadgeTier) {
  return `${badgeId}:${tier}`;
}

export function createBadgeSnapshot(items: readonly BadgeSourceItem[]): BadgeSnapshot {
  const completedGenres = new Set<string>();
  let startedGames = 0;
  let completedGames = 0;
  let ratedGames = 0;
  let fiveStarGames = 0;
  let linkedGames = 0;

  for (const item of items) {
    if (item.backlog.startedAt) startedGames += 1;
    if (item.backlog.rating !== null) ratedGames += 1;
    if (item.backlog.rating === 5) fiveStarGames += 1;
    if (item.backlog.sourceUrl) linkedGames += 1;

    if (item.backlog.completedAt) {
      completedGames += 1;
      for (const genre of item.genres) {
        const normalizedGenre = genre.trim().toLowerCase();
        if (normalizedGenre) completedGenres.add(normalizedGenre);
      }
    }
  }

  return {
    completedGames,
    completedGenres: completedGenres.size,
    fiveStarGames,
    linkedGames,
    ratedGames,
    savedGames: items.length,
    startedGames,
  };
}

export function getEligibleBadgeUnlocks(snapshot: BadgeSnapshot): BadgeUnlock[] {
  return badgeDefinitions.flatMap((badge) =>
    badge.milestones
      .filter((milestone) => snapshot[badge.metric] >= milestone.target)
      .map((milestone) => ({
        badgeId: badge.id,
        key: getBadgeUnlockKey(badge.id, milestone.tier),
        tier: milestone.tier,
      })),
  );
}

export function getBadgeProgress(
  snapshot: BadgeSnapshot,
  unlockDates: ReadonlyMap<string, Date>,
): BadgeProgress[] {
  return badgeDefinitions.map((badge) => {
    const current = snapshot[badge.metric];
    const milestones = badge.milestones.map((milestone) => {
      const key = getBadgeUnlockKey(badge.id, milestone.tier);
      const unlockedAt = unlockDates.get(key) ?? null;

      return { ...milestone, unlocked: unlockedAt !== null, unlockedAt };
    });
    const nextMilestone = milestones.find((milestone) => !milestone.unlocked) ?? null;
    const target = nextMilestone?.target ?? milestones.at(-1)?.target ?? 1;

    return {
      ...badge,
      current,
      milestones,
      nextMilestone,
      progress: Math.min(1, current / target),
    };
  });
}
