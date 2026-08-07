import {
  ViroARScene,
  ViroARSceneNavigator,
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
  position: Vec3Tuple;
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
  const [markers, setMarkers] = useState<SphereMarker[]>([]);
  const [selectedState, setSelectedState] = useState<GeoFeature | null>(null);
  const [earthScale, setEarthScale] = useState(1);

  const MIN_SCALE = 0.5;
  const MAX_SCALE = 3;

  // --------------------------------------------------
  // Sphere parameters
  // --------------------------------------------------

  const sphereCenter: Vec3 = {
    x: 0,
    y: 0,
    z: -1,
  };

  const sphereRadius = 0.5;

  // Your existing sphere rotation.
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
  //
  // IMPORTANT:
  // This is your existing custom calculation.
  // It has not been replaced with camera/raycast
  // calculation.
  // --------------------------------------------------

  const _handleSphereClick = (
    clickState: number,
    clickPos: [number, number, number] | null | undefined,
  ) => {
    if (clickState !== 3 || !clickPos) {
      return;
    }

    console.log("================================");

    console.log("RAW CLICK:", clickPos);

    // --------------------------------------------------
    // 1. World -> sphere local
    // --------------------------------------------------

    const worldPoint: Vec3 = {
      x: clickPos[0],
      y: clickPos[1],
      z: clickPos[2],
    };

    const translatedPoint: Vec3 = {
      x: worldPoint.x - sphereCenter.x,

      y: worldPoint.y - sphereCenter.y,

      z: worldPoint.z - sphereCenter.z,
    };

    // --------------------------------------------------
    // 2. Undo sphere rotation
    // --------------------------------------------------

    const inverseRotation: [number, number, number] = [
      -sphereRotation[0],
      -sphereRotation[1],
      -sphereRotation[2],
    ];

    const localPoint = rotateVector(translatedPoint, inverseRotation);

    // --------------------------------------------------
    // 3. Project directly onto sphere surface
    // --------------------------------------------------

    const distance = Math.sqrt(
      localPoint.x * localPoint.x +
        localPoint.y * localPoint.y +
        localPoint.z * localPoint.z,
    );

    if (distance === 0) {
      return;
    }

    const scale = sphereRadius / distance;

    const surfaceLocal: Vec3 = {
      x: localPoint.x * scale,
      y: localPoint.y * scale,
      z: localPoint.z * scale,
    };

    console.log("LOCAL SURFACE:", surfaceLocal);

    // --------------------------------------------------
    // 4. Calculate lat/lng
    // --------------------------------------------------

    const { latitude, longitude } = surfacePointToLatLng(
      surfaceLocal,
      sphereRadius,
    );

    // --------------------------------------------------
    // 5. Find GeoJSON state
    // --------------------------------------------------

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

    if (detectedState) {
      console.log("✅ Selected state:", detectedState.properties.shapeName);

      setSelectedState(detectedState);
    } else {
      console.log("❌ No state found");

      setSelectedState(null);
    }

    // --------------------------------------------------
    // 7. Local -> World
    // --------------------------------------------------

    const rotatedSurface = rotateVector(surfaceLocal, sphereRotation);

    const worldSurface: Vec3Tuple = [
      rotatedSurface.x + sphereCenter.x,

      rotatedSurface.y + sphereCenter.y,

      rotatedSurface.z + sphereCenter.z,
    ];

    console.log("📍 WORLD SURFACE:", worldSurface);

    // --------------------------------------------------
    // 8. World normal
    // --------------------------------------------------

    const localNormal = normalizeVector(surfaceLocal);

    const worldNormal = rotateVector(localNormal, sphereRotation);

    const lineLength = 0.08;

    const start: Vec3Tuple = worldSurface;

    const end: Vec3Tuple = [
      start[0] + worldNormal.x * lineLength,

      start[1] + worldNormal.y * lineLength,

      start[2] + worldNormal.z * lineLength,
    ];

    // --------------------------------------------------
    // 9. Add click marker
    // --------------------------------------------------

    setMarkers((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${prev.length}`,
        position: worldSurface,
        end,
        start: start,
      },
    ]);

    console.log("================================");
  };

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
    <ViroARScene>
      {/* ------------------------------------------- */}
      {/* Earth */}
      {/* ------------------------------------------- */}

      <ViroNode
        position={[sphereCenter.x, sphereCenter.y, sphereCenter.z]}
        rotation={sphereRotation}
        scale={[earthScale, earthScale, earthScale]}
        onPinch={handlePinch}
      >
        <ViroSphere
          heightSegmentCount={20}
          widthSegmentCount={20}
          radius={sphereRadius}
          position={[0, 0, 0]}
          materials={["earth"]}
          facesOutward={true}
          onClickState={_handleSphereClick}
        />

        {/* ------------------------------------------- */}
        {/* Click markers */}
        {/* ------------------------------------------- */}

        {/* {markers.map((marker) => (
        <React.Fragment key={marker.id}>
          <ViroPolyline
            points={[marker.position, marker.end]}
            thickness={0.003}
            materials={["markerMaterial"]}
          />

          <ViroBox
            position={marker.position}
            scale={[0.005, 0.005, 0.005]}
            materials={["markerMaterial"]}
          />
        </React.Fragment>
      ))} */}

        {selectedState && (
          <StateHighlight
            feature={selectedState}
            color="#00FFFF"
            earthRadius={sphereRadius}
            earthPosition={[0, 0, 0]}
            sphereRotation={[0, 0, 0]}
          />
        )}
      </ViroNode>
    </ViroARScene>
  );
}

ViroMaterials.createMaterials({
  sphereMaterial: { diffuseColor: "#FF0000" },
  markerMaterial: { diffuseColor: "#00FF00" },
});
