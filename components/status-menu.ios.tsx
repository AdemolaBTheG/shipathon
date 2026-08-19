import { Host } from "@expo/ui";
import { Button, Menu } from "@expo/ui/swift-ui";
import {
  buttonStyle,
  controlSize,
  foregroundStyle,
  frame,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { StyleSheet } from "react-native";
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
    <Host
      colorScheme="dark"
      matchContents
      useViewportSizeMeasurement
      seedColor={colors.primary}
      style={styles.host}
    >
      <Menu
        label={t(current.label)}
        modifiers={[
          frame({ alignment: "center" }),
          buttonStyle("borderedProminent"),
          controlSize("extraLarge"),
          tint(colors.primary),
          foregroundStyle(colors.background),
        ]}
        systemImage={current.icon.ios}
      >
        {statusOptions.map((option) => (
          <Button
            key={option.value}
            label={t(option.label)}
            onPress={() => {
              appHaptics.confirm();
              onChange(option.value);
            }}
            systemImage={
              option.value === status ? "checkmark" : option.icon.ios
            }
          />
        ))}
      </Menu>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: { alignItems: "center" },
});
