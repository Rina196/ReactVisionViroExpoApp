import {
  ViroARScene,
  ViroARSceneNavigator,
  ViroBox,
  ViroMaterials,
  ViroSphere,
} from "@reactvision/react-viro";
import React, { useRef, useState } from "react";
import indiaGeoJson from "../../assets/IND.json";

import {
  findStateAtCoordinate,
  GeoFeature,
  surfacePointToLatLng,
  Vec3,
} from "../utils/ar-utils";

type Vec3Tuple = [number, number, number];

export default function ViroExample() {
  return (
    <ViroARSceneNavigator
      worldMeshEnabled
      initialScene={{
        scene: MyARScene,
      }}
      style={{ flex: 1 }}
    />
  );
}

function MyARScene() {
  const sceneRef = useRef<any>(null);
  const [spawnedObjects, setSpawnedObjects] = useState<Vec3Tuple[]>([]);

  // Sphere parameters
  const sphereCenter: Vec3 = { x: 0, y: 0, z: -1 };
  const sphereRadius = 0.5;

  // Helper to transform a vector by Euler rotations (degrees)
  const rotateVector = (v, euler) => {
    const radX = (euler[0] * Math.PI) / 180;
    const radY = (euler[1] * Math.PI) / 180;
    const radZ = (euler[2] * Math.PI) / 180;

    // RX
    let y1 = v.y * Math.cos(radX) - v.z * Math.sin(radX);
    let z1 = v.y * Math.sin(radX) + v.z * Math.cos(radX);
    let x1 = v.x;

    // RY
    let x2 = x1 * Math.cos(radY) + z1 * Math.sin(radY);
    let z2 = -x1 * Math.sin(radY) + z1 * Math.cos(radY);
    let y2 = y1;

    // RZ
    let x3 = x2 * Math.cos(radZ) - y2 * Math.sin(radZ);
    let y3 = x2 * Math.sin(radZ) + y2 * Math.cos(radZ);
    let z3 = z2;

    return { x: x3, y: y3, z: z3 };
  };

  // Sphere rotation in state/props e.g., [rx, ry, rz]
  const sphereRotation = [0, 0, 180];

  const _handleSphereClick = async (
    clickState: number,
    clickPos: [number, number, number] | null | undefined,
  ) => {
    if (clickState !== 3 || !clickPos || !sceneRef.current) {
      return;
    }

    const cameraOrientation =
      await sceneRef.current.getCameraOrientationAsync();

    const camPos: Vec3 = {
      x: cameraOrientation.position[0],
      y: cameraOrientation.position[1],
      z: cameraOrientation.position[2],
    };

    // World -> Local
    const camLocal: Vec3 = {
      x: camPos.x - sphereCenter.x,
      y: camPos.y - sphereCenter.y,
      z: camPos.z - sphereCenter.z,
    };

    const clickLocal: Vec3 = {
      x: clickPos[0] - sphereCenter.x,
      y: clickPos[1] - sphereCenter.y,
      z: clickPos[2] - sphereCenter.z,
    };

    // Undo sphere rotation
    const inverseRotation: [number, number, number] = [
      -sphereRotation[0],
      -sphereRotation[1],
      -sphereRotation[2],
    ];

    const rayOriginLocal = rotateVector(camLocal, inverseRotation);
    const rayTargetLocal = rotateVector(clickLocal, inverseRotation);

    // Ray direction
    const dx = rayTargetLocal.x - rayOriginLocal.x;
    const dy = rayTargetLocal.y - rayOriginLocal.y;
    const dz = rayTargetLocal.z - rayOriginLocal.z;

    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const rayDir = {
      x: dx / length,
      y: dy / length,
      z: dz / length,
    };

    // Ray / Sphere intersection
    const b =
      2 *
      (rayOriginLocal.x * rayDir.x +
        rayOriginLocal.y * rayDir.y +
        rayOriginLocal.z * rayDir.z);

    const c =
      rayOriginLocal.x * rayOriginLocal.x +
      rayOriginLocal.y * rayOriginLocal.y +
      rayOriginLocal.z * rayOriginLocal.z -
      sphereRadius * sphereRadius;

    const discriminant = b * b - 4 * c;

    if (discriminant < 0) {
      console.log("No sphere intersection");
      return;
    }

    const t = (-b - Math.sqrt(discriminant)) / 2;

    // Local point on sphere
    const localPoint: Vec3 = {
      x: rayOriginLocal.x + rayDir.x * t,
      y: rayOriginLocal.y + rayDir.y * t,
      z: rayOriginLocal.z + rayDir.z * t,
    };

    // Latitude / Longitude
    const { latitude, longitude } = surfacePointToLatLng(
      localPoint,
      sphereRadius,
    );

    const detectedState = findStateAtCoordinate(
      latitude,
      longitude,
      indiaGeoJson.features as GeoFeature[],
    );

    console.log("🌍 TAP LOCATION", {
      latitude,
      longitude,
      country: detectedState?.properties.shapeGroup ?? null,
      state: detectedState?.properties.shapeName ?? null,
    });

    // Local -> World
    const worldPoint = rotateVector(localPoint, sphereRotation);

    const worldSurface: [number, number, number] = [
      worldPoint.x + sphereCenter.x,
      worldPoint.y + sphereCenter.y,
      worldPoint.z + sphereCenter.z,
    ];

    console.log("📍 World Surface:", worldSurface);

    setSpawnedObjects((prev) => [...prev, worldSurface]);
  };

  ViroMaterials.createMaterials({
    earth: {
      diffuseTexture: require("../../assets/images/earth2kNew1.jpg"),
      wrapS: "Clamp",
      wrapT: "Clamp",
    },
  });

  return (
    <ViroARScene ref={sceneRef}>
      <ViroSphere
        heightSegmentCount={20}
        widthSegmentCount={20}
        radius={sphereRadius}
        position={[sphereCenter.x, sphereCenter.y, sphereCenter.z]}
        materials={["earth"]}
        facesOutward={true}
        rotation={sphereRotation}
        onClickState={_handleSphereClick}
      />

      {spawnedObjects.map((pos, index) => (
        <ViroBox
          key={index}
          position={pos}
          scale={[0.005, 0.005, 0.005]}
          materials={["markerMaterial"]}
        />
      ))}
    </ViroARScene>
  );
}

