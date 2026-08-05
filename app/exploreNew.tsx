// import {
//     Viro3DObject,
//     ViroAmbientLight,
//     ViroAnimations,
//     ViroARScene,
//     ViroARSceneNavigator,
//     ViroBox,
//     ViroCameraTexture,
//     ViroMaterials,
//     ViroNode,
//     ViroQuad,
//     ViroScene,
//     ViroSpotLight,
//     ViroText,
// } from "@reactvision/react-viro";
// // import { ViroFaceTracking } from "@reactvision/react-viro-face-tracking";
// import React, { useState } from "react";
// import { Dimensions } from "react-native";
// const emojiSmileVrx = require("./../../assets/emoji/emoji_smile.vrx");

// export default function HomeScreen() {
//   // ViroFaceTracking.isSupported();

//   return (
//     <ViroARSceneNavigator
//       provider="arcore"
//       frontCameraEnabled
//       autofocus
//       initialScene={{
//         scene: SelfieARScene,
//       }}
//       style={{ flex: 1 }}
//       onWorldMeshUpdated={(state) => {
//         console.log("state of mesh", state.lastUpdateTimeMs);
//       }}
//       depthDebugEnabled
//       onPointerDownCapture={(event) => {
//         console.log("state of mesh", event.type);
//       }}
//       onCloudAnchorStateChange={(event) => {
//         console.log("FullscreenSelfieScene", event.anchorId);
//       }}
//     />
//   );
// }

// const FaceScene = () => (
//   <ViroARScene>
//     <ViroAmbientLight color="#ffffff" intensity={300} />
//     {/* content here renders over the selfie feed but is NOT attached to face landmarks */}
//   </ViroARScene>
// );

// function HomeScene() {
//   ViroMaterials.createMaterials({
//     grid: {
//       diffuseTexture: require("./../../assets/images/grid_bg.jpg"),
//     },
//   });

//   ViroAnimations.registerAnimations({
//     rotate: {
//       properties: {
//         rotateY: "+=90",
//       },
//       duration: 250, //.25 seconds
//     },
//   });

//   return (
//     <ViroARScene>
//       <ViroText
//         text={"Hello world"}
//         scale={[0.5, 0.5, 0.5]}
//         position={[0, 0, -2]}
//         style={{
//           fontFamily: "Arial",
//           fontSize: 30,
//           color: "#ffffff",
//           textAlignVertical: "center",
//           textAlign: "center",
//         }}
//       />

//       <ViroBox
//         position={[-0.5, -0.5, -1]}
//         animation={{ name: "rotate", run: true, loop: true }}
//         scale={[0.3, 0.3, 0.1]}
//         materials={["grid"]}
//       />

//       <ViroSpotLight
//         innerAngle={5}
//         outerAngle={90}
//         direction={[0, -1, -0.2]}
//         position={[0, -1, 0]}
//         color="#780606"
//         castsShadow={true}
//         shadowOpacity={0.1}
//         shadowFarZ={1}
//       />

//       <ViroNode
//         position={[0.5, -0.5, -0.5]}
//         dragType="FixedToWorld"
//         onDrag={() => {}}
//       >
//         <ViroAmbientLight color="#ffffff" intensity={300} />

//         <ViroSpotLight
//           innerAngle={5}
//           outerAngle={360}
//           direction={[0, -1, -0.2]}
//           position={[0, 0, 0]}
//           color="#ffffff"
//           castsShadow={true}
//           influenceBitMask={2}
//           shadowMapSize={2048}
//           shadowNearZ={2}
//           shadowFarZ={5}
//           shadowOpacity={0.1}
//           attenuationStartDistance={4}
//           attenuationEndDistance={10}
//         />

