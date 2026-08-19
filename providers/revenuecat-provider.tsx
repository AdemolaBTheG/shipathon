import { createContext, type ReactNode, useEffect, useState } from "react";
import { Platform } from "react-native";
import Purchases, {
  type CustomerInfo,
  LOG_LEVEL,
  type PurchasesOffering,
  type PurchasesPackage,
} from "react-native-purchases";
import RevenueCatUI, {
  PAYWALL_RESULT,
} from "react-native-purchases-ui";

import {
  getRevenueCatApiKey,
  isTestStoreApiKey,
  revenueCatConfig,
} from "@/lib/revenuecat-config";
import { ensureCloudUser } from "@/services/sharing";

type RevenueCatContextValue = {
  currentOffering: PurchasesOffering | null;
  currentPackage: PurchasesPackage | null;
  customerInfo: CustomerInfo | null;
  error: string | null;
  identifyWithAppUserId: (appUserId: string) => Promise<CustomerInfo>;
  isConfigured: boolean;
  isLoading: boolean;
  isPro: boolean;
  isSupported: boolean;
  isUsingTestStore: boolean;
  managementUrl: string | null;
  packages: PurchasesPackage[];
  packageMap: Record<"lifetime" | "monthly" | "yearly", PurchasesPackage | null>;
  presentCustomerCenter: () => Promise<void>;
  presentPaywall: () => Promise<PAYWALL_RESULT>;
  presentPaywallIfNeeded: () => Promise<PAYWALL_RESULT>;
  purchasePackage: (pkg: PurchasesPackage) => Promise<CustomerInfo>;
  refresh: () => Promise<void>;
  restorePurchases: () => Promise<CustomerInfo>;
};

export const RevenueCatContext = createContext<RevenueCatContextValue | null>(
  null,
);

let hasConfiguredPurchases = false;

function getActiveEntitlement(customerInfo: CustomerInfo | null) {
  if (!customerInfo) return null;

  return (
    customerInfo.entitlements.active[revenueCatConfig.entitlementId] ?? null
  );
}

function formatPurchasesError(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "userCancelled" in error &&
    error.userCancelled
  ) {
    return "Purchase cancelled.";
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.length > 0
  ) {
    return error.message;
  }

  return "Something went wrong while talking to RevenueCat.";
}

