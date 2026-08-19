import type { GameLinkDetection } from "@/lib/link-resolver";

import {
  getSocialGameDetection,
  isSocialJobId,
  isSocialResolverConfigured,
  isSocialVideoUrl,
  SocialResolverError,
  startSocialGameDetection,
} from "./social-resolver";

const GEMINI_MODEL = "gemini-3.1-flash-lite";
const GEMINI_GENERATE_CONTENT_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 2;
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

const detectionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: {
      type: ["string", "null"],
      description: "Exact title of the primary video game shown or discussed.",
    },
    alternateTitles: {
      type: "array",
      maxItems: 3,
      items: { type: "string" },
      description: "Other exact titles or localized names supported by the source.",
    },
    platformHint: {
      type: ["string", "null"],
      description: "Platform explicitly shown or mentioned, otherwise null.",
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
      description: "Confidence based only on direct evidence in the supplied source.",
    },
    evidence: {
      type: "string",
      description: "Short explanation of the strongest direct evidence.",
    },
    sourceKind: {
      type: "string",
      enum: ["video", "page", "unknown"],
    },
  },
  required: [
    "title",
    "alternateTitles",
    "platformHint",
    "confidence",
    "evidence",
    "sourceKind",
  ],
} as const;

type GeminiGenerateContentResponse = {
  candidates?: {
    content?: {
      parts?: { text?: string }[];
    };
  }[];
  promptFeedback?: { blockReason?: string };
  error?: { code?: string; message?: string };
};

export type GameDetectionJobResult =
  | { status: "pending" }
  | { status: "completed"; detection: GameLinkDetection };

export type GameDetectionStartResult =
  | { status: "pending"; jobId: string }
  | { status: "completed"; detection: GameLinkDetection };

type GeminiDebugContext = {
  apiKeyConfigured?: boolean;
  apiKeyLength?: number;
  attempt?: number;
  cause?: string;
  model?: string;
  responseBodySnippet?: string;
  responseStatusText?: string;
  status?: number;
  url?: string;
};

export class GeminiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly debugContext?: GeminiDebugContext,
  ) {
    super(message);
    this.name = "GeminiRequestError";
  }
}

function requiredApiKey() {
  const value = process.env.GEMINI_API_KEY;
  if (!value) throw new GeminiRequestError("Gemini is not configured", 503);
  return value;
}

function sleep(duration: number) {
  return new Promise((resolve) => setTimeout(resolve, duration));
}

function retryDelay(response: Response, attempt: number) {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1_000, 2_000);
  }

  return 350 * 2 ** attempt;
}

