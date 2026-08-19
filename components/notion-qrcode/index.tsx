/**
 * QR Code Animation Component
 *
 * Creates an animated 3D visualization where avatar images arranged in a
 * rotating torus (donut shape) morph into a scannable QR code.
 *
 * ## How it works:
 *
 * 1. SHAPE GENERATION (useShapeData hook):
 *    - Generates N points on a 3D torus surface
 *    - Generates N points for the QR code (one per black module)
 *    - Uses Hungarian algorithm for optimal 1:1 point mapping
 *
 * 2. ANIMATION LOOP (createPicture worklet):
 *    - Runs every frame on the UI thread
 *    - Interpolates positions between torus → QR based on progress
 *    - Applies 3D rotation, perspective, depth sorting
 *    - See ./create-picture.ts for detailed implementation
 *
 * 3. WAVE EFFECT:
 *    - Points animate with staggered delays based on angular position
 *    - Creates a "wave" that sweeps around during morphing
 */
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { useEffect, useImperativeHandle } from 'react';

import { Canvas, Picture, Skia, useImage } from '@shopify/react-native-skia';
import {
  Easing,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  DEFAULT_AVATAR_SIZE,
  DEFAULT_COLORS,
  DEFAULT_QR_TARGET_HEIGHT,
  DEFAULT_TORUS,
} from './constants';
import { createPicture } from './create-picture';
import { useShapeData } from './hooks';
import {
  QRCodeAnimationProps,
  QRCodeAnimationRef,
} from './types';
import { hapticSoft } from './utils';

// Progress thresholds for haptic feedback (front-loaded burst)
const HAPTIC_THRESHOLDS = [0.05, 0.12, 0.21, 0.32];
const DOT_SPRITE_GEOMETRY = {
  cellSize: 1,
  cols: 1,
  numAvatars: 1,
  rows: 1,
} as const;

/**
 * Core QR Code Animation component.
 *
 * Renders a 3D torus of avatars that morphs into a scannable QR code.
 * Control via the ref's toggle() method.
 *
 * @example
 * ```tsx
 * const ref = useRef<QRCodeAnimationRef>(null);
 *
 * <QRCodeAnimation
 *   ref={ref}
 *   qrData="https://example.com"
 *   sprite={{
 *     source: require('./sprites.png'),
 *     cols: 5, rows: 4, cellSize: 128, numAvatars: 20
 *   }}
 * />
 *
 * ref.current?.toggle(); // Toggle between torus and QR
 * ```
 */
const QRCodeAnimation = ({
  qrData,
  sprite,
  colors = DEFAULT_COLORS,
  torus = DEFAULT_TORUS,
  avatarSize = DEFAULT_AVATAR_SIZE,
  qrTargetHeight = DEFAULT_QR_TARGET_HEIGHT,
  progress: externalProgress,
  canvasHeight,
  canvasWidth,
  haptics = true,
  idleShape = 'torus',
  onShapeReady,
  style,
  ref,
}: QRCodeAnimationProps) => {
  const window = useWindowDimensions();
  const resolvedCanvasWidth = canvasWidth ?? window.width;
  const resolvedCanvasHeight = canvasHeight ?? window.height;
  const spriteGeometry = sprite ?? DOT_SPRITE_GEOMETRY;
  // ─── ANIMATION STATE ───
  const iTime = useSharedValue(0.0); // Continuous rotation time
  const internalProgress = useSharedValue(0); // Fallback if no external
  const progress = externalProgress ?? internalProgress;
  const isShowingQR = useSharedValue(false); // Current mode
  const lastHapticIndex = useSharedValue(-1); // Haptic tracking
  const staggerBaseTime = useSharedValue(0.0); // Frozen rotation for wave
  const frozenRotationTime = useSharedValue(0.0); // Rotation to lerp from

  // Compute shape data (torus points, QR points, optimal matching)
  const shapeData = useShapeData(
    qrData,
    torus,
    qrTargetHeight,
    spriteGeometry,
    idleShape,
  );

  useEffect(() => {
    if (shapeData.nPoints === 0 || shapeData.sourceData !== qrData) return;
    onShapeReady?.(qrData);
  }, [onShapeReady, qrData, shapeData.nPoints, shapeData.sourceData]);

  // Load sprite sheet
  const spriteSheet = useImage(sprite?.source ?? null);

  /**
   * Toggle between torus and QR code modes.
   */
  const toggle = () => {
    const showQR = !isShowingQR.get();
    isShowingQR.set(showQR);
    lastHapticIndex.set(-1);

    // Freeze rotation for consistent wave pattern
    const currentRotation = iTime.get() % (2 * Math.PI);
    staggerBaseTime.set(currentRotation);
    frozenRotationTime.set(currentRotation);

    // Spring animation (longer for forward direction)
    progress.set(
      withSpring(showQR ? 1 : 0, {
        duration: showQR ? 6000 : 4000,
        dampingRatio: 1,
      }),
    );
  };

  useImperativeHandle(ref, () => ({ toggle }));

  // ─── HAPTIC FEEDBACK ───
  useAnimatedReaction(
    () => progress.get(),
    (current, previous) => {
      if (!haptics || previous === null) return;

      if (current > previous) {
        // Forward: trigger haptics at thresholds
        for (let i = 0; i < HAPTIC_THRESHOLDS.length; i++) {
          if (
            previous < HAPTIC_THRESHOLDS[i] &&
            current >= HAPTIC_THRESHOLDS[i] &&
            i > lastHapticIndex.get()
          ) {
            lastHapticIndex.set(i);
            scheduleOnRN(hapticSoft);
            break;
          }
        }
      } else if (current < 0.05) {
        // Reset when reversing
        lastHapticIndex.set(-1);
      }
    },
  );

  // ─── CONTINUOUS ROTATION ───
  useEffect(() => {
    const duration = 40000; // 40s per rotation
    const rotations = 1000; // Effectively infinite
    iTime.set(
      withTiming(Math.PI * 2 * rotations, {
        duration: duration * rotations,
        easing: Easing.linear,
      }),
    );
  }, [iTime]);

  // ─── RENDER FRAME ───
  const picture = useDerivedValue(() => {
    if (shapeData.nPoints === 0) {
      const recorder = Skia.PictureRecorder();
      recorder.beginRecording(
        Skia.XYWHRect(0, 0, resolvedCanvasWidth, resolvedCanvasHeight),
      );
      return recorder.finishRecordingAsPicture();
    }
    return createPicture(
      spriteSheet,
      progress,
      iTime,
      staggerBaseTime,
      frozenRotationTime,
      shapeData,
      colors,
      avatarSize,
      resolvedCanvasWidth,
      resolvedCanvasHeight,
      idleShape,
    );
  }, [
    spriteSheet,
    progress,
    iTime,
    staggerBaseTime,
    frozenRotationTime,
    shapeData,
    colors,
    avatarSize,
    resolvedCanvasWidth,
    resolvedCanvasHeight,
    idleShape,
  ]);

  // Don't render until both sprite and shape data are ready
  if (shapeData.nPoints === 0) {
    return (
      <View
        style={[
          styles.animationContainer,
          { height: resolvedCanvasHeight, width: resolvedCanvasWidth },
          style,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.animationContainer,
        { height: resolvedCanvasHeight, width: resolvedCanvasWidth },
        style,
      ]}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        <Picture picture={picture} />
      </Canvas>
    </View>
  );
};

const styles = StyleSheet.create({
  animationContainer: {
    overflow: 'hidden',
  },
});

export { QRCodeAnimation };
export type { QRCodeAnimationProps, QRCodeAnimationRef };
