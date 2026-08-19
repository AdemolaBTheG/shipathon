import { Text } from "@/components/Themed";
import { colors, theme } from "@/constants/theme";
import { withPreviewBacklog } from "@/constants/backlog-preview";
import { getBacklog } from "@/db/repository";
import type { BacklogStatus } from "@/db/schema";
import { LegendList } from "@legendapp/list";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { useIsFocused } from "expo-router/react-navigation";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from "react-native-reanimated";
import type { TranslationKey } from "@/localization/resources";

type BacklogGame = Awaited<ReturnType<typeof getBacklog>>[number];

type StatusCard = {
  accent: string;
  icon: NonNullable<SymbolViewProps["name"]>;
  label: TranslationKey;
  status: BacklogStatus;
};

const statusCards: StatusCard[] = [
  {
    accent: colors.primary,
    icon: { android: "bookmark", ios: "bookmark.fill" },
    label: "Want to play",
    status: "want-to-play",
  },
  {
    accent: "#A8E986",
    icon: { android: "check_circle", ios: "checkmark.circle.fill" },
    label: "Completed",
    status: "completed",
  },
  {
    accent: colors.warning,
    icon: { android: "archive", ios: "archivebox.fill" },
    label: "Shelved",
    status: "shelved",
  },
  {
    accent: colors.danger,
    icon: { android: "cancel", ios: "xmark.circle.fill" },
    label: "Abandoned",
    status: "abandoned",
  },
];

const statusRows = [statusCards.slice(0, 2), statusCards.slice(2, 4)];

export default function BacklogScreen() {
  const [games, setGames] = useState<BacklogGame[]>([]);
  const isFocused = useIsFocused();
  const { width } = useWindowDimensions();
  const horizontalPadding = 20;
  const cardGap = 12;
  const cardWidth = (width - horizontalPadding * 2 - cardGap) / 2;
  const playingGames = games.filter(
    (game) => game.backlog.status === "playing",
  );

  useEffect(() => {
    if (!isFocused) return;

    let active = true;

    void getBacklog().then((items) => {
      if (active) setGames(withPreviewBacklog(items));
    });

    return () => {
      active = false;
    };
  }, [isFocused]);

  return (
    <LegendList
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      data={statusRows}
      extraData={games}
      keyExtractor={(row) => row.map((card) => card.status).join("-")}
      ListHeaderComponent={
        <PlayingNowSection games={playingGames} screenWidth={width} />
      }
      style={styles.container}
      renderItem={({ item: row }) => (
        <View style={styles.row}>
          {row.map((card) => {
            const statusGames = games.filter(
              (game) => game.backlog.status === card.status,
            );

            return (
              <StatusCardView
                key={card.status}
                card={card}
                count={statusGames.length}
                coverUrl={statusGames[0]?.coverUrl}
                width={cardWidth}
              />
            );
          })}
        </View>
      )}
    />
  );
}

