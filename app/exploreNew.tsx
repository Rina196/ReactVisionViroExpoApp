// import {
//     ViroARPlaneSelector,
//     ViroARScene,
//     ViroARSceneNavigator,
//     ViroImage,
//     ViroMaterials,
//     ViroNode,
//     ViroSphere,
// } from "@reactvision/react-viro";

// import React, { useEffect, useMemo, useRef, useState } from "react";

// import indiaGeoJson from "../../assets/IND.json";

// import NetworkArc from "../NetworkArc";
// import {
//     findStateAtCoordinate,
//     GeoFeature,
//     surfacePointToLatLng,
//     Vec3,
// } from "../utils/ar-utils";

// type Vec3Tuple = [number, number, number];

// type SphereMarker = {
//   id: string;
//   position: Vec3Tuple;
//   latitude: number;
//   longitude: number;
//   stateName?: string;
// };

// type RoutePoint = {
//   id: string;
//   position: Vec3Tuple;
//   normal: Vec3Tuple;
//   latitude: number;
//   longitude: number;
//   stateName?: string;
// };

// const MIN_SCALE = 0.5;
// const MAX_SCALE = 3;

// const SPHERE_RADIUS = 0.5;

// const SPHERE_ROTATION: [number, number, number] = [0, 0, 180];

// /**
//  * VERY SMALL offset so the marker/route
//  * sits just above the texture.
//  */
// const ROUTE_SURFACE_OFFSET = 0.002;
// const MARKER_SURFACE_OFFSET = 0.002;

// const AIRPLANE_ROTATION_OFFSET: [number, number, number] = [0, 0, 0];

// export default function Earth() {
//   return (
//     <ViroARSceneNavigator
//       worldMeshEnabled
//       initialScene={{
//         scene: MyARScene,
//       }}
//       style={{ flex: 1 }}
//     />
//   );
// }

// function MyARScene() {
//   const selectorRef = useRef<any>(null);

//   const [markers, setMarkers] = useState<SphereMarker[]>([]);

//   const [, setSelectedState] = useState<GeoFeature | null>(null);

//   const [earthPosition, setEarthPosition] = useState<
//     [number, number, number] | null
//   >(null);

//   const [earthScale, setEarthScale] = useState(1);

//   const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);

//   const [routeProgress, setRouteProgress] = useState(0);

//   const animationRef = useRef<ReturnType<typeof setInterval> | null>(null);

//   // =========================================================
//   // SPHERE CENTER
//   // =========================================================

//   const sphereLocalCenter: Vec3 = {
//     x: 0,
//     y: SPHERE_RADIUS,
//     z: 0,
//   };

//   // =========================================================
//   // ROTATE VECTOR
//   // =========================================================

//   const rotateVector = (v: Vec3, euler: [number, number, number]): Vec3 => {
//     const radX = (euler[0] * Math.PI) / 180;
//     const radY = (euler[1] * Math.PI) / 180;
//     const radZ = (euler[2] * Math.PI) / 180;

//     const y1 = v.y * Math.cos(radX) - v.z * Math.sin(radX);

//     const z1 = v.y * Math.sin(radX) + v.z * Math.cos(radX);

//     const x1 = v.x;

//     const x2 = x1 * Math.cos(radY) + z1 * Math.sin(radY);

//     const z2 = -x1 * Math.sin(radY) + z1 * Math.cos(radY);

//     const y2 = y1;

//     const x3 = x2 * Math.cos(radZ) - y2 * Math.sin(radZ);

//     const y3 = x2 * Math.sin(radZ) + y2 * Math.cos(radZ);

//     const z3 = z2;

//     return {
//       x: x3,
//       y: y3,
//       z: z3,
//     };
//   };

//   // =========================================================
//   // NORMALIZE
//   // =========================================================

//   const normalize = (v: Vec3): Vec3 => {
//     const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);

//     if (!Number.isFinite(length) || length < 0.000001) {
//       return {
//         x: 0,
//         y: 1,
//         z: 0,
//       };
//     }

