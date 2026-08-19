import { useState } from "react";
import {
  type AccessibilityActionEvent,
  StyleSheet,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useRealtimeComposer } from "react-native-pulsar";
import { runOnJS, useSharedValue } from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import { RatingLabel } from "@/components/rating-label";
import { RatingStar } from "@/components/rating-star";
import {
  formatRating,
  getRatingLabel,
  getRatingStarState,
  MAX_RATING,
  MIN_RATING,
  ratingLabels,
  RATING_STEP,
} from "@/lib/rating";

type RatingScrubberProps = {
  disabled?: boolean;
  onChange: (rating: number) => void;
  value: number | null;
};

export function RatingScrubber({
  disabled = false,
  onChange,
  value,
}: RatingScrubberProps) {
  const { t } = useTranslation();
  const [previewRating, setPreviewRating] = useState(value);
  const [starsWidth, setStarsWidth] = useState(0);
  const gestureRating = useSharedValue(0);
  const didCommitGesture = useSharedValue(false);
  const realtimeHaptics = useRealtimeComposer();

  function updatePreview(nextRating: number) {
    setPreviewRating((current) =>
      current === nextRating ? current : nextRating,
    );
  }

  function resetPreview() {
    setPreviewRating(value);
  }

  function commitRating(nextRating: number) {
    setPreviewRating(nextRating);
    onChange(nextRating);
  }

  function getRatingFromPosition(position: number) {
    "worklet";

    const progress = Math.max(0, Math.min(1, position / starsWidth));
    return Math.max(
      MIN_RATING,
      Math.min(MAX_RATING, Math.ceil(progress * 10) * RATING_STEP),
    );
  }

  const ratingGesture = Gesture.Pan()
    .enabled(!disabled)
    .minDistance(0)
    .onBegin((event) => {
      didCommitGesture.value = false;
      if (!starsWidth) return;

      const progress = Math.max(0, Math.min(1, event.x / starsWidth));
      const nextRating = getRatingFromPosition(event.x);
      gestureRating.value = nextRating;
      realtimeHaptics.set(0.07, 0.38 + progress * 0.24, true);
      realtimeHaptics.playDiscrete(
        0.16 + nextRating * 0.015,
        0.42 + nextRating * 0.08,
      );
      runOnJS(updatePreview)(nextRating);
    })
    .onUpdate((event) => {
      if (!starsWidth) return;

      const progress = Math.max(0, Math.min(1, event.x / starsWidth));
      const nextRating = getRatingFromPosition(event.x);
      const speed = Math.min(Math.abs(event.velocityX) / 1600, 1);
      realtimeHaptics.set(0.06 + speed * 0.08, 0.38 + progress * 0.24, true);
      if (gestureRating.value === nextRating) return;

      gestureRating.value = nextRating;
      realtimeHaptics.playDiscrete(
        0.16 + nextRating * 0.015,
        0.42 + nextRating * 0.08,
      );
      runOnJS(updatePreview)(nextRating);
    })
    .onEnd(() => {
      realtimeHaptics.stop();
      if (!gestureRating.value) return;

      didCommitGesture.value = true;
      runOnJS(commitRating)(gestureRating.value);
    })
    .onFinalize(() => {
      realtimeHaptics.stop();
      if (!didCommitGesture.value) runOnJS(resetPreview)();
    });

  const displayRating = previewRating ?? value;

  function handleAccessibilityAction(event: AccessibilityActionEvent) {
    if (disabled) return;

    const currentRating = displayRating ?? 0;
    const nextRating =
      event.nativeEvent.actionName === "increment"
        ? Math.min(MAX_RATING, currentRating + RATING_STEP)
        : Math.max(MIN_RATING, currentRating - RATING_STEP);

    commitRating(nextRating);
  }

  return (
    <View>
      <GestureDetector gesture={ratingGesture}>
        <View
          accessibilityActions={[
            { label: t("Increase rating"), name: "increment" },
            { label: t("Decrease rating"), name: "decrement" },
          ]}
          accessibilityLabel={
            displayRating
              ? t("Rating: {{rating}} out of 5", {
                  rating: formatRating(displayRating),
                })
              : t("Rate game")
          }
          accessibilityRole="adjustable"
          accessibilityValue={{
            max: 5,
            min: 0,
            now: displayRating ?? 0,
            text: displayRating
              ? getRatingLabel(displayRating)
              : undefined,
          }}
          onAccessibilityAction={handleAccessibilityAction}
          onLayout={(event) => setStarsWidth(event.nativeEvent.layout.width)}
          style={styles.stars}
        >
          {ratingLabels.map((label, index) => {
            const star = index + 1;

            return (
              <View key={label} style={styles.starButton}>
                <RatingStar
                  size={38}
                  state={getRatingStarState(star, displayRating)}
                />
              </View>
            );
          })}
        </View>
      </GestureDetector>
      <RatingLabel
        rating={displayRating}
        text={
          displayRating
            ? `${formatRating(displayRating)} · ${getRatingLabel(displayRating)}`
            : t("Drag across the stars to rate")
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  starButton: {
    alignItems: "center",
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  stars: {
    flexDirection: "row",
    gap: 4,
    marginTop: 18,
  },
});