function PlayingNowSection({
  games,
  screenWidth,
}: {
  games: BacklogGame[];
  screenWidth: number;
}) {
  const { t } = useTranslation();
  const scrollX = useSharedValue(0);
  const snapInterval = screenWidth - 28;
  const handleScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  return (
    <View style={styles.listHeader}>
      <Link
        href={{ pathname: "/status/[status]", params: { status: "playing" } }}
        asChild
      >
        <Pressable
          accessibilityLabel={t("View all games currently playing")}
          accessibilityRole="button"
          style={styles.sectionTitleRow}
        >
          <Text style={styles.sectionTitle}>{t("Playing Now")}</Text>
          <SymbolView
            name={{ android: "chevron_right", ios: "chevron.right" }}
            size={20}
            tintColor={colors.textMuted}
          />
        </Pressable>
      </Link>

      {games.length > 0 ? (
        <Animated.FlatList<BacklogGame>
          contentContainerStyle={styles.playingListContent}
          data={games}
          decelerationRate="fast"
          horizontal
          initialNumToRender={2}
          keyExtractor={(game) => String(game.igdbId)}
          maxToRenderPerBatch={2}
          onScroll={handleScroll}
          renderItem={({ index, item: game }) => (
            <PlayingGameCard
              game={game}
              index={index}
              scrollX={scrollX}
              snapInterval={snapInterval}
              width={screenWidth - 40}
            />
          )}
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator={false}
          snapToInterval={snapInterval}
          style={styles.playingList}
          windowSize={3}
        />
      ) : (
        <View style={[styles.playingEmpty, { width: screenWidth - 40 }]}>
          <View style={styles.playingEmptyCover} />
          <View style={styles.playingEmptyCopy}>
            <Text style={styles.playingEmptyTitle}>{t("Nothing in progress")}</Text>
            <Text style={styles.playingEmptyText}>
              {t("Mark a game as Playing to keep it close.")}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.libraryTitleRow}>
        <Text style={styles.sectionTitle}>{t("Library")}</Text>
        <SymbolView
          name={{ android: "expand_more", ios: "chevron.down" }}
          size={18}
          tintColor={colors.textMuted}
        />
      </View>
    </View>
  );
}

function PlayingGameCard({
  game,
  index,
  scrollX,
  snapInterval,
  width,
}: {
  game: BacklogGame;
  index: number;
  scrollX: SharedValue<number>;
  snapInterval: number;
  width: number;
}) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const total = Math.max(1, game.backlog.progressTotal);
  const current = Math.min(total, Math.max(0, game.backlog.progressCurrent));
  const progress = current / total;
  const detail = game.genres.slice(0, 2).join(" · ") || t("Currently playing");
  const coverStyle = StyleSheet.flatten([
    styles.playingCover,
    !game.coverUrl && styles.playingCoverPlaceholder,
  ]);
  const focusStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return { opacity: 1, transform: [{ scale: 1 }] };
    }

    const center = index * snapInterval;
    const inputRange = [center - snapInterval, center, center + snapInterval];

    return {
      opacity: interpolate(
        scrollX.value,
        inputRange,
        [0.72, 1, 0.72],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          scale: interpolate(
            scrollX.value,
            inputRange,
            [0.97, 1, 0.97],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  }, [index, reduceMotion, snapInterval]);

  return (
    <Animated.View style={[styles.playingCard, { width }, focusStyle]}>
      {game.coverUrl ? (
        <Image
          blurRadius={100}
          contentFit="cover"
          source={game.coverUrl}
          style={styles.backdrop}
        />
      ) : null}
      <View style={styles.tint} />

      <Link
        href={{ pathname: "/game/[id]", params: { id: String(game.igdbId) } }}
        asChild
      >
        <Pressable
          accessibilityLabel={t("Open {{name}}", { name: game.name })}
          accessibilityRole="button"
          style={styles.playingMain}
        >
          <Link.AppleZoom>
            {game.coverUrl ? (
              <Image
                contentFit="cover"
                source={game.coverUrl}
                style={coverStyle}
                transition={180}
              />
            ) : (
              <View style={coverStyle} />
            )}
          </Link.AppleZoom>

          <View style={styles.playingCopy}>
            <Text numberOfLines={2} style={styles.playingTitle}>
              {game.name}
            </Text>
            <Text numberOfLines={1} style={styles.playingDetail}>
              {detail}
            </Text>
            <View style={styles.progressRow}>
              <View style={styles.progressTrack}>
                <View
                  style={[styles.progressFill, { width: `${progress * 100}%` }]}
                />
              </View>
              <Text style={styles.progressText}>
                {t("{{current}} of {{total}}", {
                  current: String(current),
                  total: String(total),
                })}
              </Text>
            </View>
          </View>
        </Pressable>
      </Link>

      <Link
        href={{ pathname: "/progress", params: { id: game.igdbId } }}
        asChild
      >
        <Pressable
          accessibilityLabel={t("Update progress for {{name}}", {
            name: game.name,
          })}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.resumeButton,
            pressed && styles.resumeButtonPressed,
          ]}
        >
          <SymbolView
            name={{ android: "play_arrow", ios: "play.fill" }}
            size={22}
            tintColor={"#fff"}
          />
        </Pressable>
      </Link>
    </Animated.View>
  );
}

