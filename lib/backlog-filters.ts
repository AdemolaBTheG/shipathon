export type BacklogSourceFilter =
  | "all"
  | "instagram"
  | "manual"
  | "other-link"
  | "tiktok"
  | "youtube";

export function getBacklogSource(sourceUrl: string | null): Exclude<
  BacklogSourceFilter,
  "all"
> {
  if (!sourceUrl) return "manual";

  try {
    const hostname = new URL(sourceUrl).hostname.toLocaleLowerCase();
    if (hostname.includes("tiktok")) return "tiktok";
    if (hostname.includes("instagram")) return "instagram";
    if (hostname.includes("youtube") || hostname === "youtu.be") {
      return "youtube";
    }
  } catch {
    return "other-link";
  }

  return "other-link";
}

export function matchesBacklogSource(
  sourceUrl: string | null,
  filter: BacklogSourceFilter,
) {
  return filter === "all" || getBacklogSource(sourceUrl) === filter;
}
