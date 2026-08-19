import { BlurView } from "expo-blur";
import { SymbolView } from "expo-symbols";
import { PressableScale } from "pressto";
import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { colors, theme } from "@/constants/theme";

type ProBlurGateProps = {
  children: ReactNode;
  isBusy?: boolean;
  message: string;
  onUnlock: () => void;
  title: string;
};

export function ProBlurGate({
  children,
  isBusy = false,
  message,
  onUnlock,
  title,
}: ProBlurGateProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <View pointerEvents="none">{children}</View>
      <BlurView intensity={58} style={StyleSheet.absoluteFill} tint="dark" />
      <View pointerEvents="none" style={styles.scrim} />
      <PressableScale
        accessibilityHint={message}
        accessibilityLabel={t("{{title}}. Unlock with Joylogue Pro", {
          title,
        })}
        accessibilityRole="button"
        disabled={isBusy}
        onPress={onUnlock}
        style={styles.action}
      >
        {isBusy ? (
          <ActivityIndicator color={colors.text} size="small" />
        ) : (
          <SymbolView
            name={{ android: "lock", ios: "lock.fill" }}
            size={19}
            tintColor={colors.success}
          />
        )}
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          <Text numberOfLines={2} style={styles.message}>
            {message}
          </Text>
        </View>
        <SymbolView
          name={{ android: "chevron_right", ios: "chevron.right" }}
          size={15}
          tintColor={colors.textMuted}
        />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 116,
    overflow: "hidden",
    position: "relative",
  },
  scrim: {
    backgroundColor: "rgba(10, 10, 10, 0.32)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  action: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "rgba(20, 20, 20, 0.82)",
    borderColor: "rgba(255, 255, 255, 0.14)",
    borderCurve: "continuous",
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: theme.spacing.sm,
    left: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    position: "absolute",
    right: theme.spacing.lg,
    top: "50%",
    transform: [{ translateY: -31 }],
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.text,
    fontSize: theme.size.md,
    fontWeight: "700",
  },
  message: {
    color: colors.textMuted,
    fontSize: theme.size.sm,
    lineHeight: 16,
  },
});
