import { randomUUID } from "expo-crypto";
import { desc, eq } from "drizzle-orm";

import type { GameSearchResult } from "@/lib/igdb";
import { normalizeRating } from "@/lib/rating";
import { trackLifecycleEvent } from "@/services/lifecycle-events";
import { requestWidgetSync } from "@/services/widget-sync";

import { syncBadgeUnlocks } from "./badges";
import { db } from "./client";
import { backlogItems, games } from "./schema";
import type { BacklogStatus } from "./schema";

function toGameValues(game: GameSearchResult) {
  return {
    igdbId: game.id,
    name: game.name,
    slug: game.slug,
    summary: game.summary,
    releaseDate: game.releaseDate,
    coverUrl: game.coverUrl,
    platformsJson: JSON.stringify(game.platforms),
    genresJson: JSON.stringify(game.genres),
    gameModesJson: JSON.stringify(game.gameModes),
    updatedAt: new Date(),
  };
}

function queueWidgetSync() {
  void requestWidgetSync().catch((error) => {
    if (__DEV__) {
      console.warn("Unable to refresh widgets after a backlog update.", error);
    }
  });
}

function trackStatusTransition(
  game: Pick<GameSearchResult, "id" | "name">,
  previousStatus: BacklogStatus | null,
  nextStatus: BacklogStatus,
  rating: number | null,
) {
  if (previousStatus === nextStatus) return;

  const properties = {
    game_id: game.id,
    game_name: game.name,
    previous_status: previousStatus,
    status: nextStatus,
  };
  trackLifecycleEvent("game_status_changed", properties);

  if (nextStatus === "playing") {
    trackLifecycleEvent("playing_activity", properties, { journey: true });
  } else if (previousStatus === "playing") {
    trackLifecycleEvent("playing_stopped", properties, { journey: true });
  }

  if (nextStatus === "completed") {
    trackLifecycleEvent(
      "game_completed",
      { ...properties, has_rating: rating !== null },
      { journey: rating === null },
    );
  } else if (previousStatus === "completed") {
    trackLifecycleEvent("game_completion_reverted", properties, {
      journey: true,
    });
  }
}

function trackRatingChange(
  game: Pick<GameSearchResult, "id" | "name">,
  previousRating: number | null,
  rating: number | null,
) {
  if (previousRating === rating) return;

  trackLifecycleEvent(
    rating === null ? "game_rating_removed" : "game_rated",
    {
      game_id: game.id,
      game_name: game.name,
      previous_rating: previousRating,
      rating,
    },
    { journey: rating !== null },
  );
}

export async function saveGameToBacklog(
  game: GameSearchResult,
  options?: {
    rating?: number | null;
    sourceUrl?: string;
    notes?: string;
    status?: BacklogStatus;
  },
) {
  const now = new Date();
  const gameValues = toGameValues(game);
  const status = options?.status ?? "want-to-play";
  const rating =
    options?.rating === undefined ? undefined : normalizeRating(options.rating);
  const [existingItem] = await db
    .select({ rating: backlogItems.rating, status: backlogItems.status })
    .from(backlogItems)
    .where(eq(backlogItems.gameId, game.id))
    .limit(1);

  await db
    .insert(games)
    .values(gameValues)
    .onConflictDoUpdate({
      target: games.igdbId,
      set: gameValues,
    });

  const backlogInsert = db
    .insert(backlogItems)
    .values({
      id: randomUUID(),
      gameId: game.id,
      sourceUrl: options?.sourceUrl,
      notes: options?.notes,
      rating,
      status,
      addedAt: now,
      startedAt: status === "playing" ? now : undefined,
      completedAt: status === "completed" ? now : undefined,
      progressCurrent: status === "completed" ? 100 : 0,
    });

  if (options?.status || options?.rating !== undefined) {
    await backlogInsert.onConflictDoUpdate({
      target: backlogItems.gameId,
      set: {
        ...(options.status
          ? {
              status,
              startedAt: status === "playing" ? now : null,
              completedAt: status === "completed" ? now : null,
              progressCurrent: status === "completed" ? 100 : 0,
            }
          : {}),
        ...(rating !== undefined ? { rating } : {}),
      },
    });
  } else {
    await backlogInsert.onConflictDoNothing({ target: backlogItems.gameId });
  }

  const unlocks = await syncBadgeUnlocks();
  queueWidgetSync();

  const finalRating = rating === undefined ? existingItem?.rating ?? null : rating;
  const finalStatus = options?.status
    ? status
    : existingItem?.status ?? status;

  if (!existingItem) {
    trackLifecycleEvent("game_added", {
      game_id: game.id,
      game_name: game.name,
      source: options?.sourceUrl ? "link" : "manual",
      status: finalStatus,
    });
    trackStatusTransition(game, null, finalStatus, finalRating);
  } else if (options?.status) {
    trackStatusTransition(
      game,
      existingItem.status,
      finalStatus,
      finalRating,
    );
  }

  if (rating !== undefined) {
    trackRatingChange(game, existingItem?.rating ?? null, rating);
  }

  return unlocks;
}

