import { SymbolView } from "expo-symbols";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/Themed";
import { colors, theme } from "@/constants/theme";

type GamePaginationFooterProps = {
  hasError: boolean;
  isFetching: boolean;
  onRetry: () => void;
};

export function GamePaginationFooter({
  hasError,
  isFetching,
  onRetry,
}: GamePaginationFooterProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      {isFetching ? (
        <ActivityIndicator color={colors.textMuted} />
      ) : hasError ? (
        <Pressable
          accessibilityHint={t("Retries loading the next page of games")}
          accessibilityRole="button"
          hitSlop={12}
          onPress={onRetry}
          style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
        >
          <SymbolView
            name="arrow.clockwise"
            size={15}
            tintColor={colors.text}
          />
          <Text style={styles.retryText}>{t("Couldn’t load more. Retry")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    height: 52,
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.55,
  },
  retry: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.xs,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: theme.spacing.md,
  },
  retryText: {
    color: colors.text,
    fontSize: theme.size.sm,
    fontWeight: "600",
  },
});
