import {
  ViroARScene,
  ViroARSceneNavigator,
  ViroMaterials,
  ViroSphere,
} from "@reactvision/react-viro";
import React, { useState } from "react";

ViroMaterials.createMaterials({
  earth: {
    diffuseTexture: require("../../assets/images/images.jpeg"),
  },
});

const ARScene = () => {
  const [position, setPosition] = useState<[number, number, number] | null>(
    null,
  );

  ViroMaterials.createMaterials({
    box: {
      diffuseColor: "#ff0000",
    },
  });

  return (
    <ViroARScene
    // onClick={(position: any, source: any) => {
    //   console.log(JSON.stringify(source), JSON.stringify(position));

    //   if (source?.hitTestResults && source.hitTestResults.length > 0) {
    //     const hit = source.hitTestResults[0];
    //   }
    // }}
    // onAnchorFound={(anchorFoundMap) => {
    //   console.log("onAnchorFound:", anchorFoundMap);

    //   if (anchorFoundMap.type === "plane") {
    //     setPosition([
    //       anchorFoundMap.position[0],
    //       anchorFoundMap.position[1],
    //       anchorFoundMap.position[2],
    //     ]);
    //     console.log("onAnchorFound:", anchorFoundMap.position);
    //   }
    // }}
    // onAnchorRemoved={(event) => {
    //   console.log("onAnchorRemoved:", event);
    // }}
    // onAnchorUpdated={(anchorUpdatedMap) => {
    //   // console.log("onAnchorUpdated:", anchorUpdatedMap);
    // }}
    >
      {/* <ViroAmbientLight color="#0e0909" /> */}

      {/* <ViroBox
        position={position}
        scale={[0.1, 0.1, 0.1]}
        materials={["earth"]}
      /> */}

      <ViroSphere
        radius={0.5}
        position={[0, 0, -1]}
        materials={["earth"]}
        facesOutward={true}
      />

      {/* {position && ( */}
      {/* <Viro3DObject
        source={require("./../../assets/models/chair.obj")}
        resources={[require("./../../assets/models/chair.mtl")]}
        type="OBJ"
        position={position}
        scale={[0.5, 0.5, 0.5]}
        lightReceivingBitMask={3}
        shadowCastingBitMask={1}
      /> */}
      {/* )} */}
    </ViroARScene>
  );
};

export default function App() {
  return (
    <ViroARSceneNavigator
      autofocus
      initialScene={{ scene: ARScene }}
      style={{ flex: 1 }}
    />
  );
}
