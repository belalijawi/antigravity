import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { View, StatusBar, LogBox, Platform, StyleSheet, Dimensions, Modal, DeviceEventEmitter } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator, BottomTabBar } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WelcomeScreen } from './components/WelcomeScreen';
import { HomeTab } from './components/HomeTab';
import { GuideTab } from './components/GuideTab';
import { DuasTab } from './components/DuasTab';
import { QuranTab } from './components/QuranTab';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Moon, BookHeart, Scroll, BookOpen, CheckSquare } from 'lucide-react-native';
import { PrayersTab } from './components/PrayersTab';
import { ThemeProvider, useTheme, ThemeColors } from './context/ThemeContext';
import { PurchasesProvider, usePurchases } from './context/PurchasesContext';
import Paywall from './components/Paywall';
import { haptic } from './utils/haptic';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { QuranPreloadService } from './services/QuranPreloadService';

// Suppress known SVG warnings
LogBox.ignoreLogs([
  'Tried to register two views with the same name',
  'Error initializing RevenueCat',
  'Error checking premium status',
  'Invalid API key',
  'No singleton instance',
  'native store is not available',
]);

const Tab = createBottomTabNavigator();

const NebulaBackground = () => {
  const { colors, darkMode } = useTheme();
  // Generate stars only once per theme/darkMode change
  const starCount = colors.starCount ?? 120;
  const starMaxOpacity = colors.starMaxOpacity ?? 0.4;
  // In dark mode: noticeably fewer and dimmer stars
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

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={darkMode ? ['#000000', '#000000', '#000000'] : ['#000000', colors.background, '#000000']}
        style={StyleSheet.absoluteFill}
      />

      {/* Theme-aware Cosmic Layers */}
      <View style={[StyleSheet.absoluteFill, { opacity: darkMode ? 0.32 : 1 }]}>
        <View style={[styles.nebulaLayer, { top: -50, right: -50, backgroundColor: colors.nebula[0], width: 500, height: 500 }]} />
        <View style={[styles.nebulaLayer, { bottom: -100, left: -100, backgroundColor: colors.nebula[1], width: 600, height: 600 }]} />
        <View style={[styles.nebulaLayer, { top: '25%', left: '10%', backgroundColor: colors.nebula[2], width: 300, height: 300 }]} />
        <View style={[styles.nebulaLayer, { bottom: '20%', right: '5%', backgroundColor: colors.nebula[3], width: 450, height: 450 }]} />
      </View>

      {Platform.OS === 'ios' && (
        <BlurView intensity={darkMode ? 55 : 30} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: colors.nebulaOverlay ?? 'rgba(0,0,0,0.3)' }]} />
      )}

      {/* Dark mode veil — pulls everything deep without killing the glow entirely */}
      {darkMode && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.42)' }]} />
      )}

      {Platform.OS === 'ios' && stars.map((star) => (
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

const DynamicTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: 'transparent',
  },
};

function MainApp() {
  const { colors } = useTheme();
  const { width } = Dimensions.get('window');
  const insets = useSafeAreaInsets();

  const BAR_BOTTOM = Math.max(insets.bottom, 14) + 4;
  const BAR_HEIGHT = 64;
  const BAR_MARGIN = 10;

  useEffect(() => {
    // Preload Quran data silently after the app has settled
    const timer = setTimeout(() => {
      QuranPreloadService.preloadInBackground();
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#020617' }}>
      <StatusBar barStyle="light-content" />
      <NebulaBackground />

      <View style={{ flex: 1, backgroundColor: 'transparent' }}>
        <NavigationContainer theme={DynamicTheme}>
          <Tab.Navigator
            tabBar={(props) => (
              <View style={{
                position: 'absolute',
                bottom: BAR_BOTTOM,
                left: BAR_MARGIN,
                right: BAR_MARGIN,
                height: BAR_HEIGHT,
                borderRadius: 34,
                overflow: 'hidden',
                shadowColor: colors.shadow,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.6,
                shadowRadius: 20,
                borderWidth: 1,
                borderColor: colors.accent + '35',
              }}>
                {/* Theme-tinted dark base */}
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.background + 'EE' }]} />
                {/* Subtle accent glow layer */}
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.accent + '14' }]} />
                {Platform.OS === 'ios' && (
                  <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFillObject} />
                )}
                <BottomTabBar {...props} style={{
                  backgroundColor: 'transparent',
                  borderTopWidth: 0,
                  height: BAR_HEIGHT,
                  paddingBottom: insets.bottom > 0 ? 6 : 2,
                  paddingTop: 6,
                  elevation: 0,
                }} />
              </View>
            )}
            screenOptions={{
              headerShown: false,
              tabBarActiveTintColor: colors.accent,
              tabBarInactiveTintColor: colors.secondaryText,
              tabBarShowLabel: true,
              tabBarLabelStyle: {
                fontSize: 9,
                fontWeight: '700',
                marginTop: 1,
                letterSpacing: 0.3,
              },
              tabBarItemStyle: {
                paddingVertical: 0,
              },
            }}
            screenListeners={({ navigation, route }) => ({
              tabPress: () => {
                haptic.light();
                const state = navigation.getState();
                if (state.routes[state.index]?.name === route.name) {
                  DeviceEventEmitter.emit('scrollToTop', route.name);
                }
              },
            })}
          >
            <Tab.Screen
              name="Home"
              component={HomeTab}
              options={{
                tabBarIcon: ({ color, focused }) => (
                  <View style={styles.iconWrapper}>
                    <Moon size={20} color={color} strokeWidth={focused ? 2.5 : 2} />
                  </View>
                ),
              }}
            />
            <Tab.Screen
              name="Guide"
              component={GuideTab}
              options={{
                tabBarIcon: ({ color, focused }) => (
                  <View style={styles.iconWrapper}>
                    <BookHeart size={20} color={color} strokeWidth={focused ? 2.5 : 2} />
                  </View>
                ),
              }}
            />
            <Tab.Screen
              name="Duas"
              component={DuasTab}
              options={{
                tabBarIcon: ({ color, focused }) => (
                  <View style={styles.iconWrapper}>
                    <Scroll size={20} color={color} strokeWidth={focused ? 2.5 : 2} />
                  </View>
                ),
              }}
            />
            <Tab.Screen
              name="Quran"
              component={QuranTab}
              options={{
                tabBarIcon: ({ color, focused }) => (
                  <View style={styles.iconWrapper}>
                    <BookOpen size={20} color={color} strokeWidth={focused ? 2.5 : 2} />
                  </View>
                ),
              }}
            />
            <Tab.Screen
              name="Prayers"
              component={PrayersTab}
              options={{
                tabBarIcon: ({ color, focused }) => (
                  <View style={styles.iconWrapper}>
                    <CheckSquare size={20} color={color} strokeWidth={focused ? 2.5 : 2} />
                  </View>
                ),
              }}
            />
          </Tab.Navigator>
        </NavigationContainer>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nebulaLayer: {
    position: 'absolute',
    borderRadius: 200,
    opacity: 0.4,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
  },
});


