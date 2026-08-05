const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push(
  "vrx",
  "obj",
  "mtl",
  "vrx",
  "glb",
  "gltf",
  "bin",
  "hdr",
);

module.exports = config;
