import {
  Canvas,
  LinearGradient,
  Rect,
  vec,
} from "@shopify/react-native-skia";
import { StyleSheet, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

type GameCoverShineProps = {
  disabled?: boolean;
  height: number;
  tiltX: SharedValue<number>;
  tiltY: SharedValue<number>;
  width: number;
};

export function GameCoverShine({
  disabled = false,
  height,
  tiltX,
  tiltY,
  width,
}: GameCoverShineProps) {
  const shaderWidth = width * 2;
  const shaderHeight = height * 1.7;

  const lightStyle = useAnimatedStyle(() => {
    const movement = Math.min(
      1,
      Math.abs(tiltX.value) + Math.abs(tiltY.value),
    );

    return {
      opacity: disabled
        ? 0
        : interpolate(
            movement,
            [0, 1],
            [0.14, 0.58],
            Extrapolation.CLAMP,
          ),
      transform: [
        { translateX: tiltX.value * width * 0.52 },
        { translateY: tiltY.value * height * 0.24 },
        { rotateZ: "-18deg" },
      ],
    };
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.shader,
          {
            height: shaderHeight,
            left: -width * 0.5,
            top: -height * 0.35,
            width: shaderWidth,
          },
          lightStyle,
        ]}
      >
        <Canvas style={StyleSheet.absoluteFill}>
          <Rect height={shaderHeight} width={shaderWidth} x={0} y={0}>
            <LinearGradient
              colors={[
                "rgba(255,255,255,0)",
                "rgba(255,255,255,0.04)",
                "rgba(255,255,255,0.72)",
                "rgba(100,255,218,0.28)",
                "rgba(255,255,255,0)",
              ]}
              end={vec(shaderWidth, 0)}
              positions={[0, 0.34, 0.48, 0.57, 0.76]}
              start={vec(0, 0)}
            />
          </Rect>
        </Canvas>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  shader: { position: "absolute" },
});
