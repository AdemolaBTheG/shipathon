import * as Burnt from "burnt";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { PressableScale } from "pressto";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Presets } from "react-native-pulsar";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  LinearTransition,
  useReducedMotion,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { OnboardingProgress } from "@/components/onboarding-progress";
import { colors, theme } from "@/constants/theme";
import { useOnboarding } from "@/providers/onboarding-provider";
import { useOneSignal } from "@/providers/one-signal-provider";

const JOYLOGUE_ICON = require("../assets/images/game.icon/Assets/videogame_asset-2.png");

const ACTIVITY_PREVIEWS = [
  {
    body: "Compare your progress",
    time: "now",
    title: "Ademola completed Hades",
  },
  {
    body: "Rated it 4.5 stars",
    time: "2m",
    title: "Lewis rated Baldur's Gate 3",
  },
  {
    body: "See what made their lists",
    time: "18m",
    title: "3 friends added Hollow Knight",
  },
  {
    body: "One game from your backlog",
    time: "tonight",
    title: "Tonight's pick is ready",
  },
] as const;

type ActivityPreview = (typeof ACTIVITY_PREVIEWS)[number];

function NotificationPreview({
  animateLayout,
  item,
  reduceMotion,
}: {
  animateLayout: boolean;
  item: ActivityPreview;
  reduceMotion: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Animated.View
      entering={FadeInDown.duration(reduceMotion ? 0 : 320).easing(
        Easing.bezier(0.23, 1, 0.32, 1),
      )}
      layout={
        animateLayout
          ? LinearTransition.duration(reduceMotion ? 0 : 420).easing(
              Easing.bezier(0.32, 0.72, 0, 1),
            )
          : undefined
      }
      style={styles.notification}
    >
      <LinearGradient
        colors={["#34C759", "#00C8B3"]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.appIcon}
      >
        <Image
          accessibilityIgnoresInvertColors
          contentFit="contain"
          source={JOYLOGUE_ICON}
          style={styles.appIconArtwork}
        />
      </LinearGradient>

      <View style={styles.notificationCopy}>
        <Text numberOfLines={1} style={styles.notificationTitle}>
          {t(item.title)}
        </Text>
        <Text numberOfLines={1} style={styles.notificationBody}>
          {t(item.body)}
        </Text>
      </View>

      <Text style={styles.notificationTime}>{t(item.time)}</Text>
    </Animated.View>
  );
}

