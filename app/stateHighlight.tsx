import {
  ViroGeometry,
  ViroMaterials,
  ViroNode,
  ViroText,
} from "@reactvision/react-viro";
import { useMemo } from "react";

import earcut from "earcut";

import {
  GeoFeature,
  PolygonCoordinates,
  Vec3,
  normalizeGeometry,
} from "./utils/ar-utils";

type Props = {
  feature: GeoFeature | null;
  color?: string;
  earthRadius: number;
  earthPosition: [number, number, number];
  sphereRotation: [number, number, number];
  showLabel?: boolean; // NEW — default true
};

type GeometryData = {
  vertices: [number, number, number][];
  normals: [number, number, number][];
  texcoords: [number, number][];
  triangleIndices: [number, number, number][];
};

const HIGHLIGHT_OFFSET = 0.001;

// How far above the highlight surface the label floats.
const LABEL_OFFSET = 0.015;

export default function StateHighlight({
  feature,
  color = "#FF000066",
  earthRadius,
  earthPosition,
  sphereRotation,
  showLabel = true,
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

  const geometries = useMemo(() => {
    if (!feature) {
      return [];
    }

    return createStateGeometries(feature, earthRadius);
  }, [feature, earthRadius]);

  /**
   * Centroid of the LARGEST outer ring (by area), in Earth-local
   * coordinates, computed with the exact same latLonToEarthVector
   * conversion the mesh itself uses — so the label can never
   * drift from the highlighted shape.
   */
  const labelPosition = useMemo((): Vec3 | null => {
    if (!feature) {
      return null;
    }

    const polygons = normalizeGeometry(feature.geometry);

    let bestRing: PolygonCoordinates[number] | null = null;
    let bestArea = 0;

    for (const polygon of polygons) {
      const outerRing = polygon?.[0];

      if (!outerRing || outerRing.length < 3) {
        continue;
      }

      const area = Math.abs(shoelaceArea(outerRing));

      if (area > bestArea) {
        bestArea = area;
        bestRing = outerRing;
      }
    }

    if (!bestRing) {
      return null;
    }

    const centroidLonLat = ringCentroid(bestRing);

    if (!centroidLonLat) {
      return null;
    }

    return latLonToEarthVector(
      centroidLonLat.latitude,
      centroidLonLat.longitude,
      earthRadius + LABEL_OFFSET,
    );
  }, [feature, earthRadius]);

  const labelText = feature?.properties?.shapeName ?? "";

  // Rough width-per-character estimate since Viro has no
  // text-measurement API — tweak the multiplier to taste.
  const chipWidth = Math.max(0.8, labelText.length * 0.11);
  const chipHeight = 0.5;

  if (!feature || geometries.length === 0) {
    return null;
  }

  return (
    <ViroNode position={earthPosition}>
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

      {showLabel && labelPosition && labelText.length > 0 && (
        <ViroNode
          position={[labelPosition.x, labelPosition.y, labelPosition.z]}
          scale={[0.1, 0.1, 0.1]}
          transformBehaviors={["billboard"]}
        >
          <ViroText
            text={labelText}
            width={chipWidth}
            height={chipHeight}
            style={{
              fontSize: 8,
              color: "#f10505",
              fontFamily: "Arial",
              fontWeight: "bold",
              textAlign: "center",
              textAlignVertical: "center",
            }}
            extrusionDepth={0}
          />
        </ViroNode>
      )}
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

  const validRings = polygon.filter(isValidRing);

  if (validRings.length === 0) {
    return null;
  }

  const flatCoordinates: number[] = [];
  const holeIndices: number[] = [];

  let vertexCount = 0;

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

  const triangleIndices = earcut(flatCoordinates, holeIndices, 2);

  if (!triangleIndices || triangleIndices.length === 0) {
    return null;
  }

  const vertices: [number, number, number][] = [];
  const normals: [number, number, number][] = [];
  const texcoords: [number, number][] = [];

  for (let i = 0; i < flatCoordinates.length; i += 2) {
    const longitude = flatCoordinates[i];
    const latitude = flatCoordinates[i + 1];

    const point = latLonToEarthVector(
      latitude,
      longitude,
      earthRadius + HIGHLIGHT_OFFSET,
    );

    vertices.push([point.x, point.y, point.z]);

    const normal = normalizeVector(point);

    normals.push([normal.x, normal.y, normal.z]);

    const u = (longitude + 180) / 360;
    const v = (latitude + 90) / 180;

    texcoords.push([u, v]);
  }

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

function normalizeVector(vector: Vec3): Vec3 {
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

/* -------------------------------------------------------------------------- */
/*                        CENTROID (shoelace, ring-based)                     */
/* -------------------------------------------------------------------------- */

function shoelaceArea(ring: readonly (readonly number[])[]): number {
  let sum = 0;

  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    sum += x1 * y2 - x2 * y1;
  }

  return sum / 2;
}

function ringCentroid(
  ring: readonly (readonly number[])[],
): { latitude: number; longitude: number } | null {
  if (ring.length < 3) {
    return null;
  }

  // Force-close the ring — GeoJSON doesn't always guarantee
  // the last point duplicates the first.
  const first = ring[0];
  const last = ring[ring.length - 1];
  const closedRing =
    first[0] !== last[0] || first[1] !== last[1] ? [...ring, first] : ring;

  let area = 0;
  let cx = 0;
  let cy = 0;

  for (let i = 0; i < closedRing.length - 1; i++) {
    const [x1, y1] = closedRing[i];
    const [x2, y2] = closedRing[i + 1];
    const cross = x1 * y2 - x2 * y1;
    area += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }

  area *= 0.5;

  if (Math.abs(area) < 1e-10) {
    let sumLon = 0;
    let sumLat = 0;

    for (const [lon, lat] of closedRing) {
      sumLon += lon;
      sumLat += lat;
    }

    return {
      longitude: sumLon / closedRing.length,
      latitude: sumLat / closedRing.length,
    };
  }

  cx /= 6 * area;
  cy /= 6 * area;

  return { longitude: cx, latitude: cy };
}

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
