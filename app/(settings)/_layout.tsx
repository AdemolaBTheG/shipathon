import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Stack, useRouter } from "expo-router";
import { Platform } from "react-native";
import { useTranslation } from "react-i18next";

import { colors } from "@/constants/theme";
import { createHeaderLeftOptions } from "@/lib/header-item-options";
import { createNativeBackItems } from "@/lib/native-header-items";

export default function SettingsLayout() {
  const router = useRouter();
  const { t } = useTranslation();
  const transparentHeader = isLiquidGlassAvailable();
  const nativeBackItems = createNativeBackItems({
    onPress: () => router.back(),
  });

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: transparentHeader
            ? "transparent"
            : colors.background,
        },
        headerTransparent: transparentHeader,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: t("Settings"),
          ...createHeaderLeftOptions(() => [
            {
              type: "button" as const,
              label: t("Close"),
              icon: {
                type: "sfSymbol" as const,
                name: "chevron.backward",
              },
              accessibilityLabel: t("Close settings"),
              onPress: () => router.back(),
            },
          ]),
        }}
      />
      <Stack.Screen
        name="profile"
        options={{
          headerBackButtonDisplayMode: "minimal",
          ...createHeaderLeftOptions(nativeBackItems),
          title: t("Edit profile"),
          headerTransparent: isLiquidGlassAvailable(),
          presentation: Platform.OS === "android" ? "modal" : "formSheet",
          ...(Platform.OS === "android"
            ? {}
            : {
                sheetAllowedDetents: "fitToContents" as const,
                sheetGrabberVisible: true,
              }),
          headerStyle: {
            backgroundColor: isLiquidGlassAvailable()
              ? "transparent"
              : colors.background,
          },
          contentStyle: {
            backgroundColor: isLiquidGlassAvailable()
              ? "transparent"
              : colors.background,
          },
        }}
      />
    </Stack>
  );
}
