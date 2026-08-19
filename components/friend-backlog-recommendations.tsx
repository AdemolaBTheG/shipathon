import { Image } from "expo-image";
import { Link } from "expo-router";
import { SymbolView } from "expo-symbols";
import { PressableScale } from "pressto";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { GameCoverPlaceholder } from "@/components/game-cover-placeholder";
import { statusOptions } from "@/components/status-options";
import { colors, theme } from "@/constants/theme";
import { formatRating } from "@/lib/rating";
import type { FriendLibraryGame } from "@/services/sharing";

type FriendBacklogRecommendationsProps = {
  friendName: string;
  games: FriendLibraryGame[];
  onAdd: (game: FriendLibraryGame) => void;
  savingGameId: number | null;
};

function getFirstName(displayName: string) {
  return displayName.trim().split(/\s+/)[0] || "Friend";
}

export function FriendBacklogRecommendations({
  friendName,
  games,
  onAdd,
  savingGameId,
}: FriendBacklogRecommendationsProps) {
  const { t } = useTranslation();
  if (games.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>
        {t("From {{name}}'s backlog", { name: getFirstName(friendName) })}
      </Text>
      <View>
        {games.map((game, index) => (
          <RecommendationRow
            game={game}
            isSaving={savingGameId === game.igdbId}
            key={game.igdbId}
            onAdd={() => onAdd(game)}
            showSeparator={index < games.length - 1}
          />
        ))}
      </View>
    </View>
  );
}

function RecommendationRow({
  game,
  isSaving,
  onAdd,
  showSeparator,
}: {
  game: FriendLibraryGame;
  isSaving: boolean;
  onAdd: () => void;
  showSeparator: boolean;
}) {
  const { t } = useTranslation();
  const status = statusOptions.find((option) => option.value === game.status);
  const metadata = [
    status ? t(status.label) : t("Tracked"),
    game.rating === null ? null : `★${formatRating(game.rating)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={styles.row}>
      <Link
        asChild
        href={{ pathname: "/game/[id]", params: { id: String(game.igdbId) } }}
      >
        <Pressable
          accessibilityLabel={t("Open {{name}}", { name: game.name })}
          accessibilityRole="button"
          style={styles.game}
        >
          <Link.AppleZoom>
            <View collapsable={false} style={styles.cover}>
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
          <View style={styles.copy}>
            <Text numberOfLines={2} style={styles.title}>
              {game.name}
            </Text>
            <Text numberOfLines={1} style={styles.metadata}>
              {metadata}
            </Text>
          </View>
        </Pressable>
      </Link>

      <PressableScale
        accessibilityLabel={t("Add {{name}} to your backlog", { name: game.name })}
        accessibilityRole="button"
        accessibilityState={{ busy: isSaving }}
        disabled={isSaving}
        onPress={onAdd}
        style={styles.addButton}
      >
        {isSaving ? (
          <ActivityIndicator color={colors.background} size="small" />
        ) : (
          <>
            <SymbolView name="plus" size={14} tintColor={colors.background} />
            <Text style={styles.addButtonText}>{t("Add")}</Text>
          </>
        )}
      </PressableScale>

      {showSeparator ? <View style={styles.separator} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingTop: theme.spacing.xl,
  },
  heading: {
    color: colors.text,
    fontSize: theme.size.lg + 2,
    fontWeight: "600",
    paddingBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    position: "relative",
  },
  game: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 12,
    minWidth: 0,
  },
  cover: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderCurve: "continuous",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    height: 108,
    overflow: "hidden",
    width: 72,
  },
  copy: {
    flex: 1,
    gap: 7,
    minWidth: 0,
  },
  title: {
    color: colors.text,
    fontSize: theme.size.md,
    fontWeight: "700",
  },
  metadata: {
    color: colors.textMuted,
    fontSize: theme.size.sm,
    fontWeight: "600",
  },
  addButton: {
    alignItems: "center",
    backgroundColor: colors.text,
    borderCurve: "continuous",
    borderRadius: theme.radius.pill,
    flexDirection: "row",
    gap: theme.spacing.xs,
    justifyContent: "center",
    minWidth: 70,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  addButtonText: {
    color: colors.background,
    fontSize: theme.size.sm,
    fontWeight: "700",
  },
  separator: {
    backgroundColor: colors.border,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    left: theme.spacing.lg + 72 + 12,
    position: "absolute",
    right: theme.spacing.lg,
  },
});
