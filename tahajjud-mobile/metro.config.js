const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add support for 3D assets
config.resolver.assetExts.push(
    'glb',
    'gltf',
    'png',
    'jpg'
);

module.exports = withNativeWind(config, { input: './global.css' });
