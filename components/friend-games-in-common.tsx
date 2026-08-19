import { Image } from "expo-image";
import { Link } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { GameCoverPlaceholder } from "@/components/game-cover-placeholder";
import { ProBlurGate } from "@/components/pro-blur-gate";
import { statusOptions } from "@/components/status-options";
import { colors, theme } from "@/constants/theme";
import { formatRating } from "@/lib/rating";
import type {
  FriendCommonGame,
  FriendCommonGameState,
} from "@/services/sharing";

type FriendGamesInCommonProps = {
  currentlyPlayingIds: number[];
  friendId: string;
  friendName: string;
  games: FriendCommonGame[];
  isLocked?: boolean;
  isUnlocking?: boolean;
  onUnlock?: () => void;
};

function getFirstName(displayName: string, fallback: string) {
  return displayName.trim().split(/\s+/)[0] || fallback;
}

function getStateCopy(
  state: FriendCommonGameState,
  t: ReturnType<typeof useTranslation>["t"],
) {
  const status = statusOptions.find((option) => option.value === state.status);
  const percentage = Math.round(
    (state.progressCurrent / Math.max(1, state.progressTotal)) * 100,
  );

  return {
    label: status ? t(status.label) : t("Tracked"),
    supporting: state.status === "playing" ? ` · ${percentage}%` : "",
  };
}

function Rating({ rating }: { rating: number | null }) {
  return (
    <Text style={styles.rating}>
      {rating === null ? "" : `★${formatRating(rating)}`}
    </Text>
  );
}

function GameState({ state }: { state: FriendCommonGameState }) {
  const { t } = useTranslation();
  const copy = getStateCopy(state, t);

  return (
    <View style={styles.stateGroup}>
      {state.status === "completed" ? (
        <SymbolView
          name={{ android: "check", ios: "checkmark" }}
          size={11}
          tintColor={colors.success}
        />
      ) : null}
      <Text numberOfLines={1} style={styles.state}>
        {copy.label}
        <Text style={styles.supporting}>{copy.supporting}</Text>
      </Text>
    </View>
  );
}

export function FriendCommonGameRow({
  friendName,
  game,
  showSeparator,
}: {
  friendName: string;
  game: FriendCommonGame;
  showSeparator: boolean;
}) {
  const { t } = useTranslation();
  const firstName = getFirstName(friendName, t("Friend"));
  const friendLabel = firstName.toLocaleUpperCase();
  const yourState = getStateCopy(game.you, t);
  const friendState = getStateCopy(game.friend, t);

  return (
    <Link
      asChild
      href={{ pathname: "/game/[id]", params: { id: String(game.igdbId) } }}
    >
      <Pressable
        accessibilityLabel={t("Compare {{game}}. You: {{yourStatus}}. {{friend}}: {{friendStatus}}.", {
          friend: firstName,
          friendStatus: friendState.label,
          game: game.name,
          yourStatus: yourState.label,
        })}
        accessibilityRole="button"
        style={styles.row}
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

        <View style={styles.details}>
          <View style={styles.titleRow}>
            <Text numberOfLines={1} style={styles.gameTitle}>
              {game.name}
            </Text>
            <SymbolView
              name={{ android: "chevron_right", ios: "chevron.right" }}
              size={14}
              tintColor={colors.textMuted}
            />
          </View>

          <View style={styles.comparisonLine}>
            <Text style={styles.identityLabel}>{t("YOU")}</Text>
            <GameState state={game.you} />
            <Rating rating={game.you.rating} />
          </View>

          <View style={styles.comparisonLine}>
            <Text numberOfLines={1} style={styles.identityLabel}>
              {friendLabel}
            </Text>
            <GameState state={game.friend} />
            <Rating rating={game.friend.rating} />
          </View>
        </View>

        {showSeparator ? <View style={styles.separator} /> : null}
      </Pressable>
    </Link>
  );
}

export function FriendGamesInCommon({
  currentlyPlayingIds,
  friendId,
  friendName,
  games,
  isLocked = false,
  isUnlocking = false,
  onUnlock,
}: FriendGamesInCommonProps) {
  const { t } = useTranslation();
  if (games.length === 0) return null;

  const playingIds = new Set(currentlyPlayingIds);
  const previewGames = [
    ...games.filter((game) => !playingIds.has(game.igdbId)),
    ...games.filter((game) => playingIds.has(game.igdbId)),
  ].slice(0, 3);
  const freePreview = isLocked ? previewGames.slice(0, 1) : previewGames;
  const lockedPreview = isLocked ? previewGames.slice(1) : [];
  const heading = (
    <Pressable
      accessibilityLabel={
        isLocked ? t("Unlock all games in common") : t("Show all games in common")
      }
      accessibilityRole="button"
      onPress={isLocked ? onUnlock : undefined}
      style={styles.headingRow}
    >
      <Text style={styles.heading}>{t("Games in common")}</Text>
      <View style={styles.seeAll}>
        <SymbolView
          name={isLocked ? "lock.fill" : "chevron.right"}
          size={isLocked ? 15 : 18}
          tintColor={isLocked ? colors.success : colors.textMuted}
        />
      </View>
    </Pressable>
  );

  return (
    <View style={styles.section}>
      {isLocked ? (
        heading
      ) : (
        <Link
          asChild
          href={{ pathname: "/friend/[id]/common", params: { id: friendId } }}
        >
          {heading}
        </Link>
      )}

      <View>
        {freePreview.map((game, index) => (
          <FriendCommonGameRow
            friendName={friendName}
            game={game}
            key={game.igdbId}
            showSeparator={!isLocked && index < freePreview.length - 1}
          />
        ))}
        {lockedPreview.length > 0 && onUnlock ? (
          <ProBlurGate
            isBusy={isUnlocking}
            message={t("See every shared game, rating, status, and progress comparison.")}
            onUnlock={onUnlock}
            title={t("Unlock {{count}} shared games", { count: games.length })}
          >
            {lockedPreview.map((game, index) => (
              <FriendCommonGameRow
                friendName={friendName}
                game={game}
                key={game.igdbId}
                showSeparator={index < lockedPreview.length - 1}
              />
            ))}
          </ProBlurGate>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingTop: theme.spacing.xl,
  },
  headingRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
  heading: {
    color: colors.text,
    fontSize: theme.size.lg + 2,
    fontWeight: "600",
  },
  seeAll: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.xs,
  },
  seeAllText: {
    color: colors.textMuted,
    fontSize: theme.size.md,
    fontWeight: "600",
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    position: "relative",
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
  details: {
    flex: 1,
    gap: 7,
    minWidth: 0,
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  gameTitle: {
    color: colors.text,
    flex: 1,
    fontSize: theme.size.md,
    fontWeight: "700",
  },
  comparisonLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  identityLabel: {
    color: colors.textMuted,
    fontSize: theme.spacing.sm + 2,
    fontWeight: "800",
  },
  state: {
    color: colors.text,
    flex: 1,
    fontSize: theme.size.sm,
    fontWeight: "600",
  },
  stateGroup: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: theme.spacing.xs,
    minWidth: 0,
  },
  supporting: {
    color: colors.textMuted,
    fontWeight: "500",
  },
  rating: {
    color: colors.success,
    fontSize: theme.size.sm,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
    textAlign: "right",
    width: 32,
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
