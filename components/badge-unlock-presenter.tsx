import { router } from "expo-router";
import { useEffect } from "react";

import { subscribeToBadgeUnlocks } from "@/lib/badge-unlock-events";

export function BadgeUnlockPresenter() {
  useEffect(
    () =>
      subscribeToBadgeUnlocks((unlocks) => {
        router.push({
          pathname: "/badge-reveal",
          params: { unlocks: JSON.stringify(unlocks) },
        });
      }),
    [],
  );

  return null;
}
