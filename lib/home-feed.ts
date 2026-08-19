export const HOME_FEED_TYPES = [
  "upcoming",
  "friends-playing",
  "quick-wins",
] as const;

export type HomeFeedType = (typeof HOME_FEED_TYPES)[number];

export const HOME_FEED_CONFIG = {
  upcoming: {
    searchPlaceholder: "Search upcoming games",
    title: "Coming Soon",
  },
  "friends-playing": {
    searchPlaceholder: "Search friends' games",
    title: "Friends are playing",
  },
  "quick-wins": {
    searchPlaceholder: "Search quick wins",
    title: "Quick wins",
  },
} satisfies Record<
  HomeFeedType,
  { searchPlaceholder: string; title: string }
>;

export function isHomeFeedType(
  value: string | undefined,
): value is HomeFeedType {
  return HOME_FEED_TYPES.some((type) => type === value);
}
