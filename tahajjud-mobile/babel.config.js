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
            ["babel-preset-expo", { jsxImportSource: "nativewind" }],
            "nativewind/babel",
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
