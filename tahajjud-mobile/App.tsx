import 'react-native-gesture-handler';
// Platform must be imported BEFORE Sentry.init — it's used in tracesSampleRate
// at module-evaluation time (line ~45). Importing after would leave Platform
// undefined when Sentry.init runs, causing a crash at startup.
import { Platform, View, Text, Pressable, StatusBar, LogBox, StyleSheet, Dimensions, Modal, DeviceEventEmitter, Animated as RNAnimated } from 'react-native';
import * as Sentry from '@sentry/react-native';
import React, { useEffect, useState } from 'react';
import Constants from 'expo-constants';

// Pull the app version + build number from Expo's constants so Sentry can
// group crashes by release. Without this, every crash gets bucketed under an
// "unknown release" and we can't tell whether a bug was fixed in build N+1.
//   - release format (industry standard): "com.bundleId@versionString+buildNumber"
//   - dist (App Store / iOS distribution channel): the raw build number
const APP_VERSION = (Constants.expoConfig?.version ?? '1.0.0');
const NATIVE_BUILD_NUMBER =
    (Constants.expoConfig?.ios?.buildNumber as string | undefined)
    ?? String(Constants.expoConfig?.android?.versionCode ?? '0');
const BUNDLE_ID = (Constants.expoConfig?.ios?.bundleIdentifier as string | undefined) ?? 'com.tahajjudplus.app';
const SENTRY_RELEASE = `${BUNDLE_ID}@${APP_VERSION}+${NATIVE_BUILD_NUMBER}`;
const IS_PRODUCTION = !__DEV__;

// Initialize Sentry as early as possible. Add your DSN to Constants.expoConfig.extra.SENTRY_DSN
// or set it directly here. With no DSN, Sentry stays dormant — no crashes if unset.
Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || '',
    // Tag every crash with the exact build that produced it. Lets us answer
    // "did this crash happen on the build we just shipped?" in one query.
    release: SENTRY_RELEASE,
    dist: NATIVE_BUILD_NUMBER,
    // 'production' for TestFlight + App Store builds, 'development' for
    // Metro/dev-client. Sentry can filter dashboards by environment.
    environment: IS_PRODUCTION ? 'production' : 'development',
    // Only sample dev errors at 100% — production gets a lighter rate to
    // stay under Sentry quota at scale (10% of transactions).
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30000,
    // Filter out spiritual content from breadcrumbs to respect user privacy
    beforeBreadcrumb: (breadcrumb) => {
        if (breadcrumb.category === 'console' && typeof breadcrumb.message === 'string') {
            const m = breadcrumb.message;
            if (m.includes('journal') || m.includes('dua') || m.includes('letter')) return null;
        }
        return breadcrumb;
    },
    // Android samples 1% in production vs iOS at 10% — Reanimated worklets +
    // Hermes on Android already pay a higher bridge cost; reducing Sentry
    // sample rate noticeably improves scroll perf on lower-end devices.
    tracesSampleRate: IS_PRODUCTION ? (Platform.OS === 'android' ? 0.01 : 0.1) : 1.0,
});
// (Platform, View, Text, etc. moved above Sentry.init — see top of file)
import { NavigationContainer, DarkTheme, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator, BottomTabBar } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from './utils/i18n';
import { WelcomeScreen } from './components/WelcomeScreen';
import { OnboardingFlow, hasCompletedOnboarding } from './components/OnboardingFlow';
import { HomeTab } from './components/HomeTab';
import { GuideTab } from './components/GuideTab';
import { DuasTab } from './components/DuasTab';
import { QuranTab } from './components/QuranTab';
import { NebulaBackground } from './components/NebulaBackground';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Moon, BookHeart, Scroll, BookOpen, CheckSquare } from 'lucide-react-native';
import { PrayersTab } from './components/PrayersTab';
import { ThemeProvider, useTheme, ThemeColors } from './context/ThemeContext';
import { PurchasesProvider, usePurchases } from './context/PurchasesContext';
import { QuranAudioProvider } from './context/QuranAudioContext';
import Paywall from './components/Paywall';
import { haptic } from './utils/haptic';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { QuranPreloadService } from './services/QuranPreloadService';
import { requestNotificationPermissions } from './utils/notifications';
import { refreshWeeklyDigest } from './utils/weeklyDigest';
import { initAnalytics, track } from './utils/analytics';
import { applyRtlIfNeeded } from './utils/rtl';
import { drainPendingPrayerLogs } from './utils/pendingIntents';
import { scheduleIslamicEventNotifications } from './utils/islamicEvents';
import { useFonts } from 'expo-font';

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

