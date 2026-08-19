import { Image } from "expo-image";
import { Link, type Href } from "expo-router";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { PressableScale } from "pressto";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/Themed";
import { GameCoverPlaceholder } from "@/components/game-cover-placeholder";
import { PlatformIcon } from "@/components/platform-icon";
import { statusOptions } from "@/components/status-options";
import { colors, theme } from "@/constants/theme";
import type { BacklogStatus } from "@/db/schema";
import type { GameSearchResult } from "@/lib/igdb";
import { getIgdbImageUrl } from "@/lib/igdb-image";

type SymbolName = NonNullable<SymbolViewProps["name"]>;

const addSymbol: SymbolName = {
  android: "add",
  ios: "plus",
};

type GameSearchResultRowProps = {
  actionLabel?: string;
  allowDetails?: boolean;
  coverHeight: number;
  coverWidth: number;
  detailsHref?: Href;
  game: GameSearchResult;
  hideAction?: boolean;
  index: number;
  isSaving: boolean;
  onAdd?: (game: GameSearchResult) => void;
  onOpenDetails?: () => void;
  status: BacklogStatus | null;
  total: number;
};

export function GameSearchResultRow({
  actionLabel,
  allowDetails = true,
  coverHeight,
  coverWidth,
  detailsHref,
  game,
  hideAction = false,
  index,
  isSaving,
  onAdd,
  onOpenDetails,
  status,
  total,
}: GameSearchResultRowProps) {
  const { t } = useTranslation();
  const releaseYear = game.releaseDate?.slice(0, 4);
  const statusOption = statusOptions.find((option) => option.value === status);
  const visiblePlatforms = game.platforms.slice(0, 2);
  const remainingPlatformCount =
    game.platforms.length - visiblePlatforms.length;
  const coverStyle = StyleSheet.flatten([
    styles.cover,
    { height: coverHeight, width: coverWidth },
  ]);

  const coverUrl = getIgdbImageUrl(game.coverUrl, "cover_big_2x");
  const cover = coverUrl ? (
    <Image contentFit="cover" source={coverUrl} style={coverStyle} />
  ) : (
    <GameCoverPlaceholder gameName={game.name} style={coverStyle} />
  );
  const resultMain = (
    <Pressable
      onPress={allowDetails ? undefined : () => onAdd?.(game)}
      style={styles.resultMain}
    >
      {allowDetails ? <Link.AppleZoom>{cover}</Link.AppleZoom> : cover}
      <View style={styles.resultCopy}>
        <Text numberOfLines={2} style={styles.resultTitle}>
          {game.name}
        </Text>
        <View style={styles.metadataRow}>
          {releaseYear ? (
            <Text style={styles.metadata}>{releaseYear}</Text>
          ) : null}
          <View style={styles.platforms}>
            {visiblePlatforms.map((platform) => (
              <PlatformIcon key={platform} platform={platform} />
            ))}
            {remainingPlatformCount > 0 ? (
              <Text style={styles.platformOverflow}>
                +{remainingPlatformCount}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View
      style={[
        styles.resultCard,
        index === 0 && styles.resultCardFirst,
        index === total - 1 && styles.resultCardLast,
      ]}
    >
      {allowDetails ? (
        <Link
          asChild
          href={
            detailsHref ?? {
              pathname: "/game/[id]",
              params: { id: String(game.id) },
            }
          }
          onPress={onOpenDetails}
        >
          <Link.Trigger>{resultMain}</Link.Trigger>
        </Link>
      ) : (
        resultMain
      )}

      {statusOption ? (
        <SymbolView
          accessibilityLabel={`${game.name}: ${t(statusOption.label)}`}
          name={statusOption.icon}
          size={24}
          tintColor={colors.primary}
        />
      ) : hideAction ? null : (
        <PressableScale
          accessibilityLabel={t("Add {{name}}", { name: game.name })}
          accessibilityRole="button"
          accessibilityState={{ busy: isSaving }}
          disabled={isSaving}
          onPress={() => onAdd?.(game)}
          style={styles.addButton}
        >
          {isSaving ? (
            <ActivityIndicator color={colors.surface} size="small" />
          ) : (
            <>
              <SymbolView
                name={addSymbol}
                size={20}
                weight={"semibold"}
                tintColor={colors.surface}
              />
              <Text style={styles.addButtonText}>{actionLabel ?? t("Add")}</Text>
            </>
          )}
        </PressableScale>
      )}

      {index < total - 1 ? (
        <View
          style={[styles.resultSeparator, { left: 12 + coverWidth, right: 12 }]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  addButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderCurve: "continuous",
    borderRadius: theme.radius.sm + 4,
    flexDirection: "row",
    flexShrink: 0,
    gap: theme.spacing.xs,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  addButtonText: {
    color: colors.surface,
    fontSize: theme.spacing.sm + 4,
    fontWeight: "500",
  },
  cover: {
    borderColor: colors.text,
    borderCurve: "continuous",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  metadata: {
    color: colors.textMuted,
    fontSize: theme.size.md,
  },
  metadataRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    overflow: "hidden",
  },
  platformOverflow: {
    color: colors.textMuted,
    fontSize: theme.size.sm,
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
  },
  platforms: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 1,
    gap: theme.spacing.sm,
    overflow: "hidden",
  },
  resultCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "rgba(255, 255, 255, 0.2)",
    borderCurve: "continuous",
    borderRadius: 0,
    flexDirection: "row",
    overflow: "hidden",
    padding: 12,
    position: "relative",
  },
  resultCardFirst: {
    borderCurve: "continuous",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  resultCardLast: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderCurve: "continuous",
  },
  resultCopy: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
  },
  resultMain: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    minWidth: 0,
  },
  resultSeparator: {
    backgroundColor: colors.border,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    position: "absolute",
  },
  resultTitle: {
    color: colors.text,
    fontSize: theme.size.lg,
    fontWeight: "600",
  },
});
