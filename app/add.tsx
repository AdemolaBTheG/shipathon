import { AnimatedCardGlow } from "@/components/animated-card-glow";
import { LinkResolutionResult } from "@/components/link-resolution-result";
import { colors, theme } from "@/constants/theme";
import {
  AI_LINK_RECOGNITION_FEATURE,
  FREE_AI_LINK_RECOGNITIONS_PER_MONTH,
  getMonthlyFeatureUsage,
  incrementMonthlyFeatureUsage,
} from "@/db/feature-usage";
import { getCachedLinkResolution } from "@/db/link-resolution-cache";
import { getBacklog, saveGameToBacklog } from "@/db/repository";
import { useRevenueCat } from "@/hooks/use-revenuecat";
import { createHeaderLeftOptions } from "@/lib/header-item-options";
import type { GameSearchResult } from "@/lib/igdb";
import { createNativeBackItems } from "@/lib/native-header-items";
import {
  LinkResolutionRequestError,
  resolveGameLink,
  type GameLinkResolution,
} from "@/lib/link-resolver";
import * as Burnt from "burnt";
import * as Clipboard from "expo-clipboard";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useIncomingShare } from "expo-sharing";
import { SymbolView } from "expo-symbols";
import { PressableOpacity, PressableScale } from "pressto";
import { usePostHog } from "posthog-react-native";
import { PAYWALL_RESULT } from "react-native-purchases-ui";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Presets, Settings } from "react-native-pulsar";
import Animated, {
  FadeIn,
  FadeInUp,
  useReducedMotion,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

function normalizeWebUrl(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  try {
    const candidate = new URL(
      /^https?:\/\//i.test(trimmedValue)
        ? trimmedValue
        : `https://${trimmedValue}`,
    );

    if (candidate.protocol !== "http:" && candidate.protocol !== "https:") {
      return null;
    }

    return candidate.toString();
  } catch {
    return null;
  }
}

function extractSharedWebUrl(value: string) {
  const candidates = value.match(/https?:\/\/[^\s<>"']+/gi) ?? [value];

  for (const candidate of candidates) {
    const normalizedUrl = normalizeWebUrl(
      candidate.replace(/[\])},.!?;:]+$/g, ""),
    );
    if (normalizedUrl) return normalizedUrl;
  }

  return null;
}

