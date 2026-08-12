import { ViroGeometry, ViroMaterials, ViroNode } from "@reactvision/react-viro";
import { useMemo } from "react";

import earcut from "earcut";

import {
  GeoFeature,
  PolygonCoordinates,
  Vec3,
  normalizeGeometry,
  normalizeVector,
} from "./utils/ar-utils";

type Props = {
  feature: GeoFeature | null;
  color?: string;
  earthRadius: number;
};

type GeometryData = {
  vertices: [number, number, number][];
  normals: [number, number, number][];
  texcoords: [number, number][];
  triangleIndices: [number, number, number][];
};

const HIGHLIGHT_OFFSET = 0.001;

export default function StateHighlight({
  feature,
  color = "#FF000066",
  earthRadius,
}: Props) {
  const materialName = useMemo(() => {
    const name = `stateHighlight_${color.replace("#", "")}`;

    ViroMaterials.createMaterials({
      [name]: {
        diffuseColor: color,
        lightingModel: "Constant",
        cullMode: "None",
      },
    });

    return name;
  }, [color]);

  /**
   * Everything generated here is in EARTH LOCAL SPACE.
   *
   * It does not know:
   *
   * - AR camera position
   * - plane position
   * - Earth world position
   * - Earth world rotation
   * - Earth scale
   */
  const geometries = useMemo(() => {
    if (!feature) {
      return [];
    }

    return createStateGeometries(feature, earthRadius);
  }, [feature, earthRadius]);

  if (!feature || geometries.length === 0) {
    return null;
  }

  /**
   * IMPORTANT:
   *
   * This node is local to the Earth ViroNode.
   *
   * Parent:
   *
   *   position = plane tap
   *   rotation = Earth rotation
   *   scale = Earth scale
   *
   * Therefore this geometry automatically follows
   * the Earth.
   */
  return (
    <ViroNode position={[0, 0, 0]} rotation={[0, 0, 0]} scale={[1, 1, 1]}>
      {geometries.map((geometry, index) => (
        <ViroGeometry
          key={`state-highlight-${index}`}
          vertices={geometry.vertices}
          normals={geometry.normals}
          texcoords={geometry.texcoords}
          triangleIndices={geometry.triangleIndices}
          materials={[materialName]}
        />
      ))}
    </ViroNode>
  );
}

/* -------------------------------------------------------------------------- */
/*                       CREATE STATE GEOMETRY                                */
/* -------------------------------------------------------------------------- */

