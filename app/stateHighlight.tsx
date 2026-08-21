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
  showLabel?: boolean;
};

type GeometryData = {
  vertices: [number, number, number][];
  normals: [number, number, number][];
  texcoords: [number, number][];
  triangleIndices: [number, number, number][];
};

type StateRenderData = {
  geometries: GeometryData[];
  labelPosition: Vec3 | null;
  labelText: string;
};

/**
 * Small offset above the Earth surface so the highlight
 * does not z-fight with the Earth sphere.
 */
const HIGHLIGHT_OFFSET = 0.001;

/**
 * Distance between the state surface and the label.
 */
const LABEL_OFFSET = 0.015;

/**
 * Maximum number of triangles rendered by one ViroGeometry.
 *
 * Large GeoJSON states can contain thousands of triangles.
 * Splitting them prevents one extremely large ViroGeometry
 * from causing a large rendering/update spike.
 */
const MAX_TRIANGLES_PER_GEOMETRY = 5000;

/**
 * Material cache.
 *
 * ViroMaterials.createMaterials() is relatively expensive,
 * so don't recreate the same material every time a component
 * mounts/re-renders.
 */
const MATERIAL_CACHE = new Map<string, string>();

/* -------------------------------------------------------------------------- */
/*                              COMPONENT                                     */
/* -------------------------------------------------------------------------- */

