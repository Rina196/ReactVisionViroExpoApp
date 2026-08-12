// ============================================================
// TYPES
// ============================================================

export type Vec3 = {
  x: number;
  y: number;
  z: number;
};

export type Vec3Tuple = [number, number, number];

export type EarthTransform = {
  position: Vec3;

  /**
   * Euler rotation in degrees.
   */
  rotation: [number, number, number];

  /**
   * Uniform scale.
   */
  scale: number;

  /**
   * LOCAL sphere radius.
   */
  radius: number;
};

export type LocationInfo = {
  country?: string;
  state?: string;
  city?: string;
  name?: string;
};

export type MarkerLine = {
  start: Vec3Tuple;
  end: Vec3Tuple;
};

export type Position = [number, number];

export type LinearRing = Position[];

export type PolygonCoordinates = LinearRing[];

export type MultiPolygonCoordinates = PolygonCoordinates[];

export type GeoFeature = {
  type: "Feature";

  properties: {
    shapeName: string;
    shapeID: string;
    shapeGroup: string;
    shapeType: string;
  };

  geometry:
    | {
        type: "Polygon";
        coordinates: PolygonCoordinates;
      }
    | {
        type: "MultiPolygon";
        coordinates: MultiPolygonCoordinates;
      };
};

// ============================================================
// VECTOR
// ============================================================

export function normalizeVector(vector: Vec3): Vec3 {
  const length = Math.sqrt(
    vector.x * vector.x + vector.y * vector.y + vector.z * vector.z,
  );

  if (length === 0) {
    return {
      x: 0,
      y: 0,
      z: 0,
    };
  }

  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
}

export function vectorLength(vector: Vec3): number {
  return Math.sqrt(
    vector.x * vector.x + vector.y * vector.y + vector.z * vector.z,
  );
}

export function subtractVectors(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z,
  };
}

export function addVectors(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
  };
}

export function multiplyVector(vector: Vec3, scalar: number): Vec3 {
  return {
    x: vector.x * scalar,
    y: vector.y * scalar,
    z: vector.z * scalar,
  };
}

// ============================================================
// EULER ROTATION
// ============================================================

/**
 * Rotate vector using the same Euler order used by
 * the existing Earth coordinate system.
 *
 * Order:
 *
 *   X -> Y -> Z
 */
export function rotateVector(
  vector: Vec3,
  euler: [number, number, number],
): Vec3 {
  const radX = (euler[0] * Math.PI) / 180;
  const radY = (euler[1] * Math.PI) / 180;
  const radZ = (euler[2] * Math.PI) / 180;

  const cosX = Math.cos(radX);
  const sinX = Math.sin(radX);

  const cosY = Math.cos(radY);
  const sinY = Math.sin(radY);

  const cosZ = Math.cos(radZ);
  const sinZ = Math.sin(radZ);

  // ----------------------------------------------------------
  // X
  // ----------------------------------------------------------

  const x1 = vector.x;

  const y1 = vector.y * cosX - vector.z * sinX;

  const z1 = vector.y * sinX + vector.z * cosX;

  // ----------------------------------------------------------
  // Y
  // ----------------------------------------------------------

  const x2 = x1 * cosY + z1 * sinY;

  const y2 = y1;

  const z2 = -x1 * sinY + z1 * cosY;

  // ----------------------------------------------------------
  // Z
  // ----------------------------------------------------------

  const x3 = x2 * cosZ - y2 * sinZ;

  const y3 = x2 * sinZ + y2 * cosZ;

  const z3 = z2;

  return {
    x: x3,
    y: y3,
    z: z3,
  };
}

// ============================================================
// INVERSE EULER ROTATION
// ============================================================

/**
 * IMPORTANT:
 *
 * The inverse of:
 *
 *   Rx -> Ry -> Rz
 *
 * is NOT generally:
 *
 *   -Rx -> -Ry -> -Rz
 *
 * in the same order.
 *
 * The inverse has to be applied in reverse order:
 *
 *   Rz^-1 -> Ry^-1 -> Rx^-1
 *
 * This function performs that correctly.
 */
export function inverseRotateVector(
  vector: Vec3,
  euler: [number, number, number],
): Vec3 {
  const radX = (-euler[0] * Math.PI) / 180;
  const radY = (-euler[1] * Math.PI) / 180;
  const radZ = (-euler[2] * Math.PI) / 180;

  const cosX = Math.cos(radX);
  const sinX = Math.sin(radX);

  const cosY = Math.cos(radY);
  const sinY = Math.sin(radY);

  const cosZ = Math.cos(radZ);
  const sinZ = Math.sin(radZ);

  // ----------------------------------------------------------
  // Inverse Z
  // ----------------------------------------------------------

  const x1 = vector.x * cosZ - vector.y * sinZ;

  const y1 = vector.x * sinZ + vector.y * cosZ;

  const z1 = vector.z;

  // ----------------------------------------------------------
  // Inverse Y
  // ----------------------------------------------------------

  const x2 = x1 * cosY + z1 * sinY;

  const y2 = y1;

  const z2 = -x1 * sinY + z1 * cosY;

  // ----------------------------------------------------------
  // Inverse X
  // ----------------------------------------------------------

  const x3 = x2;

  const y3 = y2 * cosX - z2 * sinX;

  const z3 = y2 * sinX + z2 * cosX;

  return {
    x: x3,
    y: y3,
    z: z3,
  };
}

