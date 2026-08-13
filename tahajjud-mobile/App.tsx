import 'react-native-gesture-handler';
// Platform must be imported BEFORE Sentry.init — it's used in tracesSampleRate
// at module-evaluation time (line ~45). Importing after would leave Platform
// undefined when Sentry.init runs, causing a crash at startup.
import { Platform, View, Text, TouchableOpacity, StatusBar, LogBox, StyleSheet, Dimensions, Modal, DeviceEventEmitter, Animated as RNAnimated, AppState } from 'react-native';
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
import { AgeAssuranceGate } from './components/AgeAssuranceGate';
import { getAgeStatus } from './utils/ageGate';
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
import { initAnalytics, track, setSuperProperties, noteOnboardedAtLaunch } from './utils/analytics';
import { recordAppOpen } from './utils/neverConvertedOffer';
import { applyRtlIfNeeded } from './utils/rtl';
import { drainPendingPrayerLogs } from './utils/pendingIntents';
import { hydrateDhikrPending, drainPendingWidgetDhikrTaps } from './utils/dhikrLeaderboardTracker';
import { hydrateQuranPending } from './utils/quranReadingTracker';
import { hydrateTahajjudPending } from './utils/tahajjudLeaderboardSync';
import { scheduleIslamicEventNotifications, forceRescheduleIslamicEventNotifications } from './utils/islamicEvents';
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
 * Handles a notification tap/action. The "Log" action button (see
 * utils/notifications.ts's PRAYER_LOG category) logs the prayer in the
 * background instead of just routing to a tab — this is what makes the
 * one-tap flow actually one tap instead of "open app, find tracker, tap".
 */
function handleNotificationResponse(response: { actionIdentifier: string; notification: { request: { content: { data: any } } } }): void {
  const data = response.notification.request.content.data;
  if (response.actionIdentifier === 'LOG' && data?.prayer) {
    import('./utils/quickLogPrayer').then(m => m.quickLogPrayer(data.prayer, 'notification')).then(logged => {
      // Only buzz on an actual new log — re-tapping Log on a prayer already
      // logged (e.g. from the app) should stay silent, not falsely confirm.
      if (logged) haptic.success();
    }).catch(() => {});
    // Tahajjud is still worth landing on Home for (streak/gate state visible);
    // the daily prayers don't need to pull the user into the app at all.
    if (data.prayer !== 'tahajjud') return;
  }
  routeFromNotification(data);
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
  } else if (type === 'dua_milestone' || type === 'dua_reply' || type === 'dua_answered') {
    target = 'Duas';   // Dua Wall lives in the Duas tab
  } else if (type === 'testimony_milestone' || type === 'testimony_reply') {
    target = 'Guide';  // Testimonies live in the Guide tab
  } else if (type === 'reply_liked' || type === 'thread_reply') {
    // The liked/replied-to thread lives wherever its parent does.
    target = data?.parentType === 'testimony' ? 'Guide' : 'Duas';
  } else if (type === 'winback_1' || type === 'winback_2' || type === 'trial_winback') {
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
        DeviceEventEmitter.emit('openPaywall', { source: 'streak_notification' });
      }, 1500);
    }
    // Win-back tap: same deep-link, but tagged so the paywall knows to check
    // for an eligible win-back offer (Apple StoreKit 2 / RevenueCat).
    if (type === 'winback_1' || type === 'winback_2') {
      setTimeout(() => {
        DeviceEventEmitter.emit('openPaywall', { source: 'winback' });
      }, 1500);
    }
    // Trial-cancel win-back tap: separate source so the paywall only spends
    // a StoreKit round-trip checking the Promotional Offer for users who
    // actually arrived this way (see utils/trialWinback.ts).
    if (type === 'trial_winback') {
      setTimeout(() => {
        DeviceEventEmitter.emit('openPaywall', { source: 'trial_winback' });
      }, 1500);
    }
    // Reply notification tap: open the Dua Wall scrolled to the replied-to
    // dua with its thread expanded. Same 1500ms mount-grace as streak_paywall.
    // reply_liked and thread_reply can ALSO be for a testimony thread (shared
    // type across both surfaces) — testimonies have no scroll-to-story deep
    // link yet, so those are excluded here same as reply_liked already was.
    if ((type === 'dua_reply' || type === 'dua_answered'
        || ((type === 'reply_liked' || type === 'thread_reply') && data?.parentType !== 'testimony'))
        && data?.parentId) {
      // requestOpenWall queues the request until DuasTab's listener is
      // actually registered, so there's no need to guess a mount-grace delay
      // (previously a fixed 1500ms regardless of how fast the tab was ready).
      require('./components/DuasTab').requestOpenWall({ focusDuaId: String(data.parentId) });
    }
    // Rank-tier notification tap: open the Leaderboard directly rather than
    // just landing on Home and making them find the card themselves. Same
    // 1500ms cold-start grace as the paywall deep-links above — HomeTab is
    // always eagerly mounted (it's the first tab), but a slow Hermes JIT
    // warm-up on cold start is the same risk regardless of which tab it is.
    if (type === 'leaderboard_rank') {
      setTimeout(() => {
        DeviceEventEmitter.emit('leaderboard:open');
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

// Custom tab bar button — fires instantly on any touch (quick tap, slow tap,
// long press). The default TouchableWithoutFeedback has an internal press
// delay and drops the onPress if the finger lifts after the long-press
// threshold (~500ms), meaning slow presses silently do nothing.
// TouchableOpacity with delayPressIn={0} registers the touch the instant the
// finger lands, eliminating the need to double-tap.
function TabBarButton({ onPress, children, style, accessibilityRole, accessibilityState, accessibilityLabel, testID }: any) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      delayPressIn={0}
      onPress={onPress}
      onLongPress={onPress}        // slow press → navigate, not scroll-to-top
      delayLongPress={300}
      style={style}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {children}
    </TouchableOpacity>
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
      // Notification permission first (analytics init lives in AppNavigator —
      // it must run before onboarding completes, and MainApp only mounts after)
      requestNotificationPermissions();
      drainPendingPrayerLogs().catch(() => {});
      // Recover any dhikr/Quran leaderboard count stranded by a hard app
      // kill before its debounced or backgrounding flush ever ran — see
      // dhikrLeaderboardTracker.ts / quranReadingTracker.ts.
      hydrateDhikrPending().catch(() => {});
      hydrateQuranPending().catch(() => {});
      // Lock Screen dhikr widget taps (iOS 17+) accumulate natively while
      // the app isn't running — pull them in on cold start too, not just
      // the foreground listener below, so a tap made before the app was
      // ever (re)launched this session isn't left stranded.
      drainPendingWidgetDhikrTaps().catch(() => {});
      // Retry any Tahajjud leaderboard +1 that failed to sync last session
      // — see utils/tahajjudLeaderboardSync.ts.
      hydrateTahajjudPending().catch(() => {});
      // Re-personalize a pending trial-ending reminder with the user's
      // current nights-prayed count (no-op when no trial is running).
      import('./utils/trialReminder').then(m => m.refreshTrialReminder()).catch(() => {});
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
          handleNotificationResponse(response);
        }
      }).catch(() => {});

      // Handle the warm-tap case: user tapped a notification while app was
      // backgrounded but still in memory.
      responseSub = NotificationsModule.addNotificationResponseReceivedListener(response => {
        handleNotificationResponse(response);
      });
    }).catch(() => {});

    // Drain pending prayer logs (from a widget "Log" tap) whenever the app
    // comes back to the foreground, not just at cold start — otherwise a log
    // made while merely backgrounded wouldn't show up until a full relaunch.
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        drainPendingPrayerLogs().catch(() => {});
        // Same idea as the prayer-log widget drain above, for Lock Screen
        // dhikr taps — a tap made while merely backgrounded (not a full
        // relaunch) needs this same catch, or it sits stranded until the
        // next cold start.
        drainPendingWidgetDhikrTaps().catch(() => {});
        // Rank-milestone notifications for dhikr/Quran are normally fired by
        // checkRankMilestones right after the debounced flush below — but
        // that flush is forced out at the exact moment the app is
        // backgrounding, with no background-task extension requested, so
        // iOS can suspend the process mid-chain before the (multi-network-
        // round-trip) rank check ever reaches notifyNow(). In practice this
        // made the notification only reliably appear when the Leaderboard
        // screen was opened directly (its own trackRank call runs safely in
        // the foreground) — never from background activity, which is the
        // whole point of a notification. Re-running the check here, on the
        // NEXT safe foreground, catches whatever the backgrounding attempt
        // didn't finish. Idempotent: trackRank only notifies on an actual
        // tier change since the last stored rank, so a redundant check
        // (the backgrounding one DID complete) is a harmless no-op. Tahajjud
        // isn't included — its syncDelta always runs from an already-
        // foregrounded context (Tracker/quickLogPrayer/pendingIntents-on-
        // launch), so it never has this race.
        import('./utils/leaderboard').then(m => {
          m.Leaderboard.checkRankMilestones('dhikr').catch(() => {});
          m.Leaderboard.checkRankMilestones('quranAyahs').catch(() => {});
        }).catch(() => {});
      }
      // Dhikr/Quran leaderboard counters are debounced a few seconds so a
      // burst of taps doesn't turn into one Firestore write each — but that
      // means backgrounding the app mid-debounce would otherwise strand
      // whatever hasn't flushed yet. Force it out now instead of waiting for
      // a timer that may never get to fire.
      if (state === 'background' || state === 'inactive') {
        import('./utils/dhikrLeaderboardTracker').then(m => m.flushDhikrNow()).catch(() => {});
        import('./utils/quranReadingTracker').then(m => m.flushQuranNow()).catch(() => {});
      }
    });

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(timer);
      responseSub?.remove();
      appStateSub.remove();
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
                marginTop: Platform.OS === 'android' ? 0 : 1,
                letterSpacing: Platform.OS === 'android' ? 0 : 0.3,
                // No includeFontPadding:false here — it crops Android text to the
                // Latin em-box, which cuts the bottom off Arabic/Urdu tab labels.
                // The explicit lineHeight gives tall scripts room instead.
                lineHeight: Platform.OS === 'android' ? 17 : undefined,
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
      // Local notifications bake their title/body in as plain strings at
      // schedule time — there's no "render live in whatever language is
      // active when it fires" for these, unlike in-app UI. A notification
      // already queued in the old language stays in that language forever
      // unless something re-schedules it. Without this, switching language
      // (even switching back) leaves every already-pending, translated
      // notification stuck in whatever language was active when it was
      // queued — exactly the "got a notification in the old language after
      // switching back" report this fixes. Covers the notification types
      // that are safe to recompute on demand (weekly digest, streak-at-risk,
      // Islamic events); trial/win-back/feature-nudge notifications are
      // one-shot state machines and are deliberately left alone here rather
      // than risking a duplicate or an out-of-sequence resend.
      refreshWeeklyDigest().catch(() => {});
      forceRescheduleIslamicEventNotifications().catch(() => {});
      import('./utils/streakReminder').then(m => m.cancelStreakAtRisk()).catch(() => {});
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
  // Retroactive age check for users who installed before the age gate
  // existed — they skip needsOnboardingFlow entirely (already onboarded),
  // so without this they'd never be asked at all. See AgeAssuranceGate.tsx.
  const [needsAgeGate, setNeedsAgeGate] = useState(false);
  const { setUserName } = useTheme();

  // Load Mushaf-quality Arabic font once at startup. If it fails (e.g.
  // bundle missing), we silently fall back to system Arabic — never blocks UI.
  const [fontsLoaded] = useFonts({
    'AmiriQuran': require('./assets/fonts/AmiriQuran-Regular.ttf'),
  });

  useEffect(() => {
    checkOnboarding();
    setupAudio();
    // Analytics must initialize here — NOT in MainApp, which only mounts after
    // onboarding. By then a brand-new user already has the "onboarded" flag set
    // (app_first_open would misclassify them as an existing user) and every
    // onboarding_* event fired before init would be silently dropped.
    // Still deferred 1200ms to stay out of the cold-start critical window.
    const analyticsTimer = setTimeout(() => {
      initAnalytics().then(() => {
        // Slice every future event by these dimensions without having to
        // pass them on each call — critical for "did v1.8.0 convert better
        // than v1.7.0?" / "are Android users behaving differently?" queries.
        setSuperProperties({
          app_version: APP_VERSION,
          build_number: NATIVE_BUILD_NUMBER,
          platform: Platform.OS,
          environment: IS_PRODUCTION ? 'production' : 'development',
        });
        track('app_launched');
        // Depends on analytics' own FIRST_OPEN_KEY stamp above, so it's
        // chained here rather than run independently.
        recordAppOpen().catch(() => {});
      }).catch(() => {});
    }, 1200);
    // Set up the foreground notification handler immediately on cold start —
    // otherwise a push that arrives in the cold-start window can be silently
    // swallowed before the handler is configured.
    import('./utils/notifications')
      .then(m => m.ensureNotificationHandler())
      .catch(() => { /* ignore */ });
    // Refresh Expo push token on every cold start AND on auth-state change.
    // Stale / missing tokens are why Dua Wall + partner notifications fail
    // silently. The auth listener handles new sign-ins (including the initial
    // anonymous sign-in on first launch) so the token is always in Firestore
    // before the user can post a dua or receive an Ameen.
    // Save Expo push token whenever Firebase auth settles (sign-in, anonymous
    // auth on first launch, etc.) so the token is always in Firestore before
    // the user can post a dua or receive an Ameen/testimony notification.
    let authUnsub: (() => void) | undefined;
    import('./utils/firebase').then(({ getFirebaseAuth }) => {
      const auth = getFirebaseAuth();
      if (!auth) return;
      authUnsub = auth.onAuthStateChanged((user) => {
        if (!user) return; // signed out — nothing to save
        import('./utils/accountabilityPartner')
          .then(m => m.saveExpoPushToken())
          .catch(() => {});
        // Merge cloud-backed streaks/prayer history with local state —
        // restores everything after a reinstall or on a new device.
        import('./utils/prayerHistorySync')
          .then(m => m.restorePrayerHistory())
          .catch(() => {});
      });
    }).catch(() => {});
    // Also refresh 3s after cold start to catch any race with auth settling
    const tokenTimer = setTimeout(() => {
      import('./utils/accountabilityPartner')
        .then(m => m.saveExpoPushToken())
        .catch(() => { /* ignore — best-effort */ });
    }, 3000);
    return () => {
      authUnsub?.();
      clearTimeout(tokenTimer);
      clearTimeout(analyticsTimer);
    };
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
      // Two independent AsyncStorage reads (different keys, neither depends
      // on the other's result) — this gates the very first frame the app
      // can show (isOnboarded === null renders nothing but a blank splash
      // until it resolves, see below), so it sits squarely in the cold/warm
      // start critical path. Awaiting them sequentially paid for two native
      // bridge round-trips back to back for no reason; running them together
      // costs the same as the slower of the two instead of both combined.
      const [onboarded, completed] = await Promise.all([
        AsyncStorage.getItem('onboarded'),
        hasCompletedOnboarding(),
      ]);
      // Snapshot BEFORE onboarding can complete — app_first_open classifies
      // new-vs-existing users from this, not from a post-onboarding read.
      noteOnboardedAtLaunch(onboarded === 'true');
      setIsOnboarded(onboarded === 'true');
      // Skip the new multi-step flow for users who were already onboarded
      // BEFORE this build shipped — they've already used the app and don't
      // need a feature walkthrough.
      setNeedsOnboardingFlow(!completed && onboarded !== 'true');
      // Users onboarded before the age gate existed skip needsOnboardingFlow
      // entirely, so they'd never be asked at all without this — see
      // AgeAssuranceGate.tsx. New installs answer it inside OnboardingFlow
      // instead, so this only applies to the already-onboarded case.
      if (onboarded === 'true') {
        const ageStatus = await getAgeStatus();
        setNeedsAgeGate(ageStatus === null);
      }
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

  // Retroactive age check for pre-existing installs — see the comment on
  // needsAgeGate above.
  if (needsAgeGate) {
    return <AgeAssuranceGate onComplete={() => setNeedsAgeGate(false)} />;
  }

  return <MainAppWithPaywall />;
}

function MainAppWithPaywall() {
  const { paywallVisible, closePaywall, paywallSource, paywallFeatureId } = usePurchases();
  return (
    <>
      <MainApp />
      <Modal visible={paywallVisible} animationType="slide" presentationStyle="fullScreen">
        <Paywall onClose={closePaywall} source={paywallSource} featureId={paywallFeatureId} />
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