//     return {
//       x: v.x / length,
//       y: v.y / length,
//       z: v.z / length,
//     };
//   };

//   // =========================================================
//   // DOT
//   // =========================================================

//   const dot = (a: Vec3, b: Vec3): number => {
//     return a.x * b.x + a.y * b.y + a.z * b.z;
//   };

//   // =========================================================
//   // SLERP
//   // =========================================================

//   const slerp = (a: Vec3, b: Vec3, t: number): Vec3 => {
//     const na = normalize(a);
//     const nb = normalize(b);

//     let cosTheta = dot(na, nb);

//     cosTheta = Math.max(-1, Math.min(1, cosTheta));

//     const theta = Math.acos(cosTheta);

//     if (theta < 0.00001) {
//       return normalize({
//         x: na.x + (nb.x - na.x) * t,
//         y: na.y + (nb.y - na.y) * t,
//         z: na.z + (nb.z - na.z) * t,
//       });
//     }

//     const sinTheta = Math.sin(theta);

//     const weightA = Math.sin((1 - t) * theta) / sinTheta;

//     const weightB = Math.sin(t * theta) / sinTheta;

//     return normalize({
//       x: na.x * weightA + nb.x * weightB,

//       y: na.y * weightA + nb.y * weightB,

//       z: na.z * weightA + nb.z * weightB,
//     });
//   };

//   // =========================================================
//   // CREATE GREAT CIRCLE ROUTE
//   // =========================================================

//   const createGreatCircleRoute = (
//     start: Vec3,
//     end: Vec3,
//     segments = 100,
//   ): Vec3Tuple[] => {
//     const points: Vec3Tuple[] = [];

//     const startVector: Vec3 = {
//       x: start.x - sphereLocalCenter.x,

//       y: start.y - sphereLocalCenter.y,

//       z: start.z - sphereLocalCenter.z,
//     };

//     const endVector: Vec3 = {
//       x: end.x - sphereLocalCenter.x,

//       y: end.y - sphereLocalCenter.y,

//       z: end.z - sphereLocalCenter.z,
//     };

//     const routeRadius = SPHERE_RADIUS + ROUTE_SURFACE_OFFSET;

//     for (let i = 0; i <= segments; i++) {
//       const t = i / segments;

//       const interpolated = slerp(startVector, endVector, t);

//       const n = normalize(interpolated);

//       points.push([
//         sphereLocalCenter.x + n.x * routeRadius,

//         sphereLocalCenter.y + n.y * routeRadius,

//         sphereLocalCenter.z + n.z * routeRadius,
//       ]);
//     }

//     return points;
//   };

//   // =========================================================
//   // COMPLETE ROUTE
//   // =========================================================

//   const completeRoute = useMemo(() => {
//     if (routePoints.length !== 2) {
//       return [];
//     }

//     const start: Vec3 = {
//       x: routePoints[0].position[0],
//       y: routePoints[0].position[1],
//       z: routePoints[0].position[2],
//     };

//     const end: Vec3 = {
//       x: routePoints[1].position[0],
//       y: routePoints[1].position[1],
//       z: routePoints[1].position[2],
//     };

//     return createGreatCircleRoute(start, end, 100);
//   }, [routePoints]);

//   // =========================================================
//   // VISIBLE ROUTE
//   // =========================================================

//   const visibleRoute = useMemo(() => {
//     if (completeRoute.length === 0) {
//       return [];
//     }

//     const maxIndex = Math.max(
//       1,
//       Math.floor(routeProgress * (completeRoute.length - 1)),
//     );

//     return completeRoute.slice(0, maxIndex + 1);
//   }, [completeRoute, routeProgress]);

//   // =========================================================
//   // AIRPLANE POSITION
//   // =========================================================

//   const movingPlanePosition = useMemo(() => {
//     if (routePoints.length !== 2 || completeRoute.length < 2) {
//       return null;
//     }