function StatusCardView({
  card,
  count,
  coverUrl,
  width,
}: {
  card: StatusCard;
  count: number;
  coverUrl: string | null | undefined;
  width: number;
}) {
  const { t } = useTranslation();
  const coverWidth = width * 0.38;
  const coverHeight = coverWidth * (4 / 3);

  return (
    <Link
      href={{
        pathname: "/status/[status]",
        params: { status: card.status },
      }}
      asChild
    >
      <Pressable
        accessibilityLabel={`${t(card.label)}, ${t(count === 1 ? "{{count}} game" : "{{count}} games", { count })}`}
        accessibilityRole="button"
        style={{ height: width * 1.12, width }}
      >
        <Link.AppleZoom>
          <View
            style={StyleSheet.flatten([
              styles.card,
              {
                backgroundColor: colors.surface,
                height: width * 1.12,
                width,
              },
            ])}
          >
            {coverUrl ? (
              <Image
                blurRadius={100}
                contentFit="cover"
                source={coverUrl}
                style={styles.backdrop}
              />
            ) : null}
            <View style={styles.tint} />

            <View style={styles.iconBadge}>
              <SymbolView
                name={card.icon}
                size={24}
                tintColor="rgba(255, 255, 255, 0.2)"
              />
            </View>

            {coverUrl ? (
              <Image
                contentFit="cover"
                source={coverUrl}
                style={[
                  styles.cover,
                  {
                    height: coverHeight,
                    right: 17,
                    top: 20,
                    width: coverWidth,
                  },
                ]}
                transition={180}
              />
            ) : (
              <View
                style={[
                  styles.coverPlaceholder,
                  {
                    height: coverHeight,
                    right: 17,
                    top: 20,
                    width: coverWidth,
                  },
                ]}
              />
            )}

            <View style={styles.copy}>
              <Text numberOfLines={2} style={styles.cardTitle}>
                {t(card.label)}
              </Text>
              <Text style={styles.count}>
                {t(count === 1 ? "{{count}} game" : "{{count}} games", {
                  count,
                })}
              </Text>
            </View>

            <SymbolView
              name={{ android: "chevron_right", ios: "chevron.right" }}
              size={15}
              tintColor={colors.textMuted}
              style={styles.chevron}
            />
          </View>
        </Link.AppleZoom>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
  },
  content: {
    gap: 12,
    paddingBottom: 32,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  listHeader: {
    gap: 14,
    paddingBottom: 8,
  },
  sectionTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: colors.text,
    fontSize: theme.size.xl,
    fontWeight: "600",
  },
  playingList: {
    marginHorizontal: -20,
  },
  playingListContent: {
    gap: 12,
    paddingHorizontal: 20,
  },
  playingCard: {
    backgroundColor: colors.surface,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderCurve: "continuous",
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 12,
    overflow: "hidden",
    padding: 16,
  },
  playingMain: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 16,
  },
  playingCover: {
    borderCurve: "continuous",
    borderRadius: 14,
    height: 104,
    width: 78,
  },
  playingCoverPlaceholder: {
    borderColor: "rgba(255, 255, 255, 0.24)",
    borderStyle: "dashed",
    borderWidth: 1.5,
  },
  playingCopy: {
    flex: 1,
    gap: 6,
  },
  playingTitle: {
    color: colors.text,
    fontSize: theme.size.md,
    fontWeight: "600",
  },
  playingDetail: {
    color: colors.textMuted,
    fontSize: theme.size.sm,
    fontWeight: "500",
  },
  progressRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingTop: 8,
  },
  progressTrack: {
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderRadius: 999,
    flex: 1,
    height: 5,
    overflow: "hidden",
  },
  progressFill: {
    backgroundColor: "#fff",
    borderRadius: 999,
    height: "100%",
  },
  progressText: {
    color: colors.textMuted,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
  },
  resumeButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 999,
    height: 50,
    justifyContent: "center",
    width: 50,
  },
  resumeButtonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }],
  },
  playingEmpty: {
    alignItems: "center",
    borderColor: "rgba(255, 255, 255, 0.14)",
    borderCurve: "continuous",
    borderRadius: 26,
    borderStyle: "dashed",
    borderWidth: 1.5,
    flexDirection: "row",
    gap: 16,
    minHeight: 150,
    padding: 16,
  },
  playingEmptyCover: {
    borderColor: "rgba(255, 255, 255, 0.2)",
    borderCurve: "continuous",
    borderRadius: 13,
    borderStyle: "dashed",
    borderWidth: 1.5,
    height: 112,
    width: 84,
  },
  playingEmptyCopy: {
    flex: 1,
    gap: 5,
  },
  playingEmptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
  },
  playingEmptyText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 19,
  },
  libraryTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 16,
  },
  sectionHeading: {
    gap: 6,
    paddingBottom: 18,
    paddingTop: 8,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.3,
  },
  heading: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  loader: {
    paddingBottom: 12,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  card: {
    borderColor: "rgba(255, 255, 255, 0.2)",
    borderCurve: "continuous",
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    boxShadow: "0 10px 24px rgba(0, 0, 0, 0.24)",
    overflow: "hidden",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    opacity: 1,
    transform: [{ scale: 1.3 }],
  },
  tint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.64)",
  },
  iconBadge: {
    alignItems: "center",
    borderCurve: "continuous",
    borderRadius: 12,
    height: 34,
    justifyContent: "center",
    left: 16,
    position: "absolute",
    top: 16,
    width: 34,
  },
  cover: {
    borderColor: "rgba(255, 255, 255, 0.15)",
    borderCurve: "continuous",
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    boxShadow: "0 10px 20px rgba(0, 0, 0, 0.38)",
    position: "absolute",
  },
  coverPlaceholder: {
    borderColor: "rgba(255, 255, 255, 0.24)",
    borderCurve: "continuous",
    borderRadius: 15,
    borderStyle: "dashed",
    borderWidth: 1.5,
    position: "absolute",
  },
  copy: {
    bottom: 17,
    gap: 5,
    left: 17,
    position: "absolute",
    right: 38,
  },
  chevron: {
    bottom: 19,
    position: "absolute",
    right: 16,
  },
  cardTitle: {
    color: colors.text,
    fontSize: theme.size.lg,
    fontWeight: "700",
  },
  count: {
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    fontWeight: "500",
    color: colors.textMuted,
  },
});
