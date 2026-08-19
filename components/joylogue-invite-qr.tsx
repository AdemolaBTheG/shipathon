import { QRCodeAnimation } from "@/components/notion-qrcode";
import { colors, theme } from "@/constants/theme";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  cancelAnimation,
  Easing,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

type JoylogueInviteQrProps = {
  animateOnResolve?: boolean;
  failed?: boolean;
  loading?: boolean;
  url?: string | null;
};

const PLACEHOLDER_URL = "https://joylogue.app/invite/preparing-joylogue";
const MORPH_DURATION = 2000;

export function JoylogueInviteQr({
  animateOnResolve = true,
  failed = false,
  loading = false,
  url,
}: JoylogueInviteQrProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const size = Math.min(width - theme.spacing.md * 4, 360);
  const progress = useSharedValue(url && !animateOnResolve ? 1 : 0);
  const reduceMotion = useReducedMotion();
  const [readyUrl, setReadyUrl] = useState<string | null>(null);
  const animatedUrlRef = useRef<string | null>(null);
  const readyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isReady = Boolean(url && readyUrl === url);
  const torus = useMemo(
    () => ({
      majorRadius: size * 0.22,
      minorRadius: size * 0.105,
      targetHeight: size * 0.4,
    }),
    [size],
  );

  useEffect(() => {
    if (url) return;

    animatedUrlRef.current = null;
    if (readyTimerRef.current) clearTimeout(readyTimerRef.current);
    cancelAnimation(progress);
    progress.set(0);
  }, [progress, url]);

  useEffect(() => {
    return () => {
      if (readyTimerRef.current) clearTimeout(readyTimerRef.current);
    };
  }, []);

  const handleShapeReady = useCallback(
    (readyUrl: string) => {
      if (!url || readyUrl !== url || animatedUrlRef.current === url) return;

      animatedUrlRef.current = url;
      if (!animateOnResolve || reduceMotion) {
        cancelAnimation(progress);
        progress.set(1);
        setReadyUrl(url);
        return;
      }

      setReadyUrl(null);
      progress.set(
        withTiming(1, {
          duration: MORPH_DURATION,
          // Per-particle motion already has an ease-in-out curve. Keeping the
          // shared clock linear avoids double-easing and a sluggish tail.
          easing: Easing.linear,
        }),
      );

      if (readyTimerRef.current) clearTimeout(readyTimerRef.current);
      readyTimerRef.current = setTimeout(() => {
        setReadyUrl(url);
        readyTimerRef.current = null;
      }, MORPH_DURATION);
    },
    [animateOnResolve, progress, reduceMotion, url],
  );

  if ((!loading && !url) || failed) return null;

  return (
    <View style={styles.container}>
      <View
        accessibilityLabel={
          isReady
            ? t("Joylogue invite QR code")
            : t("Forming invite QR code")
        }
        style={[styles.qrSurface, { height: size, width: size }]}
      >
        <QRCodeAnimation
          avatarSize={3.2}
          canvasHeight={size}
          canvasWidth={size}
          colors={{
            hue: 163,
            lightnessRange: [46, 62],
            saturationRange: [70, 92],
          }}
          haptics={false}
          idleShape="controller"
          onShapeReady={handleShapeReady}
          progress={progress}
          qrData={url ?? PLACEHOLDER_URL}
          qrTargetHeight={size * 0.7}
          torus={torus}
        />
      </View>
      <Text style={styles.statusTitle}>
        {isReady
          ? t("Ready to scan")
          : url
            ? t("Forming your code")
            : t("Building your invite")}
      </Text>
      <Text style={styles.statusText}>
        {isReady
          ? t("Friends can scan this to compare backlogs.")
          : url
            ? t("Turning your invite into a private Joylogue code.")
            : t("Publishing your latest backlog securely.")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  qrSurface: {
    alignItems: "center",
    borderCurve: "continuous",
    justifyContent: "center",
    overflow: "hidden",
  },
  statusText: {
    color: colors.textMuted,
    fontSize: theme.size.sm,
    textAlign: "center",
  },
  statusTitle: {
    color: colors.text,
    fontSize: theme.size.lg,
    fontWeight: "800",
    marginTop: theme.spacing.md,
    textAlign: "center",
  },
});