// Navigation ref so non-screen code (search, verse-of-the-day, etc.) can
// programmatically switch tabs.
const navigationRef = createNavigationContainerRef();
export function switchToTab(tabName: 'Home' | 'Guide' | 'Duas' | 'Quran' | 'Prayers') {
  if (navigationRef.isReady()) {
    navigationRef.navigate(tabName as never);
  }
}

/**
 * Route the user to the right tab based on what notification they tapped.
 * For Tahajjud reminders + partner wake-ups: Home tab (where partner card +
 * Tahajjud zone live). For prayer reminders: Home tab too (prayer countdown).
 * Falls back to Home for anything unrecognised.
 *
 * Defensive: navigationRef may not be ready yet at cold start (we run this
 * before NavigationContainer mounts). Retry on next tick if so.
 */
function routeFromNotification(data: any): void {
  if (!data) return;
  const type = data?.type;
  let target: 'Home' | 'Guide' | 'Duas' | 'Quran' | 'Prayers' = 'Home';
  if (type === 'partner_wakeup' || type === 'partner_prayed' || type === 'tahajjud_reminder') {
    target = 'Home';
  } else if (type === 'prayer_reminder' || type === 'fajr' || type === 'dhuhr' || type === 'asr' || type === 'maghrib' || type === 'isha') {
    target = 'Home';
  }
  const navigate = () => {
    if (!navigationRef.isReady()) return;
    navigationRef.navigate(target as never);
    // Deep-link streak notification straight to paywall
    if (type === 'streak_paywall') {
      // 1500ms gives HomeTab time to mount and register its listener even on
      // cold start with Hermes JIT warm-up (400ms was too short on some devices).
      setTimeout(() => {
        DeviceEventEmitter.emit('openPaywall');
      }, 1500);
    }
  };
  if (navigationRef.isReady()) {
    navigate();
  } else {
    setTimeout(navigate, 300);
  }
}

// Cross-tab "open this thing" plumbing.
//
// When the user taps a search result on Home, we switch tabs THEN need to
// tell the new tab what to open. If the target tab has never mounted, its
// DeviceEventEmitter listener doesn't exist yet — a naive emit gets dropped.
// To fix that, we stash the request in a module-scoped pending slot and
// emit; the target screen flushes the slot from its mount-effect even if
// it missed the live event.
type PendingOpen =
  | { kind: 'surah'; surahNumber: number; ayahNumber?: number }
  | { kind: 'dua'; id: string }
  | { kind: 'letter'; id: string }
  | { kind: 'journal'; id: string };

const pendingOpens: Record<string, PendingOpen | undefined> = {};

export function requestOpen(req: PendingOpen): void {
  pendingOpens[req.kind] = req;
  // Also fire the live event for already-mounted screens.
  DeviceEventEmitter.emit(`open:${req.kind}`, req);
}

export function consumePendingOpen<K extends PendingOpen['kind']>(
  kind: K
): Extract<PendingOpen, { kind: K }> | undefined {
  const v = pendingOpens[kind];
  if (v && v.kind === kind) {
    delete pendingOpens[kind];
    return v as Extract<PendingOpen, { kind: K }>;
  }
  return undefined;
}

// Custom tab bar button — replaces the default TouchableWithoutFeedback so
// that holding a finger on a tab (long press) still navigates to it.
// React Navigation fires onLongPress separately from onPress, meaning a slow
// press never triggers navigation with the default button.
function TabBarButton({ onPress, onLongPress, children, style, ...rest }: any) {
  return (
    <Pressable
      {...rest}
      style={style}
      onPress={onPress}
      onLongPress={onPress}   // treat long press exactly like a normal press
      delayLongPress={200}    // fire after 200ms hold, not the default 500ms
      android_ripple={null}
    >
      {children}
    </Pressable>
  );
}

