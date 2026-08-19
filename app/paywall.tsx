import * as Burnt from "burnt";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { PressableScale } from "pressto";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import RevenueCatUI from "react-native-purchases-ui";

import { colors, theme } from "@/constants/theme";
import { useRevenueCat } from "@/hooks/use-revenuecat";
import { useOnboarding } from "@/providers/onboarding-provider";

function getErrorMessage(error: unknown, fallback: string) {
  console.error("RevenueCat operation failed", error);
  return fallback;
}

export default function PaywallScreen() {
  const { t } = useTranslation();
  const {
    currentOffering,
    isConfigured,
    isLoading,
    isPro,
    isSupported,
    refresh,
  } = useRevenueCat();
  const didFinish = useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { completeOnboarding } = useOnboarding();

  const finishPaywall = useCallback(async () => {
    if (didFinish.current) return;

    didFinish.current = true;
    try {
      await completeOnboarding();
      router.replace("/(tabs)/(home)");
    } catch (completionError) {
      didFinish.current = false;
      Burnt.toast({
        message: getErrorMessage(
          completionError,
          t("Please try again in a moment."),
        ),
        preset: "error",
        title: t("Unable to finish onboarding"),
      });
    }
  }, [completeOnboarding, t]);

  async function refreshAndFinish(message: string) {
    Burnt.toast({ title: message });

    try {
      await refresh();
    } finally {
      await finishPaywall();
    }
  }

  async function retryOffering() {
    if (isRefreshing) return;

    try {
      setIsRefreshing(true);
      await refresh();
    } catch (refreshError) {
      Burnt.toast({
        message: getErrorMessage(
          refreshError,
          t("Please try again in a moment."),
        ),
        preset: "error",
        title: t("Unable to load Joylogue Pro"),
      });
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    if (!isLoading && isPro) {
      void finishPaywall();
    }
  }, [finishPaywall, isLoading, isPro]);

  if (isLoading || isPro) {
    return (
      <View style={styles.centeredScreen}>
        <StatusBar style="light" />
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>{t("Preparing Joylogue Pro…")}</Text>
      </View>
    );
  }

  if (!isSupported || !isConfigured || !currentOffering) {
    const fallbackMessage = !isSupported
      ? t("Subscriptions are available in the iOS and Android app.")
      : t(
          "No current RevenueCat offering is available. You can continue and try again later.",
        );

    return (
      <View style={styles.fallbackScreen}>
        <StatusBar style="light" />

        <View style={styles.fallbackCopy}>
          <Text style={styles.eyebrow}>{t("JOYLOGUE PRO")}</Text>
          <Text style={styles.title}>{t("Pro is not available right now.")}</Text>
          <Text style={styles.description}>{fallbackMessage}</Text>
        </View>

        <View style={styles.actions}>
          {isConfigured ? (
            <PressableScale
              accessibilityLabel={t("Try loading Joylogue Pro again")}
              accessibilityRole="button"
              disabled={isRefreshing}
              onPress={() => void retryOffering()}
              style={styles.primaryButton}
            >
              {isRefreshing ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.primaryButtonText}>{t("Try again")}</Text>
              )}
            </PressableScale>
          ) : null}

          <PressableScale
            accessibilityLabel={t("Continue without Joylogue Pro")}
            accessibilityRole="button"
            onPress={() => void finishPaywall()}
            style={isConfigured ? styles.secondaryButton : styles.primaryButton}
          >
            <Text
              style={
                isConfigured
                  ? styles.secondaryButtonText
                  : styles.primaryButtonText
              }
            >
              {t("Continue without Pro")}
            </Text>
          </PressableScale>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <RevenueCatUI.Paywall
        onDismiss={() => void finishPaywall()}
        onPurchaseCompleted={() =>
          void refreshAndFinish(t("Joylogue Pro unlocked"))
        }
        onPurchaseError={({ error: purchaseError }) => {
          Burnt.toast({
            message: getErrorMessage(
              purchaseError,
              t("Please try again in a moment."),
            ),
            preset: "error",
            title: t("Purchase failed"),
          });
        }}
        onRestoreCompleted={() =>
          void refreshAndFinish(t("Purchases restored"))
        }
        onRestoreError={({ error: restoreError }) => {
          Burnt.toast({
            message: getErrorMessage(
              restoreError,
              t("Please try again in a moment."),
            ),
            preset: "error",
            title: t("Restore failed"),
          });
        }}
        options={{
          displayCloseButton: true,
          offering: currentOffering,
        }}
        style={styles.paywall}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: theme.spacing.sm,
  },
  centeredScreen: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
    gap: theme.spacing.md,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.lg,
  },
  description: {
    color: colors.textMuted,
    fontSize: theme.size.lg,
    fontWeight: "600",
    lineHeight: 24,
    textAlign: "center",
  },
  eyebrow: {
    color: colors.success,
    fontSize: theme.size.sm,
    fontWeight: "900",
    letterSpacing: 2.2,
    textAlign: "center",
  },
  fallbackCopy: {
    alignItems: "center",
    gap: theme.spacing.md,
    maxWidth: 420,
  },
  fallbackScreen: {
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "space-between",
    paddingBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 160,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: theme.size.md,
    fontWeight: "600",
  },
  paywall: {
    flex: 1,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderCurve: "continuous",
    borderRadius: theme.radius.pill,
    justifyContent: "center",
    minHeight: 56,
    paddingHorizontal: theme.spacing.lg,
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: theme.size.lg,
    fontWeight: "800",
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  secondaryButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  secondaryButtonText: {
    color: colors.textMuted,
    fontSize: theme.size.md,
    fontWeight: "700",
  },
  title: {
    color: colors.text,
    fontSize: theme.size["3xl"],
    fontWeight: "800",
    textAlign: "center",
  },
});
