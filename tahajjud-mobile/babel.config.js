module.exports = function (api) {
    api.cache(true);

    // Strip console.* calls in production builds — they're surprisingly
    // expensive on Android (each log crosses the JS-native bridge and
    // serializes its args). With 31+ console.log calls scattered across the
    // app, hot paths like list scroll and audio playback were paying a real
    // cost. Hermes strips some but transform-remove-console guarantees it.
    // Keep console.error so Sentry / native crash reporters still see issues.
    const productionPlugins = [
        ["transform-remove-console", { exclude: ["error", "warn"] }],
    ];

    return {
        presets: [
            // Standard Expo preset — nativewind removed (zero className usage
            // in the codebase; its Babel transform was running on every file
            // for no benefit and injecting its runtime into the bundle).
            "babel-preset-expo",
        ],
        plugins: [
            "react-native-reanimated/plugin",
        ],
        env: {
            production: {
                plugins: productionPlugins,
            },
        },
    };
};
