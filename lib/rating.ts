export const RATING_STEP = 0.5;
export const MAX_RATING = 5;
export const MIN_RATING = 0.5;

export const ratingLabels = [
  "Rough",
  "Okay",
  "Good",
  "Great",
  "Masterpiece",
] as const;

export type RatingStarState = "empty" | "full" | "half";

export function normalizeRating(rating: number | null) {
  if (rating === null) return null;
  if (!Number.isFinite(rating)) return MIN_RATING;

  return Math.min(
    MAX_RATING,
    Math.max(MIN_RATING, Math.round(rating / RATING_STEP) * RATING_STEP),
  );
}

export function formatRating(rating: number) {
  return Number.isInteger(rating) ? String(rating) : rating.toFixed(1);
}

export function getRatingLabel(rating: number) {
  return ratingLabels[Math.ceil(normalizeRating(rating) ?? MIN_RATING) - 1];
}

export function getRatingStarState(
  star: number,
  rating: number | null,
): RatingStarState {
  if (rating === null || rating < star - RATING_STEP) return "empty";
  if (rating < star) return "half";
  return "full";
}
