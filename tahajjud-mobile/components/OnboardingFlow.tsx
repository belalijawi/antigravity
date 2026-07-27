/**
 * Multi-step onboarding shown ONCE on first launch. Steps:
 *   1. What is Tahajjud
 *   2. Your Nightly Gate
 *   3. Sign up / sign in  ← new
 *   4. Location permission
 *   5. Notification permission
 *   6. Paywall
 */
import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Moon, MapPin, Bell, BookHeart, ChevronRight, Check, UserCircle, Globe, Shield } from 'lucide-react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { SlideInRight, SlideOutLeft } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { haptic } from '../utils/haptic';
import { track } from '../utils/analytics';
import { t } from '../utils/i18n';
import { scheduleMorningAfter } from '../utils/notifications';
import { getPrayerTimes } from '../lib/api';
import Paywall from './Paywall';
import { GoogleAuthProvider, OAuthProvider } from 'firebase/auth';
import { getFirebaseAuth, upgradeAnonymousAccount } from '../utils/firebase';
import { friendlyAuthErrorMessage } from '../utils/authErrors';

// Safe requires for native modules not available in Expo Go
let AppleAuthentication: typeof import('expo-apple-authentication') | null = null;
let GoogleSignin: any = null;
let statusCodes: any = {};
try { AppleAuthentication = require('expo-apple-authentication'); } catch (_) {}
try {
    const gs = require('@react-native-google-signin/google-signin');
    GoogleSignin = gs.GoogleSignin;
    statusCodes = gs.statusCodes;
} catch (_) {}

const STORAGE_KEY = 'onboarding_complete_v1';

