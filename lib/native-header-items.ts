import { colors } from "@/constants/theme";
import { appHaptics } from "@/lib/haptics";
import type { NativeStackHeaderItemProps } from "expo-router";

type NativeBackItemOptions = {
  accessibilityLabel?: string;
  label?: string;
  onPress: () => void;
  tintColor?: string;
};

export function createNativeBackItems({
  accessibilityLabel = "Go back",
  label = "Back",
  onPress,
  tintColor = colors.text,
}: NativeBackItemOptions) {
  return (_props: NativeStackHeaderItemProps) => [
    {
      type: "button" as const,
      label,
      icon: {
        type: "sfSymbol" as const,
        name: "chevron.backward" as const,
      },
      accessibilityLabel,
      onPress: () => {
        appHaptics.back();
        onPress();
      },
      tintColor,
    },
  ];
}