export function OnboardingNotificationsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [isRequesting, setIsRequesting] = useState(false);
  const [animatedNotificationCount, setAnimatedNotificationCount] = useState(0);
  const { saveNotificationPreference } = useOnboarding();
  const oneSignal = useOneSignal();
  const visibleNotificationCount = reduceMotion
    ? ACTIVITY_PREVIEWS.length
    : animatedNotificationCount;

  useEffect(() => {
    if (reduceMotion) return;

    const timers = ACTIVITY_PREVIEWS.map((_, index) =>
      setTimeout(
        () => setAnimatedNotificationCount(index + 1),
        420 + index * 640,
      ),
    );

    return () => timers.forEach(clearTimeout);
  }, [reduceMotion]);

  async function finishOnboarding(
    preference: "denied" | "enabled" | "skipped",
  ) {
    await saveNotificationPreference(preference);
    if (preference === "enabled") {
      Presets.System.notificationSuccess();
    } else {
      Presets.snap();
    }
    router.replace("/paywall");
  }

  async function enableNotifications() {
    if (isRequesting) return;

    setIsRequesting(true);

    try {
      const granted = await oneSignal.requestPermission();

      if (!granted) {
        Burnt.toast({
          preset: "none",
          title: t("Notifications are off"),
          message: t("You can enable them later in Settings."),
        });
      }
      await finishOnboarding(granted ? "enabled" : "denied");
    } catch (error) {
      console.error("Unable to enable onboarding notifications", error);
      Presets.System.notificationError();
      Burnt.toast({
        preset: "error",
        title: t("Unable to enable notifications"),
        message: t("You can try again later in Settings."),
      });
      await finishOnboarding("denied");
    }
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <ScrollView
        bounces={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: insets.bottom + 150,
            paddingTop: insets.top + theme.spacing.lg,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <OnboardingProgress step={4} style={styles.progress} total={4} />

        <Animated.View
          entering={FadeIn.duration(reduceMotion ? 0 : 300)}
          style={styles.intro}
        >
          <Text style={styles.title}>
            {t("The good stuff, never the noise.")}
          </Text>
          <Text style={styles.subtitle}>
            {t(
              "Get meaningful updates from friends, your backlog, and games you are waiting for.",
            )}
          </Text>
        </Animated.View>

        <Animated.View
          accessibilityLabel={t("Examples of Joylogue notifications")}
          style={styles.notifications}
        >
          {ACTIVITY_PREVIEWS.slice(0, visibleNotificationCount).map(
            (item, index) => (
              <NotificationPreview
                animateLayout={index < visibleNotificationCount - 1}
                item={item}
                key={item.title}
                reduceMotion={reduceMotion}
              />
            ),
          )}
        </Animated.View>
      </ScrollView>

      <Animated.View
        entering={FadeInUp.delay(reduceMotion ? 0 : 180)
          .duration(reduceMotion ? 0 : 360)
          .easing(Easing.bezier(0.23, 1, 0.32, 1))}
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, theme.spacing.md) },
        ]}
      >
        <PressableScale
          accessibilityHint={t(
            "Opens the system notification permission prompt",
          )}
          accessibilityLabel={t("Turn on notifications")}
          accessibilityRole="button"
          disabled={isRequesting}
          onPress={() => void enableNotifications()}
          style={styles.primaryButton}
        >
          {isRequesting ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.primaryButtonText}>
              {t("Turn on notifications")}
            </Text>
          )}
        </PressableScale>

        <PressableScale
          accessibilityLabel={t("Not now")}
          accessibilityRole="button"
          disabled={isRequesting}
          onPress={() => void finishOnboarding("skipped")}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>{t("Not now")}</Text>
        </PressableScale>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  appIcon: {
    alignItems: "center",
    borderCurve: "continuous",
    borderRadius: 10,
    height: 40,
    justifyContent: "center",
    overflow: "hidden",
    width: 40,
  },
  appIconArtwork: {
    height: 32,
    width: 32,
  },
  content: {
    alignItems: "center",
    flexGrow: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  eyebrow: {
    color: colors.success,
    fontSize: theme.size.sm,
    fontWeight: "900",
    letterSpacing: 2.2,
    textAlign: "center",
  },
  footer: {
    backgroundColor: colors.background,
    bottom: 0,
    gap: theme.spacing.xs,
    left: 0,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    position: "absolute",
    right: 0,
  },
  intro: {
    alignItems: "center",
    gap: theme.spacing.sm,
    maxWidth: 390,
    paddingTop: 54,
  },
  notification: {
    alignItems: "center",
    backgroundColor: "rgba(30, 30, 30, 0.92)",
    borderColor: colors.border,
    borderCurve: "continuous",
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    boxShadow: "0 12px 34px rgba(0, 0, 0, 0.32)",
    flexDirection: "row",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
  },
  notificationBody: {
    color: colors.textMuted,
    fontSize: theme.size.sm,
  },
  notificationCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  notifications: {
    alignSelf: "stretch",
    gap: theme.spacing.sm,
    height: 328,
    justifyContent: "center",
    marginTop: theme.spacing.lg,
    maxWidth: 400,
  },
  notificationTime: {
    alignSelf: "flex-start",
    color: "rgba(255, 255, 255, 0.42)",
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    paddingTop: 2,
  },
  notificationTitle: {
    color: colors.text,
    fontSize: theme.size.md,
    fontWeight: "700",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderCurve: "continuous",
    borderRadius: theme.radius.pill,
    justifyContent: "center",
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: theme.size.lg,
    fontWeight: "700",
  },
  progress: {
    width: "58%",
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
    overflow: "hidden",
  },
  secondaryButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.md,
  },
  secondaryButtonText: {
    color: colors.textMuted,
    fontSize: theme.size.md,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: theme.size.lg,
    fontWeight: "600",
    paddingHorizontal: theme.spacing.sm,
    textAlign: "center",
  },
  title: {
    color: colors.text,
    fontSize: theme.size["3xl"],
    fontWeight: "800",
    textAlign: "center",
  },
});
