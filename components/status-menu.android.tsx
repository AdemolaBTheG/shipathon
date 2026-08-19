import { Host } from "@expo/ui";
import {
  DropdownMenu,
  DropdownMenuItem,
  RNHostView,
  Text as ComposeText,
} from "@expo/ui/jetpack-compose";
import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
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
  const [expanded, setExpanded] = useState(false);
  const current = statusOptions.find((option) => option.value === status)!;

  return (
    <Host matchContents style={styles.host}>
      <DropdownMenu
        color={colors.surface}
        expanded={expanded}
        onDismissRequest={() => setExpanded(false)}
      >
        <DropdownMenu.Trigger>
          <RNHostView matchContents>
            <Pressable
              accessibilityLabel={t("Status: {{status}}", {
                status: t(current.label),
              })}
              accessibilityRole="button"
              onPress={() => {
                appHaptics.menuOpen();
                setExpanded(true);
              }}
              style={styles.trigger}
            >
              <SymbolView
                name={current.icon}
                size={18}
                tintColor={colors.text}
              />
              <Text style={styles.triggerText}>{t(current.label)}</Text>
              <SymbolView
                name={{ android: "arrow_drop_down", ios: "chevron.down" }}
                size={18}
                tintColor={colors.textMuted}
              />
            </Pressable>
          </RNHostView>
        </DropdownMenu.Trigger>
        <DropdownMenu.Items>
          {statusOptions.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => {
                appHaptics.confirm();
                setExpanded(false);
                onChange(option.value);
              }}
            >
              <DropdownMenuItem.Text>
                <ComposeText>
                  {option.value === status
                    ? `✓ ${t(option.label)}`
                    : t(option.label)}
                </ComposeText>
              </DropdownMenuItem.Text>
            </DropdownMenuItem>
          ))}
        </DropdownMenu.Items>
      </DropdownMenu>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: { minHeight: 52, width: "100%" },
  trigger: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    height: 52,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  triggerText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
});
