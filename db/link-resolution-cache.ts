import { eq } from "drizzle-orm";

import type { GameLinkResolution } from "@/lib/link-resolver";

import { db } from "./client";
import { linkResolutions } from "./schema";

const CACHE_SCHEMA_VERSION = 1;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

function isCacheableResolution(value: unknown): value is GameLinkResolution {
  if (!value || typeof value !== "object") return false;

  const resolution = value as Partial<GameLinkResolution>;
  return (
    (resolution.status === "matched" ||
      resolution.status === "needs-confirmation") &&
    typeof resolution.sourceUrl === "string" &&
    Boolean(resolution.detection) &&
    Array.isArray(resolution.candidates)
  );
}

export async function getCachedLinkResolution(sourceUrl: string) {
  const [cached] = await db
    .select()
    .from(linkResolutions)
    .where(eq(linkResolutions.sourceUrl, sourceUrl))
    .limit(1);

  if (!cached) return null;
  if (
    cached.schemaVersion !== CACHE_SCHEMA_VERSION ||
    cached.expiresAt.getTime() <= Date.now()
  ) {
    await db
      .delete(linkResolutions)
      .where(eq(linkResolutions.sourceUrl, sourceUrl));
    return null;
  }

  try {
    const resolution = JSON.parse(cached.resolutionJson) as unknown;
    return isCacheableResolution(resolution) ? resolution : null;
  } catch {
    await db
      .delete(linkResolutions)
      .where(eq(linkResolutions.sourceUrl, sourceUrl));
    return null;
  }
}

export async function cacheLinkResolution(resolution: GameLinkResolution) {
  if (!isCacheableResolution(resolution)) return;

  const now = new Date();
  const values = {
    sourceUrl: resolution.sourceUrl,
    resolutionJson: JSON.stringify(resolution),
    schemaVersion: CACHE_SCHEMA_VERSION,
    expiresAt: new Date(now.getTime() + CACHE_TTL_MS),
    updatedAt: now,
  };

  await db
    .insert(linkResolutions)
    .values(values)
    .onConflictDoUpdate({
      target: linkResolutions.sourceUrl,
      set: values,
    });
}
