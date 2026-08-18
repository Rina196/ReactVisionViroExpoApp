import { ViroBox, ViroNode } from "@reactvision/react-viro";
import React, { useEffect, useMemo, useState } from "react";

type Vec3Tuple = [number, number, number];

type MarkerPinProps = {
  position: Vec3Tuple;
  normal: Vec3Tuple;
  material: string;
  targetLength?: number;
  radius?: number;
};

const EPSILON = 0.000001;

// ============================================================
// NORMALIZE
// ============================================================

const normalize = (v: Vec3Tuple): Vec3Tuple => {
  const length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);

  if (!Number.isFinite(length) || length < EPSILON) {
    return [0, 1, 0];
  }

  return [v[0] / length, v[1] / length, v[2] / length];
};

// ============================================================
// NORMAL -> VIRO ROTATION
//
// Marker local +Y axis is:
//
//        ↑
//        Y
//
// We rotate that axis so it follows
// the Earth's outward surface normal.
//
// This works for every point on the sphere.
// ============================================================

const normalToRotation = (normal: Vec3Tuple): Vec3Tuple => {
  const n = normalize(normal);

  const x = n[0];
  const y = n[1];
  const z = n[2];

  // ----------------------------------------------------------
  // Horizontal direction
  // ----------------------------------------------------------

  const horizontalLength = Math.sqrt(x * x + z * z);

  // ----------------------------------------------------------
  // Pitch
  //
  // Controls how much the marker tilts away
  // from the Earth's Y axis.
  // ----------------------------------------------------------

  const pitch = Math.atan2(horizontalLength, y) * (180 / Math.PI);

  // ----------------------------------------------------------
  // Yaw
  //
  // Controls rotation around the sphere.
  // ----------------------------------------------------------

  const yaw = Math.atan2(x, z) * (180 / Math.PI);

  // ----------------------------------------------------------
  // Important:
  //
  // ViroBox's long axis is local Y.
  // We rotate X for the sphere tilt and Y
  // for the longitude direction.
  //
  // ----------------------------------------------------------

  return [pitch, yaw, 0];
};

// ============================================================
// COMPONENT
// ============================================================

export default React.memo(function MarkerPin({
  position,
  normal,
  material,
  targetLength = 0.05,
  radius = 0.006,
}: MarkerPinProps) {
  const [progress, setProgress] = useState(0);

  // ----------------------------------------------------------
  // Normalize only once when normal changes
  // ----------------------------------------------------------

  const normalizedNormal = useMemo(() => normalize(normal), [normal]);

  // ----------------------------------------------------------
  // Calculate marker orientation
  // ----------------------------------------------------------

  const rotation = useMemo(
    () => normalToRotation(normalizedNormal),
    [normalizedNormal],
  );

  // ==========================================================
  // DEBUG
  // ==========================================================

  useEffect(() => {
    console.log("================================");
    console.log("📍 MARKER");
    console.log("POSITION:", position);
    console.log("NORMAL:", normalizedNormal);
    console.log("ROTATION:", rotation);
    console.log("================================");
  }, [position, normalizedNormal, rotation]);

  // ==========================================================
  // MARKER GROW ANIMATION
  // ==========================================================

  useEffect(() => {
    setProgress(0);

    let value = 0;

    const timer = setInterval(() => {
      value += 0.06;

      if (value >= 1) {
        value = 1;
        clearInterval(timer);
      }

      setProgress(value);
    }, 16);

    return () => {
      clearInterval(timer);
    };
  }, [position]);

  // ==========================================================
  // CURRENT LENGTH
  // ==========================================================

  const currentLength = targetLength * progress;

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <ViroNode position={position} rotation={rotation}>
      {currentLength > 0.0001 && (
        <ViroBox
          position={[0, currentLength / 2, 0]}
          scale={[radius, currentLength, radius]}
          materials={[material]}
        />
      )}
    </ViroNode>
  );
});
