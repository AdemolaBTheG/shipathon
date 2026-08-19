import type { ConfigContext, ExpoConfig } from "expo/config";

const appJson = require("./app.json") as { expo: ExpoConfig };

const TEST_STORE_API_KEY = "test_KplaxJwWoInFuOAssDllswxcqDE";

const isProductionBuild = process.env.EAS_BUILD_PROFILE === "production";
const oneSignalMode = isProductionBuild ? "production" : "development";
const basePlugins = appJson.expo.plugins ?? [];
const skipServerExport = process.env.EXPO_NO_DEPLOY === "1";
const serverOnlyExport = process.env.EXPO_SERVER_ONLY === "1";
const nonRouterPlugins = basePlugins.filter((plugin) => {
  const pluginName = Array.isArray(plugin) ? plugin[0] : plugin;
  return pluginName !== "expo-router";
});
const revenueCatIosApiKey = (
  process.env.EXPO_RC_APPLE_API_KEY ??
  process.env.REVENUECAT_IOS_API_KEY ??
  process.env.REVENUECAT_API_KEY ??
  (isProductionBuild ? "" : TEST_STORE_API_KEY)
).trim();

if (
  isProductionBuild &&
  (!revenueCatIosApiKey || revenueCatIosApiKey.startsWith("test_"))
) {
  throw new Error(
    "Production iOS builds require EXPO_RC_APPLE_API_KEY with a RevenueCat appl_ key.",
  );
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  ...appJson.expo,
  ios: {
    ...appJson.expo.ios,
    infoPlist: {
      ...appJson.expo.ios?.infoPlist,
      UIBackgroundModes: ["remote-notification"],
    },
  },
  web: {
    ...appJson.expo.web,
    // Native archives do not need to evaluate the web/server route manifest.
    // API-route deployments still use the server output configured in app.json.
    output: skipServerExport ? "single" : appJson.expo.web?.output,
  },
  plugins: [
    [
      "onesignal-expo-plugin",
      { disableLocation: true, mode: oneSignalMode },
    ],
    serverOnlyExport
      ? ["expo-router", { root: "server-app" }]
      : "expo-router",
    ...nonRouterPlugins,
  ],
  extra: {
    ...appJson.expo.extra,
    eas: {
      ...appJson.expo.extra?.eas,
      projectId: "78743bc3-0d82-4c21-a1c6-cf28a55716a2",
    },
    oneSignalAppId:
      process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID ??
      process.env.ONESIGNAL_APP_ID ??
      "",
    posthog: {
      host: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "",
      projectToken: process.env.EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN ?? "",
    },
    revenueCat: {
      androidApiKey:
        process.env.REVENUECAT_ANDROID_API_KEY ??
        process.env.REVENUECAT_API_KEY ??
        TEST_STORE_API_KEY,
      // Keep the pre-rename RevenueCat identifier so existing purchases remain valid.
      entitlementId: "savepoint_pro",
      iosApiKey: revenueCatIosApiKey,
      packageIds: {
        lifetime: "lifetime",
        monthly: "monthly",
        yearly: "yearly",
      },
      testStoreApiKey: TEST_STORE_API_KEY,
    },
  },
});
