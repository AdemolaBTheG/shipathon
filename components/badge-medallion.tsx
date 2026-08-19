import {
  BlurMask,
  Canvas,
  LinearGradient,
  Path,
  RadialGradient,
  Skia,
  SweepGradient,
  vec,
} from "@shopify/react-native-skia";
import { SymbolView } from "expo-symbols";
import type { SymbolViewProps } from "expo-symbols";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import type { BadgeTier } from "@/db/schema";
import type { BadgeDefinition } from "@/lib/badges";

type BadgeSymbol = BadgeDefinition["symbol"];

type BadgeMedallionProps = {
  accessibilityLabel?: string;
  locked?: boolean;
  size?: number;
  symbol: BadgeSymbol;
  tier: BadgeTier;
};

type MaterialPalette = {
  face: readonly [string, string, string, string];
  rim: readonly [string, string, string, string, string];
};

const MATERIALS = {
  bronze: {
    face: ["#8A5739", "#6B402B", "#4B2B20", "#271713"],
    rim: ["#F0B17C", "#C47A47", "#784126", "#9B5934", "#E5A06B"],
  },
  gold: {
    face: ["#9A742E", "#78571E", "#533A12", "#2E200B"],
    rim: ["#FFEAA5", "#E3B84F", "#936A1D", "#C58C27", "#F3D078"],
  },
  silver: {
    face: ["#7B8592", "#59616C", "#394049", "#1F2329"],
    rim: ["#FFFFFF", "#D7DDE5", "#87919D", "#B5BDC7", "#EEF1F5"],
  },
  standard: {
    face: ["#44484F", "#303339", "#212328", "#121315"],
    rim: ["#AEB3BC", "#747982", "#3E4249", "#5D626B", "#969BA4"],
  },
} as const satisfies Record<BadgeTier, MaterialPalette>;

const LOCKED_MATERIAL: MaterialPalette = {
  face: ["#292B2F", "#1D1F22", "#151618", "#0D0E10"],
  rim: ["#565960", "#3A3D42", "#202226", "#2D3034", "#474A50"],
};

export function getBadgeAtmosphereColor({
  locked,
  tier,
}: Pick<BadgeMedallionProps, "locked" | "tier">) {
  const palette = locked ? LOCKED_MATERIAL : MATERIALS[tier];

  // Use the medallion's mid-tone so the backdrop reads as the same material
  // without competing with the brighter rim and face highlights.
  return palette.face[2];
}

const SYMBOLS = {
  bookmark: { android: "bookmark", ios: "bookmark.fill" },
  checkmark: { android: "check", ios: "checkmark" },
  dice: { android: "casino", ios: "die.face.5.fill" },
  gamecontroller: { android: "sports_esports", ios: "gamecontroller.fill" },
  link: { android: "link", ios: "link" },
  play: { android: "play_arrow", ios: "play.fill" },
  star: { android: "star", ios: "star.fill" },
} as const satisfies Record<
  BadgeSymbol,
  NonNullable<SymbolViewProps["name"]>
>;

type Point = { x: number; y: number };

function pointToward(from: Point, to: Point, distance: number): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);

  if (length === 0) return from;
  const scale = Math.min(distance / length, 0.45);
  return { x: from.x + dx * scale, y: from.y + dy * scale };
}

function createMedallionPath(
  size: number,
  inset: number,
  cornerRadius: number,
  offsetY = 0,
  offsetX = 0,
) {
  const left = inset + offsetX;
  const right = size - inset + offsetX;
  const top = inset + offsetY;
  const bottom = size - inset + offsetY;
  const center = size / 2 + offsetX;
  const width = right - left;
  const height = bottom - top;
  const points: Point[] = [
    { x: center, y: top },
    { x: right - width * 0.055, y: top + height * 0.19 },
    { x: right, y: top + height * 0.7 },
    { x: center, y: bottom },
    { x: left, y: top + height * 0.7 },
    { x: left + width * 0.055, y: top + height * 0.19 },
  ];
  const path = Skia.Path.Make();

  points.forEach((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const start = pointToward(point, previous, cornerRadius);
    const end = pointToward(point, next, cornerRadius);

    if (index === 0) path.moveTo(start.x, start.y);
    else path.lineTo(start.x, start.y);
    path.quadTo(point.x, point.y, end.x, end.y);
  });

  path.close();
  return path;
}

export function createBadgeMedallionShinePath(size: number, offset = 0) {
  return createMedallionPath(
    size,
    size * 0.07,
    size * 0.076,
    offset,
    offset,
  );
}

