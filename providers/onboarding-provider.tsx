import * as SplashScreen from "expo-splash-screen";
import type { Href } from "expo-router";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import {
  getOnboardingState,
  type OnboardingStatePatch,
  type PersistedOnboardingState,
  updateOnboardingState,
} from "@/db/onboarding";
import type {
  NotificationPreference,
  OnboardingStep,
} from "@/db/schema";
import { trackLifecycleEvent } from "@/services/lifecycle-events";

type SelectedGame = {
  coverUrl: string | null;
  id: number;
  name: string;
};

type OnboardingContextValue = {
  completeOnboarding: () => Promise<void>;
  saveNotificationPreference: (
    preference: NotificationPreference,
  ) => Promise<void>;
  savePlatforms: (platformIds: string[]) => Promise<void>;
  saveSelectedGame: (game: SelectedGame) => Promise<void>;
  setStep: (step: OnboardingStep) => Promise<void>;
  state: PersistedOnboardingState;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function getOnboardingResumeHref(
  state: PersistedOnboardingState,
): Href {
  switch (state.currentStep) {
    case "platforms":
      return "/(onboarding)/platforms";
    case "games":
      return "/(onboarding)/games";
    case "rating":
      return state.selectedGameId
        ? {
            pathname: "/(onboarding)/rating/[id]",
            params: {
              coverUrl: state.selectedGameCoverUrl ?? "",
              id: String(state.selectedGameId),
              name: state.selectedGameName ?? "",
            },
          }
        : "/(onboarding)/games";
    case "notifications":
      return "/(onboarding)/notifications";
    case "paywall":
      return "/paywall";
    case "completed":
      return "/";
    case "welcome":
    default:
      return "/(onboarding)";
  }
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [hydrationError, setHydrationError] = useState<string | null>(null);
  const [state, setState] = useState<PersistedOnboardingState | null>(null);

  useEffect(() => {
    let active = true;

    void getOnboardingState()
      .then((persistedState) => {
        if (active) setState(persistedState);
      })
      .catch((error) => {
        if (!active) return;
        console.error("Unable to load onboarding state", error);
        setHydrationError("onboarding-state-unavailable");
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!state && !hydrationError) return;

    const frame = requestAnimationFrame(() => {
      void SplashScreen.hideAsync();
    });
    return () => cancelAnimationFrame(frame);
  }, [hydrationError, state]);

  const persist = useCallback((patch: OnboardingStatePatch) => {
    return updateOnboardingState(patch).then((next) => {
      setState(next);
    });
  }, []);

  const completeOnboarding = useCallback(async () => {
    await persist({
        currentStep: "completed",
        onboardingCompletedAt: new Date(),
    });
    trackLifecycleEvent("onboarding_completed", {}, { journey: true });
  }, [persist]);
  const saveNotificationPreference = useCallback(
    async (notificationPreference: NotificationPreference) => {
      await persist({ currentStep: "paywall", notificationPreference });
      trackLifecycleEvent(
        notificationPreference === "enabled"
          ? "onboarding_notifications_enabled"
          : "onboarding_notifications_declined",
        { preference: notificationPreference },
        { journey: notificationPreference === "enabled" },
      );
    },
    [persist],
  );
  const savePlatforms = useCallback(
    async (selectedPlatformIds: string[]) => {
      await persist({ selectedPlatformIds });
      trackLifecycleEvent("onboarding_platforms_selected", {
        platform_count: selectedPlatformIds.length,
        platform_ids: selectedPlatformIds.join(","),
      });
    },
    [persist],
  );
  const saveSelectedGame = useCallback(
    async (game: SelectedGame) => {
      const changed = state?.selectedGameId !== game.id;
      await persist({
        currentStep: "rating",
        selectedGameCoverUrl: game.coverUrl,
        selectedGameId: game.id,
        selectedGameName: game.name,
      });
      if (changed) {
        trackLifecycleEvent("onboarding_game_selected", {
          game_id: game.id,
          game_name: game.name,
        });
      }
    },
    [persist, state?.selectedGameId],
  );
  const setStep = useCallback(
    async (currentStep: OnboardingStep) => {
      const isStarting =
        state?.currentStep === "welcome" && currentStep === "platforms";
      await persist({ currentStep });
      if (isStarting) trackLifecycleEvent("onboarding_started");
    },
    [persist, state?.currentStep],
  );

  const value = useMemo<OnboardingContextValue | null>(() => {
    if (!state) return null;

    return {
      completeOnboarding,
      saveNotificationPreference,
      savePlatforms,
      saveSelectedGame,
      setStep,
      state,
    };
  }, [
    completeOnboarding,
    saveNotificationPreference,
    savePlatforms,
    saveSelectedGame,
    setStep,
    state,
  ]);

  if (hydrationError) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <Text selectable>{t("Unable to load onboarding state.")}</Text>
      </View>
    );
  }

  if (!value) return null;

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used inside OnboardingProvider");
  }
  return context;
}
