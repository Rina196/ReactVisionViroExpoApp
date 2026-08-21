import { Viro3DObject, ViroNode, ViroPolyline } from "@reactvision/react-viro";

import React, { useEffect, useMemo, useState } from "react";

type Vec3Tuple = [number, number, number];

type RoutePoint = {
  id: string;
  position: Vec3Tuple;
  normal: Vec3Tuple;
  latitude: number;
  longitude: number;
  stateName?: string;
};

type Props = {
  from: RoutePoint;
  to: RoutePoint;
  sphereCenter: Vec3Tuple;
  sphereRadius: number;
  arcHeight?: number;
  segments?: number;
  thickness?: number;
  material?: string;

  animationDuration?: number;
};

const MOVING_OBJECT_SOURCE = require("./../assets/models/Airplane.glb");

const AIRPLANE_SURFACE_OFFSET = 0.015;

const MODEL_LOCAL_CENTER: Vec3Tuple = [1.64484, 74.16682, -144.95105];

const MOVING_OBJECT_SCALE: Vec3Tuple = [0.0000358, 0.0000358, 0.0000358];

const AIRPLANE_ROTATION_OFFSET: Vec3Tuple = [0, 0, 0];

const normalize = (v: Vec3Tuple): Vec3Tuple => {
  const length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);

  if (!Number.isFinite(length) || length < 0.000001) {
    return [0, 1, 0];
  }

  return [v[0] / length, v[1] / length, v[2] / length];
};

// ============================================================
// DISTANCE
// ============================================================

const distance = (a: Vec3Tuple, b: Vec3Tuple): number => {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];

  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

const quadraticBezier = (
  start: Vec3Tuple,
  control: Vec3Tuple,
  end: Vec3Tuple,
  t: number,
): Vec3Tuple => {
  const inv = 1 - t;

  return [
    inv * inv * start[0] + 2 * inv * t * control[0] + t * t * end[0],

    inv * inv * start[1] + 2 * inv * t * control[1] + t * t * end[1],

    inv * inv * start[2] + 2 * inv * t * control[2] + t * t * end[2],
  ];
};