//         <Viro3DObject
//           source={emojiSmileVrx}
//           position={[0, 0, -1]}
//           scale={[0.2, 0.2, 0.2]}
//           type="VRX"
//           lightReceivingBitMask={3}
//           shadowCastingBitMask={1}
//           transformBehaviors={["billboardY"]}
//           resources={[
//             require("./../../assets/emoji/emoji_smile_diffuse.png"),
//             require("./../../assets/emoji/emoji_smile_specular.png"),
//             require("./../../assets/emoji/emoji_smile_normal.png"),
//           ]}
//         />

//         <ViroQuad
//           rotation={[-90, 0, 0]}
//           width={0.5}
//           height={0.5}
//           arShadowReceiver={true}
//           lightReceivingBitMask={2}
//         />
//       </ViroNode>
//     </ViroARScene>
//   );
// }

// function SelfieARScene() {
//   const [ready, setReady] = useState(false);
//   ViroMaterials.createMaterials({
//     selfie: { lightingModel: "Constant" },
//   });

//   const onTrackingUpdated = (state: number, reason: number) => {
//     console.log("Tracking State:", state);
//     console.log("Tracking Reason:", reason);
//   };

//   const onCameraTransformUpdate = (transform: any) => {
//     console.log("Camera Transform:", transform);
//   };

//   ViroMaterials.createMaterials({
//     box: {
//       diffuseColor: "#ff0000",
//     },
//   });

//   return (
//     <ViroARScene>
//       <ViroAmbientLight color="#ffffff" intensity={1000} />

//       <ViroBox
//         position={[0, 0, -0.5]}
//         scale={[0.1, 0.1, 0.1]}
//         materials={["box"]}
//       />
//     </ViroARScene>
//   );

//   // return (
//   //   <ViroARScene
//   //     onTrackingUpdated={onTrackingUpdated}
//   //     onCameraTransformUpdate={onCameraTransformUpdate}
//   //   >
//   //     <ViroNode position={[0, 0, -1]}>
//   //       <ViroText
//   //         text="WORLD"
//   //         width={2}
//   //         height={2}
//   //         style={{
//   //           fontSize: 30,
//   //           color: "#ffffff",
//   //           textAlign: "center",
//   //         }}
//   //       />
//   //     </ViroNode>
//   //   </ViroARScene>
//   // );

//   // return (
//   //   <ViroARScene
//   //     onTrackingUpdated={(state, reason) => {
//   //       console.log("onTrackingUpdated", state.toString(), reason);
//   //     }}
//   //     onDepthReady={() => {}}
//   //   >

//   //     {/* A portrait-ratio quad floating in front of the user */}
//   //     <ViroQuad
//   //       position={[0, 0, -1.5]}
//   //       width={0.9}
//   //       height={1.6}
//   //       materials={["selfie"]}
//   //       opacity={ready ? 1 : 0} // hide until the first frame arrives
//   //     />
//   //     {/* <ViroCameraTexture
//   //       material="selfie"
//   //       cameraPosition="front"
//   //       onCameraReady={() => setReady(true)}
//   //       onError={(e) => console.error("Camera error:", e.nativeEvent.error)}
//   //     /> */}
//   //   </ViroARScene>
//   // );
// }

// function FullscreenSelfieScene() {
//   const [ready, setReady] = useState(false);

//   ViroMaterials.createMaterials({
//     mirror: { lightingModel: "Constant" },
//   });

//   const DIST = 1;
//   const WIDTH = 2 * DIST; // fills 90° horizontal FOV
//   const { width: sw, height: sh } = Dimensions.get("window");
//   const HEIGHT = WIDTH * (sh / sw);

//   return (
//     <ViroScene>
//       <ViroQuad
//         position={[0, 0, -DIST]}
//         width={WIDTH}
//         height={HEIGHT}
//         materials={["mirror"]}
//         opacity={ready ? 1 : 0}
//       />
//       <ViroCameraTexture
//         material="mirror"
//         cameraPosition="front"
//         onCameraReady={() => setReady(true)}
//         onError={(e) => console.error(e.nativeEvent.error)}
//       />
//     </ViroScene>
//   );
// }
