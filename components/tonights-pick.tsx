import MaskedView from "@expo/ui/community/masked-view";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { SymbolView } from "expo-symbols";
import { PressableOpacity, PressableScale } from "pressto";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { Easing, LinearTransition } from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import { GameCoverPlaceholder } from "@/components/game-cover-placeholder";
import { colors, theme } from "@/constants/theme";
import { getIgdbImageUrl } from "@/lib/igdb-image";

const pickLayoutTransition = LinearTransition.duration(220).easing(
  Easing.out(Easing.cubic),
);

export type TonightPickGame = {
  coverUrl: string | null;
  genres: string[];
  igdbId: number;
  name: string;
  platforms: string[];
};

type TonightsPickProps = {
  backdropHeight: number;
  game: TonightPickGame | null;
  isLoading: boolean;
  isShuffleLocked: boolean;
  isStarting: boolean;
  heroHeight: number;
  mainStorySeconds: number | null;
  onAdd: () => void;
  onShuffle: () => void;
  onStart: () => void;
  topInset: number;
};

export function TonightsPick({
  backdropHeight,
  game,
  heroHeight,
  isLoading,
  isShuffleLocked,
  isStarting,
  mainStorySeconds,
  onAdd,
  onShuffle,
  onStart,
  topInset,
}: TonightsPickProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const coverWidth = Math.min(252, Math.max(220, width * 0.62));
  const coverHeight = Math.round(coverWidth * 1.5);
  const heroStyle = StyleSheet.flatten([
    styles.hero,
    { height: heroHeight, width },
  ]);
  const coverStyle = StyleSheet.flatten([
    styles.cover,
    { height: coverHeight, width: coverWidth },
  ]);
  if (isLoading) {
    return (
      <View style={[heroStyle, styles.loadingHero]}>
        <ActivityIndicator color={colors.success} size="large" />
      </View>
    );
  }

  if (!game) {
    return (
      <View style={[heroStyle, styles.emptyHero]}>
        <View style={styles.emptyIcon}>
          <SymbolView
            name={{ android: "library_add", ios: "rectangle.stack.badge.plus" }}
            size={34}
            tintColor={colors.success}
          />
        </View>
        <View style={styles.emptyCopy}>
          <Text style={styles.eyebrow}>{t("YOUR NEXT SAVE")}</Text>
          <Text style={styles.emptyTitle}>{t("Build your queue")}</Text>
          <Text style={styles.emptyDescription}>
            {t(
              "Save a game you want to play and it can become tonight's pick.",
            )}
          </Text>
        </View>
        <PressableScale
          accessibilityLabel={t("Add a game")}
          accessibilityRole="button"
          onPress={onAdd}
          style={styles.emptyButton}
        >
          <SymbolView
            name={{ android: "add", ios: "plus" }}
            size={16}
            tintColor={colors.background}
          />
          <Text style={styles.primaryButtonText}>{t("Add a game")}</Text>
        </PressableScale>
      </View>
    );
  }

  const platform = game.platforms[0];
  const genre = game.genres[0];
  const playtime = mainStorySeconds
    ? `~${Math.max(1, Math.round(mainStorySeconds / 3_600))}h`
    : null;
  const metadata = [platform, playtime ?? genre].filter(Boolean).join(" · ");
  const highQualityCoverUrl = getIgdbImageUrl(game.coverUrl, "cover_big_2x");

  return (
    <View style={heroStyle}>
      {game.coverUrl ? (
        <MaskedView
          maskElement={<View style={styles.backdropMask} />}
          style={[styles.backdrop, { height: backdropHeight }]}
        >
          <Image
            blurRadius={36}
            contentFit="cover"
            source={game.coverUrl}
            style={[StyleSheet.absoluteFill, styles.backdropImage]}
            transition={360}
          />
        </MaskedView>
      ) : null}

      <View style={[styles.heroContent, { paddingTop: topInset }]}>
        <Text style={styles.eyebrow}>{t("Tonight's Pick")}</Text>
        <Link
          asChild
          href={{ pathname: "/game/[id]", params: { id: String(game.igdbId) } }}
        >
          <Pressable
            accessibilityLabel={t("View {{name}}", { name: game.name })}
          >
            <Link.AppleZoom>
              <Animated.View
                collapsable={false}
                layout={pickLayoutTransition}
                style={coverStyle}
              >
                {highQualityCoverUrl ? (
                  <Image
                    cachePolicy="memory-disk"
                    contentFit="cover"
                    source={highQualityCoverUrl}
                    style={[StyleSheet.absoluteFill]}
                    transition={180}
                  />
                ) : (
                  <GameCoverPlaceholder
                    gameName={game.name}
                    style={StyleSheet.absoluteFill}
                  />
                )}
              </Animated.View>
            </Link.AppleZoom>
          </Pressable>
        </Link>

        <Animated.View layout={pickLayoutTransition} style={styles.copy}>
          <Animated.Text
            layout={pickLayoutTransition}
            numberOfLines={2}
            style={styles.title}
          >
            {game.name}
          </Animated.Text>
          {metadata ? (
            <Animated.Text
              layout={pickLayoutTransition}
              numberOfLines={1}
              style={styles.metadata}
            >
              {metadata}
            </Animated.Text>
          ) : null}

          <Animated.View layout={pickLayoutTransition} style={styles.actions}>
            <PressableScale
              accessibilityLabel={t("Start playing {{name}}", {
                name: game.name,
              })}
              accessibilityRole="button"
              accessibilityState={{ busy: isStarting }}
              disabled={isStarting}
              onPress={onStart}
              style={styles.primaryButton}
            >
              {isStarting ? (
                <ActivityIndicator color={colors.background} size="small" />
              ) : (
                <>
                  <SymbolView
                    name={{ android: "play_arrow", ios: "play.fill" }}
                    size={16}
                    tintColor={colors.background}
                  />
                  <Text numberOfLines={1} style={styles.primaryButtonText}>
                    {t("Start playing")}
                  </Text>
                </>
              )}
            </PressableScale>
            <PressableOpacity
              accessibilityHint={
                isShuffleLocked
                  ? t("Opens Joylogue Pro")
                  : t("Chooses another game from your backlog")
              }
              accessibilityLabel={
                isShuffleLocked
                  ? t("Unlock Tonight's Pick shuffle")
                  : t("Choose another game")
              }
              accessibilityRole="button"
              onPress={onShuffle}
              style={styles.shuffleButton}
            >
              <SymbolView
                name={{ android: "shuffle", ios: "shuffle" }}
                size={17}
                tintColor={colors.text}
              />
            </PressableOpacity>
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginLeft: -theme.spacing.lg,
    overflow: "hidden",
  },
  loadingHero: {
    alignItems: "center",
    justifyContent: "center",
  },
  backdrop: {
    left: 0,
    overflow: "hidden",
    position: "absolute",
    right: 0,
    top: 0,
  },
  backdropImage: {
    opacity: 0.82,
  },
  backdropMask: {
    experimental_backgroundImage:
      "linear-gradient(to bottom, transparent 0%, black 24%, black 68%, transparent 100%)",
    flex: 1,
  },
  heroContent: {
    alignItems: "center",
    flex: 1,
    marginTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.md,
  },
  cover: {
    backgroundColor: colors.surface,
    borderColor: "rgba(255, 255, 255, 0.4)",
    borderCurve: "continuous",
    borderRadius: theme.radius.lg + 2,
    borderWidth: StyleSheet.hairlineWidth,
    boxShadow: "0 14px 32px rgba(0, 0, 0, 0.38)",
    marginTop: theme.spacing.xl,
    overflow: "hidden",
  },
  copy: {
    alignItems: "center",
    marginTop: theme.spacing.lg,
    width: "100%",
  },
  eyebrow: {
    color: "#fff",
    fontSize: theme.size["2xl"],
    fontWeight: "600",
  },
  title: {
    color: colors.text,
    fontSize: theme.size["2xl"],
    fontWeight: "700",
    textAlign: "center",
  },
  metadata: {
    color: colors.textMuted,
    fontSize: theme.size.sm,
    fontWeight: "600",
    marginTop: theme.spacing.xs,
    textAlign: "center",
  },
  actions: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
    maxWidth: 360,
    width: "100%",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderCurve: "continuous",
    borderRadius: theme.radius.pill,
    flex: 1,
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.sm,
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: theme.size.md,
    fontWeight: "800",
  },
  shuffleButton: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderCurve: "continuous",
    borderRadius: theme.radius.pill,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  emptyHero: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.xl,
  },
  emptyIcon: {
    alignItems: "center",
    backgroundColor: "rgba(100, 255, 218, 0.1)",
    borderRadius: theme.radius.pill,
    height: 54,
    justifyContent: "center",
    width: 54,
  },
  emptyCopy: {
    alignItems: "center",
    marginTop: theme.spacing.md,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: theme.size.xl,
    fontWeight: "800",
    marginTop: theme.spacing.xs,
  },
  emptyDescription: {
    color: colors.textMuted,
    fontSize: theme.size.sm,
    marginTop: theme.spacing.xs,
    textAlign: "center",
  },
  emptyButton: {
    alignItems: "center",
    backgroundColor: colors.success,
    borderRadius: theme.radius.pill,
    flexDirection: "row",
    gap: theme.spacing.xs,
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
});
