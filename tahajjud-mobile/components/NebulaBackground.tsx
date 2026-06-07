import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTheme } from '../context/ThemeContext';

/**
 * The app's shared cosmic background — a theme-tinted gradient with soft nebula
 * blobs and a faint star field. Rendered once behind the tab navigator, and also
 * behind full-screen modals (e.g. the Hifz session) so every surface shares the
 * same look instead of falling back to flat black.
 */
export const NebulaBackground = () => {
  const { colors, darkMode } = useTheme();
  const starCount = colors.starCount ?? 120;
  const starMaxOpacity = colors.starMaxOpacity ?? 0.4;
  const effectiveStarCount = darkMode ? Math.floor(starCount * 0.55) : starCount;
  const effectiveStarMaxOpacity = darkMode ? starMaxOpacity * 0.38 : starMaxOpacity;

  const stars = React.useMemo(() => {
    return Array.from({ length: effectiveStarCount }).map((_, i) => ({
      id: i,
      top: Math.random() * 100,
      left: Math.random() * 100,
      size: Math.random() * 1.5 + 1,
      opacity: Math.random() * effectiveStarMaxOpacity + 0.05,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveStarCount, effectiveStarMaxOpacity]);

  // Android renders without BlurView, so the 4 nebula layers + gradient stay
  // raw and expensive on the GPU. Use a flat solid background on Android.
  if (Platform.OS === 'android') {
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: '#020617' }]} />;
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={darkMode ? ['#000000', '#000000', '#000000'] : ['#000000', colors.background, '#000000']}
        style={StyleSheet.absoluteFill}
      />

      {/* Theme-aware cosmic layers */}
      <View style={[StyleSheet.absoluteFill, { opacity: darkMode ? 0.32 : 1 }]}>
        <View style={[styles.nebulaLayer, { top: -50, right: -50, backgroundColor: colors.nebula[0], width: 500, height: 500 }]} />
        <View style={[styles.nebulaLayer, { bottom: -100, left: -100, backgroundColor: colors.nebula[1], width: 600, height: 600 }]} />
        <View style={[styles.nebulaLayer, { top: '25%', left: '10%', backgroundColor: colors.nebula[2], width: 300, height: 300 }]} />
        <View style={[styles.nebulaLayer, { bottom: '20%', right: '5%', backgroundColor: colors.nebula[3], width: 450, height: 450 }]} />
      </View>

      <BlurView
        intensity={darkMode ? 55 : 30}
        tint="dark"
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.nebulaOverlay ?? 'rgba(0,0,0,0.3)' }]}
      />

      {/* Dark mode veil — pulls everything deep without killing the glow entirely */}
      {darkMode && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.42)' }]} />
      )}

      {stars.map((star) => (
        <View
          key={star.id}
          style={{
            position: 'absolute',
            top: `${star.top}%`,
            left: `${star.left}%`,
            width: star.size,
            height: star.size,
            borderRadius: star.size / 2,
            backgroundColor: '#ffffff',
            opacity: star.opacity,
          }}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  nebulaLayer: {
    position: 'absolute',
    borderRadius: 200,
    opacity: 0.4,
  },
});

export default NebulaBackground;