export default React.memo(function NetworkArc({
  from,
  to,
  sphereCenter,
  sphereRadius,
  arcHeight = 0.12,
  segments = 40,
  thickness = 0.003,
  material = "routeMaterial",
  animationDuration = 1200,
}: Props) {
  const [progress, setProgress] = useState(0);

  const [modelLoaded, setModelLoaded] = useState(false);

  const progressRef = React.useRef(0);

  useEffect(() => {
    setProgress(0);
    setModelLoaded(false);
  }, [from.id, to.id]);

  const controlPoint = useMemo(() => {
    const start = from.position;
    const end = to.position;

    const startDirection = normalize([
      start[0] - sphereCenter[0],

      start[1] - sphereCenter[1],

      start[2] - sphereCenter[2],
    ]);

    const endDirection = normalize([
      end[0] - sphereCenter[0],

      end[1] - sphereCenter[1],

      end[2] - sphereCenter[2],
    ]);

    const middle = normalize([
      startDirection[0] + endDirection[0],

      startDirection[1] + endDirection[1],

      startDirection[2] + endDirection[2],
    ]);

    const markerDistance = distance(start, end);

    const dynamicHeight = arcHeight + markerDistance * 0.35;

    const controlRadius = sphereRadius + dynamicHeight;

    return [
      sphereCenter[0] + middle[0] * controlRadius,

      sphereCenter[1] + middle[1] * controlRadius,

      sphereCenter[2] + middle[2] * controlRadius,
    ] as Vec3Tuple;
  }, [from, to, sphereCenter, sphereRadius, arcHeight]);

  const completePoints = useMemo(() => {
    const points: Vec3Tuple[] = [];

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;

      points.push(quadraticBezier(from.position, controlPoint, to.position, t));
    }

    return points;
  }, [from.position, controlPoint, to.position, segments]);

  const routeDirections = useMemo(() => {
    const directions: Vec3Tuple[] = [];

    for (let i = 0; i < completePoints.length; i++) {
      const prev = completePoints[Math.max(0, i - 1)];
      const next = completePoints[Math.min(completePoints.length - 1, i + 1)];

      directions.push(
        normalize([next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]]),
      );
    }

    return directions;
  }, [completePoints]);

  useEffect(() => {
    if (!modelLoaded) {
      return;
    }

    console.log("🚀 Starting airplane + polyline animation");

    progressRef.current = 0;
    setProgress(0);

    const startTime = Date.now();

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const nextProgress = Math.min(elapsed / animationDuration, 1);

      progressRef.current = nextProgress;
      setProgress(nextProgress);

      if (nextProgress >= 1) {
        clearInterval(timer);
      }
    }, 33);

    return () => {
      clearInterval(timer);
    };
  }, [modelLoaded, animationDuration, from.id, to.id]);

  const animationPoint = useMemo(() => {
    const currentProgress = modelLoaded ? progress : 0;

    if (completePoints.length < 2) {
      return from.position;
    }

    const exactIndex = currentProgress * (completePoints.length - 1);
    const index = Math.floor(exactIndex);
    const nextIndex = Math.min(index + 1, completePoints.length - 1);
    const localT = exactIndex - index;

    const a = completePoints[index];
    const b = completePoints[nextIndex];

    return [
      a[0] + (b[0] - a[0]) * localT,
      a[1] + (b[1] - a[1]) * localT,
      a[2] + (b[2] - a[2]) * localT,
    ] as Vec3Tuple;
  }, [modelLoaded, progress, completePoints, from.position]);

  const visiblePoints = useMemo(() => {
    /**
     * Don't draw the animated route before
     * the airplane has loaded.
     */
    if (!modelLoaded) {
      return [];
    }

    if (completePoints.length < 2) {
      return [];
    }

    const exactIndex = progress * (completePoints.length - 1);

    const index = Math.floor(exactIndex);

    const clampedIndex = Math.min(
      completePoints.length - 1,

      Math.max(0, index),
    );

    const points = completePoints.slice(0, clampedIndex + 1);

    const lastPoint = points[points.length - 1];

    if (!lastPoint || distance(lastPoint, animationPoint) > 0.000001) {
      points.push(animationPoint);
    }

    return points;
  }, [modelLoaded, completePoints, progress, animationPoint]);

  const airplanePosition = useMemo(() => {
    const currentPoint = animationPoint;

    const normal = normalize([
      currentPoint[0] - sphereCenter[0],

      currentPoint[1] - sphereCenter[1],

      currentPoint[2] - sphereCenter[2],
    ]);

    return [
      currentPoint[0] + normal[0] * AIRPLANE_SURFACE_OFFSET,

      currentPoint[1] + normal[1] * AIRPLANE_SURFACE_OFFSET,

      currentPoint[2] + normal[2] * AIRPLANE_SURFACE_OFFSET,
    ] as Vec3Tuple;
  }, [animationPoint, sphereCenter]);

  const airplaneRotation = useMemo(() => {
    if (!modelLoaded || completePoints.length < 2) {
      return AIRPLANE_ROTATION_OFFSET;
    }

    const exactIndex = progress * (completePoints.length - 1);
    const index = Math.min(Math.floor(exactIndex), completePoints.length - 1);
    const nextIndex = Math.min(index + 1, completePoints.length - 1);
    const localT = exactIndex - index;

    const d1 = routeDirections[index];
    const d2 = routeDirections[nextIndex];

    const dx = d1[0] + (d2[0] - d1[0]) * localT;
    const dz = d1[2] + (d2[2] - d1[2]) * localT;

    const horizontalLength = Math.sqrt(dx * dx + dz * dz);

    if (horizontalLength < 0.000001) {
      return AIRPLANE_ROTATION_OFFSET;
    }

    const yaw = (Math.atan2(dx, dz) * 180) / Math.PI;

    return [
      AIRPLANE_ROTATION_OFFSET[0],
      yaw + AIRPLANE_ROTATION_OFFSET[1],
      AIRPLANE_ROTATION_OFFSET[2],
    ] as Vec3Tuple;
  }, [modelLoaded, progress, completePoints, routeDirections]);

  return (
    <ViroNode>
      {modelLoaded && visiblePoints.length >= 2 && (
        <ViroPolyline
          points={visiblePoints}
          thickness={thickness}
          materials={[material]}
        />
      )}

      <ViroNode position={airplanePosition} rotation={airplaneRotation}>
        <Viro3DObject
          source={MOVING_OBJECT_SOURCE}
          type="GLB"
          position={[
            -MODEL_LOCAL_CENTER[0] * MOVING_OBJECT_SCALE[0],

            -MODEL_LOCAL_CENTER[1] * MOVING_OBJECT_SCALE[1],

            -MODEL_LOCAL_CENTER[2] * MOVING_OBJECT_SCALE[2],
          ]}
          rotation={[0, 0, 0]}
          scale={MOVING_OBJECT_SCALE}
          lightReceivingBitMask={3}
          onLoadStart={() => {
            console.log("✈️ Airplane loading...");

            setModelLoaded(false);
          }}
          onLoadEnd={() => {
            console.log("✈️ Airplane loaded!");

            setProgress(0);

            setModelLoaded(true);
          }}
          onError={(event) => {
            console.log("❌ Airplane load error:", event.nativeEvent);
          }}
        />
      </ViroNode>
    </ViroNode>
  );
});