// ============================================================
// WORLD -> EARTH LOCAL
// ============================================================

/**
 * Convert an AR WORLD point into Earth LOCAL coordinates.
 *
 * WORLD:
 *
 *   translation
 *   rotation
 *   scale
 *
 * LOCAL:
 *
 *   Earth center = [0,0,0]
 *   Earth radius = transform.radius
 */
export function worldToEarthLocal(
  worldPoint: Vec3,
  transform: EarthTransform,
): Vec3 {
  // ----------------------------------------------------------
  // 1. Remove Earth translation
  // ----------------------------------------------------------

  const translated: Vec3 = {
    x: worldPoint.x - transform.position.x,

    y: worldPoint.y - transform.position.y,

    z: worldPoint.z - transform.position.z,
  };

  // ----------------------------------------------------------
  // 2. Remove Earth scale
  // ----------------------------------------------------------

  const scale = transform.scale === 0 ? 1 : transform.scale;

  const unscaled: Vec3 = {
    x: translated.x / scale,
    y: translated.y / scale,
    z: translated.z / scale,
  };

  // ----------------------------------------------------------
  // 3. Remove Earth rotation
  // ----------------------------------------------------------

  return inverseRotateVector(unscaled, transform.rotation);
}

// ============================================================
// EARTH LOCAL -> WORLD
// ============================================================

/**
 * Convert an Earth LOCAL point into AR WORLD coordinates.
 */
export function earthLocalToWorld(
  localPoint: Vec3,
  transform: EarthTransform,
): Vec3 {
  // ----------------------------------------------------------
  // 1. Apply scale
  // ----------------------------------------------------------

  const scaled: Vec3 = {
    x: localPoint.x * transform.scale,
    y: localPoint.y * transform.scale,
    z: localPoint.z * transform.scale,
  };

  // ----------------------------------------------------------
  // 2. Apply rotation
  // ----------------------------------------------------------

  const rotated = rotateVector(scaled, transform.rotation);

  // ----------------------------------------------------------
  // 3. Apply translation
  // ----------------------------------------------------------

  return {
    x: rotated.x + transform.position.x,

    y: rotated.y + transform.position.y,

    z: rotated.z + transform.position.z,
  };
}

// ============================================================
// WORLD NORMAL
// ============================================================

/**
 * Convert an Earth LOCAL normal to WORLD normal.
 *
 * IMPORTANT:
 *
 * Normals are not translated and uniform scale does not
 * change their direction.
 */
export function earthLocalNormalToWorld(
  localNormal: Vec3,
  transform: EarthTransform,
): Vec3 {
  return normalizeVector(
    rotateVector(normalizeVector(localNormal), transform.rotation),
  );
}

// ============================================================
// PROJECT POINT ONTO SPHERE
// ============================================================

/**
 * Project an arbitrary LOCAL point radially onto the sphere.
 *
 * This is useful as a final stabilization step when Viro's
 * click position is slightly inside/outside the sphere.
 */
export function projectPointToSphere(
  point: Vec3,
  sphereRadius: number,
): Vec3 | null {
  const distance = vectorLength(point);

  if (distance <= 0.0000001) {
    return null;
  }

  const factor = sphereRadius / distance;

  return {
    x: point.x * factor,
    y: point.y * factor,
    z: point.z * factor,
  };
}

// ============================================================
// SPHERE DISTANCE DEBUG
// ============================================================

export function sphereSurfaceError(point: Vec3, sphereRadius: number): number {
  return Math.abs(vectorLength(point) - sphereRadius);
}

// ============================================================
// RAY
// ============================================================

export function rayDirection(rayOrigin: Vec3, target: Vec3): Vec3 {
  return normalizeVector({
    x: target.x - rayOrigin.x,
    y: target.y - rayOrigin.y,
    z: target.z - rayOrigin.z,
  });
}

// ============================================================
// RAY / SPHERE INTERSECTION
// ============================================================