// Animated tab icon — scales up + shows a glowing dot when its tab is the
// active one. Replaces the flat stroke-weight switch with something the eye
// actually catches.
function AnimatedTabIcon({
  Icon, color, focused, accent,
}: {
  Icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  color: string; focused: boolean; accent: string;
}) {
  const scale = React.useRef(new RNAnimated.Value(focused ? 1.15 : 1)).current;
  const dotOpacity = React.useRef(new RNAnimated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    RNAnimated.parallel([
      RNAnimated.spring(scale, {
        toValue: focused ? 1.18 : 1,
        useNativeDriver: true,
        damping: 12,
        stiffness: 180,
      }),
      RNAnimated.timing(dotOpacity, {
        toValue: focused ? 1 : 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused, scale, dotOpacity]);

  return (
    <View style={styles.iconWrapper}>
      <RNAnimated.View style={{ transform: [{ scale }] }}>
        <Icon size={20} color={color} strokeWidth={focused ? 2.5 : 2} />
      </RNAnimated.View>
      <RNAnimated.View
        style={{
          marginTop: 4,
          width: 4, height: 4, borderRadius: 2,
          backgroundColor: accent,
          opacity: dotOpacity,
          shadowColor: accent, shadowOpacity: 0.9, shadowRadius: 4,
        }}
      />
    </View>
  );
}

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
  // Android renders text with slightly more vertical padding than iOS AND the
  // rounded pill (borderRadius 34) clips the bottom of label text on edge tabs.
  // Taller container + slightly smaller radius keeps "Home/Guide/Duas/Quran/Prayers"
  // fully readable across all 5 tabs without changing the iOS look.
  const BAR_HEIGHT = Platform.OS === 'android' ? 76 : 64;
  const BAR_RADIUS = Platform.OS === 'android' ? 28 : 34;
  const BAR_MARGIN = 10;

  useEffect(() => {
    // ── Critical at launch: RTL must apply before first paint ──
    // Mirror UI for RTL locales (Arabic, Urdu, Persian, Hebrew)
    applyRtlIfNeeded().catch(() => {});

    // ── Deferred startup work ──
    // Everything below is non-critical background work. We defer it off the
    // initial render/Hermes-init window so the burst of async work + native
    // module access can't destabilise launch. Staggered so they don't all
    // fire at once.
    const t1 = setTimeout(() => {
      // Notification permission + analytics first (most important)
      requestNotificationPermissions();
      initAnalytics().then(() => track('app_launched')).catch(() => {});
      drainPendingPrayerLogs().catch(() => {});
    }, 1200);

    const t2 = setTimeout(() => {
      // Notification scheduling (clears + re-schedules — heavier work)
      refreshWeeklyDigest().catch(() => {});
      scheduleIslamicEventNotifications().catch(() => {});
      import('./utils/recommendPrayerMethod')
          .then(m => m.autoPickMethodIfNeeded())
          .catch(() => {});
    }, 2500);

    const t3 = setTimeout(() => {
      // Lowest-priority: feature nudge notification
      import('./utils/featureDiscovery')
          .then(m => m.maybeScheduleFeatureNudge())
          .catch(() => {});
    }, 4000);

    // Preload Quran data silently after the app has settled
    const timer = setTimeout(() => {
      QuranPreloadService.preloadInBackground();
    }, 5000);

    // Notification tap handler — route partner wake-ups + Tahajjud reminders
    // to the Home tab so the user sees the partner card / Tahajjud zone
    // immediately. Without this, taps just opened the app to whichever tab
    // was last active (often Quran or Settings) — disorienting for a 3am alert.
    let responseSub: { remove: () => void } | null = null;
    // Lazy import so this code doesn't pull notifications module into the
    // critical startup path on Android.
    import('expo-notifications').then(NotificationsModule => {
      // Handle the cold-start case: user tapped a notification while app was
      // closed. The response is available synchronously via getLastNotificationResponseAsync.
      NotificationsModule.getLastNotificationResponseAsync().then(response => {
        if (response) {
          routeFromNotification(response.notification.request.content.data);
        }
      }).catch(() => {});

      // Handle the warm-tap case: user tapped a notification while app was
      // backgrounded but still in memory.
      responseSub = NotificationsModule.addNotificationResponseReceivedListener(response => {
        routeFromNotification(response.notification.request.content.data);
      });
    }).catch(() => {});

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(timer);
      responseSub?.remove();
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#020617' }}>
      <StatusBar
        barStyle="light-content"
        // Android edge-to-edge: make the status bar transparent so the app's
        // background (and SafeAreaView padding) work together. Without this,
        // some Androids render a black strip behind the icons OR the app
        // content draws under opaque bar icons.
        backgroundColor="transparent"
        translucent
      />
      <NebulaBackground />

      <View style={{ flex: 1, backgroundColor: 'transparent' }}>
        <NavigationContainer ref={navigationRef} theme={DynamicTheme}>
          <Tab.Navigator
            tabBar={(props) => (
              <View
                pointerEvents="box-none"
                style={{
                position: 'absolute',
                bottom: BAR_BOTTOM,
                left: BAR_MARGIN,
                right: BAR_MARGIN,
                height: BAR_HEIGHT,
                borderRadius: BAR_RADIUS,
                overflow: 'hidden',
                shadowColor: colors.shadow,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.6,
                shadowRadius: 20,
                borderWidth: 1,
                borderColor: colors.accent + '35',
              }}>
                {/* Solid theme-tinted base. We dropped the live BlurView here —
                    it was composited every frame behind the always-visible bar
                    and hurt tab-switch responsiveness for no real visual gain
                    (it sat over a near-opaque base anyway). */}
                <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.background + 'F2' }]} />
                {/* Subtle accent glow layer */}
                <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.accent + '14' }]} />
                <BottomTabBar {...props} style={{
                  backgroundColor: 'transparent',
                  borderTopWidth: 0,
                  height: BAR_HEIGHT,
                  // Android needs more vertical room — text metrics + font ascender/descender
                  // are larger than iOS, so we pad more aggressively to keep labels clear of
                  // the pill's rounded edge.
                  paddingBottom: Platform.OS === 'android' ? 10 : (insets.bottom > 0 ? 6 : 2),
                  paddingTop: Platform.OS === 'android' ? 10 : 6,
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
                // Android renders dp smaller than iOS pt — bump font size to keep labels legible
                fontSize: Platform.OS === 'android' ? 11 : 9,
                fontWeight: '700',
                marginTop: Platform.OS === 'android' ? 2 : 1,
                letterSpacing: Platform.OS === 'android' ? 0 : 0.3,
                includeFontPadding: false,
              },
              tabBarItemStyle: {
                // Give every tab item a bit of vertical room so users don't
                // need to hit the icon dead-centre — prevents the "double tap"
                // issue where a slightly-off press isn't registered.
                paddingVertical: 4,
              },
              // Custom button so long-press still navigates (React Navigation's
              // default fires onLongPress instead of onPress on a slow tap,
              // so holding a finger too long silently does nothing).
              tabBarButton: (props) => <TabBarButton {...props} />,
            }}
            screenListeners={({ navigation, route }) => ({
              tabPress: () => {
                haptic.light();
                track('tab_viewed', { tab: route.name });
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
                tabBarLabel: t('tab.home'),
                tabBarIcon: ({ color, focused }) => (
                  <AnimatedTabIcon Icon={Moon} color={color} focused={focused} accent={colors.accent} />
                ),
              }}
            />
            <Tab.Screen
              name="Guide"
              component={GuideTab}
              options={{
                tabBarLabel: t('tab.guide'),
                tabBarIcon: ({ color, focused }) => (
                  <AnimatedTabIcon Icon={BookHeart} color={color} focused={focused} accent={colors.accent} />
                ),
              }}
            />
            <Tab.Screen
              name="Duas"
              component={DuasTab}
              options={{
                tabBarLabel: t('tab.duas'),
                tabBarIcon: ({ color, focused }) => (
                  <AnimatedTabIcon Icon={Scroll} color={color} focused={focused} accent={colors.accent} />
                ),
              }}
            />
            <Tab.Screen
              name="Quran"
              component={QuranTab}
              options={{
                tabBarLabel: t('tab.quran'),
                tabBarIcon: ({ color, focused }) => (
                  <AnimatedTabIcon Icon={BookOpen} color={color} focused={focused} accent={colors.accent} />
                ),
              }}
            />
            <Tab.Screen
              name="Prayers"
              component={PrayersTab}
              options={{
                tabBarLabel: t('tab.prayers'),
                tabBarIcon: ({ color, focused }) => (
                  <AnimatedTabIcon Icon={CheckSquare} color={color} focused={focused} accent={colors.accent} />
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
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
  },
});


function App() {
  // Locale changes don't propagate through plain function calls like `t('foo')`.
  // Bumping this key on `localeChanged` remounts the tree so every screen
  // re-reads strings from the new locale.
  const [localeNonce, setLocaleNonce] = useState(0);
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('localeChanged', () => {
      setLocaleNonce(n => n + 1);
    });
    return () => sub.remove();
  }, []);
  return (
    <SafeAreaProvider>
      <PurchasesProvider>
        <ThemeProvider>
          <QuranAudioProvider>
            <AppNavigator key={localeNonce} />
          </QuranAudioProvider>
        </ThemeProvider>
      </PurchasesProvider>
    </SafeAreaProvider>
  );
}

