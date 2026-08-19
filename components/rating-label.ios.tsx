import { Host } from "@expo/ui";
import { Text } from "@expo/ui/swift-ui";
import {
  animation,
  Animation,
  contentTransition,
  font,
  foregroundStyle,
  frame,
} from "@expo/ui/swift-ui/modifiers";
import { StyleSheet } from "react-native";

import { colors } from "@/constants/theme";

type RatingLabelProps = {
  rating: number | null;
  text: string;
};

export function RatingLabel({ rating, text }: RatingLabelProps) {
  return (
    <Host matchContents style={styles.host}>
      <Text
        modifiers={[
          frame({ alignment: "center", minWidth: 180 }),
          font({ size: 16, weight: "semibold" }),
          foregroundStyle(colors.textMuted),
          contentTransition("opacity"),
          animation(Animation.easeInOut({ duration: 0.18 }), rating ?? 0),
        ]}
      >
        {text}
      </Text>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    alignSelf: "center",
    marginTop: 14,
    minHeight: 24,
    minWidth: 180,
  },
});
