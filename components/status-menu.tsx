import { Alert, Pressable, StyleSheet } from "react-native";
import { SymbolView } from "expo-symbols";
import { useTranslation } from "react-i18next";

import { colors } from "@/constants/theme";
import type { BacklogStatus } from "@/db/schema";
import { appHaptics } from "@/lib/haptics";
import { statusOptions } from "./status-options";

type StatusMenuProps = {
  onChange: (status: BacklogStatus) => void;
  status: BacklogStatus;
};

export function StatusMenu({ onChange, status }: StatusMenuProps) {
  const { t } = useTranslation();
  const current = statusOptions.find((option) => option.value === status)!;

  return (
    <Pressable
      accessibilityLabel={t("Status: {{status}}", {
        status: t(current.label),
      })}
      accessibilityRole="button"
      onPress={() => {
        appHaptics.menuOpen();
        Alert.alert(
          t("Update status"),
          undefined,
          statusOptions.map((option) => ({
            onPress: () => {
              appHaptics.confirm();
              onChange(option.value);
            },
            text: t(option.label),
          })),
        );
      }}
      style={styles.fallback}
    >
      <SymbolView name={current.icon} size={18} tintColor={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    flexDirection: "row",
    height: 52,
    justifyContent: "center",
    width: "100%",
  },
});
