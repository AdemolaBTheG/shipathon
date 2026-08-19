const MAX_TITLE_LENGTH = 120;

function normalizedTitle(value) {
  if (typeof value !== "string") return null;
  const title = value.trim().replace(/\s+/g, " ");
  return title ? title.slice(0, MAX_TITLE_LENGTH) : null;
}

function plausiblePlainTitle(value) {
  const title = value.trim();
  return (
    title.length > 0 &&
    title.length <= MAX_TITLE_LENGTH &&
    !/[\n\r`{}<>]/.test(title) &&
    title.split(/\s+/).length <= 18 &&
    /^[\p{L}\p{N}]/u.test(title)
  );
}

export function normalizeDetection(value, defaults = {}) {
  const title = normalizedTitle(value?.title);
  return {
    title,
    alternateTitles: Array.isArray(value?.alternateTitles)
      ? value.alternateTitles
          .map(normalizedTitle)
          .filter(Boolean)
          .slice(0, 3)
      : [],
    platformHint: normalizedTitle(value?.platformHint)?.slice(0, 80) ?? null,
    confidence:
      typeof value?.confidence === "number" && Number.isFinite(value.confidence)
        ? Math.min(Math.max(value.confidence, 0), 1)
        : title
          ? defaults.confidence ?? 0
          : 0,
    evidence:
      typeof value?.evidence === "string" && value.evidence.trim()
        ? value.evidence.trim().slice(0, 240)
        : title
          ? defaults.evidence ?? "Gemini returned only the detected game title."
          : "",
    sourceKind: ["video", "page", "unknown"].includes(value?.sourceKind)
      ? value.sourceKind
      : defaults.sourceKind ?? "unknown",
  };
}

export function parseDetectionText(text, defaults = {}) {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Gemini returned no result");
  }

  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;

  try {
    const parsed = JSON.parse(candidate);
    if (parsed === null) return normalizeDetection({}, defaults);
    if (typeof parsed === "string" && plausiblePlainTitle(parsed)) {
      return normalizeDetection({ title: parsed }, defaults);
    }
    if (typeof parsed === "object" && !Array.isArray(parsed)) {
      return normalizeDetection(parsed, defaults);
    }
  } catch {
    if (plausiblePlainTitle(candidate)) {
      return normalizeDetection({ title: candidate }, defaults);
    }
  }

  throw new Error("Gemini returned an invalid structured result");
}
