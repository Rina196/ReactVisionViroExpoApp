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

  const latitude = (-Math.asin(normalized.y) * 180) / Math.PI;

  let longitude = (Math.atan2(normalized.x, -normalized.z) * 180) / Math.PI;

  longitude -= 90;

  if (longitude < -180) longitude += 360;
  if (longitude > 180) longitude -= 360;

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