function AppNavigator() {
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null);
  // Tracks whether the user has completed the multi-step onboarding flow
  // (separate from the legacy name-entry "onboarded" flag).
  const [needsOnboardingFlow, setNeedsOnboardingFlow] = useState<boolean | null>(null);
  const { setUserName } = useTheme();

  // Load Mushaf-quality Arabic font once at startup. If it fails (e.g.
  // bundle missing), we silently fall back to system Arabic — never blocks UI.
  const [fontsLoaded] = useFonts({
    'AmiriQuran': require('./assets/fonts/AmiriQuran-Regular.ttf'),
  });

  useEffect(() => {
    checkOnboarding();
    setupAudio();
    // Set up the foreground notification handler immediately on cold start —
    // otherwise a push that arrives in the cold-start window can be silently
    // swallowed before the handler is configured.
    import('./utils/notifications')
      .then(m => m.ensureNotificationHandler())
      .catch(() => { /* ignore */ });
    // Refresh Expo push token on every cold start. Stale tokens are the #1
    // reason accountability-partner wake-up notifications silently fail.
    // We import lazily to avoid pulling Firebase into the startup bundle if
    // the user is offline / hasn't signed in yet.
    setTimeout(() => {
      import('./utils/accountabilityPartner')
        .then(m => m.saveExpoPushToken())
        .catch(() => { /* ignore — best-effort */ });
    }, 3000); // small delay so Firebase auth can settle
  }, []);

  const setupAudio = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        // DoNotMix → iOS automatically pauses Quran audio for incoming phone
        // calls, Siri, and other interruptions, then resumes after. Critical
        // for a prayer app — playing recitation through a phone call would be
        // disrespectful to both the call and the Quran.
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
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
      // Skip the new multi-step flow for users who were already onboarded
      // BEFORE this build shipped — they've already used the app and don't
      // need a feature walkthrough.
      const completed = await hasCompletedOnboarding();
      setNeedsOnboardingFlow(!completed && onboarded !== 'true');
    } catch (e) {
      setIsOnboarded(false);
      setNeedsOnboardingFlow(true);
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
        <StatusBar
        barStyle="light-content"
        // Android edge-to-edge: make the status bar transparent so the app's
        // background (and SafeAreaView padding) work together. Without this,
        // some Androids render a black strip behind the icons OR the app
        // content draws under opaque bar icons.
        backgroundColor="transparent"
        translucent
      />
      </View>
    );
  }

  if (!isOnboarded) {
    return <WelcomeScreen onComplete={handleOnboardingComplete} />;
  }

  // After name-entry, show the multi-step feature walkthrough — once.
  if (needsOnboardingFlow) {
    return <OnboardingFlow onComplete={() => setNeedsOnboardingFlow(false)} />;
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

// ─── Diagnostic Error Boundary ─────────────────────────────────────────────
// Catches render-time errors and shows them on screen (red text) instead of
// going blank-white. Critical for Android debugging when we can't reach logcat.
// In production this is invisible unless something crashes — totally safe.
class DiagnosticErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null; info: any }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null, info: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error, info: null };
  }
  componentDidCatch(error: Error, info: any) {
    this.setState({ error, info });
    Sentry.captureException(error, { extra: { componentStack: info?.componentStack } });
  }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: '#1a0000', padding: 24, paddingTop: 80 }}>
          <Text style={{ color: '#ff6b6b', fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>
            App crashed on launch
          </Text>
          <Text style={{ color: '#ffcccc', fontSize: 14, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: 12 }}>
            {String(this.state.error.name)}: {String(this.state.error.message)}
          </Text>
          <Text style={{ color: '#ff9999', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
            {String(this.state.error.stack || '').slice(0, 1500)}
          </Text>
          {this.state.info?.componentStack && (
            <Text style={{ color: '#ffaaaa', fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginTop: 12 }}>
              {String(this.state.info.componentStack).slice(0, 800)}
            </Text>
          )}
          <Text style={{ color: '#fff', fontSize: 12, marginTop: 16, opacity: 0.7 }}>
            Screenshot this and send to support.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

// Wrap App with Sentry for automatic crash + performance monitoring,
// plus the diagnostic boundary so any thrown error is visible on screen.
const WrappedApp = () => (
  <DiagnosticErrorBoundary>
    <App />
  </DiagnosticErrorBoundary>
);

export default Sentry.wrap(WrappedApp);
