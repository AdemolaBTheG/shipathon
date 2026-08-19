import { AnimatedCardGlow } from "@/components/animated-card-glow";
import { colors, theme } from "@/constants/theme";
import type { GameSearchResult } from "@/lib/igdb";
import type { GameLinkResolution } from "@/lib/link-resolver";
import MaskedView from "@expo/ui/community/masked-view";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { SymbolView } from "expo-symbols";
import { PressableOpacity, PressableScale } from "pressto";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { Easing, FadeIn, FadeInUp } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

type LinkResolutionResultProps = {
  resolution: GameLinkResolution;
  savedGameIds: ReadonlySet<number>;
  savingGameId: number | null;
  selectedGame: GameSearchResult | null;
  onAdd: (game: GameSearchResult) => void;
  onChoose: (game: GameSearchResult) => void;
  onOpenDetails: () => void;
  onReset: () => void;
  reduceMotion: boolean;
};

const resultEntrance = (reduceMotion: boolean) =>
  reduceMotion
    ? FadeIn.duration(120)
    : FadeInUp.duration(240).easing(Easing.bezier(0.23, 1, 0.32, 1));

function releaseYear(game: GameSearchResult) {
  return game.releaseDate?.slice(0, 4) ?? null;
}

function gameMetadata(game: GameSearchResult) {
  return [releaseYear(game), game.platforms[0]].filter(Boolean).join(" · ");
}

function supportingMetadata(game: GameSearchResult, t: TFunction) {
  const genres = game.genres.slice(0, 2).join(" · ");
  return genres || game.developers?.[0] || t("Game details from IGDB");
}

function sourceLabel(sourceUrl: string, t: TFunction) {
  try {
    const hostname = new URL(sourceUrl).hostname.replace(/^www\./, "");
    const knownSources: [string, string][] = [
      ["tiktok.com", "TikTok"],
      ["instagram.com", "Instagram"],
      ["youtube.com", "YouTube"],
      ["youtu.be", "YouTube"],
      ["steampowered.com", "Steam"],
      ["playstation.com", "PlayStation Store"],
      ["xbox.com", "Xbox"],
    ];
    const match = knownSources.find(([domain]) => hostname.endsWith(domain));
    return t("From {{source}}", { source: match?.[1] ?? hostname });
  } catch {
    return t("Matched with IGDB");
  }
}

function Cover({
  compact,
  game,
}: {
  compact?: boolean;
  game: GameSearchResult;
}) {
  const { t } = useTranslation();
  const coverStyle = compact ? styles.compactCover : styles.heroCover;

  if (game.coverUrl) {
    return (
      <Image
        accessibilityLabel={t("{{name}} cover", { name: game.name })}
        contentFit="cover"
        source={game.coverUrl}
        style={coverStyle}
        transition={160}
      />
    );
  }

  return (
    <View style={[coverStyle, styles.coverPlaceholder]}>
      <SymbolView
        name="gamecontroller.fill"
        size={compact ? 24 : 34}
        tintColor={colors.textMuted}
      />
    </View>
  );
}

