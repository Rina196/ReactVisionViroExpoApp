export type Vec3 = {
  x: number;
  y: number;
  z: number;
};

export type LocationInfo = {
  country?: string;
  state?: string;
  city?: string;
  name?: string;
};

export type MarkerLine = {
  start: [number, number, number];
  end: [number, number, number];
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

export function normalizeVector(vector: Vec3): Vec3 {
  const length = Math.sqrt(
    vector.x * vector.x + vector.y * vector.y + vector.z * vector.z,
  );

  if (length === 0) {
    return { x: 0, y: 0, z: 0 };
  }

  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
}

export function rayDirection(rayOrigin: Vec3, target: Vec3): Vec3 {
  return normalizeVector({
    x: target.x - rayOrigin.x,
    y: target.y - rayOrigin.y,
    z: target.z - rayOrigin.z,
  });
}

export function intersectRaySphere(
  rayOrigin: Vec3,
  rayDir: Vec3,
  sphereCenter: Vec3,
  sphereRadius: number,
): Vec3 | null {
  const oc = {
    x: rayOrigin.x - sphereCenter.x,
    y: rayOrigin.y - sphereCenter.y,
    z: rayOrigin.z - sphereCenter.z,
  };

  const b = 2.0 * (oc.x * rayDir.x + oc.y * rayDir.y + oc.z * rayDir.z);
  const c =
    oc.x * oc.x + oc.y * oc.y + oc.z * oc.z - sphereRadius * sphereRadius;

  const discriminant = b * b - 4 * c;

  if (discriminant < 0) {
    return null;
  }

  const t = (-b - Math.sqrt(discriminant)) / 2.0;

  return {
    x: rayOrigin.x + t * rayDir.x,
    y: rayOrigin.y + t * rayDir.y,
    z: rayOrigin.z + t * rayDir.z,
  };
}

export function surfacePointToLatLng(
  localPoint: Vec3,
  sphereRadius: number,
): { latitude: number; longitude: number } {
  const normalized = normalizeVector({
    x: localPoint.x / sphereRadius,
    y: localPoint.y / sphereRadius,
    z: localPoint.z / sphereRadius,
  });

  // IMPORTANT:
  // Your ViroSphere / Earth coordinate system has
  // geographic North opposite to the local +Y direction.
  //
  // Therefore latitude must be inverted.
  const latitude = (-Math.asin(normalized.y) * 180) / Math.PI;

  // Keep your currently-working longitude calculation.
  let longitude = (Math.atan2(normalized.x, -normalized.z) * 180) / Math.PI;

  // Your existing 90° texture/UV alignment correction.
  longitude -= 90;

  if (longitude < -180) {
    longitude += 360;
  }

  if (longitude > 180) {
    longitude -= 360;
  }

  return {
    latitude,
    longitude,
  };
}

// export function surfacePointToLatLng(
//   surfacePoint: Vec3,
//   sphereCenter: Vec3,
//   sphereRadius: number,
// ): { latitude: number; longitude: number } {
//   const localVector = {
//     x: surfacePoint.x - sphereCenter.x,
//     y: surfacePoint.y - sphereCenter.y,
//     z: surfacePoint.z - sphereCenter.z,
//   };

//   const normalized = normalizeVector({
//     x: localVector.x / sphereRadius,
//     y: localVector.y / sphereRadius,
//     z: localVector.z / sphereRadius,
//   });

//   return {
//     latitude: Math.asin(normalized.y) * (180 / Math.PI),
//     longitude: Math.atan2(normalized.x, normalized.z) * (180 / Math.PI),
//   };
// }

function isPointInRing(
  longitude: number,
  latitude: number,
  ring: LinearRing,
): boolean {
  let inside = false;

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

function isPointInPolygon(
  longitude: number,
  latitude: number,
  polygon: PolygonCoordinates,
): boolean {
  const outerRing = polygon[0];

  if (!outerRing) {
    return false;
  }

  if (!isPointInRing(longitude, latitude, outerRing)) {
    return false;
  }

  // If the point falls inside a hole,
  // it's not inside the actual polygon.
  for (let i = 1; i < polygon.length; i++) {
    if (isPointInRing(longitude, latitude, polygon[i])) {
      return false;
    }
  }

  return true;
}

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

// =========================================================
// STATE CENTROID (lat/lon of the largest ring, area-weighted)
// =========================================================

function shoelaceArea(ring: number[][]): number {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

function ringCentroid(ring: number[][]): {
  latitude: number;
  longitude: number;
} {
  let area = 0;
  let cx = 0;
  let cy = 0;

  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    const cross = x1 * y2 - x2 * y1;
    area += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }

  area *= 0.5;

  if (Math.abs(area) < 1e-10) {
    let sumLon = 0;
    let sumLat = 0;
    for (const [lon, lat] of ring) {
      sumLon += lon;
      sumLat += lat;
    }
    return { longitude: sumLon / ring.length, latitude: sumLat / ring.length };
  }

  cx /= 6 * area;
  cy /= 6 * area;

  return { longitude: cx, latitude: cy };
}

export function computeStateCentroid(
  feature: GeoFeature,
): { latitude: number; longitude: number } | null {
  const geometry: any = feature.geometry;

  const polygons: number[][][][] =
    geometry.type === "Polygon"
      ? [geometry.coordinates]
      : geometry.type === "MultiPolygon"
        ? geometry.coordinates
        : [];

  let bestRing: number[][] | null = null;
  let bestArea = 0;

  for (const polygon of polygons) {
    const outerRing = polygon[0];
    if (!outerRing || outerRing.length < 3) continue;

    const area = Math.abs(shoelaceArea(outerRing));
    if (area > bestArea) {
      bestArea = area;
      bestRing = outerRing;
    }
  }

  return bestRing ? ringCentroid(bestRing) : null;
}

// Same inverse mapping StateHighlight.tsx uses — keeps label
// consistent with where the highlight geometry actually sits.
export function latLonToSphereVector(
  latitude: number,
  longitude: number,
  radius: number,
): Vec3 {
  const lat = (latitude * Math.PI) / 180;
  const lon = (longitude * Math.PI) / 180;
  const cosLat = Math.cos(lat);

  return {
    x: radius * cosLat * Math.cos(lon),
    y: -radius * Math.sin(lat),
    z: radius * cosLat * Math.sin(lon),
  };
}
