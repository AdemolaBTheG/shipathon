import Constants from "expo-constants";
import PostHog from "posthog-react-native";

type PostHogExtra = {
  posthog?: {
    host?: string;
    projectToken?: string;
  };
};

const extra = (Constants.expoConfig?.extra ?? {}) as PostHogExtra;
const projectToken =
  typeof extra.posthog?.projectToken === "string"
    ? extra.posthog.projectToken.trim()
    : "";
const host =
  typeof extra.posthog?.host === "string" ? extra.posthog.host.trim() : "";

if (!projectToken && __DEV__) {
  throw new Error(
    "EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN is configured",
  );
}

export const posthog = projectToken
  ? new PostHog(projectToken, {
      ...(host ? { host } : {}),
      captureAppLifecycleEvents: true,
      errorTracking: {
        autocapture: true,
      },
    })
  : null;
