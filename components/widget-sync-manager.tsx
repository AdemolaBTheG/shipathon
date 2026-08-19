import { addUserInteractionListener } from "expo-widgets";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AppState, Platform } from "react-native";

import { useRevenueCat } from "@/hooks/use-revenuecat";
import {
  adoptTonightPickFromWidget,
  requestWidgetSync,
} from "@/services/widget-sync";

export function WidgetSyncManager() {
  const { i18n } = useTranslation();
  const { isLoading, isPro } = useRevenueCat();
  const language = i18n.resolvedLanguage;

  useEffect(() => {
    if (Platform.OS !== "ios" || isLoading) return;

    let isActive = true;

    const refreshWidgets = async (adoptWidgetSelection = true) => {
      try {
        if (adoptWidgetSelection) {
          await adoptTonightPickFromWidget();
        }
        if (isActive) {
          await requestWidgetSync({ isPro });
        }
      } catch (error) {
        if (__DEV__) {
          console.warn("Unable to refresh Joylogue widgets.", error);
        }
      }
    };

    const interactionSubscription = addUserInteractionListener((event) => {
      if (
        event.source === "TonightsPickWidget" &&
        event.target === "shuffle"
      ) {
        void refreshWidgets(true);
      }
    });
    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextState) => {
        if (nextState === "active") {
          void refreshWidgets(true);
        }
      },
    );

    void refreshWidgets(true);

    return () => {
      isActive = false;
      interactionSubscription.remove();
      appStateSubscription.remove();
    };
  }, [isLoading, isPro, language]);

  return null;
}