function HeroResult({
  game,
  isSaved,
  isSaving,
  onAdd,
  onOpenDetails,
  onReset,
  reduceMotion,
  sourceUrl,
}: {
  game: GameSearchResult;
  isSaved: boolean;
  isSaving: boolean;
  onAdd: () => void;
  onOpenDetails: () => void;
  onReset: () => void;
  reduceMotion: boolean;
  sourceUrl: string;
}) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const atmosphereHeight = Math.min(420, Math.max(340, width * 0.98));

  return (
    <View style={styles.heroResultBody}>
      <Link
        href={{
          pathname: "/game/[id]",
          params: { id: String(game.id), sourceUrl },
        }}
        asChild
      >
        <Link.Trigger>
          <Pressable
            accessibilityHint={t("Opens the full game details")}
            accessibilityLabel={t("View {{name}} details", {
              name: game.name,
            })}
            accessibilityRole="button"
            onPress={onOpenDetails}
            style={styles.detailsTrigger}
          >
            <View style={[styles.heroAtmosphere, { height: atmosphereHeight }]}>
              <Animated.View
                entering={FadeIn.delay(reduceMotion ? 0 : 180).duration(
                  reduceMotion ? 0 : 260,
                )}
                style={StyleSheet.absoluteFill}
              >
                <MaskedView
                  maskElement={<View style={styles.heroBackdropMask} />}
                  pointerEvents="none"
                  style={StyleSheet.absoluteFill}
                >
                  {game.coverUrl ? (
                    <Image
                      accessibilityIgnoresInvertColors
                      blurRadius={30}
                      contentFit="cover"
                      source={game.coverUrl}
                      style={styles.heroBackdrop}
                    />
                  ) : null}
                  <View style={styles.heroBackdropScrim} />
                </MaskedView>
              </Animated.View>

              {game.coverUrl ? (
                <Link.AppleZoom>
                  <View style={styles.heroMaterializationSource}>
                    <AnimatedCardGlow
                      artworkUrl={game.coverUrl}
                      cardHeight={216}
                      cardWidth={154}
                      cornerRadius={28}
                      height={280}
                      intensity={0.9}
                      revealed
                      speed={0.9}
                      width={Math.min(width - theme.spacing.md * 2, 360)}
                    />
                  </View>
                </Link.AppleZoom>
              ) : (
                <Cover game={game} />
              )}
            </View>

            <Animated.View
              entering={FadeInUp.delay(reduceMotion ? 0 : 190).duration(
                reduceMotion ? 0 : 280,
              )}
              style={styles.heroCopy}
            >
              <Text numberOfLines={2} style={styles.heroTitle}>
                {game.name}
              </Text>
              <Text numberOfLines={1} style={styles.heroMetadata}>
                {gameMetadata(game) || t("Release details unavailable")}
              </Text>
              <Text numberOfLines={1} style={styles.heroSupporting}>
                {supportingMetadata(game, t)}
              </Text>
              <Text numberOfLines={1} style={styles.sourceLabel}>
                {sourceLabel(sourceUrl, t)}
              </Text>
              <View style={styles.quietButton}>
                <Text style={styles.quietButtonText}>{t("View details")}</Text>
                <SymbolView
                  name="arrow.up.right"
                  size={14}
                  tintColor={colors.textMuted}
                />
              </View>
            </Animated.View>
          </Pressable>
        </Link.Trigger>
      </Link>

      <Animated.View
        entering={FadeIn.delay(reduceMotion ? 0 : 250).duration(
          reduceMotion ? 0 : 220,
        )}
        style={styles.heroActions}
      >
        <PressableScale
          accessibilityLabel={
            isSaved
              ? t("{{name}} is in your backlog", { name: game.name })
              : t("Add {{name}}", { name: game.name })
          }
          accessibilityRole="button"
          accessibilityState={{
            busy: isSaving,
            disabled: isSaved || isSaving,
          }}
          disabled={isSaved || isSaving}
          onPress={onAdd}
          style={[styles.primaryButton, isSaved && styles.savedButton]}
        >
          {isSaving ? (
            <ActivityIndicator color={colors.background} size="small" />
          ) : (
            <>
              <SymbolView
                name={isSaved ? "checkmark" : "plus"}
                size={19}
                tintColor={isSaved ? colors.success : colors.background}
              />
              <Text
                style={[
                  styles.primaryButtonText,
                  isSaved && styles.savedButtonText,
                ]}
              >
                {isSaved ? t("In backlog") : t("Add to backlog")}
              </Text>
            </>
          )}
        </PressableScale>

        <PressableOpacity
          accessibilityLabel={t("Try another link")}
          accessibilityRole="button"
          onPress={onReset}
          style={styles.resetButton}
        >
          <Text style={styles.resetButtonText}>{t("Try another link")}</Text>
        </PressableOpacity>
      </Animated.View>
    </View>
  );
}