type DailyPrayer = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
const DAILY_PRAYERS: DailyPrayer[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

interface Slide {
    icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
    /** i18n keys — resolved with t() at render time so the user's locale applies. */
    title: string;
    body: string;
    cta?: string;
    skip?: string;
    action?: 'location' | 'notifications' | 'premium' | 'auth' | 'first_night' | null;
}

const SLIDES: Slide[] = [
    {
        icon: Moon,
        title: 'onboard.whatIs.title',
        body: 'onboard.whatIs.body',
        cta: 'btn.continue',
    },
    {
        icon: BookHeart,
        title: 'onboard.gate.title',
        body: 'onboard.gate.body',
        cta: 'onboard.gate.cta',
    },
    {
        icon: UserCircle,
        title: 'onboard.auth.title',
        body: 'onboard.auth.body',
        action: 'auth',
        skip: 'onboard.auth.skip',
    },
    {
        icon: MapPin,
        title: 'onboard.location.title',
        body: 'onboard.location.body',
        cta: 'onboard.location.cta',
        skip: 'onboard.notNow',
        action: 'location',
    },
    {
        icon: Bell,
        title: 'onboard.notif.title',
        body: 'onboard.notif.body',
        cta: 'onboard.notif.cta',
        skip: 'onboard.notNow',
        action: 'notifications',
    },
    {
        // Renders the full Paywall component — title/body never shown.
        icon: Moon,
        title: 'onboard.premium.title',
        body: '',
        action: 'premium',
    },
    // Activation slide — first-day prayer-loggers retain at 2× everyone else,
    // so onboarding ends with the alarm armed and (optionally) night one logged
    // instead of dropping the user onto an empty Home screen.
    {
        icon: Moon,
        title: 'onboard.firstNightTitle',
        body: 'onboard.firstNightBody',
        cta: 'onboard.firstNightCta',
        action: 'first_night',
    },
];

interface Props {
    onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: Props) {
    const { colors } = useTheme();
    const [step, setStep] = useState(0);
    const [signingIn, setSigningIn] = useState(false);
    const [appleAvailable, setAppleAvailable] = useState(false);
    const [firstPrayerLogged, setFirstPrayerLogged] = useState(false);
    // Which prayer the one-tap log button offers. Defaults to Isha (the
    // night framing this app is built around); once the user reaches the
    // final slide we try to swap in whichever prayer most recently passed
    // at their location, so a daytime onboarding isn't asked to confirm a
    // prayer that hasn't happened yet.
    const [recentPrayer, setRecentPrayer] = useState<DailyPrayer>('isha');

    React.useEffect(() => {
        if (Platform.OS !== 'ios' || !AppleAuthentication) return;
        AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => {});
    }, []);

    const slide = SLIDES[step];
    const Icon = slide.icon;
    const isLast = step === SLIDES.length - 1;

    React.useEffect(() => {
        track('onboarding_step_viewed', { step, slide_title: SLIDES[step].title });
    }, [step]);

    // Resolve the most recently passed prayer for the final slide's one-tap
    // log. Every failure path (no permission, no fix, API down) just keeps
    // the Isha default.
    const mountedRef = React.useRef(true);
    React.useEffect(() => () => { mountedRef.current = false; }, []);
    const resolveRecentPrayer = React.useCallback(async () => {
        try {
            const { status } = await Location.getForegroundPermissionsAsync();
            if (status !== 'granted') return;
            const pos = await Location.getLastKnownPositionAsync({})
                ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest });
            if (!pos || !mountedRef.current) return;
            const stored = await AsyncStorage.getItem('prayer_calculation_method');
            const method = stored && !isNaN(parseInt(stored, 10)) ? parseInt(stored, 10) : 2;
            const times = await getPrayerTimes(pos.coords.latitude, pos.coords.longitude, new Date(), method);
            if (!mountedRef.current) return;
            const now = Date.now();
            // Latest prayer whose time has passed today. Before Fajr none
            // has — the night in progress still belongs to Isha.
            let latest: DailyPrayer = 'isha';
            for (const p of DAILY_PRAYERS) {
                if (times[p].getTime() <= now) latest = p;
            }
            setRecentPrayer(latest);
        } catch { /* keep the Isha default */ }
    }, []);

    // Kick off at mount (permission may already be granted on a reinstall)
    // and refresh on the final slide (cache hit → instant). Waiting for the
    // final slide to START the lookup made the button visibly flip from
    // "Isha" to the real prayer; resolving slides earlier hides the swap.
    React.useEffect(() => { resolveRecentPrayer(); }, [resolveRecentPrayer]);
    React.useEffect(() => {
        if (slide.action === 'first_night') resolveRecentPrayer();
    }, [slide.action, resolveRecentPrayer]);

    const finish = async () => {
        try { await AsyncStorage.setItem(STORAGE_KEY, 'true'); } catch {}
        haptic.success();
        track('onboarding_completed');
        onComplete();
    };

    const next = () => {
        haptic.light();
        if (isLast) { finish(); return; }
        setStep(s => s + 1);
    };

    const handleAction = async () => {
        if (slide.action === 'location') {
            try {
                const res = await Location.requestForegroundPermissionsAsync();
                track('onboarding_permission_result', { permission: 'location', granted: res.status === 'granted' });
                // Location just became available — resolve the final slide's
                // "I prayed X" button now, in the background, so the answer
                // is ready before that slide ever renders.
                if (res.status === 'granted') resolveRecentPrayer();
            } catch {}
        } else if (slide.action === 'notifications') {
            try {
                const res = await Notifications.requestPermissionsAsync({
                    ios: { allowAlert: true, allowBadge: true, allowSound: true },
                });
                track('onboarding_permission_result', { permission: 'notifications', granted: res.status === 'granted' });
                if (res.status === 'granted') {
                    import('../utils/accountabilityPartner')
                        .then(m => m.saveExpoPushToken())
                        .catch(() => {});
                }
            } catch {}
        } else if (slide.action === 'first_night') {
            // Arm the Tahajjud alarm — NightCalculator reads this flag on Home
            // mount and schedules tonight's wake-up notification.
            try { await AsyncStorage.setItem('tahajjud_notification_enabled', 'true'); } catch {}
            scheduleMorningAfter(firstPrayerLogged).catch(() => {});
        }
        next();
    };

    // One-tap first prayer log — writes directly into the Tracker's store so
    // the user exits onboarding already invested (a streak has begun).
    const logFirstPrayer = async () => {
        if (firstPrayerLogged) return;
        try {
            const raw = await AsyncStorage.getItem('prayer-tracker-v2');
            const history = raw ? JSON.parse(raw) : {};
            if (!Array.isArray(history[recentPrayer])) history[recentPrayer] = [];
            history[recentPrayer].push(new Date().toISOString());
            for (const k of [...DAILY_PRAYERS, 'tahajjud']) {
                if (!Array.isArray(history[k])) history[k] = [];
            }
            await AsyncStorage.setItem('prayer-tracker-v2', JSON.stringify(history));
            track('prayer_logged', { prayer: recentPrayer, source: 'onboarding' });
            setFirstPrayerLogged(true);
            haptic.success();
        } catch { /* never block onboarding */ }
    };

    const handleGoogleSignIn = async () => {
        if (!GoogleSignin) {
            Alert.alert('Not Available', 'Google Sign-In requires a production build.');
            return;
        }
        setSigningIn(true);
        try {
            GoogleSignin.configure({
                iosClientId: '434827238021-l54qkp6ts99g1vsf5ha314tfj056sk50.apps.googleusercontent.com',
                webClientId: '434827238021-ntc25erm80s4nhkkbj2bv7g18v80l48h.apps.googleusercontent.com',
                scopes: ['profile', 'email'],
            });
            if (Platform.OS === 'android') {
                try { await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true }); }
                catch { setSigningIn(false); return; }
            }
            const signInResult = await GoogleSignin.signIn();
            const idToken = signInResult.data?.idToken;
            if (!idToken) throw new Error('No ID token');
            const auth = getFirebaseAuth();
            if (!auth) throw new Error('Firebase not initialised');
            const credential = GoogleAuthProvider.credential(idToken);
            await upgradeAnonymousAccount(credential);
            track('onboarding_auth_succeeded', { provider: 'google' });
            setStep(s => s + 1);
            haptic.success();
        } catch (error: any) {
            if (error.code !== statusCodes.SIGN_IN_CANCELLED) {
                Alert.alert(t('onboard.signInFailed'), friendlyAuthErrorMessage(error, t('onboard.signInFailedGoogle')));
            }
        } finally {
            setSigningIn(false);
        }
    };

    const handleAppleSignIn = async () => {
        if (!AppleAuthentication || !appleAvailable) {
            Alert.alert('Not Available', 'Apple Sign-In is not available on this device.');
            return;
        }
        setSigningIn(true);
        try {
            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
            });
            const auth = getFirebaseAuth();
            if (!auth) throw new Error('Firebase not initialised');
            if (!credential.identityToken) throw new Error('No identity token from Apple');
            const provider = new OAuthProvider('apple.com');
            const firebaseCredential = provider.credential({ idToken: credential.identityToken });
            await upgradeAnonymousAccount(firebaseCredential);
            track('onboarding_auth_succeeded', { provider: 'apple' });
            setStep(s => s + 1);
            haptic.success();
        } catch (error: any) {
            if (error.code !== 'ERR_REQUEST_CANCELED') {
                Alert.alert(t('onboard.signInFailed'), friendlyAuthErrorMessage(error, t('onboard.signInFailedApple')));
            }
        } finally {
            setSigningIn(false);
        }
    };

    // Premium step — full Paywall component
    if (slide.action === 'premium') {
        return <Paywall onClose={next} source="onboarding" />;
    }

    return (
        <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
            <LinearGradient colors={['#040714', '#07091e', '#040714']} style={StyleSheet.absoluteFill} />

            {/* Progress dots */}
            <View style={styles.dots}>
                {SLIDES.map((_, i) => (
                    <View
                        key={i}
                        style={[
                            styles.dot,
                            i === step
                                ? { backgroundColor: colors.accent, width: 28 }
                                : i < step
                                    ? { backgroundColor: colors.accent + '55', width: 8 }
                                    : { backgroundColor: 'rgba(255,255,255,0.1)', width: 8 },
                        ]}
                    />
                ))}
            </View>

            <Animated.View
                key={step}
                entering={SlideInRight.duration(300)}
                exiting={SlideOutLeft.duration(200)}
                style={styles.content}
            >
                <View style={[styles.iconWrap, { backgroundColor: colors.accent + '15', borderColor: colors.accent + '33' }]}>
                    <Icon size={40} color={colors.accent} strokeWidth={1.5} />
                </View>
                <Text style={[styles.title, { color: colors.primaryText }]}>{t(slide.title)}</Text>
                <Text style={[styles.body, { color: colors.secondaryText }]}>{slide.body ? t(slide.body) : ''}</Text>
            </Animated.View>

            {/* Auth step — Apple + Google buttons */}
            {slide.action === 'auth' ? (
                <View style={styles.footer}>
                    {signingIn ? (
                        <ActivityIndicator color={colors.accent} style={{ marginVertical: 28 }} />
                    ) : (
                        <>
                            {appleAvailable && (
                                <TouchableOpacity
                                    style={[styles.socialBtn, { backgroundColor: '#fff' }]}
                                    onPress={handleAppleSignIn}
                                    activeOpacity={0.85}
                                >
                                    <Shield size={18} color="#000" strokeWidth={2} />
                                    <Text style={styles.socialBtnTextDark}>{t('onboard.signInApple')}</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={[styles.socialBtn, { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', marginTop: appleAvailable ? 10 : 0 }]}
                                onPress={handleGoogleSignIn}
                                activeOpacity={0.85}
                            >
                                <Globe size={18} color={colors.primaryText} strokeWidth={2} />
                                <Text style={[styles.socialBtnText, { color: colors.primaryText }]}>{t('onboard.signInGoogle')}</Text>
                            </TouchableOpacity>
                        </>
                    )}
                    <TouchableOpacity
                        onPress={() => { track('onboarding_auth_skipped'); next(); }}
                        style={styles.skip}
                        hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}
                    >
                        <Text style={[styles.skipText, { color: colors.secondaryText }]}>{t('onboard.auth.skip')}</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.footer}>
                    {slide.action === 'first_night' && (
                        <TouchableOpacity
                            style={[
                                styles.socialBtn,
                                firstPrayerLogged
                                    ? { backgroundColor: colors.accent + '22', borderWidth: 1, borderColor: colors.accent + '66' }
                                    : { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
                                { marginBottom: 12 },
                            ]}
                            onPress={logFirstPrayer}
                            activeOpacity={0.85}
                        >
                            <Check size={18} color={firstPrayerLogged ? colors.accent : colors.primaryText} strokeWidth={2.5} />
                            <Text style={[styles.socialBtnText, { color: firstPrayerLogged ? colors.accent : colors.primaryText }]}>
                                {firstPrayerLogged
                                    ? (recentPrayer === 'isha' ? t('onboard.ishaLogged') : t('onboard.dayOneLogged'))
                                    : (recentPrayer === 'isha' ? t('onboard.logIsha') : t('onboard.logPrayer', { prayer: t('prayer.' + recentPrayer) }))}
                            </Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        onPress={slide.action ? handleAction : next}
                        style={[styles.cta, { backgroundColor: colors.accent, shadowColor: colors.accent }]}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.ctaText}>{slide.cta ? t(slide.cta) : t('btn.continue')}</Text>
                        {isLast
                            ? <Check size={18} color="#0a1228" strokeWidth={3} />
                            : <ChevronRight size={18} color="#0a1228" strokeWidth={3} />
                        }
                    </TouchableOpacity>
                    {slide.skip ? (
                        <TouchableOpacity
                            onPress={() => { track('onboarding_permission_skipped', { permission: slide.action }); next(); }}
                            style={styles.skip}
                            hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}
                        >
                            <Text style={[styles.skipText, { color: colors.secondaryText }]}>{t(slide.skip)}</Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={{ height: 24 }} />
                    )}
                </View>
            )}
        </SafeAreaView>
    );
}

/** Has the user completed onboarding? */
export async function hasCompletedOnboarding(): Promise<boolean> {
    try { return (await AsyncStorage.getItem(STORAGE_KEY)) === 'true'; }
    catch { return true; }
}

const styles = StyleSheet.create({
    root: { flex: 1, alignItems: 'center' },
    dots: {
        flexDirection: 'row', gap: 8,
        marginTop: 16, marginBottom: 32,
        alignItems: 'center',
    },
    dot: { height: 6, borderRadius: 3 },
    content: {
        flex: 1, alignItems: 'center', justifyContent: 'center',
        paddingHorizontal: 32,
    },
    iconWrap: {
        width: 96, height: 96, borderRadius: 48, borderWidth: 1,
        alignItems: 'center', justifyContent: 'center', marginBottom: 32,
    },
    title: {
        fontSize: 28, fontWeight: '900',
        letterSpacing: -0.5, textAlign: 'center', marginBottom: 18,
    },
    body: {
        fontSize: 15, lineHeight: 24, fontWeight: '500',
        textAlign: 'center', maxWidth: 380,
    },
    footer: {
        width: '100%',
        paddingHorizontal: 24,
        paddingBottom: Platform.OS === 'ios' ? 12 : 24,
    },
    cta: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        paddingVertical: 16, borderRadius: 18,
        shadowOpacity: 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 8 },
        elevation: 8,
    },
    ctaText: { color: '#0a1228', fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
    socialBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 10, paddingVertical: 16, borderRadius: 18,
    },
    socialBtnText: { fontSize: 16, fontWeight: '700' },
    socialBtnTextDark: { fontSize: 16, fontWeight: '700', color: '#000' },
    skip: { alignItems: 'center', paddingVertical: 14, marginTop: 8 },
    skipText: { fontSize: 14, fontWeight: '600' },
});