function createStateGeometries(
  feature: GeoFeature,
  earthRadius: number,
): GeometryData[] {
  const polygons = normalizeGeometry(feature.geometry);

  const result: GeometryData[] = [];

  for (const polygon of polygons) {
    const geometry = createPolygonGeometry(polygon, earthRadius);

    if (geometry) {
      result.push(geometry);
    }
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/*                         POLYGON → GEOMETRY                                 */
/* -------------------------------------------------------------------------- */

function createPolygonGeometry(
  polygon: PolygonCoordinates,
  earthRadius: number,
): GeometryData | null {
  if (!polygon || polygon.length === 0) {
    return null;
  }

  /**
   * First ring = outer boundary.
   * Remaining rings = holes.
   */
  const validRings = polygon.filter(isValidRing);

  if (validRings.length === 0) {
    return null;
  }

  const flatCoordinates: number[] = [];
  const holeIndices: number[] = [];

  let vertexCount = 0;

  /* ------------------------------------------------------------------------ */
  /* GeoJSON [longitude, latitude] -> Earcut coordinates                     */
  /* ------------------------------------------------------------------------ */

  for (let ringIndex = 0; ringIndex < validRings.length; ringIndex++) {
    const ring = validRings[ringIndex];

    if (ringIndex > 0) {
      holeIndices.push(vertexCount);
    }

    for (const coordinate of ring) {
      const longitude = Number(coordinate[0]);
      const latitude = Number(coordinate[1]);

      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
        continue;
      }

      flatCoordinates.push(longitude, latitude);

      vertexCount++;
    }
  }

  if (vertexCount < 3) {
    return null;
  }

  /* ------------------------------------------------------------------------ */
  /* Earcut                                                                   */
  /* ------------------------------------------------------------------------ */

  const triangleIndices = earcut(flatCoordinates, holeIndices, 2);

  if (!triangleIndices || triangleIndices.length === 0) {
    return null;
  }

  /* ------------------------------------------------------------------------ */
  /* GeoJSON -> Earth LOCAL coordinates                                       */
  /* ------------------------------------------------------------------------ */

  const vertices: [number, number, number][] = [];
  const normals: [number, number, number][] = [];
  const texcoords: [number, number][] = [];

  for (let i = 0; i < flatCoordinates.length; i += 2) {
    const longitude = flatCoordinates[i];
    const latitude = flatCoordinates[i + 1];

    /**
     * IMPORTANT:
     *
     * This is Earth LOCAL space.
     *
     * The parent ViroNode handles:
     *
     *   Earth position
     *   Earth rotation
     *   Earth scale
     */
    const point = latLonToEarthVector(
      latitude,
      longitude,
      earthRadius + HIGHLIGHT_OFFSET,
    );

    vertices.push([point.x, point.y, point.z]);

    /**
     * Normal points away from Earth.
     */
    const normal = normalizeVector(point);

    normals.push([normal.x, normal.y, normal.z]);

    /**
     * Geographic UV.
     */
    const u = (longitude + 180) / 360;
    const v = (latitude + 90) / 180;

    texcoords.push([u, v]);
  }

  /* ------------------------------------------------------------------------ */
  /* Earcut indices -> Viro triangles                                        */
  /* ------------------------------------------------------------------------ */

  const viroTriangles: [number, number, number][] = [];

  for (let i = 0; i < triangleIndices.length; i += 3) {
    const a = triangleIndices[i];
    const b = triangleIndices[i + 1];
    const c = triangleIndices[i + 2];

    if (a === undefined || b === undefined || c === undefined) {
      continue;
    }

    viroTriangles.push([a, b, c]);
  }

  if (viroTriangles.length === 0) {
    return null;
  }

  return {
    vertices,
    normals,
    texcoords,
    triangleIndices: viroTriangles,
  };
}

/* -------------------------------------------------------------------------- */
/*                         EARTH COORDINATES                                  */
/* -------------------------------------------------------------------------- */

/**
 * Exact inverse of surfacePointToLatLng().
 *
 * Existing:
 *
 * latitude  = -asin(y)
 * longitude = atan2(x, -z) - 90
 *
 * Therefore:
 *
 * x = radius * cos(lat) * cos(lon)
 * y = -radius * sin(lat)
 * z = radius * cos(lat) * sin(lon)
 */
function latLonToEarthVector(
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

/* -------------------------------------------------------------------------- */
/*                              NORMAL                                        */
/* -------------------------------------------------------------------------- */

// function normalizeVector(vector: Vec3): Vec3 {
//   const length = Math.sqrt(
//     vector.x * vector.x + vector.y * vector.y + vector.z * vector.z,
//   );

//   if (length === 0) {
//     return {
//       x: 0,
//       y: 0,
//       z: 0,
//     };
//   }

//   return {
//     x: vector.x / length,
//     y: vector.y / length,
//     z: vector.z / length,
//   };
// }

/* -------------------------------------------------------------------------- */
/*                              VALIDATION                                    */
/* -------------------------------------------------------------------------- */

function isValidRing(ring: unknown): boolean {
  if (!Array.isArray(ring)) {
    return false;
  }

  if (ring.length < 3) {
    return false;
  }

  let validPoints = 0;

  for (const coordinate of ring) {
    if (!Array.isArray(coordinate) || coordinate.length < 2) {
      continue;
    }

    const longitude = Number(coordinate[0]);

    const latitude = Number(coordinate[1]);

    if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
      validPoints++;
    }
  }

  return validPoints >= 3;
}