export default function StateHighlight({
  feature,
  color = "#FF000066",
  earthRadius,
  earthPosition,
  sphereRotation: _sphereRotation,
  showLabel = true,
}: Props) {
  /**
   * Create/reuse material.
   *
   * The material only depends on the color, so it does not
   * need to be recreated when the feature changes.
   */
  const materialName = useMemo(() => {
    const normalizedColor = color.replace("#", "").toUpperCase();

    const cachedMaterial = MATERIAL_CACHE.get(normalizedColor);

    if (cachedMaterial) {
      return cachedMaterial;
    }

    const name = `stateHighlight_${normalizedColor}`;

    ViroMaterials.createMaterials({
      [name]: {
        diffuseColor: color,
        lightingModel: "Constant",
        cullMode: "None",
      },
    });

    MATERIAL_CACHE.set(normalizedColor, name);

    return name;
  }, [color]);

  /**
   * IMPORTANT:
   *
   * Geometry + label are calculated together.
   *
   * Previously:
   *
   * normalizeGeometry()
   *   -> geometry calculation
   *
   * normalizeGeometry()
   *   -> label calculation
   *
   * Now normalizeGeometry() is performed only once.
   */
  const renderData = useMemo<StateRenderData>(() => {
    if (!feature) {
      return {
        geometries: [],
        labelPosition: null,
        labelText: "",
      };
    }

    const polygons = normalizeGeometry(feature.geometry);

    if (!polygons || polygons.length === 0) {
      return {
        geometries: [],
        labelPosition: null,
        labelText: feature.properties?.shapeName ?? "",
      };
    }

    const geometries: GeometryData[] = [];

    let bestRing: PolygonCoordinates[number] | null = null;
    let bestArea = 0;

    /**
     * Process polygons only once.
     */
    for (const polygon of polygons) {
      if (!polygon || polygon.length === 0) {
        continue;
      }

      /**
       * Find the largest outer ring.
       *
       * This is also used later for the label position.
       */
      const outerRing = polygon[0];

      if (isValidRing(outerRing)) {
        const area = Math.abs(shoelaceArea(outerRing));

        if (area > bestArea) {
          bestArea = area;
          bestRing = outerRing;
        }
      }

      /**
       * Generate the actual state mesh.
       */
      const polygonGeometries = createPolygonGeometries(polygon, earthRadius);

      if (polygonGeometries.length > 0) {
        geometries.push(...polygonGeometries);
      }
    }

    /**
     * Calculate label position from the same ring that was
     * identified during the geometry pass.
     */
    let labelPosition: Vec3 | null = null;

    if (bestRing) {
      const centroid = ringCentroid(bestRing);

      if (centroid) {
        labelPosition = latLonToEarthVector(
          centroid.latitude,
          centroid.longitude,
          earthRadius + LABEL_OFFSET,
        );
      }
    }

    return {
      geometries,
      labelPosition,
      labelText: feature.properties?.shapeName ?? "",
    };
  }, [feature, earthRadius]);

  const { geometries, labelPosition, labelText } = renderData;

  if (!feature || geometries.length === 0) {
    return null;
  }

  /**
   * ViroText width is approximate because Viro doesn't expose
   * a direct text measurement API.
   */
  const chipWidth = Math.max(0.8, labelText.length * 0.11);
  const chipHeight = 0.5;

  return (
    <ViroNode position={earthPosition}>
      {/* ------------------------------------------------------------------ */}
      {/* STATE GEOMETRY                                                     */}
      {/* ------------------------------------------------------------------ */}

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

      {/* ------------------------------------------------------------------ */}
      {/* STATE LABEL                                                        */}
      {/* ------------------------------------------------------------------ */}

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
/*                       CREATE STATE GEOMETRIES                              */
/* -------------------------------------------------------------------------- */

/**
 * Creates one or more ViroGeometry objects for a polygon.
 *
 * Large states can contain thousands of triangles.
 * Instead of putting all triangles into one huge ViroGeometry,
 * the triangle index array is split into smaller render chunks.
 *
 * IMPORTANT:
 *
 * The actual vertices are NOT changed.
 * The geographic coordinates remain exactly the same.
 */
function createPolygonGeometries(
  polygon: PolygonCoordinates,
  earthRadius: number,
): GeometryData[] {
  if (!polygon || polygon.length === 0) {
    return [];
  }

  const validRings: PolygonCoordinates = [];

  /**
   * Filter invalid rings once.
   */
  for (const ring of polygon) {
    if (isValidRing(ring)) {
      validRings.push(ring);
    }
  }

  if (validRings.length === 0) {
    return [];
  }

  const flatCoordinates: number[] = [];
  const holeIndices: number[] = [];

  let vertexCount = 0;

  /**
   * Flatten GeoJSON coordinates.
   *
   * This pass validates every coordinate and builds the
   * exact data required by earcut.
   */
  for (let ringIndex = 0; ringIndex < validRings.length; ringIndex++) {
    const ring = validRings[ringIndex];

    if (ringIndex > 0) {
      holeIndices.push(vertexCount);
    }

    for (const coordinate of ring) {
      if (!Array.isArray(coordinate) || coordinate.length < 2) {
        continue;
      }

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
    return [];
  }

  /**
   * Earcut is still used because it handles:
   *
   * - complex state boundaries
   * - holes
   * - MultiPolygon geometry
   *
   * without changing the visual shape.
   */
  const triangleIndices = earcut(flatCoordinates, holeIndices, 2);

  if (!triangleIndices || triangleIndices.length === 0) {
    return [];
  }

  /**
   * Generate vertices only once.
   */
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

    /**
     * Since the state sits directly on a sphere,
     * the normalized position is also its surface normal.
     */
    const invRadius =
      1 / Math.sqrt(point.x * point.x + point.y * point.y + point.z * point.z);

    normals.push([
      point.x * invRadius,
      point.y * invRadius,
      point.z * invRadius,
    ]);

    /**
     * Preserve the existing UV mapping.
     */
    texcoords.push([(longitude + 180) / 360, (latitude + 90) / 180]);
  }

  /**
   * Convert Earcut's flat index array into Viro's
   * triangle tuple format.
   */
  const triangles: [number, number, number][] = [];

  for (let i = 0; i < triangleIndices.length; i += 3) {
    const a = triangleIndices[i];
    const b = triangleIndices[i + 1];
    const c = triangleIndices[i + 2];

    if (a === undefined || b === undefined || c === undefined) {
      continue;
    }

    triangles.push([a, b, c]);
  }

  if (triangles.length === 0) {
    return [];
  }

  /**
   * Small polygons only need one ViroGeometry.
   */
  if (triangles.length <= MAX_TRIANGLES_PER_GEOMETRY) {
    return [
      {
        vertices,
        normals,
        texcoords,
        triangleIndices: triangles,
      },
    ];
  }

  /**
   * Large polygon:
   *
   * Split triangle indices into multiple ViroGeometry
   * objects while keeping the same vertex buffer.
   *
   * This avoids one giant ViroGeometry becoming a bottleneck.
   */
  const result: GeometryData[] = [];

  for (
    let start = 0;
    start < triangles.length;
    start += MAX_TRIANGLES_PER_GEOMETRY
  ) {
    const end = Math.min(start + MAX_TRIANGLES_PER_GEOMETRY, triangles.length);

    result.push({
      vertices,
      normals,
      texcoords,
      triangleIndices: triangles.slice(start, end),
    });
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/*                         EARTH COORDINATES                                  */
/* -------------------------------------------------------------------------- */

/**
 * Converts latitude/longitude to the SAME Earth-local coordinate
 * system used by the original implementation.
 *
 * IMPORTANT:
 * Do not change this function if you want to preserve the
 * current Earth orientation and state placement.
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
/*                         CENTROID CALCULATION                               */
/* -------------------------------------------------------------------------- */

/**
 * Calculates the signed planar area of a GeoJSON ring.
 *
 * Used only for choosing the largest outer ring.
 */
function shoelaceArea(ring: readonly (readonly number[])[]): number {
  if (ring.length < 3) {
    return 0;
  }

  let sum = 0;

  /**
   * GeoJSON usually contains a closed ring.
   *
   * We still handle an unclosed ring below.
   */
  for (let i = 0; i < ring.length - 1; i++) {
    const current = ring[i];
    const next = ring[i + 1];

    if (!current || !next) {
      continue;
    }

    const x1 = Number(current[0]);
    const y1 = Number(current[1]);

    const x2 = Number(next[0]);
    const y2 = Number(next[1]);

    if (
      !Number.isFinite(x1) ||
      !Number.isFinite(y1) ||
      !Number.isFinite(x2) ||
      !Number.isFinite(y2)
    ) {
      continue;
    }

    sum += x1 * y2 - x2 * y1;
  }

  /**
   * Handle an unclosed GeoJSON ring.
   */
  const first = ring[0];
  const last = ring[ring.length - 1];

  if (first && last) {
    const firstX = Number(first[0]);
    const firstY = Number(first[1]);

    const lastX = Number(last[0]);
    const lastY = Number(last[1]);

    if (
      Number.isFinite(firstX) &&
      Number.isFinite(firstY) &&
      Number.isFinite(lastX) &&
      Number.isFinite(lastY) &&
      (firstX !== lastX || firstY !== lastY)
    ) {
      sum += lastX * firstY - firstX * lastY;
    }
  }

  return sum / 2;
}

/**
 * Calculates the centroid of a polygon ring.
 *
 * This intentionally keeps the original centroid algorithm
 * so the label position does not unexpectedly change.
 */
function ringCentroid(ring: readonly (readonly number[])[]): {
  latitude: number;
  longitude: number;
} | null {
  if (ring.length < 3) {
    return null;
  }

  const first = ring[0];
  const last = ring[ring.length - 1];

  if (!first || !last) {
    return null;
  }

  const isClosed = first[0] === last[0] && first[1] === last[1];

  /**
   * Avoid allocating a new array when the GeoJSON ring
   * is already closed.
   */
  const closedRing = isClosed ? ring : [...ring, first];

  let area = 0;
  let cx = 0;
  let cy = 0;

  for (let i = 0; i < closedRing.length - 1; i++) {
    const current = closedRing[i];
    const next = closedRing[i + 1];

    if (!current || !next) {
      continue;
    }

    const x1 = Number(current[0]);
    const y1 = Number(current[1]);

    const x2 = Number(next[0]);
    const y2 = Number(next[1]);

    if (
      !Number.isFinite(x1) ||
      !Number.isFinite(y1) ||
      !Number.isFinite(x2) ||
      !Number.isFinite(y2)
    ) {
      continue;
    }

    const cross = x1 * y2 - x2 * y1;

    area += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }

  area *= 0.5;

  /**
   * Degenerate polygon fallback.
   */
  if (Math.abs(area) < 1e-10) {
    let sumLon = 0;
    let sumLat = 0;
    let count = 0;

    for (const coordinate of closedRing) {
      if (!coordinate || coordinate.length < 2) {
        continue;
      }

      const longitude = Number(coordinate[0]);
      const latitude = Number(coordinate[1]);

      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
        continue;
      }

      sumLon += longitude;
      sumLat += latitude;
      count++;
    }

    if (count === 0) {
      return null;
    }

    return {
      longitude: sumLon / count,
      latitude: sumLat / count,
    };
  }

  cx /= 6 * area;
  cy /= 6 * area;

  return {
    longitude: cx,
    latitude: cy,
  };
}

/* -------------------------------------------------------------------------- */
/*                              VALIDATION                                    */
/* -------------------------------------------------------------------------- */

/**
 * Fast ring validation.
 *
 * We only need to know whether at least three valid points exist.
 */
function isValidRing(ring: unknown): ring is PolygonCoordinates[number] {
  if (!Array.isArray(ring) || ring.length < 3) {
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

      /**
       * We don't need to scan the remaining points once
       * three valid points are found.
       */
      if (validPoints >= 3) {
        return true;
      }
    }
  }

  return false;
}