export function intersectRaySphere(
  rayOrigin: Vec3,
  rayDir: Vec3,
  sphereCenter: Vec3,
  sphereRadius: number,
): Vec3 | null {
  const direction = normalizeVector(rayDir);

  const oc = {
    x: rayOrigin.x - sphereCenter.x,

    y: rayOrigin.y - sphereCenter.y,

    z: rayOrigin.z - sphereCenter.z,
  };

  const b = 2 * (oc.x * direction.x + oc.y * direction.y + oc.z * direction.z);

  const c =
    oc.x * oc.x + oc.y * oc.y + oc.z * oc.z - sphereRadius * sphereRadius;

  const discriminant = b * b - 4 * c;

  if (discriminant < 0) {
    return null;
  }

  const sqrtDiscriminant = Math.sqrt(discriminant);

  const t1 = (-b - sqrtDiscriminant) / 2;

  const t2 = (-b + sqrtDiscriminant) / 2;

  let t = Number.POSITIVE_INFINITY;

  if (t1 >= 0) {
    t = t1;
  }

  if (t2 >= 0 && t2 < t) {
    t = t2;
  }

  if (!Number.isFinite(t)) {
    return null;
  }

  return {
    x: rayOrigin.x + t * direction.x,

    y: rayOrigin.y + t * direction.y,

    z: rayOrigin.z + t * direction.z,
  };
}

// ============================================================
// SURFACE -> LAT/LON
// ============================================================

export function surfacePointToLatLng(
  localPoint: Vec3,
  sphereRadius: number,
): {
  latitude: number;
  longitude: number;
} {
  if (sphereRadius <= 0) {
    return {
      latitude: 0,
      longitude: 0,
    };
  }

  const normalized = normalizeVector({
    x: localPoint.x / sphereRadius,
    y: localPoint.y / sphereRadius,
    z: localPoint.z / sphereRadius,
  });

  /**
   * Keep the exact coordinate convention you were already
   * using for the Earth texture / GeoJSON.
   */
  const latitude = (-Math.asin(normalized.y) * 180) / Math.PI;

  let longitude = (Math.atan2(normalized.x, -normalized.z) * 180) / Math.PI;

  longitude -= 90;

  while (longitude < -180) {
    longitude += 360;
  }

  while (longitude > 180) {
    longitude -= 360;
  }

  return {
    latitude,
    longitude,
  };
}

// ============================================================
// GEOJSON RING
// ============================================================

function isPointInRing(
  longitude: number,
  latitude: number,
  ring: LinearRing,
): boolean {
  let inside = false;

  if (!ring || ring.length < 3) {
    return false;
  }

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];

    const intersects =
      yi > latitude !== yj > latitude &&
      longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

// ============================================================
// GEOJSON POLYGON
// ============================================================

function isPointInPolygon(
  longitude: number,
  latitude: number,
  polygon: PolygonCoordinates,
): boolean {
  if (!polygon || polygon.length === 0) {
    return false;
  }

  const outerRing = polygon[0];

  if (!outerRing) {
    return false;
  }

  if (!isPointInRing(longitude, latitude, outerRing)) {
    return false;
  }

  // ----------------------------------------------------------
  // Holes
  // ----------------------------------------------------------

  for (let i = 1; i < polygon.length; i++) {
    if (isPointInRing(longitude, latitude, polygon[i])) {
      return false;
    }
  }

  return true;
}

// ============================================================
// GEOJSON STATE LOOKUP
// ============================================================

export function findStateAtCoordinate(
  latitude: number,
  longitude: number,
  features: GeoFeature[],
): GeoFeature | null {
  for (const feature of features) {
    const { geometry } = feature;

    if (geometry.type === "Polygon") {
      if (isPointInPolygon(longitude, latitude, geometry.coordinates)) {
        return feature;
      }
    }

    if (geometry.type === "MultiPolygon") {
      for (const polygon of geometry.coordinates) {
        if (isPointInPolygon(longitude, latitude, polygon)) {
          return feature;
        }
      }
    }
  }

  return null;
}

// ============================================================
// FIND ALL MATCHING STATES
// ============================================================
//
// DEBUG FUNCTION.
//
// This is useful for checking whether a coordinate is actually
// inside multiple GeoJSON polygons.
//

export function findAllStatesAtCoordinate(
  latitude: number,
  longitude: number,
  features: GeoFeature[],
): GeoFeature[] {
  const matches: GeoFeature[] = [];

  for (const feature of features) {
    const { geometry } = feature;

    if (geometry.type === "Polygon") {
      if (isPointInPolygon(longitude, latitude, geometry.coordinates)) {
        matches.push(feature);
      }
    }

    if (geometry.type === "MultiPolygon") {
      for (const polygon of geometry.coordinates) {
        if (isPointInPolygon(longitude, latitude, polygon)) {
          matches.push(feature);
          break;
        }
      }
    }
  }

  return matches;
}

// ============================================================
// NORMALIZE GEOJSON
// ============================================================

export function normalizeGeometry(
  geometry: GeoFeature["geometry"],
): PolygonCoordinates[] {
  if (geometry.type === "Polygon") {
    return [geometry.coordinates];
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates;
  }

  return [];
}

// ============================================================
// LOCATION API
// ============================================================

export async function getLocationName(
  latitude: number,
  longitude: number,
): Promise<LocationInfo | undefined> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
    );

    const data = await response.json();

    return {
      country: data.address?.country,

      state: data.address?.state,

      city: data.address?.city || data.address?.town || data.address?.village,

      name: data.display_name,
    };
  } catch (error) {
    console.log("getLocationName error:", error);
  }
}
