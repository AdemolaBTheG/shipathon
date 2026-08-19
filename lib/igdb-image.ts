export type IgdbImageSize =
  | "cover_big"
  | "cover_big_2x"
  | "cover_small"
  | "cover_small_2x";

export function getIgdbImageUrl(
  url: string | null | undefined,
  size: IgdbImageSize,
) {
  if (!url || !url.includes("images.igdb.com/igdb/image/upload/")) {
    return url ?? null;
  }

  return url.replace(/\/t_[^/]+\//, `/t_${size}/`);
}
