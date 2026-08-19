import Constants from "expo-constants";
import { useRouter } from "expo-router";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { TurboModuleRegistry } from "react-native";
import type {
  NotificationClickEvent,
  PushSubscriptionChangedState,
} from "react-native-onesignal";

import { setLifecycleJourneyEventSender } from "@/services/lifecycle-events";
import { ensureCloudUser } from "@/services/sharing";

type OneSignalContextValue = {
  error: string | null;
  isAvailable: boolean;
  isInitialized: boolean;
  isOptedIn: boolean;
  requestPermission: () => Promise<boolean>;
  subscriptionId: string | null;
};

const OneSignalContext = createContext<OneSignalContextValue | null>(null);

let initializationPromise: Promise<void> | null = null;
let oneSignalSdk: typeof import("react-native-onesignal") | null = null;

function hasOneSignalNativeModule() {
  if (process.env.EXPO_OS === "web") return false;

  try {
    return Boolean(TurboModuleRegistry?.get?.("OneSignal"));
  } catch {
    return false;
  }
}

function getOneSignalSdk() {
  if (!oneSignalSdk) {
    // Keep the native SDK out of runtimes whose binary does not include OneSignal.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    oneSignalSdk = require("react-native-onesignal") as typeof import(
      "react-native-onesignal"
    );
  }

  return oneSignalSdk;
}

function getOneSignalAppId() {
  const value = Constants.expoConfig?.extra?.oneSignalAppId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function initializeOneSignal(appId: string) {
  if (!initializationPromise) {
    const operation = (async () => {
      const { LogLevel, OneSignal } = getOneSignalSdk();
      OneSignal.Debug.setLogLevel(__DEV__ ? LogLevel.Warn : LogLevel.Error);
      OneSignal.initialize(appId);
      const cloudUser = await ensureCloudUser();
      OneSignal.login(cloudUser.id);
      setLifecycleJourneyEventSender((name, properties) => {
        OneSignal.User.trackEvent(name, properties);
      });
    })();
    initializationPromise = operation.catch((error) => {
      initializationPromise = null;
      throw error;
    });
  }

  return initializationPromise;
}

function isNotificationData(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getNotificationDestination(event: NotificationClickEvent) {
  const data = event.notification.additionalData;
  if (!isNotificationData(data)) return null;

  if (data.notificationType === "friend_request") {
    return { pathname: "/(tabs)/(shared)" } as const;
  }

  if (
    data.notificationType === "friend_request_accepted" &&
    typeof data.actorId === "string" &&
    data.actorId
  ) {
    return {
      params: { id: data.actorId },
      pathname: "/friend/[id]",
    } as const;
  }

  if (data.notificationType === "onboarding_reminder") {
    return { pathname: "/(onboarding)" } as const;
  }

  const gameId =
    typeof data.gameId === "number" || typeof data.gameId === "string"
      ? String(data.gameId)
      : null;
  if (data.notificationType === "rating_reminder" && gameId) {
    return {
      params: { id: gameId },
      pathname: "/rating",
    } as const;
  }

  if (data.notificationType === "progress_reminder" && gameId) {
    return {
      params: { id: gameId },
      pathname: "/game/[id]",
    } as const;
  }

  return null;
}

export function OneSignalProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const appId = getOneSignalAppId();
  const isAvailable = Boolean(appId) && hasOneSignalNativeModule();
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isOptedIn, setIsOptedIn] = useState(false);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!appId || !isAvailable) return;

    void initializeOneSignal(appId)
      .then(() => {
        if (active) setIsInitialized(true);
      })
      .catch((setupError) => {
        if (!active) return;
        setError(
          setupError instanceof Error
            ? setupError.message
            : "Unable to initialize OneSignal",
        );
      });

    return () => {
      active = false;
    };
  }, [appId, isAvailable]);

  useEffect(() => {
    if (!appId || !isAvailable) return;

    const { OneSignal } = getOneSignalSdk();
    const handleClick = (event: NotificationClickEvent) => {
      const destination = getNotificationDestination(event);
      if (destination) router.push(destination);
    };
    OneSignal.Notifications.addEventListener("click", handleClick);

    return () => {
      OneSignal.Notifications.removeEventListener("click", handleClick);
    };
  }, [appId, isAvailable, router]);

  useEffect(() => {
    if (!isInitialized) return;

    const { OneSignal } = getOneSignalSdk();
    let active = true;
    const updateSubscription = (
      state: PushSubscriptionChangedState["current"],
    ) => {
      if (!active) return;
      setIsOptedIn(state.optedIn);
      setSubscriptionId(state.id ?? null);
    };
    const handleSubscriptionChange = (event: PushSubscriptionChangedState) => {
      updateSubscription(event.current);
    };

    void Promise.all([
      OneSignal.User.pushSubscription.getIdAsync(),
      OneSignal.User.pushSubscription.getOptedInAsync(),
    ])
      .then(([id, optedIn]) =>
        updateSubscription({ id: id ?? undefined, optedIn }),
      )
      .catch((subscriptionError) => {
        if (!active) return;
        setError(
          subscriptionError instanceof Error
            ? subscriptionError.message
            : "Unable to read the push subscription",
        );
      });
    OneSignal.User.pushSubscription.addEventListener(
      "change",
      handleSubscriptionChange,
    );

    return () => {
      active = false;
      OneSignal.User.pushSubscription.removeEventListener(
        "change",
        handleSubscriptionChange,
      );
    };
  }, [isInitialized]);

  const requestPermission = useCallback(async () => {
    if (!appId || !isAvailable) {
      throw new Error("OneSignal is not configured for this build.");
    }

    await initializeOneSignal(appId);
    setIsInitialized(true);

    const { OneSignal } = getOneSignalSdk();
    const alreadyGranted = await OneSignal.Notifications.getPermissionAsync();
    const granted = alreadyGranted
      ? true
      : await OneSignal.Notifications.requestPermission(true);

    if (granted) {
      OneSignal.User.pushSubscription.optIn();
      setIsOptedIn(true);
    }
    return granted;
  }, [appId, isAvailable]);

  const value = useMemo(
    () => ({
      error,
      isAvailable,
      isInitialized,
      isOptedIn,
      requestPermission,
      subscriptionId,
    }),
    [
      error,
      isAvailable,
      isInitialized,
      isOptedIn,
      requestPermission,
      subscriptionId,
    ],
  );

  return (
    <OneSignalContext.Provider value={value}>
      {children}
    </OneSignalContext.Provider>
  );
}

export function useOneSignal() {
  const context = useContext(OneSignalContext);
  if (!context) {
    throw new Error("useOneSignal must be used inside OneSignalProvider");
  }
  return context;
}
