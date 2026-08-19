import {
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router";
import { SymbolView } from "expo-symbols";
import { useTranslation } from "react-i18next";
import {
  useDeferredValue,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import {
  type NativeSyntheticEvent,
  SectionList,
  StyleSheet,
  type TextInputChangeEventData,
  View,
} from "react-native";

import { Text } from "@/components/Themed";
import { PlatformBrowseCard } from "@/components/platform-browse-card";
import {
  GAME_PLATFORM_SECTIONS,
  type GamePlatform,
} from "@/constants/game-platforms";
import { colors, theme } from "@/constants/theme";
import type { TranslationKey } from "@/localization/resources";

type PlatformRow = readonly [GamePlatform, GamePlatform?];

function toRows(platforms: readonly GamePlatform[]) {
  const rows: PlatformRow[] = [];
  for (let index = 0; index < platforms.length; index += 2) {
    const first = platforms[index];
    if (first) rows.push([first, platforms[index + 1]]);
  }
  return rows;
}

export default function PlatformsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const router = useRouter();
  const { sourceUrl } = useLocalSearchParams<{ sourceUrl?: string }>();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const sections = useMemo(
    () =>
      GAME_PLATFORM_SECTIONS.map((section) => ({
        title: section.title,
        data: toRows(
          section.data.filter((platform) =>
            platform.label.toLowerCase().includes(deferredQuery),
          ),
        ),
      })).filter((section) => section.data.length > 0),
    [deferredQuery],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerSearchBarOptions: {
        autoCapitalize: "none",
        hideWhenScrolling: false,
        onCancelButtonPress: () => setQuery(""),
        onChangeText: (
          event: NativeSyntheticEvent<TextInputChangeEventData>,
        ) => setQuery(event.nativeEvent.text),
        placeholder: t("Search platforms"),
      },
      title: t("Platforms"),
    });
  }, [navigation, t]);

  const openPlatform = (platform: GamePlatform) => {
    router.push({
      pathname: "/platform/[id]",
      params: {
        id: platform.id,
        ...(sourceUrl ? { sourceUrl } : {}),
      },
    });
  };

  return (
    <SectionList
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyExtractor={(row) =>
        row
          .filter((platform): platform is GamePlatform => Boolean(platform))
          .map((platform) => platform.id)
          .join(":")
      }
      keyboardDismissMode="on-drag"
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <SymbolView
            name={{ android: "sports_esports", ios: "gamecontroller" }}
            size={38}
            tintColor={colors.textMuted}
          />
          <Text style={styles.emptyTitle}>{t("No platforms found")}</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <PlatformBrowseCard
            onPress={() => openPlatform(item[0])}
            platform={item[0]}
            style={styles.card}
          />
          {item[1] ? (
            <PlatformBrowseCard
              onPress={() => openPlatform(item[1]!)}
              platform={item[1]}
              style={styles.card}
            />
          ) : (
            <View style={styles.card} />
          )}
        </View>
      )}
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionTitle}>
          {t(section.title as TranslationKey)}
        </Text>
      )}
      sections={sections}
      stickySectionHeadersEnabled={false}
      style={styles.container}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
  },
  container: {
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    gap: 12,
    paddingBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
  },
  emptyState: {
    alignItems: "center",
    flex: 1,
    gap: theme.spacing.md,
    justifyContent: "center",
    paddingBottom: 96,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: theme.size.lg,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: theme.size.xl,
    fontWeight: "700",
    paddingBottom: theme.spacing.xs,
    paddingTop: theme.spacing.md,
  },
});
