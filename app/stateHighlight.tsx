import { ViroMaterials, ViroNode, ViroPolyline } from "@reactvision/react-viro";
import { useMemo } from "react";

import {
  GeoFeature,
  normalizeGeometry,
  PolygonCoordinates,
  Vec3,
} from "./utils/ar-utils";

type Vec3Tuple = [number, number, number];

type Props = {
  feature: GeoFeature | null;
  color?: string;
  earthRadius: number;
  earthPosition: Vec3Tuple;
};

const BORDER_OFFSET = 0.003;

// Keep each ViroPolyline reasonably small.
// Your Gujarat border has 8715 points.
const MAX_POINTS_PER_POLYLINE = 200;

export default function StateHighlight({
  feature,
  color = "#FF0000",
  earthRadius,
  earthPosition,
}: Props) {
  const materialName = useMemo(() => {
    const name = `stateBorder_${color.replace("#", "")}`;

    ViroMaterials.createMaterials({
      [name]: {
        diffuseColor: color,
        lightingModel: "Constant",
        cullMode: "None",
      },
    });

    return name;
  }, [color]);

  const polylines = useMemo(() => {
    if (!feature) {
      return [];
    }

    return createStateBorders(feature, earthRadius);
  }, [feature, earthRadius]);

  if (!feature || polylines.length === 0) {
    return null;
  }

  return (
    <ViroNode position={earthPosition}>
      {polylines.map((points, index) => {
        // Never send an empty/single-point array to Viro.
        if (!points || points.length < 2) {
          return null;
        }

        return (
          <ViroPolyline
            key={`state-border-${index}`}
            points={points}
            thickness={0.0009}
            materials={[materialName]}
          />
        );
      })}
    </ViroNode>
  );
}

/* -------------------------------------------------------------------------- */
/*                         CREATE STATE BORDERS                               */
/* -------------------------------------------------------------------------- */

function createStateBorders(
  feature: GeoFeature,
  earthRadius: number,
): Vec3Tuple[][] {
  const polygons = normalizeGeometry(feature.geometry);

  const result: Vec3Tuple[][] = [];

  for (let polygonIndex = 0; polygonIndex < polygons.length; polygonIndex++) {
    const polygon = polygons[polygonIndex];

    const polygonPolylines = createPolygonBorders(polygon, earthRadius);

    result.push(...polygonPolylines);
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/*                         POLYGON → POLYLINES                                */
/* -------------------------------------------------------------------------- */

function createPolygonBorders(
  polygon: PolygonCoordinates,
  earthRadius: number,
): Vec3Tuple[][] {
  if (!polygon || !Array.isArray(polygon)) {
    return [];
  }

  const result: Vec3Tuple[][] = [];

  for (let ringIndex = 0; ringIndex < polygon.length; ringIndex++) {
    const ring = polygon[ringIndex];

    if (!Array.isArray(ring)) {
      continue;
    }

    const points: Vec3Tuple[] = [];

    for (const coordinate of ring) {
      if (!Array.isArray(coordinate)) {
        continue;
      }

      if (coordinate.length < 2) {
        continue;
      }

      const longitude = Number(coordinate[0]);
      const latitude = Number(coordinate[1]);

      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
        continue;
      }

      const point = latLonToEarthVector(
        latitude,
        longitude,
        earthRadius + BORDER_OFFSET,
      );

      points.push([point.x, point.y, point.z]);
    }

    if (points.length < 2) {
      continue;
    }

    /*
     * Split a large GeoJSON ring into smaller ViroPolylines.
     *
     * Example:
     *
     * 8715 points
     *       ↓
     * ~44 polylines
     *       ↓
     * each max 200 points
     */
    const chunks = splitPolyline(points, MAX_POINTS_PER_POLYLINE);

    result.push(...chunks);
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/*                         SPLIT POLYLINE                                     */
/* -------------------------------------------------------------------------- */

function splitPolyline(points: Vec3Tuple[], maxPoints: number): Vec3Tuple[][] {
  if (points.length < 2) {
    return [];
  }

  if (points.length <= maxPoints) {
    return [points];
  }

  const result: Vec3Tuple[][] = [];

  /*
   * We overlap the last point of the previous chunk
   * with the first point of the next chunk.
   *
   * This prevents visible gaps between chunks.
   */
  const step = maxPoints - 1;

  for (let start = 0; start < points.length - 1; start += step) {
    const end = Math.min(start + maxPoints, points.length);

    const chunk = points.slice(start, end);

    if (chunk.length >= 2) {
      result.push(chunk);
    }

    if (end >= points.length) {
      break;
    }
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/*                         LAT/LON → EARTH                                    */
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