//     const index = Math.min(
//       completeRoute.length - 1,
//       Math.floor(routeProgress * (completeRoute.length - 1)),
//     );

//     return completeRoute[index];
//   }, [routePoints, completeRoute, routeProgress]);

//   // =========================================================
//   // AIRPLANE ROTATION
//   // =========================================================

//   const movingPlaneRotation = useMemo(() => {
//     if (routePoints.length !== 2 || completeRoute.length < 2) {
//       return AIRPLANE_ROTATION_OFFSET;
//     }

//     const rawIndex = Math.floor(routeProgress * (completeRoute.length - 1));

//     const index = Math.min(completeRoute.length - 2, Math.max(0, rawIndex));

//     const current = completeRoute[index];

//     const next = completeRoute[index + 1];

//     const dx = next[0] - current[0];
//     const dy = next[1] - current[1];
//     const dz = next[2] - current[2];

//     const horizontalLength = Math.sqrt(dx * dx + dz * dz);

//     if (horizontalLength < 0.00001) {
//       return AIRPLANE_ROTATION_OFFSET;
//     }

//     const yaw = (Math.atan2(dx, dz) * 180) / Math.PI;

//     const pitch = (-Math.atan2(dy, horizontalLength) * 180) / Math.PI;

//     return [
//       pitch + AIRPLANE_ROTATION_OFFSET[0],

//       yaw + AIRPLANE_ROTATION_OFFSET[1],

//       AIRPLANE_ROTATION_OFFSET[2],
//     ];
//   }, [routePoints.length, completeRoute, routeProgress]);

//   // =========================================================
//   // ROUTE ANIMATION
//   // =========================================================

//   useEffect(() => {
//     if (routePoints.length !== 2 || completeRoute.length < 2) {
//       return;
//     }

//     if (animationRef.current) {
//       clearInterval(animationRef.current);
//       animationRef.current = null;
//     }

//     setRouteProgress(0);

//     let progress = 0;

//     animationRef.current = setInterval(() => {
//       progress += 0.015;

//       if (progress >= 1) {
//         progress = 1;

//         if (animationRef.current) {
//           clearInterval(animationRef.current);

//           animationRef.current = null;
//         }
//       }

//       setRouteProgress(progress);
//     }, 40);

//     return () => {
//       if (animationRef.current) {
//         clearInterval(animationRef.current);

//         animationRef.current = null;
//       }
//     };
//   }, [routePoints, completeRoute.length]);

//   // =========================================================
//   // SPHERE CLICK
//   // =========================================================

//   const handleSphereClick = (
//     clickState: number,
//     clickPos: [number, number, number] | null | undefined,
//   ) => {
//     if (clickState !== 3 || !clickPos || !earthPosition) {
//       return;
//     }

//     if (!clickPos.every(Number.isFinite)) {
//       return;
//     }

//     const worldClick: Vec3 = {
//       x: clickPos[0],
//       y: clickPos[1],
//       z: clickPos[2],
//     };

//     // =======================================================
//     // WORLD -> EARTH NODE LOCAL
//     // =======================================================

//     const translated: Vec3 = {
//       x: worldClick.x - earthPosition[0],

//       y: worldClick.y - earthPosition[1],

//       z: worldClick.z - earthPosition[2],
//     };

//     const inverseRotation: [number, number, number] = [
//       -SPHERE_ROTATION[0],
//       -SPHERE_ROTATION[1],
//       -SPHERE_ROTATION[2],
//     ];

//     const unrotated = rotateVector(translated, inverseRotation);

//     const earthLocal: Vec3 = {
//       x: unrotated.x / earthScale,
//       y: unrotated.y / earthScale,
//       z: unrotated.z / earthScale,
//     };

//     // =======================================================
//     // RELATIVE TO ACTUAL SPHERE CENTER
//     // =======================================================

//     const fromSphereCenter: Vec3 = {
//       x: earthLocal.x - sphereLocalCenter.x,

//       y: earthLocal.y - sphereLocalCenter.y,

//       z: earthLocal.z - sphereLocalCenter.z,
//     };

