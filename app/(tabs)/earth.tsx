import {
  ViroARImageMarker,
  ViroARScene,
  ViroARSceneNavigator,
  ViroARTrackingTargets,
  ViroDetectedObject,
  ViroDetectionEvent,
  ViroMaterials,
  ViroNode,
  ViroObjectDetector,
  ViroText,
} from "@reactvision/react-viro";
import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

/**
 * ---------------------------------------------------------
 * MATERIALS
 * ---------------------------------------------------------
 */

ViroMaterials.createMaterials({
  imageMarkerBox: {
    diffuseColor: "#00FF88",
    lightingModel: "Constant",
  },

  objectMarker: {
    diffuseColor: "#00AFFF",
    lightingModel: "Constant",
  },
});

/**
 * ---------------------------------------------------------
 * IMAGE RECOGNITION
 * ---------------------------------------------------------
 */

type ImageRecognitionProps = {
  onDetected: () => void;
};

ViroARTrackingTargets.createTargets({
  myImage: {
    source: require("../../assets/images/imagetarget.png"),
    orientation: "Up",
    physicalWidth: 0.165,
    type: "Image",
  },
});

const ImageRecognition = ({ onDetected }: ImageRecognitionProps) => {
  return (
    <ViroARImageMarker
      target="myImage"
      onAnchorFound={() => {
        console.log("🟢 IMAGE DETECTED");

        onDetected();
      }}
      onAnchorRemoved={() => {
        console.log("⚪ IMAGE LOST");
      }}
    >
      <ViroNode position={[0, 0, 0]}>
        {/* <ViroBox
          position={[0, 0.05, 0]}
          scale={[0.08, 0.08, 0.08]}
          materials={["imageMarkerBox"]}
        /> */}

        <ViroText
          text="IMAGE DETECTED"
          position={[0, 0.02, 0]}
          scale={[0.1, 0.1, 0.1]}
          transformBehaviors={["billboard"]}
          style={{
            fontSize: 20,
            fontWeight: "700",
            color: "#ff8400",
            textAlign: "center",
            textAlignVertical: "center",
          }}
          extrusionDepth={0}
        />
      </ViroNode>
    </ViroARImageMarker>
  );
};

/**
 * ---------------------------------------------------------
 * OBJECT RECOGNITION
 * ---------------------------------------------------------
 */

type ObjectRecognitionProps = {
  onObjectDetected: (detection: ViroDetectedObject) => void;
};

const ObjectRecognition = ({ onObjectDetected }: ObjectRecognitionProps) => {
  const handleDetection = useCallback(
    ({ detections }: ViroDetectionEvent) => {
      if (!detections || detections.length === 0) {
        return;
      }

      console.log("🔵 OBJECT DETECTIONS:", detections);

      /**
       * Get highest-confidence detection.
       */
      const bestDetection = [...detections].sort(
        (a, b) => b.confidence - a.confidence,
      )[0];

      console.log("🎯 OBJECT:", bestDetection.label);

      console.log("🎯 CONFIDENCE:", bestDetection.confidence);

      console.log("📦 BOUNDING BOX:", bestDetection.boundingBox);

      console.log("📱 SCREEN BOUNDING BOX:", bestDetection.screenBoundingBox);

      if (bestDetection.worldPosition) {
        console.log("🌎 WORLD POSITION:", bestDetection.worldPosition);
      }

      onObjectDetected(bestDetection);
    },
    [onObjectDetected],
  );

  return (
    <ViroObjectDetector
      model="yoloe-26n"
      mode="prompt-free"
      confidenceThreshold={0.45}
      maxFPS={15}
      maxDetections={20}
      onDetection={handleDetection}
      onReady={() => {
        console.log("✅ OBJECT DETECTOR READY");
      }}
      onError={(error) => {
        console.error("❌ OBJECT DETECTOR ERROR:", error);
      }}
      style={{
        position: "absolute",
        width: 0,
        height: 0,
      }}
    />
  );
};

/**
 * ---------------------------------------------------------
 * AR SCENE
 * ---------------------------------------------------------
 */

const RecognitionARScene = () => {
  const [imageDetected, setImageDetected] = useState(false);

  const [objectDetected, setObjectDetected] =
    useState<ViroDetectedObject | null>(null);

  /**
   * IMAGE TRIGGER
   */
  const handleImageDetected = useCallback(() => {
    console.log("🔥 IMAGE RECOGNITION TRIGGER FIRED");

    setImageDetected(true);
  }, []);

  /**
   * OBJECT TRIGGER
   */
  const handleObjectDetected = useCallback((detection: ViroDetectedObject) => {
    console.log("🔥 OBJECT RECOGNITION TRIGGER FIRED");

    console.log("Object:", detection.label);

    console.log("Confidence:", detection.confidence);

    console.log("Bounding Box:", detection.boundingBox);

    console.log("Screen Bounding Box:", detection.screenBoundingBox);

    if (detection.worldPosition) {
      console.log("World Position:", detection.worldPosition);
    }

    setObjectDetected((previous) => {
      if (
        previous?.label === detection.label &&
        Math.abs(previous.confidence - detection.confidence) < 0.02
      ) {
        return previous;
      }

      return detection;
    });
  }, []);

  return (
    <ViroARScene>
      {/* -----------------------------------------
          IMAGE RECOGNITION
          ----------------------------------------- */}

      <ImageRecognition onDetected={handleImageDetected} />

      {/* -----------------------------------------
          OBJECT RECOGNITION
          ----------------------------------------- */}

      {/* <ObjectRecognition onObjectDetected={handleObjectDetected} /> */}

      {/* -----------------------------------------
          OBJECT 3D MARKER
          ----------------------------------------- */}

      {/* {objectDetected?.worldPosition && (
        <ViroNode
          position={[
            objectDetected.worldPosition.x,

            objectDetected.worldPosition.y,

            objectDetected.worldPosition.z,
          ]}
        >
          <ViroBox
            position={[0, 0.1, 0]}
            scale={[0.05, 0.05, 0.05]}
            materials={["objectMarker"]}
          />

          <ViroText
            text={objectDetected.label}
            position={[0, 0.18, 0]}
            scale={[0.04, 0.04, 0.04]}
            style={{
              fontSize: 30,
              color: "#00AFFF",
              textAlign: "center",
              textAlignVertical: "center",
            }}
            extrusionDepth={0.01}
          />
        </ViroNode>
      )} */}
    </ViroARScene>
  );
};

/**
 * ---------------------------------------------------------
 * MAIN COMPONENT
 * ---------------------------------------------------------
 *
 * Same name as your original file:
 *
 *     Example
 *
 */

export default function Example() {
  return (
    <View style={styles.container}>
      <ViroARSceneNavigator
        style={StyleSheet.absoluteFill}
        initialScene={{
          scene: () => <RecognitionARScene />,
        }}
      />

      {/* -----------------------------------------
          STATUS UI
          ----------------------------------------- */}

      <View pointerEvents="none" style={styles.statusContainer}>
        <Text style={styles.title}>AR Recognition</Text>

        <Text style={styles.status}>Point camera at an image or object</Text>
      </View>
    </View>
  );
}

/**
 * ---------------------------------------------------------
 * STYLES
 * ---------------------------------------------------------
 */

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  statusContainer: {
    position: "absolute",
    top: 50,
    left: 20,
    right: 20,

    padding: 16,

    borderRadius: 12,

    backgroundColor: "rgba(0,0,0,0.65)",
  },

  title: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },

  status: {
    color: "#FFFFFF",
    fontSize: 15,
    marginTop: 4,
  },
});