export default function App() {
  return (
    <SafeAreaProvider>
      <PurchasesProvider>
        <ThemeProvider>
          <AppNavigator />
        </ThemeProvider>
      </PurchasesProvider>
    </SafeAreaProvider>
  );
}

function AppNavigator() {
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null);
  const { setUserName } = useTheme();

  useEffect(() => {
    checkOnboarding();
    setupAudio();
  }, []);

  const setupAudio = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
        playThroughEarpieceAndroid: false,
      });
    } catch (e) {
      console.error('Error setting global audio mode:', e);
    }
  };

  const checkOnboarding = async () => {
    try {
      const onboarded = await AsyncStorage.getItem('onboarded');
      setIsOnboarded(onboarded === 'true');
    } catch (e) {
      setIsOnboarded(false);
    }
  };

  const handleOnboardingComplete = async (name?: string) => {
    try {
      await AsyncStorage.setItem('onboarded', 'true');
      if (name && name.trim().length > 0) {
        // Save to AsyncStorage AND update the ThemeContext immediately
        await setUserName(name.trim());
      }
      setIsOnboarded(true);
    } catch (e) {
      console.error('Failed to save onboarding status', e);
    }
  };

  if (isOnboarded === null) {
    return (
      <View style={{ flex: 1, backgroundColor: '#020617', justifyContent: 'center', alignItems: 'center' }}>
        <StatusBar barStyle="light-content" />
      </View>
    );
  }

  if (!isOnboarded) {
    return <WelcomeScreen onComplete={handleOnboardingComplete} />;
  }

  return <MainAppWithPaywall />;
}

function MainAppWithPaywall() {
  const { paywallVisible, closePaywall } = usePurchases();
  return (
    <>
      <MainApp />
      <Modal visible={paywallVisible} animationType="slide" presentationStyle="fullScreen">
        <Paywall onClose={closePaywall} />
      </Modal>
    </>
  );
}
