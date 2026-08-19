import type {
  NativeStackHeaderItemMenu,
  NativeStackHeaderItemMenuAction,
  NativeStackHeaderItemMenuSubmenu,
} from "expo-router";
import type { ColorValue } from "react-native";

import { appHaptics } from "@/lib/haptics";

type FilterActionOptions = {
  description?: string;
  disabled?: boolean;
  icon?: NativeStackHeaderItemMenuAction["icon"];
  label: string;
  onPress: () => void;
  selected: boolean;
};

type FilterMenuOptions = {
  accessibilityLabel?: string;
  active?: boolean;
  items: NativeStackHeaderItemMenu["menu"]["items"];
  label?: string;
  tintColor?: ColorValue;
  title?: string;
};

type FilterSubmenuOptions = {
  icon?: NativeStackHeaderItemMenuSubmenu["icon"];
  items: NativeStackHeaderItemMenuSubmenu["items"];
  label: string;
  multiselectable?: boolean;
};

export function createFilterAction({
  description,
  disabled,
  icon,
  label,
  onPress,
  selected,
}: FilterActionOptions): NativeStackHeaderItemMenuAction {
  return {
    description,
    disabled,
    icon,
    label,
    onPress: () => {
      appHaptics.menuSelect();
      onPress();
    },
    state: selected ? "on" : "off",
    type: "action",
  };
}

export function createFilterSubmenu({
  icon,
  items,
  label,
  multiselectable = false,
}: FilterSubmenuOptions): NativeStackHeaderItemMenuSubmenu {
  return {
    icon,
    items,
    label,
    multiselectable,
    type: "submenu",
  };
}

export function createHeaderFilterMenu({
  accessibilityLabel = "Filter list",
  active = false,
  items,
  label = "Filter",
  tintColor,
  title,
}: FilterMenuOptions): NativeStackHeaderItemMenu {
  return {
    accessibilityLabel,
    icon: {
      name: active
        ? "line.3.horizontal.decrease.circle.fill"
        : "line.3.horizontal.decrease.circle",
      type: "sfSymbol",
    },
    label,
    menu: { items, title },
    tintColor: active ? tintColor : undefined,
    type: "menu",
  };
}