//     const distance = Math.sqrt(
//       fromSphereCenter.x * fromSphereCenter.x +
//         fromSphereCenter.y * fromSphereCenter.y +
//         fromSphereCenter.z * fromSphereCenter.z,
//     );

//     if (!Number.isFinite(distance) || distance < 0.000001) {
//       return;
//     }

//     // =======================================================
//     // EXACT EARTH SURFACE
//     // =======================================================

//     const projectionScale = SPHERE_RADIUS / distance;

//     const surfaceLocal: Vec3 = {
//       x: fromSphereCenter.x * projectionScale,

//       y: fromSphereCenter.y * projectionScale,

//       z: fromSphereCenter.z * projectionScale,
//     };

//     // =======================================================
//     // OUTWARD NORMAL
//     // =======================================================

//     const surfaceNormalVec = normalize(surfaceLocal);

//     const surfaceNormal: Vec3Tuple = [
//       surfaceNormalVec.x,
//       surfaceNormalVec.y,
//       surfaceNormalVec.z,
//     ];

//     // =======================================================
//     // LAT/LNG
//     // =======================================================

//     const { latitude, longitude } = surfacePointToLatLng(
//       surfaceLocal,
//       SPHERE_RADIUS,
//     );

//     // =======================================================
//     // STATE
//     // =======================================================

//     const detectedState = findStateAtCoordinate(
//       latitude,
//       longitude,
//       (indiaGeoJson as any).features as GeoFeature[],
//     );

//     if (detectedState) {
//       setSelectedState(detectedState);
//     } else {
//       setSelectedState(null);
//     }

//     // =======================================================
//     // MARKER
//     //
//     // IMPORTANT:
//     //
//     // Marker position is in the SAME local coordinate
//     // system as the ViroSphere.
//     //
//     // The offset is now extremely small.
//     // =======================================================

//     const markerSurface = SPHERE_RADIUS + MARKER_SURFACE_OFFSET;

//     const markerPosition: Vec3Tuple = [
//       sphereLocalCenter.x + surfaceNormalVec.x * markerSurface,

//       sphereLocalCenter.y + surfaceNormalVec.y * markerSurface,

//       sphereLocalCenter.z + surfaceNormalVec.z * markerSurface,
//     ];

//     // =======================================================
//     // ROUTE POINT
//     // =======================================================

//     const id = `${Date.now()}-${Math.random()}`;

//     const newRoutePoint: RoutePoint = {
//       id,
//       position: markerPosition,
//       normal: surfaceNormal,
//       latitude,
//       longitude,
//       stateName: detectedState?.properties.shapeName,
//     };

//     // =======================================================
//     // ROUTE POINTS
//     // =======================================================

//     setRoutePoints((previousPoints) => {
//       if (previousPoints.length === 0) {
//         setRouteProgress(0);

//         return [newRoutePoint];
//       }

//       if (previousPoints.length === 1) {
//         return [previousPoints[0], newRoutePoint];
//       }

//       setRouteProgress(0);

//       return [newRoutePoint];
//     });

//     // =======================================================
//     // MARKERS
//     // =======================================================

//     const newMarker: SphereMarker = {
//       id,
//       position: markerPosition,
//       latitude,
//       longitude,
//       stateName: detectedState?.properties.shapeName,
//     };

//     setMarkers((previousMarkers) => {
//       if (previousMarkers.length >= 2) {
//         return [newMarker];
//       }

//       return [...previousMarkers, newMarker];
//     });
//   };

//   // =========================================================
//   // PINCH
//   // =========================================================

//   const pinchStartScale = useRef(1);

//   const handlePinch = (pinchState: number, scaleFactor: number) => {
//     if (pinchState === 1) {
//       pinchStartScale.current = earthScale;

//       return;
//     }

//     if (pinchState === 2) {
//       const newScale = pinchStartScale.current * scaleFactor;

//       const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));

//       setEarthScale(clampedScale);
//     }
//   };

