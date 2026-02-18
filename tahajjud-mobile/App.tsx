import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { View, StatusBar, LogBox, Platform, StyleSheet } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WelcomeScreen } from './components/WelcomeScreen';
import { HomeTab } from './components/HomeTab';
import { GuideTab } from './components/GuideTab';
import { DuasTab } from './components/DuasTab';
import { RamadanTab } from './components/RamadanTab';
import { QuranTab } from './components/QuranTab';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Moon, BookHeart, Scroll, BookOpen } from 'lucide-react-native';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { haptic } from './utils/haptic';
import { setupFirebase } from './setup-firebase';

// Suppress known SVG warnings
LogBox.ignoreLogs([
  'Tried to register two views with the same name',
]);

const Tab = createBottomTabNavigator();

const NebulaBackground = () => {
  // Generate stars only once
  const stars = React.useMemo(() => {
    return Array.from({ length: 120 }).map((_, i) => ({
      id: i,
      top: Math.random() * 100,
      left: Math.random() * 100,
      size: Math.random() * 1.5 + 1, // 1px to 2.5px
      opacity: Math.random() * 0.4 + 0.1, // 0.1 to 0.5 (More subtle)
    }));
  }, []);

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#000000', '#020617', '#000000']}
        style={StyleSheet.absoluteFill}
      />

      {/* Vibrant Cosmic Layers */}
      <View style={[styles.nebulaLayer, { top: -50, right: -50, backgroundColor: 'rgba(79, 70, 229, 0.25)', width: 500, height: 500 }]} />
      <View style={[styles.nebulaLayer, { bottom: -100, left: -100, backgroundColor: 'rgba(139, 92, 246, 0.2)', width: 600, height: 600 }]} />
      <View style={[styles.nebulaLayer, { top: '25%', left: '10%', backgroundColor: 'rgba(236, 72, 153, 0.1)', width: 300, height: 300 }]} />
      <View style={[styles.nebulaLayer, { bottom: '20%', right: '5%', backgroundColor: 'rgba(56, 189, 248, 0.15)', width: 450, height: 450 }]} />

      <BlurView intensity={30} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />

      {/* Subtle Starfield */}
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

const DynamicTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: 'transparent',
  },
};

function MainApp() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // Bar sits 16px above the safe area bottom edge
  const BAR_BOTTOM = Math.max(insets.bottom, 8) + 8;
  const BAR_HEIGHT = 62;
  // Horizontal gutter: safe area inset + 16px breathing room
  const BAR_SIDE = Math.max(insets.left, insets.right, 0) + 16;

  return (
    <View style={{ flex: 1, backgroundColor: '#020617' }}>
      <StatusBar barStyle="light-content" />
      <NebulaBackground />

      <NavigationContainer theme={DynamicTheme}>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              position: 'absolute',
              bottom: BAR_BOTTOM,
              left: BAR_SIDE,
              right: BAR_SIDE,
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              borderRadius: 28,
              height: BAR_HEIGHT,
              paddingBottom: 10,
              paddingTop: 8,
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.1)',
              elevation: 0,
              shadowColor: colors.shadow,
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.5,
              shadowRadius: 24,
            },
            tabBarBackground: () => (
              <BlurView intensity={95} tint="dark" style={{ ...StyleSheet.absoluteFillObject, borderRadius: 28, overflow: 'hidden' }} />
            ),
            tabBarActiveTintColor: colors.accent,
            tabBarInactiveTintColor: colors.secondaryText,
            tabBarShowLabel: true,
            tabBarLabelStyle: {
              fontSize: 8, // Reduced from 9
              fontWeight: '800',
              marginTop: 0,
              marginBottom: 0,
              letterSpacing: 0,
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
            name="Ramadan"
            component={RamadanTab}
            options={{
              tabBarIcon: ({ color, focused }) => (
                <View style={styles.iconWrapper}>
                  <Moon size={18} color={color} strokeWidth={focused ? 2.5 : 3} fill={focused ? color : 'transparent'} />
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
        </Tab.Navigator>
      </NavigationContainer>
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
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    // Setup Firebase config on first run
    setupFirebase();

    checkOnboarding();
  }, []);

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
      if (name) {
        await AsyncStorage.setItem('user-name', name);
      }
      setIsOnboarded(true);
    } catch (e) {
      console.error('Failed to save onboarding status', e);
    }
  };

  if (isOnboarded === null) {
    return (
      <SafeAreaProvider>
        <ThemeProvider>
          <View style={{ flex: 1, backgroundColor: '#020617', justifyContent: 'center', alignItems: 'center' }}>
            <StatusBar barStyle="light-content" />
          </View>
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }

  if (!isOnboarded) {
    return (
      <SafeAreaProvider>
        <ThemeProvider>
          <WelcomeScreen onComplete={handleOnboardingComplete} />
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <MainApp />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
