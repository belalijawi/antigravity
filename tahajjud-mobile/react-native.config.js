// Exclude iOS-only native modules from Android autolinking so they don't break
// the Android Gradle build. The JS side of these libs still loads, but it's
// guarded with `Platform.OS === 'ios'` checks so Android execution is safe.
module.exports = {
    dependencies: {
        'react-native-health': {
            platforms: {
                android: null, // skip Android autolinking — iOS-only HealthKit lib
            },
        },
    },
};