export function LinkResolutionResult({
  resolution,
  savedGameIds,
  savingGameId,
  selectedGame,
  onAdd,
  onChoose,
  onOpenDetails,
  onReset,
  reduceMotion,
}: LinkResolutionResultProps) {
  const { t } = useTranslation();
  const confirmedGame =
    selectedGame ??
    resolution.game ??
    (resolution.candidates.length === 1 ? resolution.candidates[0] : null);

  if (confirmedGame) {
    return (
      <HeroResult
        game={confirmedGame}
        isSaved={savedGameIds.has(confirmedGame.id)}
        isSaving={savingGameId === confirmedGame.id}
        onAdd={() => onAdd(confirmedGame)}
        onOpenDetails={onOpenDetails}
        onReset={onReset}
        reduceMotion={reduceMotion}
        sourceUrl={resolution.sourceUrl}
      />
    );
  }

  const candidates = Array.from(
    new Map(resolution.candidates.map((game) => [game.id, game])).values(),
  ).slice(0, 5);

  return (
    <Animated.View
      entering={resultEntrance(reduceMotion)}
      style={styles.candidateScreen}
    >
      <FlatList
        contentContainerStyle={styles.candidateContent}
        contentInsetAdjustmentBehavior="automatic"
        data={candidates}
        keyExtractor={(game) => String(game.id)}
        ListFooterComponent={
          <View style={styles.candidateFooter}>
            <PressableScale
              accessibilityLabel={t("Try another link")}
              accessibilityRole="button"
              onPress={onReset}
              style={styles.resetButton}
            >
              <Text style={styles.resetButtonText}>{t("Try another link")}</Text>
            </PressableScale>
          </View>
        }
        renderItem={({ item: game, index }) => (
          <View
            style={[
              styles.candidateItem,
              index === 0 && styles.candidateItemFirst,
              index === candidates.length - 1 && styles.candidateItemLast,
            ]}
          >
            <PressableScale
              accessibilityLabel={t("Choose {{name}}", { name: game.name })}
              accessibilityRole="button"
              onPress={() => onChoose(game)}
              style={styles.candidateRow}
            >
              <Cover compact game={game} />
              <View style={styles.candidateCopy}>
                <Text numberOfLines={1} style={styles.candidateTitle}>
                  {game.name}
                </Text>
                <Text numberOfLines={1} style={styles.candidateMetadata}>
                  {gameMetadata(game) || supportingMetadata(game, t)}
                </Text>
              </View>
              <SymbolView
                name="chevron.right"
                size={16}
                tintColor={colors.textMuted}
              />
            </PressableScale>
            {index < candidates.length - 1 ? (
              <View style={styles.candidateSeparator} />
            ) : null}
          </View>
        )}
        showsVerticalScrollIndicator={false}
        style={styles.candidateList}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  heroResultBody: {
    paddingBottom: theme.spacing.lg,
  },
  detailsTrigger: {
    gap: theme.spacing.md,
  },
  heroAtmosphere: {
    alignItems: "center",
    justifyContent: "flex-end",
    overflow: "hidden",
    paddingBottom: theme.spacing.md,
    position: "relative",
  },
  heroBackdrop: {
    bottom: 0,
    left: 0,
    opacity: 0.4,
    position: "absolute",
    right: 0,
    top: 0,
    transform: [{ scale: 1.18 }],
  },
  heroBackdropScrim: {
    backgroundColor: "rgba(18, 18, 18, 0.48)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  heroBackdropMask: {
    experimental_backgroundImage:
      "linear-gradient(to bottom, black 0%, black 46%, rgba(0, 0, 0, 0.72) 68%, transparent 100%)",
    flex: 1,
  },
  heroMaterializationSource: {
    alignItems: "center",
    height: 280,
    justifyContent: "center",
  },
  heroCover: {
    backgroundColor: colors.surfaceMuted,
    borderCurve: "continuous",
    borderRadius: 28,
    boxShadow: "0 16px 32px rgba(0, 0, 0, 0.38)",
    height: 216,
    width: 154,
  },
  compactCover: {
    backgroundColor: colors.surfaceMuted,
    borderCurve: "continuous",
    borderRadius: 10,
    height: 88,
    width: 64,
  },
  coverPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  heroCopy: {
    alignItems: "center",
    gap: 2,
    paddingHorizontal: theme.spacing.md,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.7,
    lineHeight: 30,
    textAlign: "center",
  },
  heroMetadata: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
    marginTop: 7,
    textAlign: "center",
  },
  heroSupporting: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 5,
    textAlign: "center",
  },
  sourceLabel: {
    color: "rgba(255, 255, 255, 0.42)",
    fontSize: 12,
    marginTop: theme.spacing.sm,
    textAlign: "center",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderCurve: "continuous",
    borderRadius: theme.radius.pill,
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: theme.spacing.lg,
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "800",
  },
  savedButton: {
    backgroundColor: "rgba(100, 255, 218, 0.1)",
  },
  savedButtonText: {
    color: colors.success,
  },
  heroActions: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  quietButton: {
    alignItems: "center",
    alignSelf: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    marginTop: theme.spacing.sm,
    minHeight: 32,
    paddingHorizontal: theme.spacing.sm,
  },
  quietButtonText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "500",
  },
  candidateList: {
    flex: 1,
  },
  candidateScreen: {
    flex: 1,
  },
  candidateContent: {
    paddingBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
  },
  candidateItem: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  candidateItemFirst: {
    borderCurve: "continuous",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  candidateItemLast: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderCurve: "continuous",
  },
  candidateRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md,
    minHeight: 112,
    padding: 12,
  },
  candidateCopy: {
    flex: 1,
    minWidth: 0,
  },
  candidateTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  candidateMetadata: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 7,
  },
  candidateSeparator: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
    marginLeft: 92,
  },
  candidateFooter: {
    paddingTop: theme.spacing.md,
  },
  resetButton: {
    alignItems: "center",
    alignSelf: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.md,
  },
  resetButtonText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
});
