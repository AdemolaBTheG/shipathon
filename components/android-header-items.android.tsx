import { Host } from "@expo/ui";
import {
  DropdownMenu,
  DropdownMenuItem,
  RNHostView,
  Text as ComposeText,
} from "@expo/ui/jetpack-compose";
import type {
  NativeStackHeaderItem,
  NativeStackHeaderItemButton,
  NativeStackHeaderItemMenu,
  NativeStackHeaderItemMenuAction,
  NativeStackHeaderItemMenuSubmenu,
} from "expo-router";
import {
  SymbolView,
  type AndroidSymbol,
  type SymbolViewProps,
} from "expo-symbols";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/constants/theme";
import { appHaptics } from "@/lib/haptics";

type AndroidHeaderItemsProps = {
  items: NativeStackHeaderItem[];
};

type MenuRow =
  | { key: string; kind: "heading"; label: string }
  | { action: NativeStackHeaderItemMenuAction; key: string; kind: "action" };

const androidSymbolNames: Record<string, AndroidSymbol> = {
  "chevron.backward": "arrow_back",
  "crown.fill": "workspace_premium",
  ellipsis: "more_vert",
  "line.3.horizontal.decrease.circle": "filter_list",
  "line.3.horizontal.decrease.circle.fill": "filter_list",
  "person.badge.plus": "person_add",
  plus: "add",
  star: "star",
  "star.fill": "star",
  "trophy.fill": "emoji_events",
  xmark: "close",
};

export function AndroidHeaderItems({ items }: AndroidHeaderItemsProps) {
  return (
    <View style={styles.items}>
      {items.map((item, index) => {
        if (item.type === "button") {
          return <HeaderButton item={item} key={`button-${index}`} />;
        }
        if (item.type === "menu") {
          return <HeaderMenu item={item} key={`menu-${index}`} />;
        }
        if (item.type === "custom") {
          return <View key={`custom-${index}`}>{item.element}</View>;
        }
        return (
          <View
            key={`spacing-${index}`}
            style={{ width: Math.max(0, item.spacing) }}
          />
        );
      })}
    </View>
  );
}

function HeaderButton({ item }: { item: NativeStackHeaderItemButton }) {
  const iconName = getAndroidIconName(item);

  return (
    <Pressable
      accessibilityHint={item.accessibilityHint}
      accessibilityLabel={item.accessibilityLabel ?? item.label}
      accessibilityRole="button"
      disabled={item.disabled}
      hitSlop={8}
      onPress={item.onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.buttonPressed,
        item.disabled && styles.buttonDisabled,
      ]}
    >
      {iconName ? (
        <SymbolView
          name={iconName}
          size={22}
          tintColor={item.tintColor ?? colors.text}
          weight="semibold"
        />
      ) : (
        <Text
          style={[styles.buttonLabel, { color: item.tintColor ?? colors.text }]}
        >
          {item.label}
        </Text>
      )}
    </Pressable>
  );
}

function HeaderMenu({ item }: { item: NativeStackHeaderItemMenu }) {
  const [expanded, setExpanded] = useState(false);
  const rows = flattenMenuItems(item.menu.items);

  return (
    <Host matchContents style={styles.menuHost}>
      <DropdownMenu
        color={colors.surface}
        expanded={expanded}
        onDismissRequest={() => setExpanded(false)}
      >
        <DropdownMenu.Trigger>
          <RNHostView matchContents>
            <Pressable
              accessibilityHint={item.accessibilityHint}
              accessibilityLabel={item.accessibilityLabel ?? item.label}
              accessibilityRole="button"
              disabled={item.disabled}
              hitSlop={8}
              onPress={() => {
                appHaptics.menuOpen();
                setExpanded(true);
              }}
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                item.disabled && styles.buttonDisabled,
              ]}
            >
              <SymbolView
                name={
                  getAndroidIconName(item) ?? {
                    android: "filter_list",
                    ios: "line.3.horizontal.decrease.circle",
                  }
                }
                size={22}
                tintColor={item.tintColor ?? colors.text}
                weight="semibold"
              />
            </Pressable>
          </RNHostView>
        </DropdownMenu.Trigger>
        <DropdownMenu.Items>
          {rows.map((row) =>
            row.kind === "heading" ? (
              <DropdownMenuItem enabled={false} key={row.key}>
                <DropdownMenuItem.Text>
                  <ComposeText>{row.label}</ComposeText>
                </DropdownMenuItem.Text>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                elementColors={
                  row.action.destructive
                    ? { textColor: colors.danger }
                    : undefined
                }
                enabled={!row.action.disabled}
                key={row.key}
                onClick={() => {
                  if (!row.action.keepsMenuPresented) setExpanded(false);
                  row.action.onPress();
                }}
              >
                <DropdownMenuItem.Text>
                  <ComposeText>
                    {formatMenuActionLabel(row.action)}
                  </ComposeText>
                </DropdownMenuItem.Text>
              </DropdownMenuItem>
            ),
          )}
        </DropdownMenu.Items>
      </DropdownMenu>
    </Host>
  );
}

function flattenMenuItems(
  items: NativeStackHeaderItemMenu["menu"]["items"],
  path = "root",
): MenuRow[] {
  return items.flatMap((item, index) => {
    const key = `${path}-${index}`;
    if (item.type === "action") {
      return item.hidden ? [] : [{ action: item, key, kind: "action" }];
    }

    return [
      { key: `${key}-heading`, kind: "heading", label: item.label },
      ...flattenSubmenu(item, key),
    ];
  });
}

function flattenSubmenu(
  submenu: NativeStackHeaderItemMenuSubmenu,
  path: string,
) {
  return flattenMenuItems(submenu.items, path);
}

function formatMenuActionLabel(action: NativeStackHeaderItemMenuAction) {
  const selection = action.state === "on" ? "✓ " : "";
  return action.description
    ? `${selection}${action.label} · ${action.description}`
    : `${selection}${action.label}`;
}

function getAndroidIconName(
  item: NativeStackHeaderItemButton | NativeStackHeaderItemMenu,
): SymbolViewProps["name"] | null {
  if (!item.icon || item.icon.type !== "sfSymbol") return null;
  return {
    android: androidSymbolNames[item.icon.name] ?? "more_vert",
    ios: item.icon.name,
  };
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    minWidth: 44,
  },
  buttonDisabled: {
    opacity: 0.38,
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: "700",
    paddingHorizontal: 8,
  },
  buttonPressed: {
    opacity: 0.56,
  },
  items: {
    alignItems: "center",
    flexDirection: "row",
  },
  menuHost: {
    height: 44,
    width: 44,
  },
});