export async function getBacklog() {
  const rows = await db
    .select({ game: games, backlog: backlogItems })
    .from(backlogItems)
    .innerJoin(games, eq(backlogItems.gameId, games.igdbId))
    .orderBy(desc(backlogItems.addedAt));

  return rows.map(({ game, backlog }) => ({
    ...game,
    platforms: JSON.parse(game.platformsJson) as string[],
    genres: JSON.parse(game.genresJson) as string[],
    gameModes: JSON.parse(game.gameModesJson) as string[],
    backlog,
  }));
}

export async function updateBacklogStatus(
  gameId: number,
  status: BacklogStatus,
) {
  const [currentItem] = await db
    .select({
      completedAt: backlogItems.completedAt,
      name: games.name,
      progressTotal: backlogItems.progressTotal,
      rating: backlogItems.rating,
      startedAt: backlogItems.startedAt,
      status: backlogItems.status,
    })
    .from(backlogItems)
    .innerJoin(games, eq(backlogItems.gameId, games.igdbId))
    .where(eq(backlogItems.gameId, gameId))
    .limit(1);

  const [updatedItem] = await db
    .update(backlogItems)
    .set({
      status,
      ...(status === "playing" && !currentItem?.startedAt
        ? { startedAt: new Date() }
        : {}),
      ...(status === "completed" && !currentItem?.completedAt
        ? { completedAt: new Date() }
        : {}),
      ...(status === "completed"
        ? { progressCurrent: currentItem?.progressTotal ?? 100 }
        : {}),
    })
    .where(eq(backlogItems.gameId, gameId))
    .returning();

  await syncBadgeUnlocks();
  queueWidgetSync();

  if (currentItem && updatedItem) {
    trackStatusTransition(
      { id: gameId, name: currentItem.name },
      currentItem.status,
      status,
      currentItem.rating,
    );
  }

  return updatedItem;
}

export async function updateBacklogRating(
  gameId: number,
  rating: number | null,
) {
  const [currentItem] = await db
    .select({ name: games.name, rating: backlogItems.rating })
    .from(backlogItems)
    .innerJoin(games, eq(backlogItems.gameId, games.igdbId))
    .where(eq(backlogItems.gameId, gameId))
    .limit(1);
  const normalizedRating = normalizeRating(rating);

  await db
    .update(backlogItems)
    .set({ rating: normalizedRating })
    .where(eq(backlogItems.gameId, gameId));

  const unlocks = await syncBadgeUnlocks();
  queueWidgetSync();
  if (currentItem) {
    trackRatingChange(
      { id: gameId, name: currentItem.name },
      currentItem.rating,
      normalizedRating,
    );
  }
  return unlocks;
}

export async function updateBacklogProgress(
  gameId: number,
  progressCurrent: number,
  progressTotal = 100,
) {
  const [currentItem] = await db
    .select({
      name: games.name,
      progressCurrent: backlogItems.progressCurrent,
      progressTotal: backlogItems.progressTotal,
      status: backlogItems.status,
    })
    .from(backlogItems)
    .innerJoin(games, eq(backlogItems.gameId, games.igdbId))
    .where(eq(backlogItems.gameId, gameId))
    .limit(1);
  const safeTotal = Math.max(1, Math.round(progressTotal));
  const safeCurrent = Math.min(
    safeTotal,
    Math.max(0, Math.round(progressCurrent)),
  );

  await db
    .update(backlogItems)
    .set({ progressCurrent: safeCurrent, progressTotal: safeTotal })
    .where(eq(backlogItems.gameId, gameId));

  const unlocks = await syncBadgeUnlocks();
  queueWidgetSync();

  if (
    currentItem &&
    (currentItem.progressCurrent !== safeCurrent ||
      currentItem.progressTotal !== safeTotal)
  ) {
    const properties = {
      game_id: gameId,
      game_name: currentItem.name,
      previous_progress: currentItem.progressCurrent,
      progress: safeCurrent,
      progress_total: safeTotal,
      progress_percent: Math.round((safeCurrent / safeTotal) * 100),
    };
    trackLifecycleEvent("game_progress_updated", properties);
    if (currentItem.status === "playing") {
      trackLifecycleEvent("playing_activity", properties, { journey: true });
    }
  }
  return unlocks;
}