//   // =========================================================
//   // RENDER
//   // =========================================================

//   return (
//     <ViroARScene
//       anchorDetectionTypes={["PlanesHorizontal"]}
//       onAnchorFound={(anchor) => {
//         selectorRef.current?.handleAnchorFound(anchor);
//       }}
//       onAnchorUpdated={(anchor) => {
//         selectorRef.current?.handleAnchorUpdated(anchor);
//       }}
//       onAnchorRemoved={(anchor) => {
//         anchor && selectorRef.current?.handleAnchorRemoved(anchor);
//       }}
//     >
//       {/* =================================================
//           PLANE SELECTOR
//       ================================================= */}

//       <ViroARPlaneSelector
//         ref={selectorRef}
//         alignment="Horizontal"
//         minWidth={0.1}
//         minHeight={0.1}
//         hideOverlayOnSelection
//         useActualShape
//         onPlaneSelected={(_, tapPosition) => {
//           if (!tapPosition) {
//             return;
//           }

//           setEarthPosition(tapPosition);
//         }}
//       />

//       {/* =================================================
//           EARTH
//       ================================================= */}

//       {earthPosition && (
//         <ViroNode
//           position={earthPosition}
//           rotation={SPHERE_ROTATION}
//           scale={[earthScale, earthScale, earthScale]}
//           onPinch={handlePinch}
//         >
//           {/* =================================================
//       EARTH
//   ================================================= */}
//           <ViroSphere
//             heightSegmentCount={20}
//             widthSegmentCount={20}
//             radius={SPHERE_RADIUS}
//             position={[0, SPHERE_RADIUS, 0]}
//             materials={["earth"]}
//             facesOutward
//             highAccuracyEvents
//             onClickState={handleSphereClick}
//           />
//           {/* =================================================
//       MARKERS
//   ================================================= */}
//           {routePoints.map((point) => {
//             const position: Vec3Tuple = [
//               point.position[0],
//               point.position[1] - 0.02,
//               point.position[2],
//             ];

//             return (
//               <ViroNode
//                 key={point.id}
//                 position={position}
//                 transformBehaviors={["billboard"]}
//               >
//                 <ViroImage
//                   source={require("../../assets/images/location.png")}
//                   width={0.045}
//                   height={0.045}
//                 />
//               </ViroNode>
//             );
//           })}
//           {/* {routePoints.map((point, index) => (
//             <MarkerPin
//               key={point.id}
//               position={point.position}
//               normal={point.normal}
//               material={index === 0 ? "pointBMaterial" : "pointBMaterial"}
//               targetLength={0.1}
//               radius={0.006}
//             />
//           ))} */}
//           {/* =================================================
//       NETWORK ARC
//   ================================================= */}
//           {routePoints.length === 2 && (
//             <NetworkArc
//               from={routePoints[0]}
//               to={routePoints[1]}
//               sphereCenter={[
//                 sphereLocalCenter.x,
//                 sphereLocalCenter.y,
//                 sphereLocalCenter.z,
//               ]}
//               sphereRadius={SPHERE_RADIUS}
//               arcHeight={0.12}
//               segments={80}
//               thickness={0.003}
//               material="routeMaterial"
//               animationDuration={1200}
//             />
//           )}
//         </ViroNode>
//       )}
//     </ViroARScene>
//   );
// }

// // ============================================================
// // MATERIALS
// // ============================================================

// ViroMaterials.createMaterials({
//   earth: {
//     diffuseTexture: require("../../assets/images/earth2kNew1.jpg"),
//   },

//   markerMaterial: {
//     diffuseColor: "#00FF00",
//     lightingModel: "Constant",
//   },

//   pointAMaterial: {
//     diffuseColor: "#FFD700",
//     lightingModel: "Constant",
//   },

//   pointBMaterial: {
//     diffuseColor: "#FF3030",
//     lightingModel: "Constant",
//   },

//   routeMaterial: {
//     diffuseColor: "#00BFFF",
//     lightingModel: "Constant",
//   },
// });
