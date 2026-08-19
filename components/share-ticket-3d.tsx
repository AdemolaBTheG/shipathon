/* eslint-disable import/no-named-as-default, react/no-unknown-property */
import { Canvas, useFrame } from "@react-three/fiber/native";
import qrcode from "qrcode-generator";
import { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import * as THREE from "three";
import helvetikerBold from "three/examples/fonts/helvetiker_bold.typeface.json";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import {
  FontLoader,
  type FontData,
} from "three/examples/jsm/loaders/FontLoader.js";

type ShareTicket3DProps = {
  url: string;
};

type TicketModelProps = ShareTicket3DProps & {
  reduceMotion: boolean;
};

const TICKET_HALF_WIDTH = 2.3;
const TICKET_HALF_HEIGHT = 1.25;
const CUTOUT_RADIUS = 0.28;
const CIRCLE_CONTROL = 0.5522848;
const BORDER_INSET = 0.17;
const BORDER_THICKNESS = 0.055;
const PORTRAIT_ROTATION = Math.PI / 2;
const titleFont = new FontLoader().parse(helvetikerBold as FontData);

function createTicketShape() {
  const shape = new THREE.Shape();
  const width = TICKET_HALF_WIDTH;
  const height = TICKET_HALF_HEIGHT;
  const radius = CUTOUT_RADIUS;
  const control = radius * CIRCLE_CONTROL;

  shape.moveTo(-width + radius, height);
  shape.lineTo(width - radius, height);
  shape.bezierCurveTo(
    width - radius,
    height - control,
    width - control,
    height - radius,
    width,
    height - radius,
  );
  shape.lineTo(width, radius);
  shape.bezierCurveTo(
    width - control,
    radius,
    width - radius,
    control,
    width - radius,
    0,
  );
  shape.bezierCurveTo(
    width - radius,
    -control,
    width - control,
    -radius,
    width,
    -radius,
  );
  shape.lineTo(width, -height + radius);
  shape.bezierCurveTo(
    width - control,
    -height + radius,
    width - radius,
    -height + control,
    width - radius,
    -height,
  );
  shape.lineTo(-width + radius, -height);
  shape.bezierCurveTo(
    -width + radius,
    -height + control,
    -width + control,
    -height + radius,
    -width,
    -height + radius,
  );
  shape.lineTo(-width, -radius);
  shape.bezierCurveTo(
    -width + control,
    -radius,
    -width + radius,
    -control,
    -width + radius,
    0,
  );
  shape.bezierCurveTo(
    -width + radius,
    control,
    -width + control,
    radius,
    -width,
    radius,
  );
  shape.lineTo(-width, height - radius);
  shape.bezierCurveTo(
    -width + control,
    height - radius,
    -width + radius,
    height - control,
    -width + radius,
    height,
  );
  shape.closePath();

  return shape;
}

function createBorderArcShape(
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
) {
  const shape = new THREE.Shape();
  const outerRadius = radius + BORDER_THICKNESS / 2;
  const innerRadius = radius - BORDER_THICKNESS / 2;
  const segments = 16;

  for (let index = 0; index <= segments; index += 1) {
    const progress = index / segments;
    const angle = startAngle + (endAngle - startAngle) * progress;
    const x = centerX + Math.cos(angle) * outerRadius;
    const y = centerY + Math.sin(angle) * outerRadius;

    if (index === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  }

  for (let index = segments; index >= 0; index -= 1) {
    const progress = index / segments;
    const angle = startAngle + (endAngle - startAngle) * progress;
    shape.lineTo(
      centerX + Math.cos(angle) * innerRadius,
      centerY + Math.sin(angle) * innerRadius,
    );
  }

  shape.closePath();
  return shape;
}

function createQrTexture(url: string) {
  const qr = qrcode(0, "H");
  qr.addData(url);
  qr.make();

  const quietZone = 4;
  const modules = qr.getModuleCount();
  const size = modules + quietZone * 2;
  const pixels = new Uint8Array(size * size * 4);

  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const qrRow = row - quietZone;
      const qrColumn = column - quietZone;
      const isInside =
        qrRow >= 0 && qrRow < modules && qrColumn >= 0 && qrColumn < modules;
      const isDark = isInside && qr.isDark(qrRow, qrColumn);
      const value = isDark ? 10 : 255;
      const offset = (row * size + column) * 4;

      pixels[offset] = value;
      pixels[offset + 1] = value;
      pixels[offset + 2] = value;
      pixels[offset + 3] = isDark ? 255 : 0;
    }
  }

  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

function TicketModel({ reduceMotion, url }: TicketModelProps) {
  const group = useRef<THREE.Group>(null);
  const shape = useMemo(() => createTicketShape(), []);
  const qrTexture = useMemo(() => createQrTexture(url), [url]);
  const borderArcs = useMemo(() => {
    const horizontalCenter = TICKET_HALF_WIDTH - BORDER_INSET;
    const verticalCenter = TICKET_HALF_HEIGHT - BORDER_INSET;

    return [
      createBorderArcShape(horizontalCenter, 0, CUTOUT_RADIUS, Math.PI / 2, (Math.PI * 3) / 2),
      createBorderArcShape(-horizontalCenter, 0, CUTOUT_RADIUS, -Math.PI / 2, Math.PI / 2),
      createBorderArcShape(horizontalCenter, verticalCenter, CUTOUT_RADIUS, Math.PI, (Math.PI * 3) / 2),
      createBorderArcShape(horizontalCenter, -verticalCenter, CUTOUT_RADIUS, Math.PI / 2, Math.PI),
      createBorderArcShape(-horizontalCenter, -verticalCenter, CUTOUT_RADIUS, 0, Math.PI / 2),
      createBorderArcShape(-horizontalCenter, verticalCenter, CUTOUT_RADIUS, -Math.PI / 2, 0),
    ];
  }, []);
  const titleGeometry = useMemo(() => {
    const geometry = new TextGeometry("JOYLOGUE", {
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 0.008,
      bevelThickness: 0.008,
      curveSegments: 8,
      depth: 0.025,
      font: titleFont,
      size: 0.2,
    });
    geometry.center();
    return geometry;
  }, []);

  useEffect(() => () => qrTexture.dispose(), [qrTexture]);
  useEffect(() => () => titleGeometry.dispose(), [titleGeometry]);

  useFrame(({ clock }) => {
    if (!group.current || reduceMotion) {
      return;
    }

    const time = clock.getElapsedTime();
    group.current.rotation.x = -0.08 + Math.cos(time * 0.55) * 0.06;
    group.current.rotation.y = Math.sin(time * 0.48) * 0.18;
    group.current.rotation.z =
      PORTRAIT_ROTATION - 0.07 + Math.sin(time * 0.32) * 0.025;
    group.current.position.y = Math.sin(time * 0.65) * 0.08;
  });

  return (
    <group ref={group} rotation={[-0.08, 0, PORTRAIT_ROTATION - 0.07]}>
      <mesh>
        <extrudeGeometry
          args={[
            shape,
            {
              bevelEnabled: true,
              bevelSegments: 5,
              bevelSize: 0.035,
              bevelThickness: 0.045,
              curveSegments: 20,
              depth: 0.16,
            },
          ]}
        />
        <meshStandardMaterial
          color="#D69C00"
          metalness={0.55}
          roughness={0.22}
        />
      </mesh>

      <mesh position={[0, 0, 0.215]}>
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial
          color="#D69C00"
          metalness={0.55}
          polygonOffset
          polygonOffsetFactor={-1}
          roughness={0.22}
        />
      </mesh>

      <group position={[0, 0, 0.225]}>
        <mesh position={[0, TICKET_HALF_HEIGHT - BORDER_INSET, 0]}>
          <planeGeometry
            args={[
              (TICKET_HALF_WIDTH - CUTOUT_RADIUS - BORDER_INSET) * 2,
              BORDER_THICKNESS,
            ]}
          />
          <meshBasicMaterial color="#111111" toneMapped={false} />
        </mesh>
        <mesh position={[0, -TICKET_HALF_HEIGHT + BORDER_INSET, 0]}>
          <planeGeometry
            args={[
              (TICKET_HALF_WIDTH - CUTOUT_RADIUS - BORDER_INSET) * 2,
              BORDER_THICKNESS,
            ]}
          />
          <meshBasicMaterial color="#111111" toneMapped={false} />
        </mesh>

        {[-1, 1].flatMap((xDirection) =>
          [-1, 1].map((yDirection) => (
            <mesh
              key={`${xDirection}-${yDirection}`}
              position={[
                xDirection * (TICKET_HALF_WIDTH - BORDER_INSET),
                yDirection * 0.54,
                0,
              ]}
            >
              <planeGeometry args={[BORDER_THICKNESS, 0.52]} />
              <meshBasicMaterial color="#111111" toneMapped={false} />
            </mesh>
          )),
        )}

        {borderArcs.map((borderArc, index) => (
          <mesh key={index}>
            <shapeGeometry args={[borderArc]} />
            <meshBasicMaterial color="#111111" toneMapped={false} />
          </mesh>
        ))}
      </group>

      <mesh position={[0, 0, 0.235]}>
        <planeGeometry args={[1.88, 1.88]} />
        <meshBasicMaterial
          alphaTest={0.5}
          map={qrTexture}
          toneMapped={false}
          transparent
        />
      </mesh>

      <mesh
        geometry={titleGeometry}
        position={[1.57, 0, 0.245]}
        rotation={[0, 0, -PORTRAIT_ROTATION]}
      >
        <meshStandardMaterial
          color="#111111"
          metalness={0.08}
          roughness={0.5}
        />
      </mesh>
    </group>
  );
}

export function ShareTicket3D({ url }: ShareTicket3DProps) {
  const reduceMotion = useReducedMotion();

  return (
    <View style={styles.container}>
      <Canvas
        camera={{ fov: 38, position: [0, 0, 7.5] }}
        gl={{ alpha: true }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      >
        <ambientLight intensity={1.35} />
        <directionalLight
          color="#FFF2C4"
          intensity={3.5}
          position={[-3, 4, 5]}
        />
        <pointLight color="#64FFDA" intensity={18} position={[3.5, -2.5, 3]} />
        <TicketModel reduceMotion={reduceMotion} url={url} />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    aspectRatio: 0.72,
    borderRadius: 24,
    overflow: "hidden",
    width: "100%",
  },
});
