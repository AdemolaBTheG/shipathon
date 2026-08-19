import { colors } from "@/constants/theme";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Stack } from "expo-router";
export default function HomeStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerTransparent: isLiquidGlassAvailable(),
        headerStyle: {
          backgroundColor: isLiquidGlassAvailable()
            ? "transparent"
            : colors.background,
        },
      }}
    />
  );
}