ViroMaterials.createMaterials({
  sphereMaterial: { diffuseColor: "#FF0000" },
  markerMaterial: { diffuseColor: "#00FF00" },
});

// ViroMaterials.createMaterials({
//   earth: { diffuseTexture: require("../../assets/images/earth2k.jpg") },
// });

// const EARTH_RADIUS = 0.1;

// // const projectToSphere = (point: [number, number, number]) => {
// //   const [x, y, z] = point;

// //   const length = Math.sqrt(x * x + y * y + z * z);

// //   if (length === 0) {
// //     return [0, EARTH_RADIUS, 0];
// //   }

// //   return [
// //     (x / length) * EARTH_RADIUS,
// //     (y / length) * EARTH_RADIUS,
// //     (z / length) * EARTH_RADIUS,
// //   ] as [number, number, number];
// // };

// const checkPoint = (label: string, point: [number, number, number]) => {
//   const distance = Math.sqrt(
//     point[0] * point[0] + point[1] * point[1] + point[2] * point[2],
//   );

//   console.log(`${label}:`, point);
//   console.log(`${label} Distance:`, distance);

//   if (Math.abs(distance - EARTH_RADIUS) < 0.00001) {
//     console.log(`✅ ${label} is on the sphere surface`);
//   } else {
//     console.log(`❌ ${label} is NOT on the sphere surface`);
//   }
// };

// // const moveToSphereSurface = (
// //   point: [number, number, number],
// //   radius: number,
// // ): [number, number, number] => {
// //   const [x, y, z] = point;

// //   const distance = Math.sqrt(x * x + y * y + z * z);

// //   if (distance === 0) {
// //     return [0, radius, 0];
// //   }

// //   const move = (radius - distance) / distance;

// //   return [x + x * move, y + y * move, z + z * move];
// // };

// function EarthScene() {
//   const [marker, setMarker] = useState<[number, number, number] | null>(null);
//   const [position, setPosition] = useState<[number, number, number] | null>(
//     null,
//   );
//   const onEarthTap = (position, source) => {
//     console.log("Tap Position:", position);
//     setPosition(position);
//     const distance = Math.sqrt(
//       position[0] * position[0] +
//         position[1] * position[1] +
//         position[2] * position[2],
//     );

//     console.log("Distance from center:", distance);

//     const markerPos = moveToSphereSurface(position, EARTH_RADIUS);
//     checkPoint("Projected", markerPos);
//     setMarker(markerPos);
//   };

//   ViroMaterials.createMaterials({ boxMaterial: { diffuseColor: "#ff0000" } });
//   ViroMaterials.createMaterials({ blue: { diffuseColor: "#ffd700" } });

//   ViroMaterials.createMaterials({
//     box: {
//       diffuseColor: "#d32f2f",
//     },
//     lid: {
//       diffuseColor: "#b71c1c",
//     },
//     ribbon: {
//       diffuseColor: "#ffd700",
//     },
//   });

