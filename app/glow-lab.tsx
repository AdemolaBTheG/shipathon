import { useState } from "react";
import { SymbolView } from "expo-symbols";
import { useLocalSearchParams } from "expo-router";
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { PressableScale } from "pressto";
import { useTranslation } from "react-i18next";

import { AnimatedCardGlow } from "@/components/animated-card-glow";
import { Text } from "@/components/Themed";
import { colors, theme } from "@/constants/theme";
import type { TranslationKey } from "@/localization/resources";

const INTENSITY_PRESETS = [
  { label: "Subtle", value: 0.7 },
  { label: "Balanced", value: 1 },
  { label: "Vivid", value: 1.35 },
] as const satisfies readonly { label: TranslationKey; value: number }[];

const SPEED_PRESETS = [
  { label: "Slow", value: 0.65 },
  { label: "Calm", value: 1 },
  { label: "Active", value: 1.6 },
] as const satisfies readonly { label: TranslationKey; value: number }[];

const ARTWORKS = [
  "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co4jni.jpg",
  "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co670h.jpg",
  "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/coaknx.jpg",
  "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co1rs4.jpg",
] as const;

export default function GlowLabScreen() {
  const { t } = useTranslation();
  const { autoplay } = useLocalSearchParams<{ autoplay?: string }>();
  const { height, width } = useWindowDimensions();
  const [intensity, setIntensity] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [artworkIndex, setArtworkIndex] = useState(autoplay === "1" ? 0 : -1);
  const [revealed, setRevealed] = useState(autoplay === "1");
  const previewWidth = Math.min(width - theme.spacing.md * 2, 460);
  const previewHeight = Math.min(
    Math.max(420, previewWidth * 1.22),
    height * 0.58,
  );

  const revealRandomArtwork = () => {
    setArtworkIndex((current) => {
      const offset = 1 + Math.floor(Math.random() * (ARTWORKS.length - 1));
      return (Math.max(current, 0) + offset) % ARTWORKS.length;
    });
    setRevealed(true);
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={styles.container}
    >
      <View style={styles.preview}>
        <AnimatedCardGlow
          artworkUrl={artworkIndex >= 0 ? ARTWORKS[artworkIndex] : null}
          height={previewHeight}
          intensity={intensity}
          revealed={revealed}
          speed={speed}
          width={previewWidth}
        />
      </View>

      <View style={styles.actionRow}>
        <PressableScale
          accessibilityLabel={t("Reveal a random game cover")}
          accessibilityRole="button"
          onPress={revealRandomArtwork}
          style={styles.revealButton}
        >
          <SymbolView
            name="sparkles"
            size={17}
            tintColor={colors.background}
          />
          <Text style={styles.revealButtonLabel}>
            {revealed ? t("Reveal another") : t("Reveal artwork")}
          </Text>
        </PressableScale>
        <PressableScale
          accessibilityLabel={t("Reset artwork blur")}
          accessibilityRole="button"
          disabled={!revealed}
          onPress={() => setRevealed(false)}
          style={[styles.resetButton, !revealed && styles.buttonDisabled]}
        >
          <SymbolView
            name="arrow.counterclockwise"
            size={17}
            tintColor={colors.text}
          />
          <Text style={styles.resetButtonLabel}>{t("Reset")}</Text>
        </PressableScale>
      </View>

      <TuningGroup
        label={t("Glow intensity")}
        onChange={setIntensity}
        options={INTENSITY_PRESETS}
        value={intensity}
      />
      <TuningGroup
        label={t("Color drift")}
        onChange={setSpeed}
        options={SPEED_PRESETS}
        value={speed}
      />
      <Text style={styles.footnote}>
        {t("Reduce Motion freezes the shader into a static glow automatically.")}
      </Text>
    </ScrollView>
  );
}

function TuningGroup({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: number) => void;
  options: readonly { label: string; value: number }[];
  value: number;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.tuningGroup}>
      <Text style={styles.controlLabel}>{label}</Text>
      <View style={styles.presetRow}>
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <PressableScale
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={option.label}
              onPress={() => onChange(option.value)}
              style={[styles.preset, selected && styles.presetSelected]}
            >
              <Text
                style={[
                  styles.presetLabel,
                  selected && styles.presetLabelSelected,
                ]}
              >
                {t(option.label as TranslationKey)}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    maxWidth: 460,
    width: "100%",
  },
  buttonDisabled: {
    opacity: 0.38,
  },
  container: {
    backgroundColor: colors.background,
  },
  content: {
    alignItems: "center",
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.md,
  },
  controlLabel: {
    color: colors.text,
    fontSize: theme.size.md,
    fontWeight: "700",
  },
  footnote: {
    color: colors.textMuted,
    fontSize: theme.size.sm,
    lineHeight: 17,
    textAlign: "center",
  },
  preset: {
    alignItems: "center",
    borderColor: colors.border,
    borderCurve: "continuous",
    borderRadius: theme.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: theme.spacing.sm,
  },
  presetLabel: {
    color: colors.textMuted,
    fontSize: theme.size.md,
    fontWeight: "600",
  },
  presetLabelSelected: {
    color: colors.background,
  },
  presetRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  presetSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  preview: {
    alignItems: "center",
    justifyContent: "center",
  },
  resetButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderCurve: "continuous",
    borderRadius: theme.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: theme.spacing.lg,
  },
  resetButtonLabel: {
    color: colors.text,
    fontSize: theme.size.md,
    fontWeight: "700",
  },
  revealButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderCurve: "continuous",
    borderRadius: theme.radius.pill,
    flex: 1,
    flexDirection: "row",
    gap: theme.spacing.sm,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: theme.spacing.lg,
  },
  revealButtonLabel: {
    color: colors.background,
    fontSize: theme.size.md,
    fontWeight: "800",
  },
  tuningGroup: {
    gap: theme.spacing.sm,
    maxWidth: 460,
    width: "100%",
  },
});
