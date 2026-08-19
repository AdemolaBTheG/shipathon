import {
  cacheLinkResolution,
  getCachedLinkResolution,
} from "@/db/link-resolution-cache";

import type { GameSearchResult } from "./igdb";

const POLL_DEADLINE_MS = 120_000;
const MAX_STATUS_FAILURES = 1;

export type GameLinkDetection = {
  title: string | null;
  alternateTitles: string[];
  platformHint: string | null;
  confidence: number;
  evidence: string;
  sourceKind: "video" | "page" | "unknown";
};

export type GameLinkResolution = {
  status: "matched" | "needs-confirmation" | "not-found";
  sourceUrl: string;
  query: string | null;
  detection: GameLinkDetection;
  game: GameSearchResult | null;
  candidates: GameSearchResult[];
};

type PendingLinkResolution = {
  status: "pending";
  jobId: string;
  sourceUrl: string;
};

export class LinkResolutionRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: "ABORTED" | "POLL_TIMEOUT",
  ) {
    super(message);
    this.name = "LinkResolutionRequestError";
  }
}

function getApiUrl() {
  return process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
}

function isPending(value: unknown): value is PendingLinkResolution {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PendingLinkResolution>;
  return (
    candidate.status === "pending" &&
    typeof candidate.jobId === "string" &&
    typeof candidate.sourceUrl === "string"
  );
}

function isResolution(value: unknown): value is GameLinkResolution {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GameLinkResolution>;
  return (
    (candidate.status === "matched" ||
      candidate.status === "needs-confirmation" ||
      candidate.status === "not-found") &&
    typeof candidate.sourceUrl === "string" &&
    Boolean(candidate.detection) &&
    Array.isArray(candidate.candidates)
  );
}

async function postJson(
  pathname: string,
  body: Record<string, string>,
  signal?: AbortSignal,
) {
  try {
    const response = await fetch(`${getApiUrl()}${pathname}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    const payload = (await response.json().catch(() => null)) as
      | GameLinkResolution
      | PendingLinkResolution
      | { error?: string }
      | null;

    if (!response.ok) {
      throw new LinkResolutionRequestError(
        payload && "error" in payload && payload.error
          ? payload.error
          : `Link resolution failed with status ${response.status}`,
        response.status,
      );
    }

    return payload;
  } catch (error) {
    if (signal?.aborted) {
      throw new LinkResolutionRequestError(
        "Link analysis was cancelled",
        0,
        "ABORTED",
      );
    }
    if (error instanceof LinkResolutionRequestError) throw error;
    throw new LinkResolutionRequestError("Unable to reach the link service", 0);
  }
}

function pollDelay(attempt: number) {
  return Math.min(800 * 1.45 ** attempt, 3_000);
}

function wait(duration: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(
        new LinkResolutionRequestError(
          "Link analysis was cancelled",
          0,
          "ABORTED",
        ),
      );
      return;
    }

    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, duration);
    const handleAbort = () => {
      clearTimeout(timeout);
      reject(
        new LinkResolutionRequestError(
          "Link analysis was cancelled",
          0,
          "ABORTED",
        ),
      );
    };
    signal?.addEventListener("abort", handleAbort, { once: true });
  });
}

async function cachedResolution(url: string) {
  try {
    return await getCachedLinkResolution(url);
  } catch (error) {
    console.warn("Unable to read the link resolution cache", error);
    return null;
  }
}

async function cacheResolution(resolution: GameLinkResolution) {
  try {
    await cacheLinkResolution(resolution);
  } catch (error) {
    console.warn("Unable to cache the link resolution", error);
  }
}

export async function resolveGameLink(
  url: string,
  options?: { signal?: AbortSignal },
) {
  const cached = await cachedResolution(url);
  if (cached) return cached;

  const startedAt = Date.now();
  const started = await postJson("/api/links/resolve", { url }, options?.signal);
  if (isResolution(started)) {
    await cacheResolution(started);
    return started;
  }
  if (!isPending(started)) {
    throw new LinkResolutionRequestError(
      "The link service returned an invalid job",
      502,
    );
  }

  let pollAttempt = 0;
  let statusFailures = 0;
  while (Date.now() - startedAt < POLL_DEADLINE_MS) {
    await wait(pollDelay(pollAttempt), options?.signal);
    pollAttempt += 1;

    try {
      const result = await postJson(
        "/api/links/resolve/status",
        { jobId: started.jobId, url: started.sourceUrl },
        options?.signal,
      );
      statusFailures = 0;

      if (isResolution(result)) {
        await cacheResolution(result);
        return result;
      }
      if (!isPending(result)) {
        throw new LinkResolutionRequestError(
          "The link service returned an invalid result",
          502,
        );
      }
    } catch (error) {
      const canRetry =
        error instanceof LinkResolutionRequestError &&
        !error.code &&
        (error.status === 0 || error.status === 429 || error.status >= 500) &&
        statusFailures < MAX_STATUS_FAILURES;
      if (!canRetry) throw error;
      statusFailures += 1;
    }
  }

  throw new LinkResolutionRequestError(
    "This link is taking longer than expected",
    504,
    "POLL_TIMEOUT",
  );
}
