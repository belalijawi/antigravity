import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { View, StatusBar, LogBox, Platform, StyleSheet, Dimensions } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
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
import { Moon, BookHeart, Scroll, BookOpen, Infinity } from 'lucide-react-native';
import { TasbeehTab } from './components/TasbeehTab';
import { ThemeProvider, useTheme, ThemeColors } from './context/ThemeContext';
import { haptic } from './utils/haptic';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';

// Suppress known SVG warnings
LogBox.ignoreLogs([
  'Tried to register two views with the same name',
]);

const Tab = createBottomTabNavigator();

const NebulaBackground = () => {
  const { colors } = useTheme();
  // Generate stars only once
  const stars = React.useMemo(() => {
    return Array.from({ length: 120 }).map((_, i) => ({
      id: i,
      top: Math.random() * 100,
      left: Math.random() * 100,
      size: Math.random() * 1.5 + 1,
      opacity: Math.random() * 0.4 + 0.1,
    }));
  }, []);

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#000000', colors.background, '#000000']}
        style={StyleSheet.absoluteFill}
      />

      {/* Theme-aware Cosmic Layers */}
      <View style={[styles.nebulaLayer, { top: -50, right: -50, backgroundColor: colors.nebula[0], width: 500, height: 500 }]} />
      <View style={[styles.nebulaLayer, { bottom: -100, left: -100, backgroundColor: colors.nebula[1], width: 600, height: 600 }]} />
      <View style={[styles.nebulaLayer, { top: '25%', left: '10%', backgroundColor: colors.nebula[2], width: 300, height: 300 }]} />
      <View style={[styles.nebulaLayer, { bottom: '20%', right: '5%', backgroundColor: colors.nebula[3], width: 450, height: 450 }]} />

      {Platform.OS === 'ios' && (
        <BlurView intensity={30} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
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

  // Dynamic bottom placement that feels premium on all devices
  const BAR_BOTTOM = Math.max(insets.bottom, 12) + 4;
  const BAR_HEIGHT = 68;
  // Side padding: 24pt from screen edge, but capped for iPad
  const MAX_BAR_WIDTH = 500;
  const BAR_WIDTH = Math.min(width - 48, MAX_BAR_WIDTH);
  const BAR_SIDE = (width - BAR_WIDTH) / 2;

  return (
    <View style={{ flex: 1, backgroundColor: '#020617' }}>
      <StatusBar barStyle="light-content" />
      <NebulaBackground />

      <View style={{ flex: 1, backgroundColor: 'transparent' }}>
        <NavigationContainer theme={DynamicTheme}>
          <Tab.Navigator
            screenOptions={{
              headerShown: false,
              tabBarStyle: {
                position: 'absolute',
                bottom: BAR_BOTTOM,
                left: BAR_SIDE,
                right: BAR_SIDE,
                backgroundColor: 'rgba(15, 23, 42, 0.45)', // Slightly more transparent
                borderRadius: 34,
                height: BAR_HEIGHT,
                paddingBottom: insets.bottom > 0 ? 4 : 0,
                paddingTop: 8,
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.15)',
                elevation: 0,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.5,
                shadowRadius: 24,
              },
              tabBarBackground: () => (
                Platform.OS === 'ios'
                  ? <BlurView intensity={insets.bottom > 0 ? 85 : 95} tint="dark" style={{ ...StyleSheet.absoluteFillObject, borderRadius: 34, overflow: 'hidden' }} />
                  : <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: 34, overflow: 'hidden', backgroundColor: 'rgba(10, 16, 35, 0.97)' }} />
              ),
              tabBarActiveTintColor: colors.accent,
              tabBarInactiveTintColor: colors.secondaryText,
              tabBarShowLabel: true,
              tabBarLabelStyle: {
                fontSize: 9,
                fontWeight: '700',
                marginTop: 2,
                letterSpacing: 0.3,
              },
            }}
            screenListeners={{
              tabPress: () => {
                haptic.light();
              },
            }}
          >
            <Tab.Screen
              name="Home"
              component={HomeTab}
              options={{
                tabBarIcon: ({ color, focused }) => (
                  <View style={styles.iconWrapper}>
                    <Moon size={18} color={color} strokeWidth={focused ? 2.5 : 2} />
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
                    <BookHeart size={18} color={color} strokeWidth={focused ? 2.5 : 2} />
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
                    <Scroll size={18} color={color} strokeWidth={focused ? 2.5 : 2} />
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
                    <BookOpen size={18} color={color} strokeWidth={focused ? 2.5 : 2} />
                  </View>
                ),
              }}
            />
            <Tab.Screen
              name="Tasbeeh"
              component={TasbeehTab}
              options={{
                tabBarIcon: ({ color, focused }) => (
                  <View style={styles.iconWrapper}>
                    <Infinity size={18} color={color} strokeWidth={focused ? 2.5 : 2} />
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
    width: 50, // Reduced from 60
  },
});


export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppNavigator />
      </ThemeProvider>
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

  return <MainApp />;
}
