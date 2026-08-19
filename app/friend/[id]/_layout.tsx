import { colors } from "@/constants/theme";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { createNativeBackItems } from "@/lib/native-header-items";
import { createHeaderLeftOptions } from "@/lib/header-item-options";

export default function FriendStackLayout() {
  const { t } = useTranslation();
  const router = useRouter();
  const hasLiquidGlass = isLiquidGlassAvailable();
  const nativeBackItems = createNativeBackItems({
    onPress: () => router.back(),
  });

  return (
    <Stack
      screenOptions={{
        headerBackButtonDisplayMode: "minimal",
        headerTransparent: hasLiquidGlass,
        headerStyle: {
          backgroundColor: hasLiquidGlass ? "transparent" : colors.background,
        },
        ...createHeaderLeftOptions(nativeBackItems),
      }}
    >
      <Stack.Screen name="index" options={{ title: "" }} />
      <Stack.Screen
        name="playing"
        options={{ title: t("Currently playing") }}
      />
      <Stack.Screen name="common" options={{ title: t("Games in common") }} />
    </Stack>
  );
}