export function BadgeMedallion({
  accessibilityLabel,
  locked = false,
  size = 96,
  symbol,
  tier,
}: BadgeMedallionProps) {
  const palette = locked ? LOCKED_MATERIAL : MATERIALS[tier];
  const geometry = useMemo(() => {
    const outerInset = size * 0.07;
    return {
      face: createMedallionPath(size, size * 0.16, size * 0.062),
      innerBevel: createMedallionPath(size, size * 0.118, size * 0.07),
      keyline: createMedallionPath(size, size * 0.052, size * 0.082),
      rim: createMedallionPath(size, outerInset, size * 0.076),
      shadow: createMedallionPath(
        size,
        outerInset + size * 0.018,
        size * 0.08,
        size * 0.025,
      ),
    };
  }, [size]);
  const iconSize = size * 0.32;

  return (
    <View
      accessibilityLabel={
        accessibilityLabel ?? `${locked ? "Locked" : tier} badge`
      }
      accessibilityRole="image"
      style={{ height: size, width: size }}
    >
      <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Path color="rgba(0,0,0,0.72)" path={geometry.shadow}>
          <BlurMask blur={size * 0.035} style="normal" />
        </Path>

        <Path color="#07080A" path={geometry.keyline} />

        <Path path={geometry.rim}>
          <LinearGradient
            colors={[...palette.rim]}
            end={vec(size * 0.82, size * 0.9)}
            positions={[0, 0.24, 0.52, 0.78, 1]}
            start={vec(size * 0.16, size * 0.08)}
          />
        </Path>

        <Path path={geometry.rim}>
          <SweepGradient
            c={vec(size * 0.5, size * 0.48)}
            colors={[
              "rgba(255,255,255,0.22)",
              "rgba(255,255,255,0)",
              "rgba(0,0,0,0.22)",
              "rgba(255,255,255,0.08)",
              "rgba(255,255,255,0.22)",
            ]}
            end={245}
            positions={[0, 0.2, 0.5, 0.78, 1]}
            start={-115}
          />
        </Path>

        <Path path={geometry.innerBevel}>
          <LinearGradient
            colors={[
              "rgba(5,6,8,0.82)",
              "rgba(5,6,8,0.58)",
              "rgba(255,255,255,0.16)",
            ]}
            end={vec(size * 0.78, size * 0.9)}
            positions={[0, 0.56, 1]}
            start={vec(size * 0.24, size * 0.1)}
          />
        </Path>

        <Path path={geometry.face}>
          <RadialGradient
            c={vec(size * 0.38, size * 0.29)}
            colors={[...palette.face]}
            positions={[0, 0.34, 0.7, 1]}
            r={size * 0.58}
          />
        </Path>

        <Path path={geometry.face}>
          <LinearGradient
            colors={[
              "rgba(255,255,255,0.11)",
              "rgba(255,255,255,0)",
              "rgba(0,0,0,0.24)",
            ]}
            end={vec(size * 0.7, size * 0.92)}
            positions={[0, 0.44, 1]}
            start={vec(size * 0.3, size * 0.12)}
          />
        </Path>

        <Path
          path={geometry.rim}
          strokeWidth={Math.max(1, size * 0.014)}
          style="stroke"
        >
          <LinearGradient
            colors={[
              "rgba(255,255,255,0.74)",
              "rgba(255,255,255,0.18)",
              "rgba(255,255,255,0)",
              "rgba(0,0,0,0.54)",
            ]}
            end={vec(size * 0.88, size * 0.9)}
            positions={[0, 0.34, 0.62, 1]}
            start={vec(size * 0.12, size * 0.08)}
          />
        </Path>

        <Path
          path={geometry.face}
          strokeWidth={Math.max(1, size * 0.012)}
          style="stroke"
        >
          <LinearGradient
            colors={[
              "rgba(255,255,255,0.18)",
              "rgba(255,255,255,0.04)",
              "rgba(0,0,0,0.38)",
            ]}
            end={vec(size * 0.76, size * 0.88)}
            positions={[0, 0.48, 1]}
            start={vec(size * 0.24, size * 0.12)}
          />
        </Path>
      </Canvas>

      <View pointerEvents="none" style={styles.symbolContainer}>
        <SymbolView
          name={SYMBOLS[symbol]}
          size={iconSize}
          style={{
            position: "absolute",
            transform: [{ translateY: size * 0.018 }],
          }}
          tintColor={locked ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.46)"}
        />
        <SymbolView
          name={SYMBOLS[symbol]}
          size={iconSize}
          tintColor={locked ? "rgba(245,245,245,0.2)" : "#F5F5F5"}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  symbolContainer: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
});
