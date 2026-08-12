import {
  ViroARPlaneSelector,
  ViroARScene,
  ViroARSceneNavigator,
  ViroMaterials,
  ViroNode,
  ViroSphere,
} from "@reactvision/react-viro";
import React, { useRef, useState } from "react";

import indiaGeoJson from "../../assets/IND.json";

import { ViroClickState } from "@reactvision/react-viro/dist/components/Types/ViroEvents";
import StateHighlight from "../stateHighlight";
import {
  earthLocalToWorld,
  EarthTransform,
  findStateAtCoordinate,
  GeoFeature,
  normalizeVector,
  surfacePointToLatLng,
  Vec3,
  worldToEarthLocal,
} from "../utils/ar-utils";

type Vec3Tuple = [number, number, number];

type SphereMarker = {
  id: string;
  position: Vec3Tuple;
  end: Vec3Tuple;
};

const SPHERE_RADIUS = 0.5;

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;

// Keep the same rotation that was already working
// with your Earth texture + GeoJSON coordinate system.
const EARTH_ROTATION: [number, number, number] = [0, 0, 180];

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

  /**
   * Earth scale is kept separately because pinch changes it.
   *
   * IMPORTANT:
   *
   * Geographic calculations always use the LOCAL sphere radius.
   *
   * Actual world radius = SPHERE_RADIUS * earthScale
   */
  const [earthScale, setEarthScale] = useState(1);

  /**
   * Earth is initially not placed.
   *
   * Once the user taps a detected plane, this becomes
   * the WORLD position of the Earth.
   */
  const [earthPosition, setEarthPosition] = useState<Vec3 | null>(null);

  /**
   * This is the single source of truth for the Earth transform.
   *
   * LOCAL Earth:
   *
   *   center = [0, 0, 0]
   *   radius = 0.5
   *
   * WORLD Earth:
   *
   *   position = plane tap position
   *   rotation = EARTH_ROTATION
   *   scale = earthScale
   */
  const earthTransform: EarthTransform | null = earthPosition
    ? {
        position: earthPosition,
        rotation: EARTH_ROTATION,
        scale: earthScale,
        radius: SPHERE_RADIUS,
      }
    : null;

  // --------------------------------------------------
  // Plane selection
  // --------------------------------------------------

  /**
   * IMPORTANT:
   *
   * Depending on your installed ReactVision Viro version,
   * the exact ViroARScene plane APIs can differ.
   *
   * The important value we need from plane selection is:
   *
   *   tapPosition = [x, y, z]
   *
   * in WORLD coordinates.
   *
   * If you already have a working ViroARPlaneSelector
   * implementation, use its onPlaneSelected callback
   * to call this function.
   */
  const handlePlaneSelected = (tapPosition: Vec3Tuple) => {
    console.log("================================");
    console.log("🌎 PLANE TAP:", tapPosition);

    const position: Vec3 = {
      x: tapPosition[0],
      y: tapPosition[1],
      z: tapPosition[2],
    };

    setEarthPosition(position);

    // Clear previous geographic selection when placing
    // a new Earth.
    setSelectedState(null);

    // Optional: clear old markers.
    setMarkers([]);

    console.log("🌍 EARTH WORLD POSITION:", position);
    console.log("================================");
  };

  // --------------------------------------------------
  // Sphere click
  // --------------------------------------------------

  const handleSphereClick = (
    clickState: ViroClickState,
    clickPos: [number, number, number] | null | undefined,
  ) => {
    console.log("clickPos", clickPos, clickState);

    if (!clickPos || !earthTransform) {
      return;
    }

    console.log("================================");
    console.log("🌍 RAW CLICK WORLD:", clickPos);

    // --------------------------------------------------
    // 1. Viro click position is WORLD coordinates.
    // --------------------------------------------------

    const worldPoint: Vec3 = {
      x: clickPos[0],
      y: clickPos[1],
      z: clickPos[2],
    };

    console.log("WORLD POINT:", worldPoint);

    // --------------------------------------------------
    // 2. WORLD -> EARTH LOCAL
    //
    // This removes:
    //
    //   Earth position
    //   Earth scale
    //   Earth rotation
    //
    // After this point everything is back inside
    // the original coordinate system of your Earth.
    // --------------------------------------------------

    const localPoint = worldToEarthLocal(worldPoint, earthTransform);

    console.log("LOCAL CLICK:", localPoint);

    // --------------------------------------------------
    // 3. Project onto LOCAL sphere surface
    //
    // IMPORTANT:
    //
    // Use SPHERE_RADIUS, NOT:
    //
    //   SPHERE_RADIUS * earthScale
    //
    // because scale was already removed above.
    // --------------------------------------------------

    const distance = Math.sqrt(
      localPoint.x * localPoint.x +
        localPoint.y * localPoint.y +
        localPoint.z * localPoint.z,
    );

    if (distance === 0) {
      console.log("❌ Invalid click distance");
      return;
    }

    const projectionScale = SPHERE_RADIUS / distance;

    const surfaceLocal: Vec3 = {
      x: localPoint.x * projectionScale,
      y: localPoint.y * projectionScale,
      z: localPoint.z * projectionScale,
    };

    console.log("LOCAL SURFACE:", surfaceLocal);

    // --------------------------------------------------
    // 4. LOCAL SURFACE -> LAT/LON
    //
    // This function does not know anything about AR.
    // It continues to use your original Earth mapping.
    // --------------------------------------------------

    const { latitude, longitude } = surfacePointToLatLng(
      surfaceLocal,
      SPHERE_RADIUS,
    );

    console.log("🌍 LAT/LON:", {
      latitude,
      longitude,
    });

    // --------------------------------------------------
    // 5. GeoJSON state lookup
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
    // 6. LOCAL -> WORLD
    //
    // Used only for debugging / markers.
    // --------------------------------------------------

    const worldSurface = earthLocalToWorld(surfaceLocal, earthTransform);

    const worldSurfaceTuple: Vec3Tuple = [
      worldSurface.x,
      worldSurface.y,
      worldSurface.z,
    ];

    console.log("📍 WORLD SURFACE:", worldSurfaceTuple);

    // --------------------------------------------------
    // 7. World normal
    // --------------------------------------------------

    const localNormal = normalizeVector(surfaceLocal);

    /**
     * Scale does NOT affect a normal.
     *
     * Only rotation needs to be applied.
     */
    const worldNormalPoint = earthLocalToWorld(localNormal, {
      ...earthTransform,
      position: {
        x: 0,
        y: 0,
        z: 0,
      },
      scale: 1,
    });

    const worldNormal = normalizeVector(worldNormalPoint);

    const lineLength = 0.08;

    const start: Vec3Tuple = worldSurfaceTuple;

    const end: Vec3Tuple = [
      start[0] + worldNormal.x * lineLength,
      start[1] + worldNormal.y * lineLength,
      start[2] + worldNormal.z * lineLength,
    ];

    // --------------------------------------------------
    // 8. Add marker
    // --------------------------------------------------

    setMarkers((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${prev.length}`,
        position: worldSurfaceTuple,
        end,
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

  // --------------------------------------------------
  // Pinch
  // --------------------------------------------------

  const pinchStartScale = useRef(1);
  const planeSelectorRef = useRef<ViroARPlaneSelector>(null);
  const [sphereCenter, setSphereCenter] = useState({ x: 0, y: 0, z: 0 });

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

  console.log("🌍 EARTH SCALE:", earthTransform);

  // --------------------------------------------------
  // Render
  // --------------------------------------------------

  return (
    <ViroARScene
      anchorDetectionTypes={["PlanesHorizontal"]}
      onAnchorFound={(anchor) => {
        console.log("🟢 ANCHOR FOUND:", anchor);
        planeSelectorRef.current?.handleAnchorFound(anchor);
      }}
      onAnchorUpdated={(anchor) => {
        planeSelectorRef.current?.handleAnchorUpdated(anchor);
      }}
      onAnchorRemoved={(anchor) => {
        console.log("🔴 ANCHOR REMOVED:", anchor);
        planeSelectorRef.current?.handleAnchorRemoved(anchor);
      }}
    >
      {/**
       * ------------------------------------------------
       * PLANE PLACEMENT
       * ------------------------------------------------
       *
       * Replace this section with the exact
       * ViroARPlaneSelector implementation from the
       * version of ReactVision Viro you have installed.
       *
       * The important operation is:
       *
       * onPlaneSelected(..., tapPosition)
       *
       * =>
       *
       * handlePlaneSelected(tapPosition)
       *
       * ------------------------------------------------
       */}

      {!earthTransform && (
        <ViroNode
        /* Your plane selector goes here */
        >
          <ViroARPlaneSelector
            ref={planeSelectorRef}
            alignment="Horizontal"
            minWidth={0.5}
            minHeight={0.5}
            hideOverlayOnSelection={true}
            useActualShape={true}
            onPlaneSelected={(anchor, tapPosition) => {
              if (!tapPosition) {
                return;
              }

              console.log("🌎 EARTH PLACED:", tapPosition);

              setSphereCenter({
                x: tapPosition[0],
                y: tapPosition[1],
                z: tapPosition[2],
              });

              setEarthPosition({
                x: tapPosition[0],
                y: tapPosition[1],
                z: tapPosition[2],
              });
            }}
          ></ViroARPlaneSelector>
        </ViroNode>
      )}

      {/**
       * ------------------------------------------------
       * EARTH
       * ------------------------------------------------
       */}

      {earthTransform && (
        <ViroNode
          position={[
            earthTransform.position.x,
            earthTransform.position.y,
            earthTransform.position.z,
          ]}
          rotation={earthTransform.rotation}
          scale={[
            earthTransform.scale,
            earthTransform.scale,
            earthTransform.scale,
          ]}
          onPinch={handlePinch}
        >
          <ViroSphere
            heightSegmentCount={40}
            widthSegmentCount={40}
            radius={SPHERE_RADIUS}
            position={[0, 0, 0]}
            highAccuracyEvents={true}
            materials={["earth"]}
            facesOutward={true}
            // onClick={handleSphereClick}
            onClickState={handleSphereClick}
          />

          {/**
           * IMPORTANT:
           *
           * StateHighlight is LOCAL to this Earth node.
           *
           * Therefore it does NOT need:
           *
           * earthPosition
           * sphereRotation
           *
           * Viro automatically applies the parent's
           * world transform.
           */}

          {selectedState && (
            <ViroNode ignoreEventHandling={true}>
              <StateHighlight
                feature={selectedState}
                color="#00FFFF"
                earthRadius={SPHERE_RADIUS}
              />
            </ViroNode>
          )}
        </ViroNode>
      )}
    </ViroARScene>
  );
}
