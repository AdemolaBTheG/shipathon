import { SymbolView, type SymbolViewProps } from "expo-symbols";

import { colors } from "@/constants/theme";
import type { RatingStarState } from "@/lib/rating";

const symbols = {
  empty: { android: "star_outline", ios: "star" },
  full: { android: "star", ios: "star.fill" },
  half: { android: "star_half", ios: "star.leadinghalf.filled" },
} as const satisfies Record<RatingStarState, SymbolViewProps["name"]>;

type RatingStarProps = {
  emptyColor?: string;
  filledColor?: string;
  size: number;
  state: RatingStarState;
};

export function RatingStar({
  emptyColor = colors.textMuted,
  filledColor = colors.primary,
  size,
  state,
}: RatingStarProps) {
  return (
    <SymbolView
      name={symbols[state]}
      size={size}
      tintColor={state === "empty" ? emptyColor : filledColor}
    />
  );
}
