import type { GameLinkDetection } from "@/lib/link-resolver";

const JOB_PREFIX = "social_";
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_ATTEMPTS = 2;
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

type ResolverJob =
  | { status: "pending"; jobId?: string; stage?: string }
  | { status: "completed"; detection: GameLinkDetection }
  | { status: "failed"; error?: string };

export class SocialResolverError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "SocialResolverError";
  }
}

function resolverConfig() {
  const baseUrl = process.env.LINK_RESOLVER_URL?.trim().replace(/\/$/, "");
  const token = process.env.LINK_RESOLVER_TOKEN?.trim();
  return baseUrl && token ? { baseUrl, token } : null;
}

function matchesDomain(hostname: string, domain: string) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function isSocialVideoUrl(url: URL) {
  const hostname = url.hostname.toLowerCase();
  return (
    matchesDomain(hostname, "tiktok.com") ||
    matchesDomain(hostname, "instagram.com")
  );
}

export function isSocialResolverConfigured() {
  return Boolean(resolverConfig());
}

export function isSocialJobId(jobId: string) {
  return jobId.startsWith(JOB_PREFIX);
}

function sleep(duration: number) {
  return new Promise((resolve) => setTimeout(resolve, duration));
}

async function requestResolver(pathname: string, init: RequestInit = {}) {
  const config = resolverConfig();
  if (!config) throw new SocialResolverError("Social resolver is not configured", 503);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${config.baseUrl}${pathname}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${config.token}`,
          ...init.headers,
        },
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => null)) as
        | ResolverJob
        | { error?: string }
        | null;

      if (response.ok && payload) return payload as ResolverJob;
      if (
        attempt < MAX_ATTEMPTS - 1 &&
        RETRYABLE_STATUSES.has(response.status)
      ) {
        await sleep(300 * 2 ** attempt);
        continue;
      }

      throw new SocialResolverError(
        payload && "error" in payload && payload.error
          ? payload.error
          : `Social resolver returned HTTP ${response.status}`,
        response.status || 502,
      );
    } catch (error) {
      if (error instanceof SocialResolverError) throw error;
      if (attempt < MAX_ATTEMPTS - 1) {
        await sleep(300 * 2 ** attempt);
        continue;
      }
      throw new SocialResolverError(
        controller.signal.aborted
          ? "Social resolver did not respond in time"
          : "Unable to reach social resolver",
        controller.signal.aborted ? 504 : 502,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new SocialResolverError("Unable to reach social resolver", 502);
}

export async function startSocialGameDetection(url: URL) {
  const job = await requestResolver("/v1/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: url.toString() }),
  });
  if (job.status !== "pending" || !job.jobId) {
    throw new SocialResolverError("Social resolver returned an invalid job", 502);
  }
  return { jobId: `${JOB_PREFIX}${job.jobId}` };
}

export async function getSocialGameDetection(jobId: string) {
  const resolverJobId = jobId.slice(JOB_PREFIX.length);
  if (!/^[a-f0-9-]{36}$/.test(resolverJobId)) {
    throw new SocialResolverError("Invalid social resolver job ID", 400);
  }

  const job = await requestResolver(`/v1/jobs/${resolverJobId}`);
  if (job.status === "pending") return { status: "pending" as const };
  if (job.status === "completed" && job.detection) {
    return { status: "completed" as const, detection: job.detection };
  }
  throw new SocialResolverError(
    job.status === "failed" && job.error
      ? job.error
      : "Social resolver returned an invalid result",
    502,
  );
}