export default function AddScreen() {
  const { t } = useTranslation();
  const posthog = usePostHog();
  const router = useRouter();
  const {
    isConfigured,
    isLoading: isRevenueCatLoading,
    isPro,
    isSupported,
    presentPaywallIfNeeded,
  } = useRevenueCat();
  const { width } = useWindowDimensions();
  const {
    incomingShare,
    paste,
    resolve: resolveClipboard,
    source,
  } = useLocalSearchParams<{
    incomingShare?: string;
    paste?: string;
    resolve?: string;
    source?: string;
  }>();
  const {
    clearSharedPayloads,
    error: incomingShareError,
    isResolving: isIncomingShareResolving,
    resolvedSharedPayloads,
    sharedPayloads,
  } = useIncomingShare();
  const reduceMotion = useReducedMotion();
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [resolution, setResolution] = useState<GameLinkResolution | null>(null);
  const [selectedGame, setSelectedGame] = useState<GameSearchResult | null>(
    null,
  );
  const [savedGameIds, setSavedGameIds] = useState<Set<number>>(new Set());
  const [savingGameId, setSavingGameId] = useState<number | null>(null);
  const handledIncomingShareRef = useRef<string | null>(null);
  const handledWidgetPasteRef = useRef(false);
  const incomingActionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const resolveControllerRef = useRef<AbortController | null>(null);
  const insets = useSafeAreaInsets();
  const nativeBackItems = createNativeBackItems({
    onPress: () => router.back(),
  });
  useEffect(() => {
    Settings.preloadPresets(["Sweep", "Nudge"]);
    return () => {
      resolveControllerRef.current?.abort();
      if (incomingActionTimerRef.current) {
        clearTimeout(incomingActionTimerRef.current);
      }
    };
  }, []);

  const pasteLink = async () => {
    const clipboardValue = await Clipboard.getStringAsync();
    const normalizedUrl = normalizeWebUrl(clipboardValue);

    if (!normalizedUrl) {
      Presets.System.notificationWarning();
      setError(t("Copy a valid web link first."));
      Burnt.toast({ preset: "error", title: t("No valid link found") });
      return;
    }

    Presets.System.selection();
    setLink(normalizedUrl);
    setError(null);
  };

  const continueToSearch = async (value = link) => {
    if (resolveControllerRef.current) return;

    const normalizedUrl = normalizeWebUrl(value);

    if (!normalizedUrl) {
      Presets.System.notificationWarning();
      setError(
        t("Enter a valid TikTok, Instagram, YouTube, store, or web link."),
      );
      return;
    }

    let shouldConsumeRecognition = false;
    if (!isPro) {
      const cachedResolution = await getCachedLinkResolution(
        normalizedUrl,
      ).catch((cacheError) => {
        console.warn("Unable to check the link resolution cache", cacheError);
        return null;
      });

      if (!cachedResolution) {
        const usage = await getMonthlyFeatureUsage(
          AI_LINK_RECOGNITION_FEATURE,
        ).catch((usageError) => {
          console.warn("Unable to read link recognition usage", usageError);
          return null;
        });

        if (
          usage &&
          usage.count >= FREE_AI_LINK_RECOGNITIONS_PER_MONTH
        ) {
          if (
            isRevenueCatLoading ||
            !isSupported ||
            !isConfigured
          ) {
            const message = t(
              "You used your 3 free link detections this month. Joylogue Pro is unavailable right now.",
            );
            setError(message);
            Burnt.toast({ preset: "error", title: message });
            return;
          }

          try {
            const result = await presentPaywallIfNeeded();
            const unlocked =
              result === PAYWALL_RESULT.PURCHASED ||
              result === PAYWALL_RESULT.RESTORED ||
              result === PAYWALL_RESULT.NOT_PRESENTED;

            if (!unlocked) {
              setError(
                t(
                  "You used your 3 free link detections this month. Upgrade to Joylogue Pro for unlimited detection.",
                ),
              );
              return;
            }
          } catch (paywallError) {
            console.error("Unable to open Joylogue Pro", paywallError);
            const message = t("Unable to open Joylogue Pro");
            setError(message);
            Burnt.toast({ preset: "error", title: message });
            return;
          }
        } else {
          shouldConsumeRecognition = true;
        }
      }
    }

    Keyboard.dismiss();
    setError(null);
    setResolution(null);
    setSelectedGame(null);
    setIsResolving(true);
    Presets.sweep();
    const controller = new AbortController();
    resolveControllerRef.current = controller;

    try {
      const resolution = await resolveGameLink(normalizedUrl, {
        signal: controller.signal,
      });

      if (shouldConsumeRecognition) {
        await incrementMonthlyFeatureUsage(
          AI_LINK_RECOGNITION_FEATURE,
        ).catch((usageError) => {
          console.warn("Unable to record link recognition usage", usageError);
        });
      }

      const hasResult =
        (resolution.status === "matched" && resolution.game) ||
        (resolution.status === "needs-confirmation" &&
          resolution.candidates.length > 0);

      if (hasResult) {
        const backlog = await getBacklog().catch((backlogError) => {
          console.warn("Unable to check the backlog", backlogError);
          return [];
        });

        setSavedGameIds(new Set(backlog.map((item) => item.igdbId)));
        posthog.capture("game_link_resolved", {
          resolution_status: resolution.status,
          candidate_count: resolution.candidates.length,
        });
        setResolution(resolution);
        setSelectedGame(null);
        setIsResolving(false);
        Settings.stopHaptics();
        if (resolution.status === "matched") {
          Presets.System.notificationSuccess();
        } else {
          Presets.nudge();
        }
        return;
      }

      Settings.stopHaptics();
      Presets.nudge();
      Burnt.toast({
        title: resolution.query
          ? t("Choose the matching game")
          : t("Search for the game by title"),
      });
      router.dismissTo({
        pathname: "/(tabs)/(search)",
        params: {
          add: "1",
          ...(resolution.query ? { query: resolution.query } : {}),
          sourceUrl: resolution.sourceUrl,
        },
      });
    } catch (requestError) {
      if (
        requestError instanceof LinkResolutionRequestError &&
        requestError.code === "ABORTED"
      ) {
        return;
      }

      const shouldFallbackToSearch =
        requestError instanceof LinkResolutionRequestError &&
        (requestError.code === "POLL_TIMEOUT" ||
          requestError.status === 429 ||
          requestError.status === 502 ||
          requestError.status === 504);
      if (shouldFallbackToSearch) {
        Settings.stopHaptics();
        Presets.nudge();
        Burnt.toast({
          title: t("Search by title while the link is unavailable"),
        });
        router.dismissTo({
          pathname: "/(tabs)/(search)",
          params: { add: "1", sourceUrl: normalizedUrl },
        });
        return;
      }

      Settings.stopHaptics();
      Presets.System.notificationError();
      console.error("Unable to analyze link", requestError);
      const message = t("Unable to analyze this link");
      setError(message);
      setIsResolving(false);
      Burnt.toast({ preset: "error", title: message });
    } finally {
      if (resolveControllerRef.current === controller) {
        resolveControllerRef.current = null;
      }
    }
  };

  const addResolvedGame = async (game: GameSearchResult) => {
    if (!resolution || savedGameIds.has(game.id) || savingGameId !== null) {
      return;
    }

    setSavingGameId(game.id);
    try {
      await saveGameToBacklog(game, { sourceUrl: resolution.sourceUrl });
      posthog.capture("game_added", {
        game_id: game.id,
        source: "link_resolution",
      });
      setSavedGameIds((current) => new Set(current).add(game.id));
      Presets.System.notificationSuccess();
      Burnt.toast({ title: t("Added to backlog") });
    } catch (saveError) {
      Presets.System.notificationError();
      Burnt.toast({
        preset: "error",
        title:
          saveError instanceof Error
            ? saveError.message
            : t("Unable to add game"),
      });
    } finally {
      setSavingGameId(null);
    }
  };

  const resetResolution = () => {
    setResolution(null);
    setSelectedGame(null);
    setLink("");
    setError(null);
  };

  const resolveIncomingShare = useEffectEvent((sharedUrl: string) => {
    resolveControllerRef.current?.abort();
    resolveControllerRef.current = null;
    Settings.stopHaptics();
    setLink(sharedUrl);
    setError(null);
    void continueToSearch(sharedUrl);
  });

  useEffect(() => {
    if (paste !== "1" || handledWidgetPasteRef.current) return;

    handledWidgetPasteRef.current = true;
    let active = true;

    void Clipboard.getStringAsync()
      .then((clipboardValue) => {
        if (!active) return;

        const sharedUrl = extractSharedWebUrl(clipboardValue);
        posthog.capture("widget_quick_save_opened", {
          clipboard_has_url: Boolean(sharedUrl),
          source: source ?? "widget",
        });

        if (!sharedUrl) {
          Presets.System.notificationWarning();
          setError(t("Copy a TikTok, YouTube, store, or web link first."));
          return;
        }

        setLink(sharedUrl);
        setError(null);
        if (resolveClipboard === "1") {
          resolveIncomingShare(sharedUrl);
        }
      })
      .catch((clipboardError) => {
        if (!active) return;
        Presets.System.notificationWarning();
        setError(t("Joylogue couldn't read the copied link."));
        if (__DEV__) {
          console.warn("Unable to read Quick Save clipboard content.", clipboardError);
        }
      });

    return () => {
      active = false;
    };
  }, [paste, posthog, resolveClipboard, source, t]);

  useEffect(() => {
    if (incomingShare !== "1") return;

    const sharedUrl = [
      ...sharedPayloads.map((payload) => payload.value),
      ...resolvedSharedPayloads.flatMap((payload) =>
        payload.contentUri ? [payload.contentUri] : [],
      ),
    ]
      .map(extractSharedWebUrl)
      .find((value): value is string => Boolean(value));

    if (sharedUrl) {
      if (handledIncomingShareRef.current === sharedUrl) return;

      handledIncomingShareRef.current = sharedUrl;
      clearSharedPayloads();
      incomingActionTimerRef.current = setTimeout(() => {
        incomingActionTimerRef.current = null;
        resolveIncomingShare(sharedUrl);
      }, 0);
      return;
    }

    if (isIncomingShareResolving || handledIncomingShareRef.current) return;

    handledIncomingShareRef.current = "invalid-share";
    clearSharedPayloads();
    incomingActionTimerRef.current = setTimeout(() => {
      incomingActionTimerRef.current = null;
      Presets.System.notificationWarning();
      setError(
        incomingShareError
          ? t("Unable to read the shared link.")
          : t("The shared item did not contain a web link."),
      );
    }, 0);
  }, [
    clearSharedPayloads,
    incomingShare,
    incomingShareError,
    isIncomingShareResolving,
    resolvedSharedPayloads,
    sharedPayloads,
    t,
  ]);

  if (resolution) {
    const showsConfirmedResult = Boolean(
      selectedGame || resolution.game || resolution.candidates.length === 1,
    );
    const resultHeaderTitle = selectedGame
      ? t("Confirm game")
      : resolution.status === "matched"
        ? t("Game found")
        : t("Possible matches");
    const resolutionContent = (
      <LinkResolutionResult
        onAdd={(game) => void addResolvedGame(game)}
        onChoose={(game) => {
          Presets.System.selection();
          setSelectedGame(game);
        }}
        onOpenDetails={() => Presets.System.selection()}
        onReset={resetResolution}
        resolution={resolution}
        reduceMotion={reduceMotion}
        savedGameIds={savedGameIds}
        savingGameId={savingGameId}
        selectedGame={selectedGame}
      />
    );

    return (
      <View style={[styles.resultScreen]}>
        <Stack.Screen
          options={{
            title: resultHeaderTitle,
            ...createHeaderLeftOptions(
              selectedGame
                ? () => [
                  {
                    type: "button",
                    label: t("Possible matches"),
                    icon: { type: "sfSymbol", name: "chevron.backward" },
                    tintColor: colors.primary,
                    accessibilityLabel: t("Back to possible matches"),
                    accessibilityHint: t(
                      "Returns to the list without clearing the shared link",
                    ),
                    onPress: () => {
                      Presets.System.selection();
                      setSelectedGame(null);
                    },
                  },
                ]
                : nativeBackItems,
            ),
          }}
        />
        <View style={styles.resultInteraction}>
          {showsConfirmedResult ? (
            <ScrollView
              contentContainerStyle={styles.resultContent}
              contentInsetAdjustmentBehavior="never"
              style={styles.screen}
            >
              {resolutionContent}
            </ScrollView>
          ) : (
            resolutionContent
          )}
        </View>
      </View>
    );
  }

  if (isResolving) {
    const hostname = normalizeWebUrl(link)
      ? new URL(normalizeWebUrl(link) as string).hostname.replace(/^www\./, "")
      : t("shared link");

    return (
      <Animated.View
        entering={FadeIn.duration(reduceMotion ? 0 : 180)}
        style={[styles.loadingScreen, { paddingTop: insets.top }]}
      >
        <Stack.Screen
          options={{
            title: t("Add a game"),
            ...createHeaderLeftOptions(nativeBackItems),
          }}
        />
        <View style={styles.loadingBody}>
          <AnimatedCardGlow
            cardHeight={216}
            cardWidth={154}
            cornerRadius={28}
            height={280}
            intensity={0.9}
            speed={0.9}
            width={Math.min(width - theme.spacing.md * 2, 360)}
          />
          <Animated.View
            entering={FadeInUp.delay(reduceMotion ? 0 : 90).duration(
              reduceMotion ? 0 : 240,
            )}
            style={styles.loadingCopy}
          >
            <SymbolView
              animationSpec={
                reduceMotion
                  ? undefined
                  : { effect: { type: "pulse" }, repeating: true }
              }
              name={{ android: "add_link", ios: "link.badge.plus" }}
              size={44}
              tintColor={colors.text}
            />
            <Text style={styles.loadingTitle}>{t("Preparing your link")}</Text>
            <Text numberOfLines={2} style={styles.loadingSource}>
              {t("Keeping {{source}} attached as the source", {
                source: hostname,
              })}
            </Text>
          </Animated.View>
        </View>
      </Animated.View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={[
        styles.screen,
        {
          paddingBottom: insets.bottom + theme.spacing.xl,
          paddingTop: insets.top,
        },
      ]}
    >
      <Stack.Screen
        options={{
          title: t("Add a game"),
          ...createHeaderLeftOptions(nativeBackItems),
        }}
      />

      <View style={styles.heading}></View>

      <View style={styles.fieldGroup}>
        <View style={[styles.inputShell, error && styles.inputShellError]}>
          <SymbolView
            name={{ android: "link", ios: "link" }}
            size={19}
            tintColor={colors.textMuted}
          />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            onChangeText={(value) => {
              setLink(value);
              setError(null);
            }}
            onSubmitEditing={() => continueToSearch()}
            placeholder={t("Paste a link")}
            placeholderTextColor={colors.textMuted}
            returnKeyType="go"
            style={styles.input}
            value={link}
          />
          <PressableOpacity
            accessibilityLabel={t("Paste link from clipboard")}
            accessibilityRole="button"
            hitSlop={8}
            onPress={pasteLink}
            style={styles.pasteButton}
          >
            <Text style={styles.pasteButtonText}>{t("Paste")}</Text>
          </PressableOpacity>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <PressableScale
        accessibilityLabel={t("Find game from link")}
        accessibilityRole="button"
        onPress={() => continueToSearch()}
        style={styles.primaryButton}
      >
        <Text style={styles.primaryButtonText}>{t("Find this game")}</Text>
        <SymbolView
          name={{ android: "arrow_forward", ios: "arrow.right" }}
          size={24}
          tintColor={colors.background}
        />
      </PressableScale>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
  },
  resultContent: {
    flexGrow: 1,
  },
  resultScreen: {
    flex: 1,
  },
  resultInteraction: {
    flex: 1,
  },
  heading: {
    gap: theme.spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.8,
    lineHeight: 32,
  },
  description: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 23,
  },
  fieldGroup: {
    gap: theme.spacing.sm,
  },
  inputShell: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderCurve: "continuous",
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
  },
  inputShellError: {
    borderColor: colors.danger,
  },
  input: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    paddingVertical: theme.spacing.md,
  },
  pasteButton: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  pasteButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: theme.radius.pill,
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "center",
    marginTop: "auto",
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: 17,
    fontWeight: "800",
  },
  footnote: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.75,
  },
  loadingScreen: {
    flex: 1,
  },
  loadingBody: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  loadingCopy: {
    alignItems: "center",
    gap: theme.spacing.sm,
    marginTop: -theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  loadingTitle: {
    color: colors.text,
    fontSize: theme.size.xl,
    fontWeight: "700",
    textAlign: "center",
  },
  loadingSource: {
    color: colors.textMuted,
    fontSize: theme.size.md,
    textAlign: "center",
  },
});
