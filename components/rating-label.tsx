import { StyleSheet, Text } from "react-native";

import { colors } from "@/constants/theme";

type RatingLabelProps = {
  rating: number | null;
  text: string;
};

export function RatingLabel({ text }: RatingLabelProps) {
  return <Text style={styles.label}>{text}</Text>;
}

const styles = StyleSheet.create({
  label: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: "600",
    marginTop: 14,
    textAlign: "center",
  },
});
