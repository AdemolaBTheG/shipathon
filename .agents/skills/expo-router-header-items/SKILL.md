---
name: expo-router-header-items
description: Configure native Expo Router header left and right items, including buttons, menus, spacing, and custom React elements.
version: 1.0.0
---

# Expo Router Header Items

Use `unstable_headerLeftItems` and `unstable_headerRightItems` when a screen needs native actions in the navigation header. These options are provided through the screen's stack options, usually with `Stack.Screen` or `navigation.setOptions`.

## Action Buttons

An action button has `type: "button"`, a screen-reader `label`, an optional SF Symbol icon, and an `onPress` handler:

```tsx
navigation.setOptions({
  unstable_headerRightItems: () => [
    {
      type: "button",
      label: "Rate",
      icon: { type: "sfSymbol", name: "star" },
      tintColor: colors.primary,
      accessibilityLabel: "Rate game",
      onPress: openRating,
    },
  ],
});
```

When an icon is present, iOS may hide the visible text label. Keep `label` descriptive because it is used by VoiceOver and when items collapse into an overflow menu.

Supported button controls include `variant` (`plain`, `done`, or `prominent`), `disabled`, `selected`, `width`, `tintColor`, `accessibilityLabel`, and `accessibilityHint`.

## Menus

Use `type: "menu"` for a header menu. Its `menu.items` can contain actions or submenus. Actions can provide icons, selection state, disabled or destructive state, and a press handler. Use `changesSelectionAsPrimaryAction` when the primary tap should update a selected menu item.

## Spacing And Custom Elements

Use `type: "spacing"` with a numeric `spacing` value between header items. Use `type: "custom"` only when a regular button or menu cannot express the UI. Custom elements need explicit dimensions and are not automatically collapsed into the iOS 26 overflow menu.

## Dynamic Screens

For route data that loads asynchronously, set the header items inside an effect or layout effect and include every value used by the item in its dependency list. Clear or replace the items when the route no longer has an applicable action.

```tsx
useLayoutEffect(() => {
  navigation.setOptions({
    title: game?.name ?? "Game",
    unstable_headerRightItems: game
      ? () => [createRateItem(game)]
      : undefined,
  });
}, [game, navigation]);
```

Header items are native navigation UI. They are not a substitute for content actions that must remain visible while scrolling. For those, use a screen toolbar or a persistent in-content control.

## Platform Notes

The unstable header item API is primarily an iOS native header feature. SF Symbol items require an iOS symbol name. For Android behavior, use the Expo Router toolbar APIs or a platform-specific header implementation rather than importing iOS-only types into a shared route.

On iOS 26+, right-side items can collapse into an overflow menu when space is limited. Items with `type: "custom"` are excluded from that automatic collapse.
