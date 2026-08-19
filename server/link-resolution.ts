import type { GameSearchResult } from "@/lib/igdb";
import type {
  GameLinkDetection,
  GameLinkResolution,
} from "@/lib/link-resolver";

import { searchIgdbGames } from "./igdb";

const MATCH_CONFIDENCE = 0.82;

function comparableTitle(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function rankCandidates(
  games: GameSearchResult[],
  detection: GameLinkDetection,
) {
  const detectedTitles = [detection.title, ...detection.alternateTitles]
    .filter((title): title is string => Boolean(title))
    .map(comparableTitle);
  const platformHint = detection.platformHint?.toLowerCase();

  return [...games].sort((left, right) => {
    const score = (game: GameSearchResult) => {
      const exactTitle = detectedTitles.includes(comparableTitle(game.name));
      const platformMatch =
        platformHint &&
        game.platforms.some((platform) =>
          platform.toLowerCase().includes(platformHint),
        );
      return Number(exactTitle) * 2 + Number(platformMatch);
    };

    return score(right) - score(left);
  });
}

function hasExactTitle(game: GameSearchResult, detection: GameLinkDetection) {
  const gameTitle = comparableTitle(game.name);
  return [detection.title, ...detection.alternateTitles]
    .filter((title): title is string => Boolean(title))
    .some((title) => comparableTitle(title) === gameTitle);
}

export async function resolveGameDetection(
  sourceUrl: URL,
  detection: GameLinkDetection,
): Promise<GameLinkResolution> {
  if (!detection.title) {
    return {
      status: "not-found",
      sourceUrl: sourceUrl.toString(),
      query: null,
      detection,
      game: null,
      candidates: [],
    };
  }

  const searchTitles = [detection.title, ...detection.alternateTitles];
  let candidates: GameSearchResult[] = [];
  for (const title of searchTitles.slice(0, 3)) {
    // IGDB search can rank fan projects and expansions above an exact base-game
    // title. Search the full supported window, then apply our exact-title rank.
    candidates = await searchIgdbGames(title, 20);
    if (candidates.length > 0) break;
  }

  const rankedCandidates = rankCandidates(candidates, detection);
  const game = rankedCandidates[0] ?? null;
  const confidentMatch =
    game &&
    detection.confidence >= MATCH_CONFIDENCE &&
    (hasExactTitle(game, detection) || detection.confidence >= 0.94);

  return {
    status: confidentMatch
      ? "matched"
      : game
        ? "needs-confirmation"
        : "not-found",
    sourceUrl: sourceUrl.toString(),
    query: detection.title,
    detection,
    game: confidentMatch ? game : null,
    candidates: rankedCandidates,
  };
}
