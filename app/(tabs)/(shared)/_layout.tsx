import { colors } from "@/constants/theme";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

export default function SharedStackLayout() {
  const { t } = useTranslation();
  return (
    <Stack
      screenOptions={{
        headerTransparent: isLiquidGlassAvailable(),
        headerStyle: {
          backgroundColor: isLiquidGlassAvailable() ? "transparent" : colors.background,
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerLargeTitle: true,
          title: t("Shared"),
        }}
      />
    </Stack>
  );
}