async function requestGemini(url: string, init: RequestInit = {}) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const apiKey = requiredApiKey();
    const debugContextBase = {
      apiKeyConfigured: true,
      apiKeyLength: apiKey.length,
      attempt: attempt + 1,
      model: GEMINI_MODEL,
      url,
    } satisfies GeminiDebugContext;

    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          "x-goog-api-key": apiKey,
          ...init.headers,
        },
        signal: controller.signal,
      });
      const responseText = await response.text();
      const payload = (responseText
        ? JSON.parse(responseText)
        : null) as GeminiGenerateContentResponse | null;

      if (response.ok && payload) return payload;

      if (
        attempt < MAX_ATTEMPTS - 1 &&
        RETRYABLE_STATUSES.has(response.status)
      ) {
        await sleep(retryDelay(response, attempt));
        continue;
      }

      const debugContext = {
        ...debugContextBase,
        responseBodySnippet: responseText.slice(0, 500),
        responseStatusText: response.statusText,
        status: response.status || 502,
      } satisfies GeminiDebugContext;
      console.error("Gemini request failed", debugContext);
      throw new GeminiRequestError(
        payload?.error?.message ?? "Gemini request failed",
        response.status || 502,
        debugContext,
      );
    } catch (error) {
      if (error instanceof GeminiRequestError) throw error;
      if (attempt < MAX_ATTEMPTS - 1) {
        await sleep(350 * 2 ** attempt);
        continue;
      }

      const debugContext = {
        ...debugContextBase,
        cause:
          error instanceof Error ? error.message : "Unknown request failure",
        status: controller.signal.aborted ? 504 : 502,
      } satisfies GeminiDebugContext;
      console.error("Gemini request crashed", debugContext);
      throw new GeminiRequestError(
        controller.signal.aborted
          ? "Gemini did not respond in time"
          : "Unable to reach Gemini",
        controller.signal.aborted ? 504 : 502,
        debugContext,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new GeminiRequestError("Unable to reach Gemini", 502);
}

function isYouTubeUrl(url: URL) {
  const hostname = url.hostname.toLowerCase();
  return (
    hostname === "youtu.be" ||
    hostname === "youtube.com" ||
    hostname.endsWith(".youtube.com") ||
    hostname === "youtube-nocookie.com" ||
    hostname.endsWith(".youtube-nocookie.com")
  );
}

function outputText(response: GeminiGenerateContentResponse) {
  return response.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("");
}

function normalizeDetection(value: unknown): GameLinkDetection {
  if (!value || typeof value !== "object") {
    throw new GeminiRequestError("Gemini returned an invalid result", 502);
  }

  const candidate = value as Partial<GameLinkDetection>;
  const sourceKinds = new Set(["video", "page", "unknown"]);
  return {
    title:
      typeof candidate.title === "string" && candidate.title.trim()
        ? candidate.title.trim().slice(0, 120)
        : null,
    alternateTitles: Array.isArray(candidate.alternateTitles)
      ? candidate.alternateTitles
          .filter((title): title is string => typeof title === "string")
          .map((title) => title.trim().slice(0, 120))
          .filter(Boolean)
          .slice(0, 3)
      : [],
    platformHint:
      typeof candidate.platformHint === "string" && candidate.platformHint.trim()
        ? candidate.platformHint.trim().slice(0, 80)
        : null,
    confidence:
      typeof candidate.confidence === "number" &&
      Number.isFinite(candidate.confidence)
        ? Math.min(Math.max(candidate.confidence, 0), 1)
        : 0,
    evidence:
      typeof candidate.evidence === "string"
        ? candidate.evidence.trim().slice(0, 240)
        : "",
    sourceKind:
      typeof candidate.sourceKind === "string" &&
      sourceKinds.has(candidate.sourceKind)
        ? (candidate.sourceKind as GameLinkDetection["sourceKind"])
        : "unknown",
  };
}

function plausiblePlainTitle(value: string) {
  const title = value.trim();
  return (
    title.length > 0 &&
    title.length <= 120 &&
    !/[\n\r`{}<>]/.test(title) &&
    title.split(/\s+/).length <= 18 &&
    /^[\p{L}\p{N}]/u.test(title)
  );
}

function parseDetectionText(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;

  try {
    const parsed = JSON.parse(candidate) as unknown;
    if (typeof parsed === "string" && plausiblePlainTitle(parsed)) {
      return normalizeDetection({
        title: parsed,
        confidence: 0.65,
        evidence: "Gemini returned only the detected game title.",
        sourceKind: "unknown",
      });
    }
    return normalizeDetection(parsed);
  } catch (error) {
    if (error instanceof GeminiRequestError) throw error;
    if (plausiblePlainTitle(candidate)) {
      return normalizeDetection({
        title: candidate,
        confidence: 0.65,
        evidence: "Gemini returned only the detected game title.",
        sourceKind: "unknown",
      });
    }
    throw new GeminiRequestError("Gemini returned invalid JSON", 502);
  }
}

function gameDetectionRequest(url: URL) {
  const prompt = [
    "Identify the primary video game directly shown, played, reviewed, or discussed in this shared link.",
    "Use visible gameplay, title screens, captions, spoken audio, page text, and metadata as evidence.",
    "Return the exact released game title, not a franchise, character, creator, platform, or guessed sequel.",
    "If the source does not provide enough direct evidence, return title as null and confidence 0.",
    "Keep evidence to one short sentence. Do not invent information.",
  ].join(" ");
  const youtube = isYouTubeUrl(url);

  return {
    contents: [
      {
        role: "user",
        parts: youtube
          ? [
              {
                file_data: {
                  file_uri: url.toString(),
                  mime_type: "video/*",
                },
              },
              { text: prompt },
            ]
          : [{ text: `${prompt}\n\nSource URL: ${url.toString()}` }],
      },
    ],
    ...(youtube ? {} : { tools: [{ url_context: {} }] }),
    generationConfig: {
      maxOutputTokens: 500,
      responseMimeType: "application/json",
      responseJsonSchema: detectionSchema,
    },
  };
}

function completedDetection(response: GeminiGenerateContentResponse) {
  const text = outputText(response);
  if (!text) {
    throw new GeminiRequestError(
      response.promptFeedback?.blockReason
        ? `Gemini blocked the source: ${response.promptFeedback.blockReason}`
        : response.error?.message ?? "Gemini returned no result",
      502,
    );
  }

  try {
    return parseDetectionText(text);
  } catch (error) {
    if (error instanceof GeminiRequestError) throw error;
    throw new GeminiRequestError("Gemini returned invalid JSON", 502);
  }
}

export async function startGameDetection(url: URL) {
  if (isSocialVideoUrl(url) && isSocialResolverConfigured()) {
    try {
      const { jobId } = await startSocialGameDetection(url);
      return { status: "pending" as const, jobId };
    } catch (error) {
      console.error("Social resolver unavailable; falling back to URL context", {
        error: error instanceof Error ? error.message : "Unknown error",
        hostname: url.hostname,
      });
    }
  }

  const response = await requestGemini(GEMINI_GENERATE_CONTENT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(gameDetectionRequest(url)),
  });

  return {
    status: "completed" as const,
    detection: completedDetection(response),
  };
}

export async function getGameDetection(
  jobId: string,
): Promise<GameDetectionJobResult> {
  if (isSocialJobId(jobId)) {
    try {
      return await getSocialGameDetection(jobId);
    } catch (error) {
      if (error instanceof SocialResolverError) {
        throw new GeminiRequestError(error.message, error.status);
      }
      throw error;
    }
  }

  throw new GeminiRequestError(
    "This link analysis job has expired. Start the analysis again.",
    410,
  );
}
