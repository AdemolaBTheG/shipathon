import { Image } from "expo-image";
import { Link } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import { Text } from "@/components/Themed";
import { useTranslation } from "react-i18next";
import { GameCoverPlaceholder } from "@/components/game-cover-placeholder";
import { HomeRailHeading } from "@/components/home-rail-heading";
import { colors, theme } from "@/constants/theme";
import { useFriendsPlayingGames } from "@/hooks/use-friends-playing-games";
import { getHomeRailCoverMetrics } from "@/lib/home-rail-layout";
import { getIgdbImageUrl } from "@/lib/igdb-image";
import type {
  HomeFriendActivity,
  HomeFriendPlayingGame,
} from "@/services/sharing";

const AVATAR_SIZE = 28;
const AVATAR_OVERLAP = 8;

export function FriendsPlayingRail() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const { games, isPending } = useFriendsPlayingGames({ limit: 12 });
  const { height: coverHeight, width: cardWidth } =
    getHomeRailCoverMetrics(width);

  if (isPending) {
    return (
      <View style={styles.section}>
        <HomeRailHeading
          feed="friends-playing"
          subtitle={t("Games active in your circle")}
          title={t("Friends are playing")}
        />
        <ActivityIndicator color={colors.textMuted} style={styles.loader} />
      </View>
    );
  }

  if (!games.length) return null;

  return (
    <View style={styles.section}>
      <HomeRailHeading
        feed="friends-playing"
        subtitle={t("Games active in your circle")}
        title={t("Friends are playing")}
      />

      <FlatList
        contentContainerStyle={styles.railContent}
        data={games}
        horizontal
        ItemSeparatorComponent={RailSeparator}
        keyExtractor={(game) => String(game.gameId)}
        renderItem={({ item }) => (
          <FriendGameCard
            cardWidth={cardWidth}
            coverHeight={coverHeight}
            game={item}
          />
        )}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
}

function RailSeparator() {
  return <View style={styles.separator} />;
}

function FriendGameCard({
  cardWidth,
  coverHeight,
  game,
}: {
  cardWidth: number;
  coverHeight: number;
  game: HomeFriendPlayingGame;
}) {
  const coverStyle = StyleSheet.flatten([
    styles.cover,
    { height: coverHeight, width: cardWidth },
  ]);
  const friends = game.friends.slice(0, 3);
  const relationship = getRelationshipCopy(game.friends);

  return (
    <Link
      asChild
      href={{ pathname: "/game/[id]", params: { id: String(game.gameId) } }}
    >
      <Link.Trigger>
        <Pressable
          accessibilityLabel={`Open ${game.gameName}`}
          style={{ width: cardWidth }}
        >
          <View style={styles.coverBoundary}>
            <Link.AppleZoom>
              <View collapsable={false} style={coverStyle}>
                {game.coverUrl ? (
                  <Image
                    cachePolicy="memory-disk"
                    contentFit="cover"
                    source={getIgdbImageUrl(game.coverUrl, "cover_big_2x")}
                    style={StyleSheet.absoluteFill}
                    transition={180}
                  />
                ) : (
                  <GameCoverPlaceholder
                    gameName={game.gameName}
                    style={StyleSheet.absoluteFill}
                  />
                )}
              </View>
            </Link.AppleZoom>
            <FriendAvatarStack friends={friends} />
          </View>

          <Text numberOfLines={2} style={styles.gameTitle}>
            {game.gameName}
          </Text>
          <Text numberOfLines={2} style={styles.relationship}>
            {relationship}
          </Text>
        </Pressable>
      </Link.Trigger>
    </Link>
  );
}

function FriendAvatarStack({ friends }: { friends: HomeFriendActivity[] }) {
  return (
    <View pointerEvents="none" style={styles.avatarStack}>
      {friends.map((friend, index) => (
        <View
          key={friend.friendId}
          style={[
            styles.avatar,
            index > 0 ? { marginLeft: -AVATAR_OVERLAP } : null,
            { zIndex: friends.length - index },
          ]}
        >
          {friend.avatarUrl ? (
            <Image
              cachePolicy="memory-disk"
              contentFit="cover"
              source={friend.avatarUrl}
              style={StyleSheet.absoluteFill}
              transition={120}
            />
          ) : (
            <Text style={styles.avatarInitial}>
              {friend.displayName.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

function getRelationshipCopy(friends: HomeFriendActivity[]) {
  if (friends.length !== 1) {
    return `${friends.length} friends tracked this`;
  }

  const [friend] = friends;
  const progress =
    friend.progress === null ? "" : ` · ${Math.round(friend.progress)}%`;

  return `${friend.displayName} is playing${progress}`;
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.background,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    height: AVATAR_SIZE,
    justifyContent: "center",
    overflow: "hidden",
    width: AVATAR_SIZE,
  },
  avatarInitial: {
    color: colors.text,
    fontSize: theme.size.sm,
    fontWeight: "800",
  },
  avatarStack: {
    bottom: -(AVATAR_SIZE / 2),
    flexDirection: "row",
    left: theme.spacing.sm,
    position: "absolute",
  },
  cover: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderCurve: "continuous",
    borderRadius: theme.radius.md + 2,
    borderWidth: 0.5,
    overflow: "hidden",
  },
  coverBoundary: {
    position: "relative",
  },
  gameTitle: {
    color: colors.text,
    fontSize: theme.size.md,
    fontWeight: "700",
    marginTop: AVATAR_SIZE / 2 + theme.spacing.sm,
  },
  railContent: {
    paddingHorizontal: theme.spacing.md,
  },
  loader: {
    height: 120,
  },
  relationship: {
    color: colors.textMuted,
    fontSize: theme.size.sm,
    lineHeight: 17,
    marginTop: theme.spacing.xs,
  },
  section: {
    marginHorizontal: -theme.spacing.md,
    marginTop: theme.spacing.xl,
  },
  separator: {
    width: theme.spacing.md,
  },
});
