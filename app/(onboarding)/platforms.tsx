import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { PressableScale } from "pressto";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Presets } from "react-native-pulsar";
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PlatformIcon } from "@/components/platform-icon";
import { OnboardingProgress } from "@/components/onboarding-progress";
import { colors, theme } from "@/constants/theme";
import { platformPreferences } from "@/lib/platform-preferences";
import { useOnboarding } from "@/providers/onboarding-provider";

const PLATFORMS = platformPreferences;

const PAGE_PADDING = 24;
const TILE_GAP = 12;
const TILE_STAGGER = 30;
const TILE_ENTRANCE_DURATION = 400;
const TILE_COLOR_DURATION = 400;

type PlatformItem = (typeof PLATFORMS)[number];

type PlatformTileProps = {
  index: number;
  item: PlatformItem;
  onPress: () => void;
  selected: boolean;
  tileWidth: number;
};

function PlatformTile({
  index,
  item,
  onPress,
  selected,
  tileWidth,
}: PlatformTileProps) {
  const reduceMotion = useReducedMotion();
  const selectionProgress = useSharedValue(selected ? 1 : 0);

  const handlePress = () => {
    selectionProgress.set(
      withTiming(selected ? 0 : 1, {
        duration: reduceMotion ? 0 : TILE_COLOR_DURATION,
        easing: Easing.bezier(0.23, 1, 0.32, 1),
      }),
    );
    Presets.System.selection();
    onPress();
  };

  const surfaceStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      selectionProgress.get(),
      [0, 1],
      [colors.surface, "rgba(100, 255, 218, 0.08)"],
    ),
    borderColor: interpolateColor(
      selectionProgress.get(),
      [0, 1],
      [colors.border, colors.success],
    ),
  }));

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      selectionProgress.get(),
      [0, 1],
      [colors.text, colors.success],
    ),
  }));

  const defaultIconStyle = useAnimatedStyle(() => ({
    opacity: 1 - selectionProgress.get(),
  }));

  const selectedIconStyle = useAnimatedStyle(() => ({
    opacity: selectionProgress.get(),
  }));

  return (
    <Animated.View
      entering={FadeInUp.delay(reduceMotion ? 0 : index * TILE_STAGGER)
        .duration(reduceMotion ? 0 : TILE_ENTRANCE_DURATION)
        .easing(Easing.bezier(0.23, 1, 0.32, 1))}
      style={[
        styles.tileSlot,
        { width: tileWidth },
        index === PLATFORMS.length - 1 && styles.lastTile,
      ]}
    >
      <Animated.View style={[styles.tileSurface, surfaceStyle]}>
        <View style={styles.tileContent}>
          <PressableScale
            accessibilityLabel={item.label}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            onPress={handlePress}
            style={styles.tile}
          >
            <View style={styles.iconContainer}>
              <Animated.View style={defaultIconStyle}>
                <PlatformIcon
                  color={colors.text}
                  platform={item.platform}
                  size={38}
                />
              </Animated.View>
              <Animated.View style={[styles.selectedIcon, selectedIconStyle]}>
                <PlatformIcon
                  color={colors.success}
                  platform={item.platform}
                  size={38}
                />
              </Animated.View>
            </View>
            <Animated.Text style={[styles.tileLabel, labelStyle]}>
              {item.label}
            </Animated.Text>
          </PressableScale>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

export default function PlatformSelectionScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { savePlatforms, setStep, state } = useOnboarding();
  const { width } = useWindowDimensions();
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(
    state.selectedPlatformIds,
  );
  const tileWidth = (width - PAGE_PADDING * 2 - TILE_GAP) / 2;

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms((current) => {
      const next = current.includes(platformId)
        ? current.filter((id) => id !== platformId)
        : [...current, platformId];
      void savePlatforms(next).catch(() => undefined);
      return next;
    });
  };

  async function openGamePicker(platformIds: string[]) {
    await savePlatforms(platformIds);
    await setStep("games");
    Presets.snap();
    router.push("/(onboarding)/games");
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <ScrollView
        bounces={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: insets.bottom,
          },
        ]}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <OnboardingProgress step={1} style={styles.progress} total={4} />
        </View>

        <Animated.View
          entering={FadeIn.duration(reduceMotion ? 0 : 180).easing(
            Easing.bezier(0.23, 1, 0.32, 1),
          )}
          style={styles.intro}
        >
          <Text style={styles.title}>{t("Where do you play?")}</Text>
          <Text style={styles.subtitle}>
            {t(
              "Pick every platform you use. We will keep discovery relevant to your setup.",
            )}
          </Text>
        </Animated.View>

        <View style={styles.grid}>
          {PLATFORMS.map((item, index) => {
            const selected = selectedPlatforms.includes(item.id);

            return (
              <PlatformTile
                index={index}
                item={item}
                key={item.id}
                onPress={() => togglePlatform(item.id)}
                selected={selected}
                tileWidth={tileWidth}
              />
            );
          })}
        </View>

        <Animated.View
          entering={FadeIn.delay(reduceMotion ? 0 : 140)
            .duration(reduceMotion ? 0 : 220)
            .easing(Easing.bezier(0.23, 1, 0.32, 1))}
          style={styles.actions}
        >
          <View
            style={[
              styles.continueBoundary,
              selectedPlatforms.length === 0 && styles.continueButtonDisabled,
            ]}
          >
              <PressableScale
                accessibilityLabel={t("Continue")}
                accessibilityRole="button"
                accessibilityState={{
                  disabled: selectedPlatforms.length === 0,
                }}
                disabled={selectedPlatforms.length === 0}
                onPress={() => void openGamePicker(selectedPlatforms)}
                style={styles.continueButton}
              >
                <Text style={styles.continueButtonText}>{t("Continue")}</Text>
              </PressableScale>
          </View>

          <PressableScale
            accessibilityLabel={t("Skip platform selection")}
            accessibilityRole="button"
            onPress={() => void openGamePicker([])}
            style={styles.skipButton}
          >
            <Text style={styles.skipButtonText}>{t("Not now")}</Text>
          </PressableScale>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: theme.spacing.md,
    marginTop: "auto",
    paddingTop: theme.spacing.xl,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: PAGE_PADDING,
  },
  continueBoundary: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: theme.radius.pill,
    justifyContent: "center",
    minHeight: 58,
    overflow: "hidden",
  },
  continueButton: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    width: "100%",
  },
  continueButtonDisabled: {
    opacity: 0.28,
  },
  continueButtonText: {
    color: colors.background,
    fontSize: 17,
    fontWeight: "800",
  },
  eyebrow: {
    color: colors.success,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2.2,
    marginBottom: theme.spacing.sm,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: TILE_GAP,
  },
  iconContainer: {
    height: 38,
    position: "relative",
    width: 38,
  },
  intro: {
    marginBottom: theme.spacing.xl,
    marginTop: theme.spacing.lg,
  },
  lastTile: {
    marginHorizontal: "auto",
  },
  progress: {
    width: "58%",
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  skipButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 32,
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
  tile: {
    alignItems: "center",
    flex: 1,
    gap: theme.spacing.md,
    justifyContent: "center",
    width: "100%",
  },
  tileContent: {
    flex: 1,
  },
  tileLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  tileSlot: {
    aspectRatio: 1.18,
  },
  tileSurface: {
    borderCurve: "continuous",
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    flex: 1,
    overflow: "hidden",
    width: "100%",
  },
  selectedIcon: {
    ...StyleSheet.absoluteFill,
  },
  topBar: {
    alignItems: "center",
    paddingTop: theme.spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: theme.size["3xl"],
    fontWeight: "800",
    textAlign: "center",
    marginBottom: theme.spacing.sm,
  },
});
