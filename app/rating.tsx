import * as Burnt from "burnt";
import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { usePostHog } from "posthog-react-native";
import { Presets } from "react-native-pulsar";
import { useTranslation } from "react-i18next";

import { RatingScrubber } from "@/components/rating-scrubber";
import { colors } from "@/constants/theme";
import { getBacklog, updateBacklogRating } from "@/db/repository";

export default function RatingScreen() {
  const { t } = useTranslation();
  const posthog = usePostHog();
  const { id } = useLocalSearchParams<{ id: string }>();
  const gameId = Number(id);
  const hasValidGameId = Number.isInteger(gameId);
  const [game, setGame] = useState<
    Awaited<ReturnType<typeof getBacklog>>[number] | null
  >(null);
  const [rating, setRating] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(hasValidGameId);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!hasValidGameId) {
      return () => {
        active = false;
      };
    }

    void getBacklog()
      .then((backlog) => {
        if (!active) return;

        const savedGame = backlog.find((item) => item.igdbId === gameId);
        if (!savedGame) {
          router.back();
          return;
        }

        setGame(savedGame);
        setRating(savedGame.backlog.rating);
        setIsLoading(false);
      })
      .catch(() => {
        if (active) {
          setError(t("Unable to load rating"));
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [gameId, hasValidGameId, id, t]);

  async function handleRatingPress(nextRating: number) {
    if (!game || isSaving) return;

    setIsSaving(true);
    try {
      await updateBacklogRating(game.igdbId, nextRating);
      posthog.capture("rating_set", {
        game_id: game.igdbId,
        rating: nextRating,
      });
      setRating(nextRating);
      Presets.snap();
      router.back();
    } catch (ratingError) {
      Presets.System.notificationError();
      Burnt.toast({
        preset: "error",
        title:
          ratingError instanceof Error
            ? ratingError.message
            : t("Unable to save rating"),
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemoveRating() {
    if (!game || isSaving || rating === null) return;

    setIsSaving(true);
    try {
      await updateBacklogRating(game.igdbId, null);
      posthog.capture("rating_removed", {
        game_id: game.igdbId,
      });
      setRating(null);
      Presets.latch();
      router.back();
    } catch (ratingError) {
      Presets.System.notificationError();
      Burnt.toast({
        preset: "error",
        title:
          ratingError instanceof Error
            ? ratingError.message
            : t("Unable to remove rating"),
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t("Rate game") }} />
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
      >
        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : game ? (
          <>
            <View style={styles.gameHeader}>
              {game.coverUrl ? (
                <Image
                  contentFit="cover"
                  source={game.coverUrl}
                  style={styles.cover}
                />
              ) : null}
              <Text numberOfLines={2} style={styles.gameTitle}>
                {game.name}
              </Text>
            </View>

            <Text style={styles.prompt}>{t("How was it?")}</Text>
            <RatingScrubber
              disabled={isSaving}
              onChange={(nextRating) => void handleRatingPress(nextRating)}
              value={rating}
            />
          </>
        ) : null}
      </ScrollView>

      {rating !== null ? (
        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={() => void handleRemoveRating()}
            style={styles.removeButton}
          >
            <Text style={styles.removeText}>{t("Remove rating")}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    alignItems: "center",
    padding: 24,
    paddingTop: 12,
  },
  gameHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    maxWidth: 320,
  },
  cover: {
    borderRadius: 10,
    height: 76,
    width: 57,
  },
  gameTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
  },
  prompt: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    marginTop: 28,
  },
  error: {
    color: colors.danger,
  },
  footer: {
    padding: 20,
  },
  removeButton: {
    alignItems: "center",
    padding: 12,
  },
  removeText: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: "600",
  },
});
