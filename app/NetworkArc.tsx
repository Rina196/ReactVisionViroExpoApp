import { ViroNode, ViroPolyline } from "@reactvision/react-viro";

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

// ============================================================
// NORMALIZE
// ============================================================

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

// ============================================================
// QUADRATIC BEZIER
// ============================================================

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

// ============================================================
// NETWORK ARC
// ============================================================

export default React.memo(function NetworkArc({
  from,
  to,
  sphereCenter,
  sphereRadius,
  arcHeight = 0.12,
  segments = 80,
  thickness = 0.003,
  material = "routeMaterial",
  animationDuration = 1200,
}: Props) {
  // ========================================================
  // ANIMATION
  // ========================================================

  const [progress, setProgress] = useState(0);

  // ========================================================
  // CONTROL POINT
  // ========================================================

  const controlPoint = useMemo(() => {
    const start = from.position;
    const end = to.position;

    // ----------------------------------------------
    // Start direction from Earth center
    // ----------------------------------------------

    const startDirection = normalize([
      start[0] - sphereCenter[0],
      start[1] - sphereCenter[1],
      start[2] - sphereCenter[2],
    ]);

    // ----------------------------------------------
    // End direction from Earth center
    // ----------------------------------------------

    const endDirection = normalize([
      end[0] - sphereCenter[0],
      end[1] - sphereCenter[1],
      end[2] - sphereCenter[2],
    ]);

    // ----------------------------------------------
    // Mid direction
    // ----------------------------------------------

    const middle = normalize([
      startDirection[0] + endDirection[0],

      startDirection[1] + endDirection[1],

      startDirection[2] + endDirection[2],
    ]);

    // ----------------------------------------------
    // Distance between markers
    // ----------------------------------------------

    const markerDistance = distance(start, end);

    // ----------------------------------------------
    // Dynamic arc height
    // ----------------------------------------------

    const dynamicHeight = arcHeight + markerDistance * 0.35;

    const controlRadius = sphereRadius + dynamicHeight;

    // ----------------------------------------------
    // Final control point
    // ----------------------------------------------

    return [
      sphereCenter[0] + middle[0] * controlRadius,

      sphereCenter[1] + middle[1] * controlRadius,

      sphereCenter[2] + middle[2] * controlRadius,
    ] as Vec3Tuple;
  }, [from, to, sphereCenter, sphereRadius, arcHeight]);

  // ========================================================
  // BUILD COMPLETE ARC
  // ========================================================

  const completePoints = useMemo(() => {
    const points: Vec3Tuple[] = [];

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;

      points.push(quadraticBezier(from.position, controlPoint, to.position, t));
    }

    return points;
  }, [from, to, controlPoint, segments]);

  // ========================================================
  // START ANIMATION
  // ========================================================

  useEffect(() => {
    setProgress(0);

    const startTime = Date.now();

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;

      const nextProgress = Math.min(elapsed / animationDuration, 1);

      setProgress(nextProgress);

      if (nextProgress >= 1) {
        clearInterval(timer);
      }
    }, 16);

    return () => {
      clearInterval(timer);
    };
  }, [from.id, to.id, animationDuration]);

  // ========================================================
  // VISIBLE ARC
  // ========================================================

  const visiblePoints = useMemo(() => {
    if (completePoints.length < 2) {
      return [];
    }

    const index = Math.max(
      1,
      Math.floor(progress * (completePoints.length - 1)),
    );

    return completePoints.slice(0, index + 1);
  }, [completePoints, progress]);

  // ========================================================
  // RENDER
  // ========================================================

  if (visiblePoints.length < 2) {
    return null;
  }

  return (
    <ViroNode>
      <ViroPolyline
        points={visiblePoints}
        thickness={thickness}
        materials={[material]}
      />
    </ViroNode>
  );
});
