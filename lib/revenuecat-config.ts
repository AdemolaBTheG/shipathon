import Constants from "expo-constants";
import { Platform } from "react-native";

type RevenueCatExtra = {
  revenueCat?: {
    androidApiKey?: string;
    entitlementId?: string;
    iosApiKey?: string;
    packageIds?: {
      lifetime?: string;
      monthly?: string;
      yearly?: string;
    };
    testStoreApiKey?: string;
  };
};

const extra = (Constants.expoConfig?.extra ?? {}) as RevenueCatExtra;

export const revenueCatConfig = {
  // RevenueCat identifiers are durable API keys, not user-facing branding.
  entitlementId: extra.revenueCat?.entitlementId ?? "savepoint_pro",
  packageIds: {
    lifetime: extra.revenueCat?.packageIds?.lifetime ?? "lifetime",
    monthly: extra.revenueCat?.packageIds?.monthly ?? "monthly",
    yearly: extra.revenueCat?.packageIds?.yearly ?? "yearly",
  },
  testStoreApiKey: extra.revenueCat?.testStoreApiKey ?? null,
} as const;

export function getRevenueCatApiKey() {
  if (Platform.OS === "ios") {
    return extra.revenueCat?.iosApiKey ?? null;
  }

  if (Platform.OS === "android") {
    return extra.revenueCat?.androidApiKey ?? null;
  }

  return null;
}

export function isTestStoreApiKey(apiKey: string | null) {
  return typeof apiKey === "string" && apiKey.startsWith("test_");
}