function sortPackages(packages: PurchasesPackage[]) {
  const order = [
    revenueCatConfig.packageIds.monthly,
    revenueCatConfig.packageIds.yearly,
    revenueCatConfig.packageIds.lifetime,
  ];

  return [...packages].sort((left, right) => {
    const leftIndex = order.indexOf(left.identifier);
    const rightIndex = order.indexOf(right.identifier);

    return (
      (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
      (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex)
    );
  });
}

function mapPackages(packages: PurchasesPackage[]) {
  return {
    lifetime:
      packages.find(
        (pkg) => pkg.identifier === revenueCatConfig.packageIds.lifetime,
      ) ?? null,
    monthly:
      packages.find(
        (pkg) => pkg.identifier === revenueCatConfig.packageIds.monthly,
      ) ?? null,
    yearly:
      packages.find(
        (pkg) => pkg.identifier === revenueCatConfig.packageIds.yearly,
      ) ?? null,
  };
}

export function RevenueCatProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [currentOffering, setCurrentOffering] =
    useState<PurchasesOffering | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [isUsingTestStore, setIsUsingTestStore] = useState(false);

  const isSupported = Platform.OS === "ios" || Platform.OS === "android";
  const activeEntitlement = getActiveEntitlement(customerInfo);
  const isPro = Boolean(activeEntitlement);

  async function refresh() {
    if (!isSupported || !hasConfiguredPurchases) return;

    const [nextCustomerInfo, offerings] = await Promise.all([
      Purchases.getCustomerInfo(),
      Purchases.getOfferings(),
    ]);

    const nextOffering = offerings.current ?? null;
    const nextPackages = sortPackages(nextOffering?.availablePackages ?? []);

    setCustomerInfo(nextCustomerInfo);
    setCurrentOffering(nextOffering);
    setPackages(nextPackages);
  }

  async function identifyWithAppUserId(appUserId: string) {
    const loginResult = await Purchases.logIn(appUserId);
    setCustomerInfo(loginResult.customerInfo);
    setError(null);

    return loginResult.customerInfo;
  }

  async function purchasePackage(pkg: PurchasesPackage) {
    const result = await Purchases.purchasePackage(pkg);
    setCustomerInfo(result.customerInfo);
    setError(null);

    return result.customerInfo;
  }

  async function restorePurchases() {
    const restoredCustomerInfo = await Purchases.restorePurchases();
    setCustomerInfo(restoredCustomerInfo);
    setError(null);

    return restoredCustomerInfo;
  }

  async function presentPaywall() {
    const result = await RevenueCatUI.presentPaywall({
      displayCloseButton: true,
      offering: currentOffering ?? undefined,
    });

    await refresh();
    setError(null);

    return result;
  }

  async function presentPaywallIfNeeded() {
    const result = await RevenueCatUI.presentPaywallIfNeeded({
      displayCloseButton: true,
      offering: currentOffering ?? undefined,
      requiredEntitlementIdentifier: revenueCatConfig.entitlementId,
    });

    await refresh();
    setError(null);

    return result;
  }

  async function presentCustomerCenter() {
    await RevenueCatUI.presentCustomerCenter({
      callbacks: {
        onPromotionalOfferSucceeded: ({ customerInfo: nextCustomerInfo }) => {
          setCustomerInfo(nextCustomerInfo);
        },
        onRestoreCompleted: ({ customerInfo: nextCustomerInfo }) => {
          setCustomerInfo(nextCustomerInfo);
        },
      },
    });

    await refresh();
    setError(null);
  }

  useEffect(() => {
    if (!isSupported) {
      setError("RevenueCat subscriptions are only enabled on iOS and Android.");
      setIsLoading(false);
      return;
    }

    let isActive = true;

    const customerInfoListener = (nextCustomerInfo: CustomerInfo) => {
      if (!isActive) return;
      setCustomerInfo(nextCustomerInfo);
    };

    async function configureRevenueCat() {
      try {
        setIsLoading(true);
        setError(null);

        const apiKey = getRevenueCatApiKey();

        if (!apiKey) {
          throw new Error(
            "Missing RevenueCat API key. Set REVENUECAT_API_KEY or platform-specific keys.",
          );
        }

        setIsUsingTestStore(isTestStoreApiKey(apiKey));

        await Purchases.setLogLevel(
          __DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO,
        );

        if (!hasConfiguredPurchases) {
          Purchases.configure({ apiKey });
          hasConfiguredPurchases = true;
        }

        Purchases.addCustomerInfoUpdateListener(customerInfoListener);

        await refresh();
        setIsConfigured(true);

        try {
          const cloudUser = await ensureCloudUser();
          await identifyWithAppUserId(cloudUser.id);
        } catch (cloudUserError) {
          if (__DEV__) {
            console.warn(
              "RevenueCat user identification fell back to anonymous mode.",
              cloudUserError,
            );
          }
        }
      } catch (setupError) {
        if (!isActive) return;
        setError(formatPurchasesError(setupError));
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void configureRevenueCat();

    return () => {
      isActive = false;
      Purchases.removeCustomerInfoUpdateListener(customerInfoListener);
    };
  }, [isSupported]);

  return (
    <RevenueCatContext.Provider
      value={{
        currentOffering,
        currentPackage: currentOffering?.availablePackages[0] ?? null,
        customerInfo,
        error,
        identifyWithAppUserId,
        isConfigured,
        isLoading,
        isPro,
        isSupported,
        isUsingTestStore,
        managementUrl: customerInfo?.managementURL ?? null,
        packageMap: mapPackages(packages),
        packages,
        presentCustomerCenter,
        presentPaywall,
        presentPaywallIfNeeded,
        purchasePackage,
        refresh,
        restorePurchases,
      }}
    >
      {children}
    </RevenueCatContext.Provider>
  );
}
