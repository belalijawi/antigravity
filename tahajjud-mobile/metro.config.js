// IMPORTANT: Sentry's `getSentryExpoConfig` wraps Expo's default Metro
// config so Metro can resolve @sentry/core's package `exports` field,
// which uses subpaths like ./logs/public-api.js. Without this wrapper,
// Metro throws "Unable to resolve module ./logs/public-api.js" when
// @sentry/core v10+ is installed.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getSentryExpoConfig(__dirname);

// nativewind removed — zero className usage in the codebase so its Metro
// wrapper and Babel transform were dead weight on every bundled file.

module.exports = config;
