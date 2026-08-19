import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Stack, useRouter } from "expo-router";

import { colors } from "@/constants/theme";
import { createHeaderLeftOptions } from "@/lib/header-item-options";
import { createNativeBackItems } from "@/lib/native-header-items";

export default function HomeFeedLayout() {
  const router = useRouter();
  const nativeBackItems = createNativeBackItems({
    onPress: () => router.back(),
  });

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.background },
        headerBackButtonDisplayMode: "minimal",
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: isLiquidGlassAvailable()
            ? "transparent"
            : colors.background,
        },
        headerTransparent: isLiquidGlassAvailable(),
        ...createHeaderLeftOptions(nativeBackItems),
      }}
    />
  );
}
