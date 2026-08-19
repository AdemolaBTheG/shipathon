import { eq, isNull } from "drizzle-orm";

import {
  createBadgeSnapshot,
  getBadgeProgress,
  getEligibleBadgeUnlocks,
} from "@/lib/badges";
import type { BadgeId, BadgeUnlock } from "@/lib/badges";
import { publishBadgeUnlocks } from "@/lib/badge-unlock-events";

import { db } from "./client";
import { badgeUnlocks, backlogItems, games } from "./schema";

async function getBadgeSourceItems() {
  const rows = await db
    .select({
      completedAt: backlogItems.completedAt,
      genresJson: games.genresJson,
      rating: backlogItems.rating,
      sourceUrl: backlogItems.sourceUrl,
      startedAt: backlogItems.startedAt,
    })
    .from(backlogItems)
    .innerJoin(games, eq(backlogItems.gameId, games.igdbId));

  return rows.map((row) => ({
    backlog: {
      completedAt: row.completedAt,
      rating: row.rating,
      sourceUrl: row.sourceUrl,
      startedAt: row.startedAt,
    },
    genres: parseGenres(row.genresJson),
  }));
}

function parseGenres(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((genre): genre is string => typeof genre === "string")
      : [];
  } catch {
    return [];
  }
}

export async function syncBadgeUnlocks(): Promise<BadgeUnlock[]> {
  const [items, existingUnlocks] = await Promise.all([
    getBadgeSourceItems(),
    db.select().from(badgeUnlocks),
  ]);
  const eligibleUnlocks = getEligibleBadgeUnlocks(createBadgeSnapshot(items));
  const existingKeys = new Set(existingUnlocks.map((unlock) => unlock.key));
  const newlyUnlocked = eligibleUnlocks.filter(
    (unlock) => !existingKeys.has(unlock.key),
  );

  if (newlyUnlocked.length > 0) {
    const unlockedAt = new Date();
    const insertedUnlocks = await db
      .insert(badgeUnlocks)
      .values(newlyUnlocked.map((unlock) => ({ ...unlock, unlockedAt })))
      .onConflictDoNothing()
      .returning({
        badgeId: badgeUnlocks.badgeId,
        key: badgeUnlocks.key,
        tier: badgeUnlocks.tier,
      });

    const unlocks = insertedUnlocks.map((unlock) => ({
      ...unlock,
      badgeId: unlock.badgeId as BadgeId,
    }));
    publishBadgeUnlocks(unlocks);
    return unlocks;
  }

  return [];
}

export async function getBadges() {
  await syncBadgeUnlocks();

  const [items, unlocks] = await Promise.all([
    getBadgeSourceItems(),
    db.select().from(badgeUnlocks),
  ]);
  const unlockDates = new Map(
    unlocks.map((unlock) => [unlock.key, unlock.unlockedAt]),
  );

  return getBadgeProgress(createBadgeSnapshot(items), unlockDates);
}

export async function getUnseenBadgeUnlocks() {
  await syncBadgeUnlocks();
  return db
    .select()
    .from(badgeUnlocks)
    .where(isNull(badgeUnlocks.seenAt));
}

export async function markBadgeUnlockSeen(key: string) {
  await db
    .update(badgeUnlocks)
    .set({ seenAt: new Date() })
    .where(eq(badgeUnlocks.key, key));
}