//   ViroMaterials.createMaterials({ red: { diffuseColor: "#ff0000" } });

//   // const pointToLatLng = (point: [number, number, number]) => {
//   //   const [x, y, z] = point;

//   //   const radius = Math.sqrt(x * x + y * y + z * z);

//   //   const nx = x / radius;
//   //   const ny = y / radius;
//   //   const nz = z / radius;

//   //   const latitude = Math.asin(ny) * (180 / Math.PI);

//   //   const longitude = Math.atan2(nz, nx) * (180 / Math.PI);

//   //   return {
//   //     latitude,
//   //     longitude,
//   //   };
//   // };

//   const worldToLocal = (
//     world: [number, number, number],
//     sphereCenter: [number, number, number],
//   ): [number, number, number] => {
//     return [
//       world[0] - sphereCenter[0],
//       world[1] - sphereCenter[1],
//       world[2] - sphereCenter[2],
//     ];
//   };

//   // const pointToUV = (point: [number, number, number]) => {
//   //   const [x, y, z] = point;

//   //   const radius = Math.sqrt(x * x + y * y + z * z);

//   //   const nx = x / radius;
//   //   const ny = y / radius;
//   //   const nz = z / radius;

//   //   const u = 0.5 + Math.atan2(nz, nx) / (2 * Math.PI);

//   //   const v = 0.5 - Math.asin(ny) / Math.PI;

//   //   return { u, v };
//   // };

//   // const uvToLatLng = (u: number, v: number) => {
//   //   return {
//   //     latitude: 90 - v * 180,
//   //     longitude: u * 360 - 180,
//   //   };
//   // };
//   const earthPosition: [number, number, number] = [0, 0, 0];
//   const sphereCenter: [number, number, number] = [0, 0, 0];
//   const EARTH_RADIUS = 0.1;
//   const MARKER_RADIUS = 0.005;

//   // Push the marker slightly above the Earth surface
//   const MARKER_OFFSET = MARKER_RADIUS + 0.001;

//   const projectPointToSphere = (
//     worldPoint: [number, number, number],
//     sphereCenter: [number, number, number],
//     radius: number,
//   ): [number, number, number] => {
//     const dx = worldPoint[0] - sphereCenter[0];
//     const dy = worldPoint[1] - sphereCenter[1];
//     const dz = worldPoint[2] - sphereCenter[2];

//     const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

//     if (length === 0) {
//       return sphereCenter;
//     }

//     return [
//       sphereCenter[0] + (dx / length) * radius,
//       sphereCenter[1] + (dy / length) * radius,
//       sphereCenter[2] + (dz / length) * radius,
//     ];
//   };

//   const projectToSurface = (
//     hitPoint: [number, number, number],
//     sphereCenter: [number, number, number],
//     sphereRadius: number,
//     offset: number = 0,
//   ): [number, number, number] => {
//     const dx = hitPoint[0] - sphereCenter[0];
//     const dy = hitPoint[1] - sphereCenter[1];
//     const dz = hitPoint[2] - sphereCenter[2];

//     const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

//     if (distance === 0) {
//       return [
//         sphereCenter[0],
//         sphereCenter[1] + sphereRadius + offset,
//         sphereCenter[2],
//       ];
//     }

//     const scale = (sphereRadius + offset) / distance;

//     return [
//       sphereCenter[0] + dx * scale,
//       sphereCenter[1] + dy * scale,
//       sphereCenter[2] + dz * scale,
//     ];
//   };

//   const onEarthClick = (state: number, hitPoint: [number, number, number]) => {
//     if (state !== 3) return;

//     console.log("Original Hit:", hitPoint);

//     const markerPosition = projectToSurface(
//       hitPoint,
//       earthPosition,
//       EARTH_RADIUS,
//       MARKER_OFFSET,
//     );

//     console.log("Marker:", markerPosition);

//     setMarker(markerPosition);
//   };

//   return (
//     <ViroARScene>
//       <ViroSphere
//         radius={EARTH_RADIUS}
//         position={earthPosition}
//         materials={["earth"]}
//         widthSegmentCount={64}
//         heightSegmentCount={64}
//         facesOutward
//         onClickState={onEarthClick}
//       />
//       {/* <ViroBox
//         position={[0, -2, 0]}
//         materials={["red"]}
//         onClick={onEarthTap}
//         height={0.1}
//         width={0.1}
//       /> */}
//       {position && (
//         <ViroSphere radius={0.004} position={position} materials={["blue"]} />
//       )}
//       {marker && (
//         <ViroSphere
//           radius={MARKER_RADIUS}
//           position={marker}
//           materials={["red"]}
//         />
//       )}
//     </ViroARScene>
//   );
// }
