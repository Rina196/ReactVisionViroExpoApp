import {
  ViroARPlaneSelector,
  ViroARScene,
  ViroARSceneNavigator,
  ViroBox,
  ViroMaterials,
  ViroNode,
  ViroSphere,
} from "@reactvision/react-viro";
import React, { useRef, useState } from "react";

import indiaGeoJson from "../../assets/IND.json";

import StateHighlight from "../stateHighlight";
import {
  findStateAtCoordinate,
  GeoFeature,
  normalizeVector,
  surfacePointToLatLng,
  Vec3,
} from "../utils/ar-utils";

type Vec3Tuple = [number, number, number];

type SphereMarker = {
  id: string;

  // IMPORTANT:
  // Marker position is EARTH-LOCAL coordinates.
  position: Vec3Tuple;

  // IMPORTANT:
  // Marker end is also EARTH-LOCAL coordinates.
  end: Vec3Tuple;
};

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
  const selectorRef = useRef<any>(null);

  const [markers, setMarkers] = useState<SphereMarker[]>([]);

  const [selectedState, setSelectedState] = useState<GeoFeature | null>(null);

  const [earthPosition, setEarthPosition] = useState<
    [number, number, number] | null
  >(null);

  const [earthScale, setEarthScale] = useState(1);

  const MIN_SCALE = 0.5;
  const MAX_SCALE = 3;

  // --------------------------------------------------
  // Sphere parameters
  // --------------------------------------------------

  const sphereRadius = 0.5;

  // Keep your existing Earth rotation.
  const sphereRotation: [number, number, number] = [0, 0, 180];

  // --------------------------------------------------
  // Rotate vector by Euler rotation
  // --------------------------------------------------

  const rotateVector = (v: Vec3, euler: [number, number, number]): Vec3 => {
    const radX = (euler[0] * Math.PI) / 180;
    const radY = (euler[1] * Math.PI) / 180;
    const radZ = (euler[2] * Math.PI) / 180;

    // RX
    const y1 = v.y * Math.cos(radX) - v.z * Math.sin(radX);

    const z1 = v.y * Math.sin(radX) + v.z * Math.cos(radX);

    const x1 = v.x;

    // RY
    const x2 = x1 * Math.cos(radY) + z1 * Math.sin(radY);

    const z2 = -x1 * Math.sin(radY) + z1 * Math.cos(radY);

    const y2 = y1;

    // RZ
    const x3 = x2 * Math.cos(radZ) - y2 * Math.sin(radZ);

    const y3 = x2 * Math.sin(radZ) + y2 * Math.cos(radZ);

    const z3 = z2;

    return {
      x: x3,
      y: y3,
      z: z3,
    };
  };

  // --------------------------------------------------
  // Sphere click
  // --------------------------------------------------

  const _handleSphereClick = (
    clickState: number,
    clickPos: [number, number, number] | null | undefined,
  ) => {
    if (clickState !== 3 || !clickPos || !earthPosition) {
      return;
    }

    console.log("================================");
    console.log("🌎 RAW WORLD CLICK:", clickPos);
    console.log("🌎 EARTH POSITION:", earthPosition);
    console.log("🌎 EARTH SCALE:", earthScale);
    console.log("🌎 EARTH ROTATION:", sphereRotation);

    // --------------------------------------------------
    // 1. Click position is WORLD coordinates
    // --------------------------------------------------

    const worldClick: Vec3 = {
      x: clickPos[0],
      y: clickPos[1],
      z: clickPos[2],
    };

    // --------------------------------------------------
    // 2. WORLD -> EARTH NODE LOCAL
    // --------------------------------------------------

    // Remove Earth node translation.
    const translated: Vec3 = {
      x: worldClick.x - earthPosition[0],

      y: worldClick.y - earthPosition[1],

      z: worldClick.z - earthPosition[2],
    };

    // Undo Earth rotation.
    const inverseRotation: [number, number, number] = [
      -sphereRotation[0],
      -sphereRotation[1],
      -sphereRotation[2],
    ];

    const unrotated = rotateVector(translated, inverseRotation);

    // Undo Earth scale.
    const earthLocal: Vec3 = {
      x: unrotated.x / earthScale,
      y: unrotated.y / earthScale,
      z: unrotated.z / earthScale,
    };

    console.log("📐 EARTH LOCAL CLICK:", earthLocal);

    // --------------------------------------------------
    // 3. Sphere center in Earth-local coordinates
    //
    // ViroSphere:
    // position={[0, sphereRadius, 0]}
    // --------------------------------------------------

    const sphereLocalCenter: Vec3 = {
      x: 0,
      y: sphereRadius,
      z: 0,
    };

    // --------------------------------------------------
    // 4. Click relative to sphere center
    // --------------------------------------------------

    const fromSphereCenter: Vec3 = {
      x: earthLocal.x - sphereLocalCenter.x,

      y: earthLocal.y - sphereLocalCenter.y,

      z: earthLocal.z - sphereLocalCenter.z,
    };

    console.log("🌐 FROM SPHERE CENTER:", fromSphereCenter);

    // --------------------------------------------------
    // 5. Project click onto sphere surface
    // --------------------------------------------------

    const distance = Math.sqrt(
      fromSphereCenter.x * fromSphereCenter.x +
        fromSphereCenter.y * fromSphereCenter.y +
        fromSphereCenter.z * fromSphereCenter.z,
    );

    if (distance === 0) {
      console.log("❌ Click is at sphere center");
      return;
    }

    const projectionScale = sphereRadius / distance;

    const surfaceLocal: Vec3 = {
      x: fromSphereCenter.x * projectionScale,

      y: fromSphereCenter.y * projectionScale,

      z: fromSphereCenter.z * projectionScale,
    };

    console.log("📍 SPHERE LOCAL SURFACE:", surfaceLocal);

    // --------------------------------------------------
    // 6. Latitude / Longitude
    // --------------------------------------------------

    const { latitude, longitude } = surfacePointToLatLng(
      surfaceLocal,
      sphereRadius,
    );

    console.log("🌍 LAT/LNG:", {
      latitude,
      longitude,
    });

    // --------------------------------------------------
    // 7. Find state from GeoJSON
    // --------------------------------------------------

    const detectedState = findStateAtCoordinate(
      latitude,
      longitude,
      (indiaGeoJson as any).features as GeoFeature[],
    );

    console.log("🌍 TAP LOCATION:", {
      latitude,
      longitude,
      country: detectedState?.properties.shapeGroup ?? null,
      state: detectedState?.properties.shapeName ?? null,
    });

    if (detectedState) {
      console.log("✅ SELECTED STATE:", detectedState.properties.shapeName);

      setSelectedState(detectedState);
    } else {
      console.log("❌ NO STATE FOUND");

      setSelectedState(null);

      // Alert.alert(
      //   "No state found",
      //   "Tap did not hit a recognized state on the globe.",
      // );
    }

    // --------------------------------------------------
    // 8. Surface -> EARTH NODE LOCAL
    //
    // IMPORTANT:
    //
    // The marker is rendered INSIDE the Earth ViroNode.
    //
    // Therefore this must remain LOCAL.
    // --------------------------------------------------

    const sphereSurfaceInEarthLocal: Vec3 = {
      x: surfaceLocal.x,

      y: surfaceLocal.y + sphereRadius,

      z: surfaceLocal.z,
    };

    console.log("📍 MARKER EARTH-LOCAL:", sphereSurfaceInEarthLocal);

    // --------------------------------------------------
    // 9. Optional WORLD conversion
    //
    // This is ONLY for debugging.
    //
    // DO NOT use worldSurface as
    // ViroBox position.
    // --------------------------------------------------

    const scaledSurface: Vec3 = {
      x: sphereSurfaceInEarthLocal.x * earthScale,

      y: sphereSurfaceInEarthLocal.y * earthScale,

      z: sphereSurfaceInEarthLocal.z * earthScale,
    };

    const rotatedSurface = rotateVector(scaledSurface, sphereRotation);

    const worldSurface: Vec3Tuple = [
      rotatedSurface.x + earthPosition[0],

      rotatedSurface.y + earthPosition[1],

      rotatedSurface.z + earthPosition[2],
    ];

    console.log("🌎 DEBUG WORLD SURFACE:", worldSurface);

    // --------------------------------------------------
    // 10. LOCAL NORMAL
    //
    // IMPORTANT:
    //
    // Marker is inside Earth node.
    //
    // Do NOT rotate this normal again.
    // The parent ViroNode already applies
    // sphereRotation.
    // --------------------------------------------------

    const localNormal = normalizeVector(surfaceLocal);

    // --------------------------------------------------
    // 11. Marker
    //
    // IMPORTANT:
    //
    // position = EARTH LOCAL
    // end      = EARTH LOCAL
    // --------------------------------------------------

    const lineLength = 0.08;

    const start: Vec3Tuple = [
      sphereSurfaceInEarthLocal.x,
      sphereSurfaceInEarthLocal.y,
      sphereSurfaceInEarthLocal.z,
    ];

    const end: Vec3Tuple = [
      start[0] + localNormal.x * lineLength,

      start[1] + localNormal.y * lineLength,

      start[2] + localNormal.z * lineLength,
    ];

    setMarkers((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${prev.length}`,
        position: start,
        end,
      },
    ]);

    console.log("📌 MARKER LOCAL START:", start);

    console.log("📌 MARKER LOCAL END:", end);

    console.log("================================");
  };

  // --------------------------------------------------
  // Pinch
  // --------------------------------------------------

  const pinchStartScale = useRef(1);

  const handlePinch = (pinchState: number, scaleFactor: number) => {
    if (pinchState === 1) {
      pinchStartScale.current = earthScale;

      return;
    }

    if (pinchState === 2) {
      const newScale = pinchStartScale.current * scaleFactor;

      const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));

      setEarthScale(clampedScale);
    }
  };

  // --------------------------------------------------
  // Render
  // --------------------------------------------------

  return (
    <ViroARScene
      anchorDetectionTypes={["PlanesHorizontal"]}
      onAnchorFound={(anchor) => {
        selectorRef.current?.handleAnchorFound(anchor);
      }}
      onAnchorUpdated={(anchor) => {
        selectorRef.current?.handleAnchorUpdated(anchor);
      }}
      onAnchorRemoved={(anchor) => {
        anchor && selectorRef.current?.handleAnchorRemoved(anchor);
      }}
    >
      {/* ------------------------------------------------ */}
      {/* Plane Selector                                   */}
      {/* ------------------------------------------------ */}

      <ViroARPlaneSelector
        ref={selectorRef}
        alignment="Horizontal"
        minWidth={0.1}
        minHeight={0.1}
        hideOverlayOnSelection={true}
        useActualShape={true}
        onPlaneSelected={(_, tapPosition) => {
          if (!tapPosition) {
            return;
          }

          console.log("🟢 PLANE TAP POSITION:", tapPosition);

          setEarthPosition(tapPosition);
        }}
      />

      {/* ------------------------------------------------ */}
      {/* EARTH                                            */}
      {/* ------------------------------------------------ */}

      {earthPosition && (
        <ViroNode
          position={earthPosition}
          rotation={sphereRotation}
          scale={[earthScale, earthScale, earthScale]}
          onPinch={handlePinch}
        >
          {/* ------------------------------------------------ */}
          {/* Earth sphere                                     */}
          {/* ------------------------------------------------ */}

          <ViroSphere
            heightSegmentCount={20}
            widthSegmentCount={20}
            radius={sphereRadius}
            position={[0, sphereRadius, 0]}
            materials={["earth"]}
            facesOutward={true}
            highAccuracyEvents={true}
            onClickState={_handleSphereClick}
          />

          {/* ------------------------------------------------ */}
          {/* Click markers                                    */}
          {/* ------------------------------------------------ */}

          {markers.map((marker) => (
            <React.Fragment key={marker.id}>
              <ViroBox
                position={marker.position}
                scale={[0.005, 0.005, 0.005]}
                materials={["markerMaterial"]}
              />
            </React.Fragment>
          ))}

          {/* ------------------------------------------------ */}
          {/* State Highlight                                  */}
          {/* ------------------------------------------------ */}

          {selectedState && (
            <StateHighlight
              feature={selectedState}
              color="#FF0000"
              earthRadius={sphereRadius}
              earthPosition={[0, sphereRadius, 0]}
            />
          )}

          {/* {selectedState && (
            <StateHighlight
              feature={selectedState}
              color="#00FFFF"
              earthRadius={sphereRadius}
              earthPosition={[0, sphereRadius, 0]}
              sphereRotation={sphereRotation}
            />
          )} */}
        </ViroNode>
      )}
    </ViroARScene>
  );
}

// --------------------------------------------------
// Materials
// --------------------------------------------------

ViroMaterials.createMaterials({
  earth: {
    diffuseTexture: require("../../assets/images/earth2kNew1.jpg"),
  },

  markerMaterial: {
    diffuseColor: "#00FF00",
  },
});
