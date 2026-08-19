import { Image } from "expo-image";
import { Link, useNavigation } from "expo-router";
import { useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  type TextInputChangeEventData,
  useWindowDimensions,
  View,
} from "react-native";
import { Presets } from "react-native-pulsar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GameSearchResultRow } from "@/components/game-search-result";
import { OnboardingProgress } from "@/components/onboarding-progress";
import { colors, theme } from "@/constants/theme";
import { useGameSearch } from "@/hooks/use-game-search";

const CURATED_GAMES = [
  {
    coverUrl:
      "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co4jni.jpg",
    id: 119133,
    name: "Elden Ring",
  },
  {
    coverUrl:
      "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co670h.jpg",
    id: 119171,
    name: "Baldur's Gate 3",
  },
  {
    coverUrl:
      "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co741o.jpg",
    id: 250616,
    name: "Helldivers 2",
  },
  {
    coverUrl:
      "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co4rs3.jpg",
    id: 80529,
    name: "Hades",
  },
  {
    coverUrl:
      "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co1rs4.jpg",
    id: 72,
    name: "Portal 2",
  },
  {
    coverUrl:
      "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co2fca.jpg",
    id: 7342,
    name: "Inside",
  },
] as const;

const PAGE_PADDING = 24;
const GRID_GAP = 12;

export default function OnboardingGamePickerScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState("");
  const gameSearch = useGameSearch(query);
  const coverWidth = Math.min(84, Math.max(64, Math.round(width * 0.18)));
  const coverHeight = Math.round(coverWidth * (4 / 3));
  const curatedCoverWidth = (width - PAGE_PADDING * 2 - GRID_GAP * 2) / 3;
  const curatedCoverStyle = StyleSheet.flatten([
    styles.curatedCover,
    {
      height: curatedCoverWidth * 1.5,
      width: curatedCoverWidth,
    },
  ]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerSearchBarOptions: {
        autoCapitalize: "none",
        hideWhenScrolling: false,
        obscureBackground: false,
        onCancelButtonPress: () => setQuery(""),
        onChangeText: (
          event: NativeSyntheticEvent<TextInputChangeEventData>,
        ) => setQuery(event.nativeEvent.text),
        placement: "stacked",
        placeholder: t("Search games"),
      },
    });
  }, [navigation, t]);

  function handleChooseGame() {
    Presets.snap();
  }

  return (
    <FlatList
      contentContainerStyle={[
        styles.content,
        {
          paddingBottom: Math.max(insets.bottom, theme.spacing.lg),
          paddingTop: theme.spacing.lg,
        },
      ]}
      contentInsetAdjustmentBehavior="automatic"
      data={gameSearch.canSearch ? gameSearch.results : []}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      keyExtractor={(game) => String(game.id)}
      ListEmptyComponent={
        query.trim().length > 0 ? (
          <SearchFeedback
            canSearch={gameSearch.canSearch}
            error={gameSearch.error}
            isLoading={gameSearch.isLoading}
          />
        ) : null
      }
      ListFooterComponent={
        gameSearch.isFetchingNextPage ? (
          <ActivityIndicator color={colors.primary} style={styles.feedback} />
        ) : null
      }
      ListHeaderComponent={
        <View>
          <View style={styles.topBar}>
            <OnboardingProgress step={2} style={styles.progress} total={4} />
          </View>

          <View style={styles.intro}>
            <Text style={styles.title}>{t("Add your first game")}</Text>
            <Text style={styles.subtitle}>
              {t("Pick one now. You can build the rest of your backlog later.")}
            </Text>
          </View>

          {!query.trim() ? (
            <View style={styles.curatedSection}>
              <Text style={styles.sectionTitle}>
                {t("Popular starting points")}
              </Text>
              <View style={styles.curatedGrid}>
                {CURATED_GAMES.map((game) => (
                  <Link
                    asChild
                    href={{
                      pathname: "/(onboarding)/rating/[id]",
                      params: {
                        coverUrl: game.coverUrl,
                        id: String(game.id),
                        name: game.name,
                      },
                    }}
                    key={game.id}
                    onPress={handleChooseGame}
                  >
                    <Link.Trigger>
                      <Pressable
                        accessibilityLabel={t("View {{name}}", {
                          name: game.name,
                        })}
                        accessibilityRole="button"
                        style={{ width: curatedCoverWidth }}
                      >
                        <Link.AppleZoom>
                          <View
                            collapsable={false}
                            style={curatedCoverStyle}
                          >
                            <Image
                              cachePolicy="memory-disk"
                              contentFit="cover"
                              source={game.coverUrl}
                              style={StyleSheet.absoluteFill}
                            />
                          </View>
                        </Link.AppleZoom>
                        <Text numberOfLines={2} style={styles.curatedTitle}>
                          {game.name}
                        </Text>
                      </Pressable>
                    </Link.Trigger>
                  </Link>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      }
      onEndReached={() => {
        if (gameSearch.hasNextPage && !gameSearch.isFetchingNextPage) {
          void gameSearch.fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.6}
      renderItem={({ item, index }) => (
        <GameSearchResultRow
          actionLabel={t("Choose")}
          allowDetails
          coverHeight={coverHeight}
          coverWidth={coverWidth}
          detailsHref={{
            pathname: "/(onboarding)/rating/[id]",
            params: {
              coverUrl: item.coverUrl ?? "",
              id: String(item.id),
              name: item.name,
            },
          }}
          game={item}
          hideAction
          index={index}
          isSaving={false}
          onOpenDetails={handleChooseGame}
          status={null}
          total={gameSearch.results.length}
        />
      )}
      showsVerticalScrollIndicator={false}
    />
  );
}

function SearchFeedback({
  canSearch,
  error,
  isLoading,
}: {
  canSearch: boolean;
  error: string | null;
  isLoading: boolean;
}) {
  const { t } = useTranslation();
  if (isLoading) {
    return <ActivityIndicator color={colors.primary} style={styles.feedback} />;
  }

  if (error) return <Text style={styles.error}>{error}</Text>;

  return (
    <Text style={styles.feedbackText}>
      {canSearch ? t("No games found.") : t("Type at least two characters.")}
    </Text>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 80,
    paddingHorizontal: PAGE_PADDING,
  },
  curatedCover: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderCurve: "continuous",
    borderRadius: theme.radius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  curatedGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
  },
  curatedSection: {
    marginTop: theme.spacing.xl,
  },
  curatedTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: theme.spacing.sm,
  },
  error: {
    color: colors.danger,
    marginTop: theme.spacing.xl,
    textAlign: "center",
  },
  eyebrow: {
    color: colors.success,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2.2,
    marginBottom: theme.spacing.sm,
  },
  feedback: {
    marginTop: theme.spacing.xl,
  },
  feedbackText: {
    color: colors.textMuted,
    marginTop: theme.spacing.xl,
    textAlign: "center",
  },
  intro: {
    marginBottom: theme.spacing.lg,
    marginTop: 36,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: theme.size.lg + 2,
    fontWeight: "700",
    marginBottom: theme.spacing.md,
  },
  skipButton: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "rgba(18, 18, 18, 0.88)",
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    position: "absolute",
  },
  skipButtonText: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: theme.size.lg,
    fontWeight: "600",
    paddingHorizontal: theme.spacing.sm,
    textAlign: "center",
  },
  progress: {
    width: "58%",
  },
  topBar: {
    alignItems: "center",
  },
  title: {
    color: colors.text,
    fontSize: theme.size["3xl"],
    fontWeight: "800",
    textAlign: "center",
    marginBottom: theme.spacing.md,
  },
});
