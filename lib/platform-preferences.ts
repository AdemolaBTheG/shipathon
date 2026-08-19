import type { GameSearchResult } from "@/lib/igdb";

export const platformPreferences = [
  { id: "playstation", label: "PlayStation", platform: "PlayStation 5" },
  { id: "xbox", label: "Xbox", platform: "Xbox Series X|S" },
  { id: "switch", label: "Nintendo", platform: "Nintendo Switch" },
  { id: "pc", label: "PC", platform: "PC (Microsoft Windows)" },
  { id: "mobile", label: "Mobile", platform: "iOS" },
] as const;

export type PlatformPreferenceId = (typeof platformPreferences)[number]["id"];

const platformMatchers: Record<PlatformPreferenceId, RegExp> = {
  mobile: /android|ios|iphone|ipad|mobile/i,
  pc: /pc|windows|steam|linux|mac/i,
  playstation: /playstation|ps vita|psp/i,
  switch: /nintendo|switch|wii|game boy|gameboy|gamecube|nes|snes|n64|ds/i,
  xbox: /xbox/i,
};

export function isPlatformPreferenceId(
  value: string,
): value is PlatformPreferenceId {
  return platformPreferences.some((platform) => platform.id === value);
}

export function getPlatformPreferenceScore(
  platforms: readonly string[],
  preferences: readonly string[],
) {
  if (preferences.length === 0) return 0;

  return preferences.reduce((score, preference) => {
    if (!isPlatformPreferenceId(preference)) return score;
    return platforms.some((platform) =>
      platformMatchers[preference].test(platform),
    )
      ? score + 1
      : score;
  }, 0);
}

export function rankGamesByPlatformPreferences<T extends Pick<GameSearchResult, "platforms">>(
  games: readonly T[],
  preferences: readonly string[],
) {
  if (preferences.length === 0) return [...games];

  return games
    .map((game, index) => ({
      game,
      index,
      score: getPlatformPreferenceScore(game.platforms, preferences),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ game }) => game);
}
