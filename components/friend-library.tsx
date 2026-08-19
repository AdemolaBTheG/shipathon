import { LegendList } from "@legendapp/list";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { SymbolView } from "expo-symbols";
import type { ReactElement } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import { GameCoverPlaceholder } from "@/components/game-cover-placeholder";
import { colors, theme } from "@/constants/theme";
import type { FriendLibraryGame } from "@/services/sharing";

const COLUMN_GAP = 10;

type FriendLibraryProps = {
  friendName: string;
  games: FriendLibraryGame[];
  header: ReactElement;
  hasActiveFilter: boolean;
  hasSearchQuery: boolean;
  isLoading: boolean;
};

export function FriendLibrary({
  friendName,
  games,
  header,
  hasActiveFilter,
  hasSearchQuery,
  isLoading,
}: FriendLibraryProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const coverWidth = Math.floor(
    (width - theme.spacing.lg * 2 - COLUMN_GAP * 2) / 3,
  );
  const coverHeight = Math.round(coverWidth * 1.5);

  return (
    <LegendList
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      data={games}
      extraData={coverWidth}
      keyExtractor={(game) => String(game.igdbId)}
      ListEmptyComponent={
        <View style={styles.feedback}>
          {isLoading ? (
            <ActivityIndicator color={colors.primary} size="large" />
          ) : (
            <>
              <SymbolView
                name={
                  hasSearchQuery || hasActiveFilter
                    ? "line.3.horizontal.decrease.circle"
                    : "rectangle.stack"
                }
                size={44}
                tintColor={colors.textMuted}
              />
              <Text style={styles.emptyTitle}>
                {hasSearchQuery || hasActiveFilter
                  ? t("No matching games")
                  : t("Nothing shared yet")}
              </Text>
              <Text style={styles.emptyCopy}>
                {hasSearchQuery || hasActiveFilter
                  ? hasSearchQuery
                    ? t("Try searching with a different title.")
                    : t("Try another filter to see more of this library.")
                  : t("{{name}} has not made any games visible.", { name: friendName })}
              </Text>
            </>
          )}
        </View>
      }
      ListHeaderComponent={
        <View style={styles.header}>{header}</View>
      }
      numColumns={3}
      renderItem={({ item }) => (
        <LibraryGame
          coverHeight={coverHeight}
          coverWidth={coverWidth}
          game={item}
        />
      )}
      style={styles.screen}
    />
  );
}

function LibraryGame({
  coverHeight,
  coverWidth,
  game,
}: {
  coverHeight: number;
  coverWidth: number;
  game: FriendLibraryGame;
}) {
  const coverStyle = StyleSheet.flatten([
    styles.cover,
    { height: coverHeight, width: coverWidth },
  ]);

  return (
    <Link
      asChild
      href={{ pathname: "/game/[id]", params: { id: String(game.igdbId) } }}
    >
      <Pressable
        accessibilityLabel={game.name}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.game,
          { width: coverWidth },
          pressed && styles.gamePressed,
        ]}
      >
        <Link.AppleZoom>
          <View collapsable={false} style={coverStyle}>
            {game.coverUrl ? (
              <Image
                contentFit="cover"
                source={game.coverUrl}
                style={StyleSheet.absoluteFill}
                transition={180}
              />
            ) : (
              <GameCoverPlaceholder
                gameName={game.name}
                style={StyleSheet.absoluteFill}
              />
            )}
          </View>
        </Link.AppleZoom>
        <Text numberOfLines={2} style={styles.gameTitle}>
          {game.name}
        </Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  screen: {
    experimental_backgroundImage:
      "radial-gradient(circle at 50% 6%, rgba(83, 102, 102, 0.46) 0%, rgba(31, 42, 42, 0.22) 30%, #121212 62%)",
  },
  content: {
    flexGrow: 1,
    paddingBottom: 120,
    paddingHorizontal: theme.spacing.lg,
  },
  row: {
    gap: COLUMN_GAP,
  },
  header: {
    marginHorizontal: -theme.spacing.lg,
  },
  game: {
    paddingBottom: theme.spacing.lg,
  },
  gamePressed: {
    opacity: 0.72,
  },
  cover: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderCurve: "continuous",
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  gameTitle: {
    color: colors.text,
    fontSize: theme.size.sm,
    fontWeight: "600",
    lineHeight: 16,
    marginTop: theme.spacing.sm,
  },
  feedback: {
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: 96,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: theme.size.xl,
    fontWeight: "700",
    paddingTop: theme.spacing.sm,
  },
  emptyCopy: {
    color: colors.textMuted,
    fontSize: theme.size.md,
    textAlign: "center",
  },
});
