import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

import { colors } from "@/constants/theme";

export default function SearchStackLayout() {
  const { t } = useTranslation();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: isLiquidGlassAvailable()
            ? "transparent"
            : colors.background,
        },
        headerTransparent: isLiquidGlassAvailable(),
      }}
    >
      <Stack.Screen
        name="index"
        options={{ headerLargeTitle: true, title: t("Search") }}
      />
    </Stack>
  );
}
