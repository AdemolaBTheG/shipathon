import * as Burnt from "burnt";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { usePostHog } from "posthog-react-native";
import { Presets } from "react-native-pulsar";
import { useTranslation } from "react-i18next";

import { ProgressArc } from "@/components/progress-arc";
import { Text } from "@/components/Themed";
import { colors } from "@/constants/theme";
import {
  getBacklog,
  updateBacklogProgress,
  updateBacklogStatus,
} from "@/db/repository";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ProgressScreen() {
  const { t } = useTranslation();
  const posthog = usePostHog();
  const { id } = useLocalSearchParams<{ id: string }>();
  const gameId = Number(id);
  const hasValidGameId = Number.isInteger(gameId);
  const { width } = useWindowDimensions();
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    let active = true;
    if (!hasValidGameId) return () => undefined;

    void getBacklog()
      .then((backlog) => {
        if (!active) return;

        const savedGame = backlog.find((item) => item.igdbId === gameId);
        if (!savedGame) {
          router.back();
          return;
        }

        setProgress(savedGame.backlog.progressCurrent);
      })
      .catch(() => {
        if (active) setError(t("Unable to load progress"));
      });

    return () => {
      active = false;
    };
  }, [gameId, hasValidGameId, t]);

  async function handleCommit(nextProgress: number) {
    const previousProgress = progress;
    setProgress(nextProgress);

    try {
      await updateBacklogProgress(gameId, nextProgress);
      posthog.capture("progress_updated", {
        game_id: gameId,
        progress: nextProgress,
      });
      if (
        previousProgress !== null &&
        previousProgress < 100 &&
        nextProgress === 100
      ) {
        promptToMarkCompleted();
      }
    } catch (progressError) {
      setProgress(previousProgress);
      Presets.System.notificationError();
      Burnt.toast({
        preset: "error",
        title:
          progressError instanceof Error
            ? progressError.message
            : t("Unable to save progress"),
      });
    }
  }

  function promptToMarkCompleted() {
    Alert.alert(t("Mark as completed?"), t("You have reached 100% progress."), [
      { style: "cancel", text: t("Not yet") },
      {
        text: t("Mark completed"),
        onPress: () => void handleMarkCompleted(),
      },
    ]);
  }

  async function handleMarkCompleted() {
    try {
      await updateBacklogStatus(gameId, "completed");
      posthog.capture("game_completed", {
        game_id: gameId,
      });
      Presets.System.notificationSuccess();
      promptToRate();
    } catch (completionError) {
      Presets.System.notificationError();
      Burnt.toast({
        preset: "error",
        title:
          completionError instanceof Error
            ? completionError.message
            : t("Unable to complete game"),
      });
    }
  }

  function promptToRate() {
    Alert.alert(t("Game completed"), t("Would you like to rate it?"), [
      {
        style: "cancel",
        text: t("Not now"),
        onPress: () => router.back(),
      },
      {
        text: t("Rate game"),
        onPress: () =>
          router.replace({
            pathname: "/rating",
            params: { id: String(gameId) },
          }),
      },
    ]);
  }

  const arcSize = Math.min(380, width - 24);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ title: t("Progress") }} />
      {error ? (
        <Text selectable style={styles.error}>
          {error}
        </Text>
      ) : progress === null ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <ProgressArc
          initialValue={progress}
          key={progress}
          onCommit={(value) => void handleCommit(value)}
          size={arcSize}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 12,
  },
  error: {
    color: colors.danger,
  },
});
