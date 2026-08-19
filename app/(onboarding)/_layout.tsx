import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { colors } from "@/constants/theme";
import type { OnboardingStep } from "@/db/schema";
import { createHeaderLeftOptions } from "@/lib/header-item-options";
import { useOnboarding } from "@/providers/onboarding-provider";

export default function OnboardingLayout() {
  const router = useRouter();
  const { t } = useTranslation();
  const { setStep } = useOnboarding();
  const nativeBackItems = (previousStep: OnboardingStep) => () => [
    {
      type: "button" as const,
      label: t("Back"),
      icon: { type: "sfSymbol" as const, name: "chevron.backward" as const },
      tintColor: colors.text,
      accessibilityLabel: t("Go back"),
      onPress: () => {
        void setStep(previousStep).then(() => router.back());
      },
    },
  ];

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.background },
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="platforms"
        options={{
          headerBackButtonDisplayMode: "minimal",
          headerShadowVisible: false,
          headerShown: true,
          headerStyle: {
            backgroundColor: isLiquidGlassAvailable()
              ? "transparent"
              : colors.background,
          },
          headerTransparent: isLiquidGlassAvailable(),
          headerTintColor: colors.text,
          title: "",
          ...createHeaderLeftOptions(nativeBackItems("welcome")),
        }}
      />
      <Stack.Screen
        name="games"
        options={{
          headerBackButtonDisplayMode: "minimal",
          headerShadowVisible: false,
          headerShown: true,
          headerStyle: {
            backgroundColor: isLiquidGlassAvailable()
              ? "transparent"
              : colors.background,
          },
          headerTransparent: isLiquidGlassAvailable(),
          headerTintColor: colors.text,
          title: "",
          ...createHeaderLeftOptions(nativeBackItems("platforms")),
        }}
      />
      <Stack.Screen
        name="rating/[id]"
        options={{
          headerBackButtonDisplayMode: "minimal",
          headerShown: true,
          headerStyle: {
            backgroundColor: isLiquidGlassAvailable()
              ? "transparent"
              : colors.background,
          },
          headerTransparent: isLiquidGlassAvailable(),
          headerTintColor: colors.text,
          title: t("Rate your game"),
          ...createHeaderLeftOptions(nativeBackItems("games")),
        }}
      />
      <Stack.Screen
        name="notifications"
        options={{
          animation: "slide_from_right",
          headerShown: false,
          presentation: "card",
        }}
      />
    </Stack>
  );
}
