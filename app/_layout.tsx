import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { DefaultTheme, Stack, ThemeProvider, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { Fragment, useEffect } from "react";
import { PostHogProvider, usePostHog } from "posthog-react-native";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import "react-native-reanimated";

import { BadgeUnlockPresenter } from "@/components/badge-unlock-presenter";
import { WidgetSyncManager } from "@/components/widget-sync-manager";
import { colors, navigationThemeColors } from "@/constants/theme";
import { DatabaseProvider } from "@/db/provider";
import { createHeaderLeftOptions } from "@/lib/header-item-options";
import { preloadAppHaptics } from "@/lib/haptics";
import { posthog } from "@/lib/posthog";
import { createNativeBackItems } from "@/lib/native-header-items";
import { ensureCloudUser } from "@/services/sharing";
import { queryClient } from "@/lib/query-client";
import {
  OnboardingProvider,
  useOnboarding,
} from "@/providers/onboarding-provider";
import { OneSignalProvider } from "@/providers/one-signal-provider";
import { LocalizationProvider } from "@/providers/localization-provider";
import { RevenueCatProvider } from "@/providers/revenuecat-provider";

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary
} from "expo-router";

export const unstable_settings = {
  initialRouteName: "(onboarding)",
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  useEffect(() => {
    preloadAppHaptics();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LocalizationProvider>
        <KeyboardProvider>
          <QueryClientProvider client={queryClient}>
            <DatabaseProvider>
              <OnboardingProvider>
                <OneSignalProvider>
                  <RevenueCatProvider>
                    <WidgetSyncManager />
                    {posthog ? (
                      <PostHogProvider client={posthog}>
                        <IdentifiedRootStack />
                      </PostHogProvider>
                    ) : (
                      <RootStack />
                    )}
                  </RevenueCatProvider>
                </OneSignalProvider>
              </OnboardingProvider>
            </DatabaseProvider>
          </QueryClientProvider>
        </KeyboardProvider>
      </LocalizationProvider>
    </GestureHandlerRootView>
  );
}

function IdentifiedRootStack() {
  const posthogClient = usePostHog();

  useEffect(() => {
    void ensureCloudUser()
      .then((user) => posthogClient.identify(user.id))
      .catch((error) => {
        if (__DEV__) {
          console.warn("Unable to identify the PostHog user.", error);
        }
      });
  }, [posthogClient]);

  return <RootStack />;
}

function RootStack() {
  const router = useRouter();
  const { t } = useTranslation();
  const { state } = useOnboarding();
  const hasCompletedOnboarding = Boolean(state.onboardingCompletedAt);
  const nativeBackItems = createNativeBackItems({
    onPress: () => router.back(),
  });

  return (
    <Fragment>
      <BadgeUnlockPresenter />
      <ThemeProvider value={{ ...DefaultTheme, colors: navigationThemeColors }}>
        <Stack>
          <Stack.Protected guard={!hasCompletedOnboarding}>
            <Stack.Screen
              name="(onboarding)"
              options={{ headerShown: false }}
            />
          </Stack.Protected>
          <Stack.Protected guard={hasCompletedOnboarding}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack.Protected>
          <Stack.Screen name="(settings)" options={{ headerShown: false }} />
          <Stack.Screen
            name="paywall"
            options={{
              animation: "fade",
              gestureEnabled: false,
              headerShown: false,
              presentation: "card",
            }}
          />
          <Stack.Screen
            name="(badges)"
            options={{
              headerShown: false,
              presentation: "modal",
              headerTransparent: isLiquidGlassAvailable(),
              headerStyle: {
                backgroundColor: isLiquidGlassAvailable()
                  ? "transparent"
                  : colors.background,
              },
              headerTitle: t("Badges"),
            }}
          />
          <Stack.Screen
            name="badge-reveal"
            options={{
              gestureEnabled: false,
              headerShown: true,
              presentation: "modal",
              headerTransparent: isLiquidGlassAvailable(),
              headerStyle: {
                backgroundColor: isLiquidGlassAvailable()
                  ? "transparent"
                  : colors.background,
              },
              headerTitle: t("Badge Unlocked"),
              ...createHeaderLeftOptions(nativeBackItems),
            }}
          />
          <Stack.Screen
            name="game/[id]"
            options={{
              headerBackButtonDisplayMode: "minimal",
              headerTransparent: isLiquidGlassAvailable(),
              headerStyle: {
                backgroundColor: isLiquidGlassAvailable()
                  ? "transparent"
                  : colors.background,
              },
              ...createHeaderLeftOptions(nativeBackItems),
            }}
          />
          <Stack.Screen
            name="genre/[id]"
            options={{
              headerBackButtonDisplayMode: "minimal",
              headerLargeTitle: true,
              headerTransparent: isLiquidGlassAvailable(),
              headerStyle: {
                backgroundColor: isLiquidGlassAvailable()
                  ? "transparent"
                  : colors.background,
              },
              title: t("Genre"),
              ...createHeaderLeftOptions(nativeBackItems),
            }}
          />
          <Stack.Screen
            name="platforms"
            options={{
              headerBackButtonDisplayMode: "minimal",
              headerLargeTitle: true,
              headerTransparent: isLiquidGlassAvailable(),
              headerStyle: {
                backgroundColor: isLiquidGlassAvailable()
                  ? "transparent"
                  : colors.background,
              },
              title: t("Platforms"),
              ...createHeaderLeftOptions(nativeBackItems),
            }}
          />
          <Stack.Screen
            name="platform/[id]"
            options={{
              headerBackButtonDisplayMode: "minimal",
              headerLargeTitle: true,
              headerTransparent: isLiquidGlassAvailable(),
              headerStyle: {
                backgroundColor: isLiquidGlassAvailable()
                  ? "transparent"
                  : colors.background,
              },
              title: t("Platform"),
              ...createHeaderLeftOptions(nativeBackItems),
            }}
          />
          <Stack.Screen name="friend/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="feed" options={{ headerShown: false }} />
          <Stack.Screen
            name="glow-lab"
            options={{
              headerBackButtonDisplayMode: "minimal",
              title: t("Glow Lab"),
              ...createHeaderLeftOptions(nativeBackItems),
            }}
          />
          <Stack.Screen
            name="rating"
            options={{
              contentStyle: { backgroundColor: "transparent" },
              headerTransparent: true,
              presentation:
                Platform.OS === "android" ? "modal" : "formSheet",
              ...(Platform.OS === "android"
                ? {}
                : {
                    sheetAllowedDetents: "fitToContents" as const,
                    sheetGrabberVisible: true,
                  }),
              title: "",
              ...createHeaderLeftOptions(nativeBackItems),
            }}
          />
          <Stack.Screen
            name="progress"
            options={{
              contentStyle: { backgroundColor: "transparent" },
              headerTransparent: true,
              presentation:
                Platform.OS === "android" ? "modal" : "formSheet",
              ...(Platform.OS === "android"
                ? {}
                : {
                    sheetAllowedDetents: "fitToContents" as const,
                    sheetGrabberVisible: true,
                  }),
              title: "",
              ...createHeaderLeftOptions(nativeBackItems),
            }}
          />
          <Stack.Screen
            name="share"
            options={{
              contentStyle: { backgroundColor: "transparent" },
              headerTransparent: true,
              presentation:
                Platform.OS === "android" ? "modal" : "formSheet",
              ...(Platform.OS === "android"
                ? {}
                : {
                    sheetAllowedDetents: "fitToContents" as const,
                    sheetGrabberVisible: true,
                  }),
              title: "",
              ...createHeaderLeftOptions(nativeBackItems),
            }}
          />
          <Stack.Screen
            name="invite/[token]"
            options={{
              headerBackButtonDisplayMode: "minimal",
              headerTransparent: isLiquidGlassAvailable(),
              headerStyle: {
                backgroundColor: isLiquidGlassAvailable()
                  ? "transparent"
                  : colors.background,
              },
              title: t("Invitation"),
            }}
          />
          <Stack.Screen
            name="add"
            options={{
              contentStyle: {
                backgroundColor: isLiquidGlassAvailable()
                  ? "transparent"
                  : colors.background,
              },
              headerTransparent: isLiquidGlassAvailable(),
              presentation:
                Platform.OS === "android" ? "modal" : "formSheet",
              ...(Platform.OS === "android"
                ? {}
                : {
                    sheetAllowedDetents: "fitToContents" as const,
                    sheetGrabberVisible: true,
                  }),
              title: "",
            }}
          />
        </Stack>
      </ThemeProvider>
    </Fragment>
  );
}
