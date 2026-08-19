import { useContext } from "react";

import { RevenueCatContext } from "@/providers/revenuecat-provider";

export function useRevenueCat() {
  const value = useContext(RevenueCatContext);

  if (!value) {
    throw new Error("useRevenueCat must be used within a RevenueCatProvider.");
  }

  return value;
}
