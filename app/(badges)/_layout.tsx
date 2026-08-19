import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { colors } from "@/constants/theme";
import { createHeaderLeftOptions } from "@/lib/header-item-options";
import { createNativeBackItems } from "@/lib/native-header-items";

export const unstable_settings = {
  initialRouteName: "badges",
};

export default function BadgesLayout() {
  const { t } = useTranslation();
  const router = useRouter();
  const transparentHeader = isLiquidGlassAvailable();
  const nativeBackItems = createNativeBackItems({
    onPress: () => router.back(),
  });

  return (
    <Stack
      screenOptions={{
        headerBackButtonDisplayMode: "minimal",
        headerStyle: {
          backgroundColor: transparentHeader
            ? "transparent"
            : colors.background,
        },
        headerTransparent: transparentHeader,
        ...createHeaderLeftOptions(nativeBackItems),
      }}
    >
      <Stack.Screen name="badges" options={{ title: t("Badges") }} />
      <Stack.Screen name="badge/[id]" options={{ title: t("Badge") }} />
    </Stack>
  );
}
