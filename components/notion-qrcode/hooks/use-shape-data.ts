import { useEffect, useRef, useState } from 'react';

import {
  generateControllerPoints,
  generateQRMatrix,
  generateQRPointsFromModules,
  generateTorusPoints,
  getQRBlackModules,
  hungarianMatch,
  normalizeShape,
  sortBySpiral,
  sortControllerByFlow,
  sortTorusByFlow,
} from '../utils';

import type {
  IdleShape,
  Point3D,
  ShapeData,
  SpriteConfig,
  TorusConfig,
} from '../types';

type SpriteGeometry = Pick<
  SpriteConfig,
  'cellSize' | 'cols' | 'numAvatars' | 'rows'
>;

// Cache for computed shape data to avoid recomputation on re-mount
const shapeDataCache = new Map<string, ShapeData>();

// Invite URLs vary enough in QR version to otherwise change the controller's
// density just before the morph begins. Keep its particle count stable and
// repeat final QR modules as needed so every real module remains represented.
const CONTROLLER_PARTICLE_COUNT = 1320;

const computeShapeData = (
  qrData: string,
  torus: TorusConfig,
  qrTargetHeight: number,
  sprite: SpriteGeometry,
  idleShape: IdleShape,
): ShapeData => {
  // Generate QR matrix and get black modules
  const qrMatrix = generateQRMatrix(qrData);
  const qrBlackModules = getQRBlackModules(qrMatrix);

  const qrPointCount = qrBlackModules.length;
  const nPoints =
    idleShape === 'controller'
      ? Math.max(CONTROLLER_PARTICLE_COUNT, qrPointCount)
      : qrPointCount;
  const qrSize = qrMatrix.length;
  const qrModuleSize = qrTargetHeight / qrSize;

  // Generate shapes with matching point counts
  const rawIdlePoints =
    idleShape === 'controller'
      ? generateControllerPoints(nPoints)
      : generateTorusPoints(nPoints, torus.majorRadius, torus.minorRadius);
  const qrModulePoints = generateQRPointsFromModules(qrBlackModules, qrSize);
  const rawQRPoints = Array.from({ length: nPoints }, (_, index) => {
    const sourceIndex = Math.floor((index * qrPointCount) / nPoints);
    return qrModulePoints[sourceIndex];
  });

  // Normalize shapes
  const normalizedIdle = normalizeShape(rawIdlePoints, torus.targetHeight);
  const normalizedQR = normalizeShape(rawQRPoints, qrTargetHeight);

  // Sort torus by flow for visual coherence
  const idlePoints =
    idleShape === 'controller'
      ? sortControllerByFlow(normalizedIdle)
      : sortTorusByFlow(normalizedIdle);

  // Use greedy matching (fast O(n²) instead of O(n³) Hungarian)
  const qrPoints = hungarianMatch(idlePoints, sortBySpiral(normalizedQR));

  // Assign each point an avatar index
  const avatarAssignments = Array.from(
    { length: nPoints },
    (_, i) => i % sprite.numAvatars,
  );

  // Sprite rect coordinates
  const spriteCoords = Array.from({ length: sprite.numAvatars }, (_, i) => ({
    x: (i % sprite.cols) * sprite.cellSize,
    y: Math.floor(i / sprite.cols) * sprite.cellSize,
    w: sprite.cellSize,
    h: sprite.cellSize,
  }));

  return {
    allShapes: [idlePoints, qrPoints],
    nPoints,
    qrSize,
    qrModuleSize,
    sourceData: qrData,
    avatarAssignments,
    spriteCoords,
  };
};

// Minimal placeholder while loading (single invisible point)
const EMPTY_SHAPE_DATA: ShapeData = {
  allShapes: [[], []] as [Point3D[], Point3D[]],
  nPoints: 0,
  qrSize: 0,
  qrModuleSize: 0,
  sourceData: null,
  avatarAssignments: [],
  spriteCoords: [],
};

export const useShapeData = (
  qrData: string,
  torus: TorusConfig,
  qrTargetHeight: number,
  sprite: SpriteGeometry,
  idleShape: IdleShape = 'torus',
): ShapeData => {
  const cacheKey = `${qrData}-${idleShape}-${torus.majorRadius}-${torus.minorRadius}-${torus.targetHeight}-${qrTargetHeight}-${sprite.numAvatars}`;
  const cached = shapeDataCache.get(cacheKey);

  const [shapeData, setShapeData] = useState<ShapeData>(
    cached ?? EMPTY_SHAPE_DATA,
  );
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // If already cached, use it immediately
    if (shapeDataCache.has(cacheKey)) {
      const cachedTimer = setTimeout(() => {
        if (mountedRef.current) setShapeData(shapeDataCache.get(cacheKey)!);
      }, 0);
      return () => clearTimeout(cachedTimer);
    }

    // Defer heavy computation until after navigation/render completes
    // Use requestAnimationFrame + setTimeout to let the UI settle first
    let rafId: number;
    let timeoutId: ReturnType<typeof setTimeout>;

    rafId = requestAnimationFrame(() => {
      timeoutId = setTimeout(() => {
        if (!mountedRef.current) return;

        const data = computeShapeData(
          qrData,
          torus,
          qrTargetHeight,
          sprite,
          idleShape,
        );
        shapeDataCache.set(cacheKey, data);

        if (mountedRef.current) {
          setShapeData(data);
        }
      }, 0);
    });

    return () => {
      mountedRef.current = false;
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
    };
  }, [cacheKey, idleShape, qrData, torus, qrTargetHeight, sprite]);

  return shapeData;
};
