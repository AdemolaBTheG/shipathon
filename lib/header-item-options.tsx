import type {
  NativeStackHeaderItem,
  NativeStackHeaderItemProps,
} from "expo-router";
import { Platform } from "react-native";

import { AndroidHeaderItems } from "@/components/android-header-items";

type HeaderItemsFactory = (
  props: NativeStackHeaderItemProps,
) => NativeStackHeaderItem[];

export function createHeaderLeftOptions(
  items: HeaderItemsFactory | undefined,
) {
  return {
    unstable_headerLeftItems: items,
    ...(Platform.OS === "android" && items
      ? {
          headerLeft: (props: NativeStackHeaderItemProps) => (
            <AndroidHeaderItems items={items(props)} />
          ),
        }
      : { headerLeft: undefined }),
  };
}

export function createHeaderRightOptions(
  items: HeaderItemsFactory | undefined,
) {
  return {
    unstable_headerRightItems: items,
    ...(Platform.OS === "android" && items
      ? {
          headerRight: (props: NativeStackHeaderItemProps) => (
            <AndroidHeaderItems items={items(props)} />
          ),
        }
      : { headerRight: undefined }),
  };
}
