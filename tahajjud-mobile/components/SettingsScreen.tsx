import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Switch, Platform, Linking, Modal, ActivityIndicator, TextInput, DeviceEventEmitter } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, ChevronRight, User, Cloud, Shield, Bell, LogOut, Mail, Globe, Lock, MessageSquare, Palette, Moon, Trash2, Star, Mic, Check, BookOpen, FileText } from 'lucide-react-native';
import { RECITERS, getCurrentReciterId, setCurrentReciter, subscribeReciter } from '../utils/reciters';
import { SleepIntelligence } from '../services/SleepIntelligence';
import { methodForCountry, detectCountryFromGps, getDetectedCountry } from '../utils/recommendPrayerMethod';
import { LOCALES, getLocale, setLocale, t, type Locale } from '../utils/i18n';
import { track } from '../utils/analytics';

// ISO country code → short human-readable region label for the helper line.
// Just covers the common Muslim-majority countries plus a few of the bigger
// non-majority ones; falls back to the raw code for anything else.
const REGION_NAMES: Record<string, string> = {
    US: 'the US', CA: 'Canada', MX: 'Mexico',
    SA: 'Saudi Arabia', AE: 'the UAE', QA: 'Qatar', KW: 'Kuwait', BH: 'Bahrain', OM: 'Oman', YE: 'Yemen',
    PK: 'Pakistan', IN: 'India', BD: 'Bangladesh', AF: 'Afghanistan', LK: 'Sri Lanka', NP: 'Nepal',
    TR: 'Turkey', CY: 'Cyprus',
    GB: 'the UK', FR: 'France', DE: 'Germany', ES: 'Spain', IT: 'Italy', NL: 'the Netherlands',
    EG: 'Egypt', MA: 'Morocco', DZ: 'Algeria', TN: 'Tunisia', SD: 'Sudan',
    ID: 'Indonesia', MY: 'Malaysia', SG: 'Singapore', PH: 'the Philippines',
    AU: 'Australia', NZ: 'New Zealand',
    NG: 'Nigeria', SN: 'Senegal', ML: 'Mali',
    IR: 'Iran', IQ: 'Iraq', SY: 'Syria', LB: 'Lebanon', JO: 'Jordan', PS: 'Palestine',
    AZ: 'Azerbaijan', UZ: 'Uzbekistan', KZ: 'Kazakhstan',
};
function regionName(code: string | null): string {
    if (!code) return 'your area';
    return REGION_NAMES[code.toUpperCase()] ?? 'your area';
}
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { MosqueImportModal } from './MosqueImportModal';
import { MosqueEditModal } from './MosqueEditModal';
import { getMosqueTimetable, MosqueTimetable } from '../utils/mosqueTimetable';
import { localDateStr as localDate } from '../utils/localDate';
import { openAppStoreReview } from '../utils/weeklyReview';
import { GoogleAuthProvider, OAuthProvider } from 'firebase/auth';

// Native modules — not available in Expo Go, so we load them safely
let AppleAuthentication: typeof import('expo-apple-authentication') | null = null;
let GoogleSignin: any = null;
let statusCodes: any = {};
try { AppleAuthentication = require('expo-apple-authentication'); } catch (_) { }
try { const gs = require('@react-native-google-signin/google-signin'); GoogleSignin = gs.GoogleSignin; statusCodes = gs.statusCodes; } catch (_) { }
import { deleteCloudData } from '../utils/syncService';
import { getFirebaseAuth, resetToAnonymous, upgradeAnonymousAccount } from '../utils/firebase';
import { GlassBg as BlurView } from './GlassBg';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useTheme, ThemeType, PREMIUM_THEMES, THEME_LABELS } from '../context/ThemeContext';
import { usePurchases } from '../context/PurchasesContext';
import { PrivacyPolicy } from './PrivacyPolicy';
import { SourcesMethodology } from './SourcesMethodology';
import { WidgetPromo } from './WidgetPromo';
import { ModerationModal } from './ModerationModal';
import { isCurrentUserAdmin } from '../utils/admins';
import { APP_URLS, localizedUrl } from '../utils/urls';
import Paywall from './Paywall';
import { haptic } from '../utils/haptic';
import { CommunityProfileStore } from '../utils/communityProfile';
import { tabletContentStyle } from '../utils/layout';
import { friendlyAuthErrorMessage } from '../utils/authErrors';
import type { FeatureId } from '../utils/featureDiscovery';

interface SettingsScreenProps {
    onClose: () => void;
}
export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onClose }) => {
    const { theme, setTheme, colors, userName, setUserName, darkMode, setDarkMode, cardBg, cardBorder, blurIntensity } = useTheme();
    const { isPremium, trialWinbackEligible, neverConvertedOfferEligible } = usePurchases();
    const [isDeleting, setIsDeleting] = useState(false);
    const [localPaywallVisible, setLocalPaywallVisible] = useState(false);
    const [localPaywallSource, setLocalPaywallSource] = useState('settings');
    const [localPaywallFeatureId, setLocalPaywallFeatureId] = useState<FeatureId | undefined>(undefined);
    const openPaywall = (source: string = 'settings', featureId?: FeatureId) => {
        setLocalPaywallSource(source);
        setLocalPaywallFeatureId(featureId);
        setLocalPaywallVisible(true);
    };
    const insets = useSafeAreaInsets();
    const [isSyncEnabled, setIsSyncEnabled] = useState(false);
    const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [showPrivacy, setShowPrivacy] = useState(false);
    const [showSources, setShowSources] = useState(false);
    const [showModeration, setShowModeration] = useState(false);
    const [showWidgetGuide, setShowWidgetGuide] = useState(false);
    const [currentLocale, setCurrentLocale] = useState<Locale>(getLocale());
    // isAdmin must react to auth-state changes — calling once on render
    // returns false if Firebase hasn't restored the session yet (1–2 sec on
    // cold start), which permanently hides the admin section.
    const [isAdmin, setIsAdmin] = useState<boolean>(() => isCurrentUserAdmin());
    useEffect(() => {
        const auth = getFirebaseAuth();
        if (!auth) return;
        const unsub = auth.onAuthStateChanged(() => {
            setIsAdmin(isCurrentUserAdmin());
        });
        // Also recompute immediately in case the user is already signed in
        // but our initial read happened before mount finished resolving.
        setIsAdmin(isCurrentUserAdmin());
        return () => unsub();
    }, []);
    const [prayerMethod, setPrayerMethod] = useState<number>(2);
    // ISO country code (e.g. 'US', 'PK', 'TR') — used to surface a
    // "Recommended" badge on the calculation method most commonly used there.
    const [detectedCountry, setDetectedCountry] = useState<string | null>(null);
    const recommendedMethodId = methodForCountry(detectedCountry);
    useEffect(() => {
        // Try the cached country first (instant), then refresh from GPS in background.
        getDetectedCountry().then(c => { if (c) setDetectedCountry(c); });
        detectCountryFromGps().then(c => { if (c) setDetectedCountry(c); }).catch(() => {});
    }, []);
    const [reciterId, setReciterId] = useState<string>(getCurrentReciterId());

    useEffect(() => {
        const unsub = subscribeReciter(setReciterId);
        return () => unsub();
    }, []);

    const [sleepIntelEnabled, setSleepIntelEnabledState] = useState<boolean>(false);
    useEffect(() => {
        SleepIntelligence.getEnabled().then(setSleepIntelEnabledState).catch(() => {});
    }, []);
    const toggleSleepIntel = async () => {
        const next = !sleepIntelEnabled;

        // ALWAYS flip the toggle immediately — feature uses a 6.5h default
        // even without HealthKit, so it should never get "stuck" if the
        // permission flow hangs or errors.
        await SleepIntelligence.setEnabled(next);
        setSleepIntelEnabledState(next);

        if (next && SleepIntelligence.isHealthKitAvailable()) {
            // Fire HealthKit permission request in background. If it fails
            // or user denies, we just fall back to the 6.5h default — no
            // need to block the toggle UI on it.
            SleepIntelligence.requestHealthPermission()
                .then((granted) => {
                    if (!granted) {
                        Alert.alert(
                            t('settings.alertDefaultSleepTitle'),
                            t('settings.alertDefaultSleepBody')
                        );
                    }
                })
                .catch(() => { /* ignore — fall back to default */ });
        }
    };

    // Quick-jump nav: track each section's measured Y position, scroll on pill tap
    const scrollRef = useRef<ScrollView>(null);
    const sectionY = useRef<Record<string, number>>({}).current;
    const setSectionY = (key: string) => (e: any) => {
        sectionY[key] = e.nativeEvent.layout.y;
    };
    const jumpTo = (key: string) => {
        const y = sectionY[key];
        if (y !== undefined && scrollRef.current) {
            scrollRef.current.scrollTo({ y: Math.max(0, y - 12), animated: true });
        }
    };
    const [isSigningIn, setIsSigningIn] = useState(false);
    const [showNameModal, setShowNameModal] = useState(false);
    const [nameInput, setNameInput] = useState('');
    const [showMosqueImport, setShowMosqueImport] = useState(false);
    const [showMosqueEdit, setShowMosqueEdit] = useState(false);
    const [mosqueTimetable, setMosqueTimetable] = useState<MosqueTimetable | null>(null);
    const [allPrayersEnabled, setAllPrayersEnabled] = useState(false);
    const [prayerReminderOffset, setPrayerReminderOffset] = useState(0);
    const [showReminderModal, setShowReminderModal] = useState(false);

    const prayerMethods = [
        { id: 2,  name: 'ISNA',         sub: 'US, Canada, Mexico — most North American masjids' },
        { id: 3,  name: 'MWL',          sub: 'Muslim World League — global default' },
        { id: 4,  name: 'Umm al-Qura',  sub: 'Saudi Arabia, Yemen' },
        { id: 1,  name: 'Karachi',      sub: 'Pakistan, India, Bangladesh, South Asia' },
        { id: 0,  name: 'Jafari',       sub: 'Shia Ithna-Ashari — not tied to one country' },
        { id: 13, name: 'Diyanet',      sub: 'Turkey, Northern Cyprus' },
        { id: 15, name: 'Moonsighting', sub: 'UK, Ireland, Nordic — handles high-latitude summers' },
        { id: 12, name: 'UOIF',         sub: 'France' },
        { id: 5,  name: 'Egyptian',     sub: 'Egypt' },
        { id: 7,  name: 'Tehran',       sub: 'Iran' },
        { id: 8,  name: 'Gulf',         sub: 'Bahrain, Oman' },
        { id: 9,  name: 'Kuwait',       sub: 'Kuwait' },
        { id: 10, name: 'Qatar',        sub: 'Qatar' },
        { id: 16, name: 'Dubai',        sub: 'United Arab Emirates' },
        { id: 17, name: 'JAKIM',        sub: 'Malaysia' },
        { id: 20, name: 'Kemenag',      sub: 'Indonesia' },
        { id: 21, name: 'Morocco',      sub: 'Morocco' },
        { id: 19, name: 'Algeria',      sub: 'Algeria' },
        { id: 18, name: 'Tunisia',      sub: 'Tunisia' },
        { id: 23, name: 'Jordan',       sub: 'Jordan' },
        { id: 14, name: 'Russia',       sub: 'Russia' },
        { id: 11, name: 'Singapore',    sub: 'Singapore (MUIS)' },
        { id: 22, name: 'Portugal',     sub: 'Portugal' },
    ];

    // Recommended method first — otherwise its pill can sit off-screen at the
    // end of the horizontal scroller and the "Recommended" badge is never seen.
    // Stable sort keeps the familiar order for the rest.
    const orderedPrayerMethods = [...prayerMethods].sort((a, b) =>
        (b.id === recommendedMethodId ? 1 : 0) - (a.id === recommendedMethodId ? 1 : 0));

    useEffect(() => {
        loadSettings();

        // Synchronous setup — onAuthStateChanged is NOT async so we can
        // subscribe immediately and return the unsubscriber directly, avoiding
        // the async gap where the listener fires before we've stored the unsub.
        const authInstance = getFirebaseAuth();
        if (!authInstance) {
            checkUser();
            return;
        }
        const unsubscribe = authInstance.onAuthStateChanged((firebaseUser) => {
            // Firebase auto-signs everyone in anonymously on launch (see
            // utils/firebase.ts), so an anonymous user must NOT count as
            // "signed in" here — otherwise the real Google/Apple sign-in
            // buttons never render for anyone.
            if (firebaseUser && !firebaseUser.isAnonymous) {
                setUser({ id: firebaseUser.uid, email: firebaseUser.email });
                setIsSyncEnabled(true);
            } else {
                setUser(null);
                setIsSyncEnabled(false);
            }
        });
        return () => unsubscribe();
    }, []);

    const loadSettings = async () => {
        const biometricStatus = await AsyncStorage.getItem('biometric-lock-enabled');
        setIsBiometricEnabled(biometricStatus === 'true');
        const method = await AsyncStorage.getItem('prayer_calculation_method');
        if (method) setPrayerMethod(parseInt(method, 10));

        const allPrayers = await AsyncStorage.getItem('notification_all_prayers_enabled');
        setAllPrayersEnabled(allPrayers === 'true');
        const offset = await AsyncStorage.getItem('prayer_reminder_offset');
        let offsetMins = offset ? parseInt(offset, 10) : 0;
        // 10 and 20 were removed as options (now 0/5/15/30/45/60) — snap a
        // stored legacy value to the nearest remaining choice so the picker
        // doesn't render with nothing selected.
        if (offsetMins === 10 || offsetMins === 20) {
            offsetMins = 15;
            await AsyncStorage.setItem('prayer_reminder_offset', '15');
        }
        setPrayerReminderOffset(offsetMins);

        getMosqueTimetable().then(setMosqueTimetable).catch(() => {});
    };

    const updatePrayerMethod = async (id: number) => {
        haptic.light();
        setPrayerMethod(id);
        await AsyncStorage.setItem('prayer_calculation_method', id.toString());
        // Notify NightCalculator (and anyone else listening) so prayer times
        // recompute immediately with the new method — no need to navigate away.
        DeviceEventEmitter.emit('prayerMethodChanged', id);
        Alert.alert(t('settings.alertMethodUpdatedTitle'), t('settings.alertMethodUpdatedBody'));
    };

    const handleEditName = () => {
        haptic.medium();
        if (userName === 'Servant') {
            // No spiritual name set yet — check whether one was already given
            // on the Dua Wall, a comment, the Leaderboard, or the Partner
            // circle instead of showing a blank field regardless.
            setNameInput('');
            CommunityProfileStore.get().then(profile => {
                if (profile?.nickname) setNameInput(profile.nickname);
            });
        } else {
            setNameInput(userName);
        }
        setShowNameModal(true);
    };

    const checkUser = async () => {
        // Firebase auth state is handled by the listener in useEffect
        // This fallback is intentionally a no-op
    };

    // ─── Google Sign-In ──────────────────────────────────────────────
    const handleGoogleSignIn = async () => {
        haptic.medium();
        if (!GoogleSignin) {
            Alert.alert(t('settings.alertNotAvailableTitle'), t('settings.alertGoogleNotAvailableBody'));
            return;
        }
        setIsSigningIn(true);
        try {
            // Configure must be called before signIn. iosClientId is required on iOS/iPad.
            GoogleSignin.configure({
                iosClientId: '434827238021-l54qkp6ts99g1vsf5ha314tfj056sk50.apps.googleusercontent.com',
                webClientId: '434827238021-ntc25erm80s4nhkkbj2bv7g18v80l48h.apps.googleusercontent.com',
                scopes: ['profile', 'email'],
            });
            // Android: verify Google Play Services is installed + up-to-date BEFORE
            // signIn. Huawei/Xiaomi/other Chinese-market devices may lack it. Without
            // this check, signIn fails with a confusing generic error instead of
            // surfacing Google's "update Play Services" dialog.
            // iOS: hasPlayServices() crashes — never call it there.
            if (Platform.OS === 'android') {
                try {
                    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
                } catch (playErr: any) {
                    setIsSigningIn(false);
                    Alert.alert(
                        t('settings.alertPlayServicesTitle'),
                        t('settings.alertPlayServicesBody'),
                        [{ text: t('btn.ok') }]
                    );
                    console.log('Play Services check failed:', playErr?.message);
                    return;
                }
            }
            const signInResult = await GoogleSignin.signIn();
            const idToken = signInResult.data?.idToken;
            if (!idToken) throw new Error('No ID token from Google');

            const auth = getFirebaseAuth();
            if (!auth) throw new Error('Firebase not initialised');

            const credential = GoogleAuthProvider.credential(idToken);
            const result = await upgradeAnonymousAccount(credential);
            setUser(result.user);
            setIsSyncEnabled(true);
            haptic.success();
            Alert.alert(t('settings.alertSignedInTitle'), t('settings.alertWelcome', { name: result.user.displayName || result.user.email || '' }));
        } catch (error: any) {
            if (error.code === statusCodes.SIGN_IN_CANCELLED) {
                // user cancelled — no alert needed
            } else if (error.code === statusCodes.IN_PROGRESS) {
                Alert.alert(t('settings.alertSignInProgressTitle'), t('settings.alertSignInProgressBody'));
            } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
                Alert.alert(t('settings.alertErrorTitle'), t('settings.alertPlayServicesUnavailable'));
            } else {
                console.error('Google sign-in error:', error);
                Alert.alert(t('settings.alertSignInFailedTitle'), friendlyAuthErrorMessage(error, t('settings.alertSignInFailedGoogleBody')));
            }
        } finally {
            setIsSigningIn(false);
        }
    };

    // ─── Apple Sign-In ───────────────────────────────────────────────
    const handleAppleSignIn = async () => {
        haptic.medium();
        if (!AppleAuthentication) {
            Alert.alert(t('settings.alertNotAvailableTitle'), t('settings.alertAppleNotAvailableBody'));
            return;
        }
        setIsSigningIn(true);
        try {
            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
            });

            const auth = getFirebaseAuth();
            if (!auth) throw new Error('Firebase not initialised');

            const provider = new OAuthProvider('apple.com');
            // rawNonce must only be provided if a nonce was sent to Apple during sign-in.
            // Since we don't use a nonce in signInAsync, omit rawNonce entirely.
            // Passing authorizationCode here (the old code) causes Firebase to reject it.
            const firebaseCredential = provider.credential({
                idToken: credential.identityToken!,
            });
            const result = await upgradeAnonymousAccount(firebaseCredential);

            // Apple only gives name on first sign-in — persist it
            const displayName = credential.fullName
                ? `${credential.fullName.givenName ?? ''} ${credential.fullName.familyName ?? ''}`.trim()
                : result.user.displayName;

            setUser({ ...result.user, displayName });
            setIsSyncEnabled(true);
            haptic.success();
            Alert.alert(t('settings.alertSignedInTitle'), t('settings.alertWelcome', { name: displayName || '' }));
        } catch (error: any) {
            if (error.code === 'ERR_REQUEST_CANCELED') {
                // user cancelled — no alert needed
            } else {
                console.error('Apple sign-in error:', error);
                Alert.alert(t('settings.alertSignInFailedTitle'), friendlyAuthErrorMessage(error, t('settings.alertSignInFailedAppleBody')));
            }
        } finally {
            setIsSigningIn(false);
        }
    };

    const handleSocialLogin = (provider: 'google' | 'apple') => {
        if (provider === 'google') handleGoogleSignIn();
        else handleAppleSignIn();
    };

    const toggleAllPrayers = async (value: boolean) => {
        haptic.light();
        setAllPrayersEnabled(value);
        await AsyncStorage.setItem('notification_all_prayers_enabled', value.toString());
    };

    const toggleBiometric = async (value: boolean) => {
        if (value) {
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            const isEnrolled = await LocalAuthentication.isEnrolledAsync();

            if (!hasHardware || !isEnrolled) {
                Alert.alert(t('settings.alertBiometricIncompatibleTitle'), t('settings.alertBiometricIncompatibleBody'));
                return;
            }

            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Authenticate to secure your letters',
                fallbackLabel: 'Use PIN',
            });

            if (result.success) {
                haptic.success();
                setIsBiometricEnabled(true);
                await AsyncStorage.setItem('biometric-lock-enabled', 'true');
            }
        } else {
            haptic.medium();
            setIsBiometricEnabled(false);
            await AsyncStorage.setItem('biometric-lock-enabled', 'false');
        }
    };

    const handleLogout = async () => {
        try {
            const auth = getFirebaseAuth();
            if (auth) {
                await auth.signOut();
            }
            // Immediately re-establish anonymous auth so the app remains in a
            // known signed-in state. Without this, any code that reads
            // currentUser.uid (Firestore writes, partner card, journal sync)
            // would crash on null. The user-facing experience: they signed out
            // of the Apple/Google account, cloud sync paused — but the app
            // keeps working anonymously.
            try { await resetToAnonymous(); } catch { /* offline — fine */ }
            setUser(null);
            setIsSyncEnabled(false);
            Alert.alert(t('settings.alertSignedOutTitle'), t('settings.alertSignedOutBody'));
        } catch (e) {
            console.error('Logout error:', e);
        }
    };

    const handleDeleteAccount = async () => {
        if (!user) return;
        haptic.medium();

        Alert.alert(
            t('settings.alertDeleteAccountTitle'),
            t('settings.alertDeleteAccountBody'),
            [
                { text: t('btn.cancel'), style: 'cancel' },
                {
                    text: t('settings.deleteForever'),
                    style: 'destructive',
                    onPress: async () => {
                        setIsDeleting(true);
                        try {
                            const authInst = getFirebaseAuth();
                            const currentUser = authInst?.currentUser;

                            if (!currentUser) throw new Error("No authenticated user");

                            // 1. SILENT Firestore Cleanup (Best effort)
                            try {
                                await deleteCloudData(user.id);
                            } catch (firestoreError) {
                                console.log('[Deletion] Firestore cleanup failed, proceeding anyway:', firestoreError);
                            }

                            // 2. CRITICAL Auth Record Deletion (Apple Compliance)
                            await currentUser.delete();

                            // 3. Guaranteed Local Wipe
                            const keys = await AsyncStorage.getAllKeys();
                            await AsyncStorage.multiRemove(keys);

                            // Reset app state
                            setUser(null);
                            setIsSyncEnabled(false);
                            await setUserName('Servant'); // Reset to default

                            Alert.alert(
                                t('settings.alertAccountDeletedTitle'),
                                t('settings.alertAccountDeletedBody')
                            );
                            onClose();
                        } catch (e: any) {
                            console.error('Deletion error details:', e);
                            const errorMessage = e.message?.toLowerCase() || "";
                            const errorCode = e.code;

                            if (errorCode === 'auth/requires-recent-login' ||
                                errorMessage.includes('requires-recent-login') ||
                                errorMessage.includes('recent login')) {

                                Alert.alert(
                                    t('settings.alertVerificationRequiredTitle'),
                                    t('settings.alertVerificationRequiredBody'),
                                    [
                                        { text: t('btn.cancel'), style: 'cancel' },
                                        {
                                            text: t('settings.signOutReverify'),
                                            onPress: async () => {
                                                const authInst = getFirebaseAuth();
                                                await authInst?.signOut();
                                                try { await resetToAnonymous(); } catch { /* offline */ }
                                                setUser(null);
                                                onClose();
                                            }
                                        }
                                    ]
                                );
                            } else {
                                // Guaranteed local wipe even on cloud failure
                                try {
                                    const keys = await AsyncStorage.getAllKeys();
                                    await AsyncStorage.multiRemove(keys);
                                    await setUserName('Servant');
                                } catch (wipeError) {
                                    console.error('Failed to wipe local data:', wipeError);
                                }

                                Alert.alert(
                                    t('settings.alertPartiallyDeletedTitle'),
                                    t('settings.alertPartiallyDeletedBody'),
                                    [
                                        {
                                            text: t('settings.emailSupport'),
                                            onPress: () => Linking.openURL(`${APP_URLS.email}?subject=Cloud%20Deletion%20Request`)
                                        },
                                        { text: t('btn.ok'), onPress: onClose }
                                    ]
                                );
                            }
                        } finally {
                            setIsDeleting(false);
                        }
                    }
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 12 }]}>
                <View>
                    <Text style={[styles.headerTitle, { color: colors.accent }]}>{t('settings.title')}</Text>
                    <Text style={[styles.headerSubtitle, { color: colors.secondaryText }]}>{t('settings.subtitle')}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {isDeleting && (
                        <ActivityIndicator color={colors.accent} size="small" style={{ marginRight: 15 }} />
                    )}
                    <TouchableOpacity
                        onPress={onClose}
                        style={styles.backButton}
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                        disabled={isDeleting}
                    >
                        <BlurView intensity={Math.round(20 * blurIntensity)} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />
                        <X color="#ffffff" size={24} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Quick-jump pills — scroll-to a section in one tap */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={settingsJumpStyles.row}
                style={settingsJumpStyles.bar}
            >
                {[
                    { key: 'appearance', label: 'Appearance' },
                    { key: 'prayer', label: 'Prayer' },
                    { key: 'reciter', label: 'Reciter' },
                    { key: 'sleep', label: 'Sleep' },
                    { key: 'profile', label: 'Profile' },
                    { key: 'sync', label: 'Sync' },
                    { key: 'notifications', label: 'Notifications' },
                    { key: 'guardian', label: 'Guardian' },
                    { key: 'support', label: 'Support' },
                ].map(p => (
                    <TouchableOpacity
                        key={p.key}
                        onPress={() => jumpTo(p.key)}
                        style={[settingsJumpStyles.pill, { borderColor: colors.accent + '33' }]}
                        activeOpacity={0.75}
                    >
                        <Text style={[settingsJumpStyles.pillText, { color: colors.accent }]}>{p.label}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <ScrollView
                ref={scrollRef}
                style={styles.content}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.scrollContent, tabletContentStyle()]}
            >
                {!isPremium && !trialWinbackEligible && !neverConvertedOfferEligible && (
                    <Animated.View entering={FadeInDown.delay(50).duration(600)}>
                        <TouchableOpacity
                            onPress={() => openPaywall('settings_banner')}
                            style={styles.upgradeBanner}
                            activeOpacity={0.85}
                        >
                            <LinearGradient
                                colors={[colors.accentGradient[0], colors.accentGradient[1]]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={StyleSheet.absoluteFill}
                            />
                            <Star size={20} color="#000" fill="#000" />
                            <Text style={styles.upgradeBannerText}>{t('settings.upgradeBanner')}</Text>
                            <ChevronRight size={18} color="#000" />
                        </TouchableOpacity>
                    </Animated.View>
                )}
                {neverConvertedOfferEligible && (
                    <Animated.View entering={FadeInDown.delay(55).duration(600)}>
                        <TouchableOpacity
                            onPress={() => {
                                haptic.light();
                                openPaywall('settings_never_converted');
                            }}
                            style={styles.upgradeBanner}
                            activeOpacity={0.85}
                        >
                            <LinearGradient
                                colors={[colors.accentGradient[0], colors.accentGradient[1]]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={StyleSheet.absoluteFill}
                            />
                            <Star size={20} color="#000" fill="#000" />
                            <Text style={styles.upgradeBannerText}>{t('settings.neverConvertedBanner')}</Text>
                            <ChevronRight size={18} color="#000" />
                        </TouchableOpacity>
                    </Animated.View>
                )}
                {trialWinbackEligible && (
                    <Animated.View entering={FadeInDown.delay(60).duration(600)}>
                        <TouchableOpacity
                            onPress={() => {
                                haptic.light();
                                openPaywall('settings_trial_winback');
                            }}
                            style={styles.upgradeBanner}
                            activeOpacity={0.85}
                        >
                            <LinearGradient
                                colors={[colors.accentGradient[0], colors.accentGradient[1]]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={StyleSheet.absoluteFill}
                            />
                            <Star size={20} color="#000" fill="#000" />
                            <Text style={styles.upgradeBannerText}>{t('settings.trialWinbackBanner')}</Text>
                            <ChevronRight size={18} color="#000" />
                        </TouchableOpacity>
                    </Animated.View>
                )}
                {isPremium && (
                    <Animated.View entering={FadeInDown.delay(75).duration(600)} style={styles.section}>
                        <Text style={[styles.sectionHeader, { color: colors.secondaryText }]}>{t('settings.subscription')}</Text>
                        <View style={styles.card}>
                            <BlurView intensity={Math.round(20 * blurIntensity)} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />
                            <TouchableOpacity
                                style={styles.cardItem}
                                onPress={() => {
                                    haptic.light();
                                    // iOS: deep link into the App Store subscription manager.
                                    // Android: open Google Play subscriptions page (web URL works
                                    // and Play Store app intercepts it automatically).
                                    const url = Platform.OS === 'ios'
                                        ? 'itms-apps://apps.apple.com/account/subscriptions'
                                        : 'https://play.google.com/store/account/subscriptions?package=com.tahajjudplus.app';
                                    Linking.openURL(url).catch(() => {});
                                }}
                            >
                                <View style={[styles.cardIconContainer, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '33' }]}>
                                    <Star size={20} color={colors.accent} strokeWidth={2.5} />
                                </View>
                                <View style={styles.cardTextContainer}>
                                    <Text style={[styles.cardLabel, { color: colors.primaryText }]}>{t('settings.manageSubscription')}</Text>
                                    <Text style={[styles.cardSub, { color: colors.secondaryText }]}>
                                        {Platform.OS === 'ios' ? t('settings.cancelUpdateIOS') : t('settings.cancelUpdateAndroid')}
                                    </Text>
                                </View>
                                <ChevronRight size={18} color="#475569" />
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                )}

                {/* ── A note from the developer ───────────────────────── */}
                <Animated.View entering={FadeInDown.delay(90).duration(700)} style={styles.coffeeCard}>
                    <TouchableOpacity
                        activeOpacity={0.88}
                        onPress={() => {
                            haptic.light();
                            Linking.openURL('https://buymeacoffee.com/tahajjudplus');
                        }}
                        style={styles.coffeeCardInner}
                    >
                        {/* subtle gradient wash */}
                        <LinearGradient
                            colors={['rgba(99,102,241,0.18)', 'rgba(139,92,246,0.10)', 'rgba(0,0,0,0)']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFill}
                        />
                        <View style={styles.coffeeCardHeader}>
                            <Text style={styles.coffeeCardFlag}>🇵🇸</Text>
                            <Text style={styles.coffeeCardHeading}>{t('settings.devNoteHeading')}</Text>
                        </View>
                        <Text style={styles.coffeeCardBody}>
                            {t('settings.devNoteBody')}
                        </Text>
                        <View style={styles.coffeeCta}>
                            <Text style={styles.coffeeCtaText}>{t('settings.devNoteCta')}</Text>
                            <ChevronRight size={15} color="#a78bfa" strokeWidth={2.5} />
                        </View>
                    </TouchableOpacity>
                </Animated.View>

                <Animated.View onLayout={setSectionY('appearance')} entering={FadeInDown.delay(100).duration(800)} style={styles.section}>
                    <Text style={[styles.sectionHeader, { color: colors.secondaryText }]}>{t('settings.appearance')}</Text>
                    <View style={styles.card}>
                        <BlurView intensity={Math.round(20 * blurIntensity)} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />
                        <View style={styles.cardItem}>
                            <View style={styles.cardIconContainer}>
                                <Palette size={20} color={colors.primaryText} strokeWidth={2.5} />
                            </View>
                            <View style={styles.cardTextContainer}>
                                <Text style={[styles.cardLabel, { color: colors.primaryText }]}>{t('settings.themeColor')}</Text>
                                <Text style={[styles.cardSub, { color: colors.secondaryText }]}>{t('settings.themeColorSub')}</Text>
                            </View>
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.themeSelector}>
                            {(['teal', 'silver', 'emerald', 'gold', 'rose', 'purple', 'cosmic'] as ThemeType[]).map((t) => {
                                const isPremiumTheme = PREMIUM_THEMES.includes(t);
                                const isLocked = isPremiumTheme && !isPremium;
                                const GRADIENTS: Record<ThemeType, [string, string]> = {
                                    silver: ['#f1f5f9', '#cbd5e1'],
                                    teal: ['#22d3ee', '#06b6d4'],
                                    emerald: ['#34d399', '#10b981'],
                                    gold: ['#fbbf24', '#f59e0b'],
                                    rose: ['#f472b6', '#ec4899'],
                                    purple: ['#a78bfa', '#8b5cf6'],
                                    cosmic: ['#38bdf8', '#818cf8'],
                                };
                                return (
                                    <TouchableOpacity
                                        key={t}
                                        onPress={() => {
                                            if (isLocked) {
                                                openPaywall('feature_gate:theme');
                                                return;
                                            }
                                            haptic.light();
                                            setTheme(t);
                                        }}
                                        style={[
                                            styles.themeOption,
                                            theme === t && styles.themeOptionActive,
                                            { borderColor: theme === t ? colors.accent : 'rgba(255, 255, 255, 0.1)' }
                                        ]}
                                    >
                                        <LinearGradient colors={GRADIENTS[t]} style={styles.themePreview} />
                                        {isLocked && (
                                            <View style={styles.themeLockOverlay}>
                                                <Lock size={12} color="#fff" />
                                            </View>
                                        )}
                                        {theme === t && !isLocked && (
                                            <View style={[styles.activeDot, { backgroundColor: '#ffffff' }]} />
                                        )}
                                        <Text style={[styles.themeLabel, { color: theme === t ? colors.primaryText : colors.secondaryText }]}>
                                            {THEME_LABELS[t].split(' ').pop()}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        {/* Dark Mode divider */}
                        <View style={[styles.cardDivider, { backgroundColor: 'rgba(255,255,255,0.07)' }]} />

                        {/* Dark Mode toggle */}
                        <TouchableOpacity
                            style={styles.cardItem}
                            onPress={() => { haptic.light(); setDarkMode(!darkMode); }}
                            activeOpacity={0.7}
                        >
                            <View style={styles.cardIconContainer}>
                                <Moon size={20} color={darkMode ? colors.accent : colors.primaryText} strokeWidth={2.5} />
                            </View>
                            <View style={styles.cardTextContainer}>
                                <Text style={[styles.cardLabel, { color: colors.primaryText }]}>{t('settings.darkMode')}</Text>
                                <Text style={[styles.cardSub, { color: colors.secondaryText }]}>{t('settings.darkModeSub')}</Text>
                            </View>
                            <Switch
                                value={darkMode}
                                onValueChange={(v) => { haptic.light(); setDarkMode(v); }}
                                trackColor={{ false: 'rgba(255,255,255,0.12)', true: colors.accent }}
                                thumbColor={'#ffffff'}
                                ios_backgroundColor="rgba(255,255,255,0.12)"
                            />
                        </TouchableOpacity>
                    </View>
                </Animated.View>

                <Animated.View onLayout={setSectionY('prayer')} entering={FadeInDown.delay(150).duration(800)} style={styles.section}>
                    <Text style={[styles.sectionHeader, { color: colors.secondaryText }]}>Prayer Times</Text>
                    <View style={styles.card}>
                        <BlurView intensity={Math.round(20 * blurIntensity)} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />
                        <View style={styles.cardItem}>
                            <View style={styles.cardIconContainer}>
                                <Moon size={20} color={colors.primaryText} strokeWidth={2.5} />
                            </View>
                            <View style={styles.cardTextContainer}>
                                <Text style={[styles.cardLabel, { color: colors.primaryText }]}>{t('settings.prayerMethod')}</Text>
                                <Text style={[styles.cardSub, { color: colors.secondaryText }]}>
                                    {prayerMethods.find(m => m.id === prayerMethod)?.name || 'ISNA'}
                                </Text>
                            </View>
                        </View>

                        {/* Helper line — tells the user how to choose without
                            forcing them to know the technical jargon. */}
                        <Text style={[styles.helperText, { color: colors.secondaryText }]}>
                            {detectedCountry
                                ? t('settings.prayerMethodHelperWithRegion', { region: regionName(detectedCountry) })
                                : t('settings.prayerMethodHelperNoRegion')}
                        </Text>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.methodSelector}>
                            {orderedPrayerMethods.map((m) => {
                                const isSelected = prayerMethod === m.id;
                                const isRecommended = recommendedMethodId === m.id;
                                return (
                                    <TouchableOpacity
                                        key={m.id}
                                        onPress={() => updatePrayerMethod(m.id)}
                                        style={[
                                            styles.methodPill,
                                            isSelected && { backgroundColor: colors.accent, borderColor: colors.accent },
                                            !isSelected && isRecommended && { borderColor: colors.accent + '88', borderWidth: 1.5 },
                                        ]}
                                    >
                                        {/* Always show the Recommended badge so users can
                                            identify it even after selecting it */}
                                        {isRecommended && (
                                            <View style={[
                                                styles.methodBadge,
                                                // When selected: dark badge so it shows on the accent bg
                                                { backgroundColor: isSelected ? 'rgba(0,0,0,0.25)' : colors.accent },
                                            ]}>
                                                <Text style={[
                                                    styles.methodBadgeText,
                                                    { color: isSelected ? '#0f172a' : '#fff' },
                                                ]}>★ RECOMMENDED</Text>
                                            </View>
                                        )}
                                        <Text style={[
                                            styles.methodName,
                                            { color: isSelected ? '#0f172a' : colors.primaryText }
                                        ]}>{m.name}</Text>
                                        <Text style={[
                                            styles.methodSub,
                                            { color: isSelected ? 'rgba(15, 23, 42, 0.7)' : colors.secondaryText }
                                        ]}>{m.sub}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        {/* Mosque timetable import — premium only */}
                        <View style={[styles.cardItem, { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', flexWrap: 'wrap', gap: 8 }]}>
                            <View style={[styles.cardTextContainer, { flex: 1 }]}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={[styles.cardLabel, { color: colors.primaryText }]}>
                                        {t('settings.mosqueTimetable')}
                                    </Text>
                                    {!isPremium && <Lock size={11} color="#f59e0b" />}
                                </View>
                                <Text style={[styles.cardSub, { color: (() => {
                                        if (!isPremium) return colors.secondaryText;
                                        if (!mosqueTimetable) return colors.secondaryText;
                                        return mosqueTimetable.times[localDate(new Date())] ? colors.secondaryText : '#f59e0b';
                                    })() }]}>
                                    {!isPremium
                                        ? t('settings.mosqueImportPremium')
                                        : mosqueTimetable
                                            ? mosqueTimetable.times[localDate(new Date())]
                                                ? t('settings.mosqueActiveToday', { name: mosqueTimetable.mosqueName ?? 'Imported' })
                                                : t('settings.mosqueExpired', { month: new Date().toLocaleString('en-GB', { month: 'long' }) })
                                            : t('settings.mosqueImportFree')}
                                </Text>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                {isPremium && mosqueTimetable && (
                                    <TouchableOpacity
                                        onPress={() => setShowMosqueEdit(true)}
                                        style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.05)' }}
                                    >
                                        <Text style={{ color: colors.primaryText, fontSize: 13, fontWeight: '700' }}>{t('settings.editBtn')}</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    onPress={() => isPremium ? setShowMosqueImport(true) : openPaywall('feature_gate:mosque_timetable', 'mosque_timetable')}
                                    style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: colors.accent + '55', backgroundColor: colors.accent + '15' }}
                                >
                                    <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700' }}>
                                        {isPremium ? (mosqueTimetable ? t('settings.mosqueUpdateBtn') : t('settings.mosqueImportBtn')) : t('settings.unlockBtn')}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Animated.View>

                {/* ── Quran Reciter ── */}
                <Animated.View onLayout={setSectionY('reciter')} entering={FadeInDown.delay(175).duration(800)} style={styles.section}>
                    <Text style={[styles.sectionHeader, { color: colors.secondaryText }]}>{t('settings.reciter')}</Text>
                    <View style={styles.card}>
                        <BlurView intensity={Math.round(20 * blurIntensity)} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />
                        <View style={styles.cardItem}>
                            <View style={styles.cardIconContainer}>
                                <Mic size={20} color={colors.primaryText} strokeWidth={2.5} />
                            </View>
                            <View style={styles.cardTextContainer}>
                                <Text style={[styles.cardLabel, { color: colors.primaryText }]}>{t('settings.audioReciter')}</Text>
                                <Text style={[styles.cardSub, { color: colors.secondaryText }]}>
                                    {RECITERS.find(r => r.id === reciterId)?.name ?? 'Default'}
                                </Text>
                            </View>
                        </View>

                        {RECITERS.map((r) => {
                            const selected = reciterId === r.id;
                            // Free users get Alafasy (the universal default).
                            // All other reciters are premium.
                            const isLocked = r.id !== 'ar.alafasy' && !isPremium;
                            return (
                                <TouchableOpacity
                                    key={r.id}
                                    onPress={() => isLocked ? openPaywall('feature_gate:reciter') : setCurrentReciter(r.id)}
                                    activeOpacity={0.75}
                                    style={[
                                        reciterStyles.row,
                                        { borderColor: selected ? colors.accent + '88' : 'rgba(255,255,255,0.06)',
                                          backgroundColor: selected ? colors.accent + '12' : 'transparent',
                                          opacity: isLocked ? 0.55 : 1 },
                                    ]}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={[reciterStyles.name, { color: colors.primaryText }]}>
                                            {r.name}
                                        </Text>
                                        <Text style={[reciterStyles.desc, { color: colors.secondaryText }]} numberOfLines={1}>
                                            {r.description}
                                        </Text>
                                    </View>
                                    {isLocked ? (
                                        <View style={[reciterStyles.checkWrap, { backgroundColor: '#f59e0b22' }]}>
                                            <Lock size={11} color="#f59e0b" />
                                        </View>
                                    ) : selected && (
                                        <View style={[reciterStyles.checkWrap, { backgroundColor: colors.accent }]}>
                                            <Check size={12} color="#0f172a" strokeWidth={3} />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </Animated.View>

                {/* ── Notifications ── */}
                <Animated.View onLayout={setSectionY('notifications')} entering={FadeInDown.delay(187).duration(800)} style={styles.section}>
                    <Text style={[styles.sectionHeader, { color: colors.secondaryText }]}>{t('settings.notifications')}</Text>
                    <View style={styles.card}>
                        <BlurView intensity={Math.round(20 * blurIntensity)} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />

                        <View style={[styles.cardItem, allPrayersEnabled && styles.cardItemBorder]}>
                            <View style={styles.cardIconContainer}>
                                <Bell size={20} color={colors.primaryText} strokeWidth={2.5} />
                            </View>
                            <View style={styles.cardTextContainer}>
                                <Text style={[styles.cardLabel, { color: colors.primaryText }]}>{t('settings.dailyPrayerTimes')}</Text>
                                <Text style={[styles.cardSub, { color: colors.secondaryText }]}>{t('settings.dailyPrayerTimesSub')}</Text>
                            </View>
                            <Switch
                                value={allPrayersEnabled}
                                onValueChange={toggleAllPrayers}
                                trackColor={{ false: '#0f172a', true: colors.accent }}
                                thumbColor={allPrayersEnabled ? '#ffffff' : '#94a3b8'}
                            />
                        </View>

                        {allPrayersEnabled && (
                            <TouchableOpacity
                                style={styles.cardItem}
                                onPress={() => setShowReminderModal(true)}
                            >
                                <View style={styles.cardIconContainer}>
                                    <Bell size={20} color={colors.secondaryText} strokeWidth={2} />
                                </View>
                                <View style={styles.cardTextContainer}>
                                    <Text style={[styles.cardLabel, { color: colors.primaryText }]}>{t('settings.remindBeforePrayer')}</Text>
                                    <Text style={[styles.cardSub, { color: colors.secondaryText }]}>
                                        {prayerReminderOffset === 0 ? t('settings.atPrayerTime') : prayerReminderOffset === 60 ? t('settings.oneHourBefore') : t('settings.minBefore', { n: prayerReminderOffset })}
                                    </Text>
                                </View>
                                <ChevronRight size={18} color="#475569" />
                            </TouchableOpacity>
                        )}
                    </View>
                </Animated.View>

                {/* ── Language picker (English / Arabic / Urdu) ── */}
                <Animated.View entering={FadeInDown.delay(190).duration(800)} style={styles.section}>
                    <Text style={[styles.sectionHeader, { color: colors.secondaryText }]}>{t('settings.language')}</Text>
                    <View style={styles.card}>
                        <BlurView intensity={Math.round(20 * blurIntensity)} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.methodSelector}>
                            {LOCALES.map(loc => {
                                const isSelected = currentLocale === loc.code;
                                return (
                                    <TouchableOpacity
                                        key={loc.code}
                                        onPress={async () => {
                                            haptic.light();
                                            track('locale_changed', { locale: loc.code, source: 'settings' });
                                            setCurrentLocale(loc.code);
                                            await setLocale(loc.code);
                                            Alert.alert(
                                                t('settings.languageUpdatedTitle'),
                                                t('settings.languageUpdatedBody'),
                                            );
                                        }}
                                        style={[
                                            styles.methodPill,
                                            isSelected && { backgroundColor: colors.accent, borderColor: colors.accent },
                                        ]}
                                    >
                                        <Text style={[styles.methodName, { color: isSelected ? '#0f172a' : colors.primaryText }]}>
                                            {loc.native}
                                        </Text>
                                        <Text style={[styles.methodSub, { color: isSelected ? 'rgba(15, 23, 42, 0.7)' : colors.secondaryText }]}>
                                            {loc.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </Animated.View>

                {/* ── Home Screen Widget ── */}
                <Animated.View entering={FadeInDown.delay(193).duration(800)} style={styles.section}>
                    <Text style={[styles.sectionHeader, { color: colors.secondaryText }]}>{t('settings.homeScreen')}</Text>
                    <View style={styles.card}>
                        <BlurView intensity={Math.round(20 * blurIntensity)} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />
                        <TouchableOpacity style={styles.cardItem} onPress={() => setShowWidgetGuide(true)}>
                            <View style={styles.cardIconContainer}>
                                <Star size={20} color="#f8fafc" strokeWidth={2.5} />
                            </View>
                            <View style={styles.cardTextContainer}>
                                <Text style={[styles.cardLabel, { color: colors.primaryText }]}>{t('settings.addWidget')}</Text>
                                <Text style={[styles.cardSub, { color: colors.secondaryText }]}>
                                    {t('settings.addWidgetSub')}
                                </Text>
                            </View>
                            <ChevronRight size={18} color="#475569" />
                        </TouchableOpacity>
                    </View>
                </Animated.View>

                <Animated.View onLayout={setSectionY('profile')} entering={FadeInDown.delay(200).duration(800)} style={styles.section}>
                    <Text style={[styles.sectionHeader, { color: colors.secondaryText }]}>{t('settings.profile')}</Text>
                    <View style={styles.card}>
                        <BlurView intensity={Math.round(20 * blurIntensity)} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />
                        <TouchableOpacity style={styles.cardItem} onPress={handleEditName}>
                            <View style={styles.cardIconContainer}>
                                <User size={20} color="#f8fafc" strokeWidth={2.5} />
                            </View>
                            <View style={styles.cardTextContainer}>
                                <Text style={styles.cardLabel}>{t('settings.spiritualName')}</Text>
                                <Text style={styles.cardValue}>{userName}</Text>
                            </View>
                            <ChevronRight size={18} color="#475569" />
                        </TouchableOpacity>
                    </View>
                </Animated.View>

                <Animated.View onLayout={setSectionY('sync')} entering={FadeInDown.delay(200).duration(800)} style={styles.section}>
                    <Text style={styles.sectionHeader}>{t('settings.syncCloud')}</Text>
                    {user ? (
                        <View style={styles.crystallineCard}>
                            <BlurView intensity={Math.round(20 * blurIntensity)} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />
                            <LinearGradient
                                colors={['rgba(34, 197, 94, 0.1)', 'transparent']}
                                style={StyleSheet.absoluteFill}
                            />
                            <Cloud size={24} color="#22c55e" />
                            <View style={styles.cardTextContainer}>
                                <Text style={styles.syncStatusTitle}>{t('settings.journeySynced')}</Text>
                                <Text style={styles.syncStatusSub}>{user.email}</Text>
                            </View>
                            <TouchableOpacity onPress={handleLogout} style={styles.iconAction}>
                                <LogOut size={18} color="#ef4444" />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.card}>
                            <BlurView intensity={Math.round(20 * blurIntensity)} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />
                            <View style={styles.authArea}>
                                <Text style={styles.authInfo}>
                                    {t('settings.authInfo')}
                                </Text>
                                <View style={styles.authRow}>
                                    <TouchableOpacity
                                        style={[styles.authPill, styles.googlePill, isSigningIn && { opacity: 0.6 }]}
                                        onPress={() => handleSocialLogin('google')}
                                        disabled={isSigningIn}
                                    >
                                        {isSigningIn ? <ActivityIndicator size="small" color="#0f172a" /> : <Globe size={18} color="#0f172a" />}
                                        <Text style={styles.googleText}>Google</Text>
                                    </TouchableOpacity>
                                    {/* Apple Sign-In is iOS-only — Android users see Google + Anonymous instead. */}
                                    {Platform.OS === 'ios' && (
                                        <TouchableOpacity
                                            style={[styles.authPill, styles.applePill, isSigningIn && { opacity: 0.6 }]}
                                            onPress={() => handleSocialLogin('apple')}
                                            disabled={isSigningIn}
                                        >
                                            {isSigningIn ? <ActivityIndicator size="small" color="#ffffff" /> : <Shield size={18} color="#ffffff" />}
                                            <Text style={styles.appleText}>Apple</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        </View>
                    )}
                </Animated.View>

                {/* ── Sleep Intelligence ── */}
                <Animated.View onLayout={setSectionY('sleep')} entering={FadeInDown.delay(300).duration(800)} style={styles.section}>
                    <Text style={[styles.sectionHeader, { color: colors.secondaryText }]}>{t('settings.sleepIntel')}</Text>
                    <View style={styles.card}>
                        <BlurView intensity={Math.round(20 * blurIntensity)} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />
                        <View style={styles.cardItem}>
                            <View style={styles.cardIconContainer}>
                                <Moon size={20} color="#f8fafc" strokeWidth={2.5} />
                            </View>
                            <View style={styles.cardTextContainer}>
                                <Text style={[styles.cardLabel, { color: colors.primaryText }]}>{t('settings.bedtimeSuggestions')}</Text>
                                <Text style={[styles.cardSub, { color: colors.secondaryText }]}>
                                    {sleepIntelEnabled
                                        ? (SleepIntelligence.isHealthKitAvailable() ? t('settings.usingAppleHealth') : t('settings.usingDefaultSleep'))
                                        : t('settings.bedtimeSuggestionsSub')}
                                </Text>
                            </View>
                            <Switch
                                value={sleepIntelEnabled}
                                onValueChange={toggleSleepIntel}
                                trackColor={{ false: '#0f172a', true: colors.accent }}
                                thumbColor="#f8fafc"
                            />
                        </View>
                    </View>
                </Animated.View>

                <Animated.View onLayout={setSectionY('guardian')} entering={FadeInDown.delay(300).duration(800)} style={styles.section}>
                    <Text style={styles.sectionHeader}>{t('settings.guardianSettings')}</Text>
                    <View style={styles.card}>
                        <BlurView intensity={Math.round(20 * blurIntensity)} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />
                        <View style={[styles.cardItem, styles.cardItemBorder]}>
                            <View style={styles.cardIconContainer}>
                                <Lock size={20} color="#f8fafc" strokeWidth={2.5} />
                            </View>
                            <View style={styles.cardTextContainer}>
                                <Text style={styles.cardLabel}>{t('settings.secureJournal')}</Text>
                                <Text style={styles.cardSub}>{t('settings.biometricPrivacy')}</Text>
                            </View>
                            <Switch
                                value={isBiometricEnabled}
                                onValueChange={toggleBiometric}
                                trackColor={{ false: '#0f172a', true: '#f8fafc' }}
                                thumbColor={isBiometricEnabled ? '#0f172a' : '#94a3b8'}
                            />
                        </View>
                        <TouchableOpacity
                            style={styles.cardItem}
                            onPress={() => setShowPrivacy(true)}
                            accessibilityRole="button"
                            accessibilityLabel="View Privacy Policy"
                        >
                            <View style={styles.cardIconContainer}>
                                <Shield size={20} color="#f8fafc" strokeWidth={2.5} />
                            </View>
                            <View style={styles.cardTextContainer}>
                                <Text style={styles.cardLabel}>{t('settings.privacyPolicy')}</Text>
                                <Text style={styles.cardSub}>{t('settings.privacySub')}</Text>
                            </View>
                            <ChevronRight size={18} color="#475569" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.cardItem}
                            onPress={() => setShowSources(true)}
                        >
                            <View style={styles.cardIconContainer}>
                                <BookOpen size={20} color="#f8fafc" strokeWidth={2.5} />
                            </View>
                            <View style={styles.cardTextContainer}>
                                <Text style={styles.cardLabel}>{t('settings.sourcesMethodology')}</Text>
                                <Text style={styles.cardSub}>{t('settings.sourcesSub')}</Text>
                            </View>
                            <ChevronRight size={18} color="#475569" />
                        </TouchableOpacity>

                        {isAdmin && (
                            <TouchableOpacity
                                style={styles.cardItem}
                                onPress={() => setShowModeration(true)}
                                accessibilityRole="button"
                                accessibilityLabel="Moderation"
                            >
                                <View style={[styles.cardIconContainer, { backgroundColor: colors.accent + '22' }]}>
                                    <Shield size={20} color={colors.accent} strokeWidth={2.5} />
                                </View>
                                <View style={styles.cardTextContainer}>
                                    <Text style={styles.cardLabel}>{t('settings.moderateCommunity')}</Text>
                                    <Text style={styles.cardSub}>{t('settings.moderateCommunitySub')}</Text>
                                </View>
                                <ChevronRight size={18} color="#475569" />
                            </TouchableOpacity>
                        )}
                    </View>
                </Animated.View>

                <Animated.View onLayout={setSectionY('support')} entering={FadeInDown.delay(400).duration(800)} style={styles.section}>
                    <Text style={styles.sectionHeader}>{t('settings.supportCommunity')}</Text>
                    <View style={styles.card}>
                        <BlurView intensity={Math.round(20 * blurIntensity)} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />

                        <TouchableOpacity
                            style={styles.cardItem}
                            onPress={() => Linking.openURL(localizedUrl(APP_URLS.support))}
                            accessibilityRole="button"
                            accessibilityLabel="Open support center"
                        >
                            <View style={styles.cardIconContainer}>
                                <Globe size={20} color="#f8fafc" strokeWidth={2.5} />
                            </View>
                            <View style={styles.cardTextContainer}>
                                <Text style={styles.cardLabel}>{t('settings.helpFaq')}</Text>
                                <Text style={styles.cardSub}>{t('settings.helpFaqSub')}</Text>
                            </View>
                            <ChevronRight size={18} color="#475569" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.cardItem}
                            onPress={() => Linking.openURL(APP_URLS.email)}
                            accessibilityRole="button"
                            accessibilityLabel="Email support"
                        >
                            <View style={styles.cardIconContainer}>
                                <Mail size={20} color="#f8fafc" strokeWidth={2.5} />
                            </View>
                            <View style={styles.cardTextContainer}>
                                <Text style={styles.cardLabel}>{t('settings.emailUs')}</Text>
                                <Text style={styles.cardSub}>tahajjud.letters@gmail.com</Text>
                            </View>
                            <ChevronRight size={18} color="#475569" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.cardItem}
                            onPress={openAppStoreReview}
                            accessibilityRole="button"
                            accessibilityLabel={Platform.OS === 'android' ? 'Rate Tahajjud+ on Google Play' : 'Rate Tahajjud+ on the App Store'}
                        >
                            <View style={[styles.cardIconContainer, { backgroundColor: '#f59e0b22' }]}>
                                <Star size={20} color="#f59e0b" strokeWidth={2.5} fill="#f59e0b" />
                            </View>
                            <View style={styles.cardTextContainer}>
                                <Text style={styles.cardLabel}>{t('settings.rateApp')}</Text>
                                <Text style={styles.cardSub}>{t('settings.rateAppSub')}</Text>
                            </View>
                            <ChevronRight size={18} color="#475569" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.cardItem}
                            onPress={() => Linking.openURL(localizedUrl(APP_URLS.privacy))}
                            accessibilityRole="button"
                            accessibilityLabel="Open Privacy Policy on the web"
                        >
                            <View style={styles.cardIconContainer}>
                                <Shield size={20} color="#f8fafc" strokeWidth={2.5} />
                            </View>
                            <View style={styles.cardTextContainer}>
                                <Text style={styles.cardLabel}>{t('settings.privacyPolicy')}</Text>
                                <Text style={styles.cardSub}>{t('settings.privacyWebSub')}</Text>
                            </View>
                            <ChevronRight size={18} color="#475569" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.cardItem}
                            onPress={() => Linking.openURL(localizedUrl(APP_URLS.terms))}
                            accessibilityRole="button"
                            accessibilityLabel="Open Terms of Use"
                        >
                            <View style={styles.cardIconContainer}>
                                <FileText size={20} color="#f8fafc" strokeWidth={2.5} />
                            </View>
                            <View style={styles.cardTextContainer}>
                                <Text style={styles.cardLabel}>{t('settings.termsOfUse')}</Text>
                                <Text style={styles.cardSub}>{t('settings.termsSub')}</Text>
                            </View>
                            <ChevronRight size={18} color="#475569" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.cardItem}
                            onPress={() => Linking.openURL(APP_URLS.home)}
                            accessibilityRole="button"
                            accessibilityLabel="Visit Tahajjud+ website"
                        >
                            <View style={styles.cardIconContainer}>
                                <Globe size={20} color="#f8fafc" strokeWidth={2.5} />
                            </View>
                            <View style={styles.cardTextContainer}>
                                <Text style={styles.cardLabel}>{t('settings.website')}</Text>
                                <Text style={styles.cardSub}>tahajjud-2d7bf.web.app</Text>
                            </View>
                            <ChevronRight size={18} color="#475569" />
                        </TouchableOpacity>
                    </View>
                </Animated.View>

                {user && (
                    <Animated.View entering={FadeInDown.delay(500).duration(800)} style={styles.section}>
                        <Text style={[styles.sectionHeader, { color: '#ef4444' }]}>{t('settings.dangerZone')}</Text>
                        <View style={[styles.card, { borderColor: 'rgba(239, 68, 68, 0.2)' }]}>
                            <BlurView intensity={20} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(239, 68, 68, 0.05)' }]} />
                            <TouchableOpacity
                                style={styles.cardItem}
                                onPress={handleDeleteAccount}
                            >
                                <View style={[styles.cardIconContainer, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }]}>
                                    <Trash2 size={20} color="#ef4444" strokeWidth={2.5} />
                                </View>
                                <View style={styles.cardTextContainer}>
                                    <Text style={[styles.cardLabel, { color: '#ef4444' }]}>{t('settings.deleteAccount')}</Text>
                                    <Text style={styles.cardSub}>{t('settings.deleteAccountSub')}</Text>
                                </View>
                                <ChevronRight size={18} color="#475569" />
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                )}


                <View style={styles.footer}>
                    <LinearGradient
                        colors={['transparent', 'rgba(248, 250, 252, 0.1)', 'transparent']}
                        style={styles.footerLine}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                    />
                    <Text style={styles.versionText}>TAHAJJUD PLUS v1.8.0</Text>
                    <Text style={styles.creatorText}>{t('settings.createdBy')}</Text>
                </View>
            </ScrollView >

            {/* Privacy Policy Modal */}
            <Modal
                animationType="slide"
                transparent={false}
                visible={showPrivacy}
                onRequestClose={() => setShowPrivacy(false)}
            >
                <PrivacyPolicy onClose={() => setShowPrivacy(false)} />
            </Modal>

            {/* Sources & Methodology Modal */}
            <Modal
                animationType="slide"
                transparent={false}
                visible={showSources}
                onRequestClose={() => setShowSources(false)}
            >
                <SourcesMethodology onClose={() => setShowSources(false)} />
            </Modal>

            {/* Moderation Modal (admin only) — Duas, Stories, Leaderboard in one */}
            <ModerationModal
                visible={showModeration}
                onClose={() => setShowModeration(false)}
            />


            {/* Home-screen widget setup guide — invoked from "Add Home Screen
                Widget" row. Same WidgetPromo card the user first sees after
                logging their first Tahajjud, but reachable any time. */}
            {showWidgetGuide && (
                <Modal visible transparent animationType="fade" onRequestClose={() => setShowWidgetGuide(false)}>
                    <View style={styles.widgetModalBackdrop}>
                        <WidgetPromo onDismiss={() => setShowWidgetGuide(false)} />
                    </View>
                </Modal>
            )}

            {/* Remind Before Prayer Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={showReminderModal}
                onRequestClose={() => setShowReminderModal(false)}
            >
                <View style={styles.nameModalOverlay}>
                    <View style={styles.nameModalBox}>
                        <Text style={styles.nameModalTitle}>Remind Before Prayer</Text>
                        <Text style={styles.nameModalSub}>How many minutes before each prayer?</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 16 }}>
                            {[0, 5, 15, 30, 45, 60].map(mins => (
                                <TouchableOpacity
                                    key={mins}
                                    style={{
                                        flex: 1, minWidth: 70, paddingVertical: 12, borderRadius: 12,
                                        backgroundColor: prayerReminderOffset === mins ? colors.accent + '22' : 'rgba(255,255,255,0.05)',
                                        borderWidth: 1,
                                        borderColor: prayerReminderOffset === mins ? colors.accent + '66' : 'rgba(255,255,255,0.08)',
                                        alignItems: 'center',
                                    }}
                                    onPress={async () => {
                                        setPrayerReminderOffset(mins);
                                        await AsyncStorage.setItem('prayer_reminder_offset', mins.toString());
                                        // Tell NightCalculator to reschedule reminders with the new
                                        // offset now — otherwise the change only takes effect on the
                                        // next app launch (the listener had no matching emitter).
                                        DeviceEventEmitter.emit('prayerReminderOffsetChanged');
                                        haptic.light();
                                    }}
                                >
                                    <Text style={{ color: prayerReminderOffset === mins ? colors.accent : '#94a3b8', fontWeight: '800', fontSize: 15 }}>
                                        {mins === 0 ? 'At time' : mins === 60 ? '1h' : `${mins}m`}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <TouchableOpacity
                            // Override `flex: 1` from nameModalBtn — this is a
                            // standalone full-width button, not a half-width
                            // row child. Without the override the button
                            // stretches vertically and the "Done" label gets
                            // lost in a tall blue rectangle.
                            style={[styles.nameModalBtn, { flex: 0, backgroundColor: colors.accent, width: '100%', justifyContent: 'center' }]}
                            onPress={() => setShowReminderModal(false)}
                        >
                            <Text style={[styles.nameModalBtnText, { color: '#0f172a' }]}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Name Edit Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={showNameModal}
                onRequestClose={() => setShowNameModal(false)}
            >
                <View style={styles.nameModalOverlay}>
                    <View style={styles.nameModalBox}>
                        <Text style={styles.nameModalTitle}>Spiritual Name</Text>
                        <Text style={styles.nameModalSub}>How should we address you in your journey?</Text>
                        <TextInput
                            style={styles.nameModalInput}
                            value={nameInput}
                            onChangeText={setNameInput}
                            placeholder="Your name"
                            placeholderTextColor="#475569"
                            autoFocus
                            maxLength={30}
                        />
                        <View style={styles.nameModalRow}>
                            <TouchableOpacity
                                style={[styles.nameModalBtn, { backgroundColor: 'rgba(255,255,255,0.06)' }]}
                                onPress={() => setShowNameModal(false)}
                            >
                                <Text style={[styles.nameModalBtnText, { color: '#94a3b8' }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.nameModalBtn, { backgroundColor: colors.accent }]}
                                onPress={async () => {
                                    const trimmed = nameInput.trim();
                                    if (trimmed) {
                                        await setUserName(trimmed);
                                        // Propagate to the Dua Wall, comments, Leaderboard,
                                        // Testimonies, and Partner circle — whichever surface
                                        // you name yourself on first flows to the others.
                                        CommunityProfileStore.set(trimmed).catch(() => {});
                                        haptic.success();
                                    }
                                    setShowNameModal(false);
                                }}
                            >
                                <Text style={[styles.nameModalBtnText, { color: '#0f172a' }]}>Update</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Paywall Modal — rendered here so it works inside the Settings modal */}
            <Modal
                visible={localPaywallVisible}
                animationType="slide"
                presentationStyle="fullScreen"
                onRequestClose={() => setLocalPaywallVisible(false)}
            >
                <Paywall onClose={() => setLocalPaywallVisible(false)} source={localPaywallSource} featureId={localPaywallFeatureId} />
            </Modal>

            {/* Mosque Timetable Import */}
            <MosqueImportModal
                visible={showMosqueImport}
                onClose={() => {
                    setShowMosqueImport(false);
                    getMosqueTimetable().then(setMosqueTimetable).catch(() => {});
                }}
            />

            {/* Mosque Timetable Edit */}
            <MosqueEditModal
                visible={showMosqueEdit}
                onClose={() => {
                    setShowMosqueEdit(false);
                    getMosqueTimetable().then(setMosqueTimetable).catch(() => {});
                }}
            />
        </View >
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#020617',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 24,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        overflow: 'hidden',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: '#f8fafc',
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: 13,
        color: '#94a3b8',
        marginTop: 2,
        fontWeight: '600',
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 120, // Increased to avoid "half scrolls" and account for tab bar
    },
    section: {
        paddingHorizontal: 20,
        marginBottom: 28,
    },
    sectionHeader: {
        fontSize: 12,
        fontWeight: '900',
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: 2,
        marginBottom: 16,
        paddingLeft: 4,
    },
    card: {
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
    },
    cardItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
    },
    cardDivider: {
        height: 1,
        marginHorizontal: 20,
    },
    cardItemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    cardIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: 'rgba(248, 250, 252, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
        borderWidth: 1,
        borderColor: 'rgba(248, 250, 252, 0.1)',
    },
    cardTextContainer: {
        flex: 1,
    },
    cardLabel: {
        fontSize: 16,
        color: '#f8fafc',
        fontWeight: '700',
    },
    cardValue: {
        fontSize: 14,
        color: '#f8fafc',
        marginTop: 4,
        fontWeight: '800',
    },
    cardSub: {
        fontSize: 13,
        color: '#94a3b8',
        marginTop: 4,
        fontWeight: '700',
    },
    crystallineCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(34, 197, 94, 0.2)',
        overflow: 'hidden',
        gap: 16,
    },
    syncStatusTitle: {
        color: '#22c55e',
        fontWeight: '900',
        fontSize: 16,
    },
    syncStatusSub: {
        color: '#cbd5e1',
        fontSize: 13,
        marginTop: 2,
        fontWeight: '600',
    },
    iconAction: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    authArea: {
        padding: 24,
    },
    authInfo: {
        color: '#cbd5e1',
        fontSize: 14,
        lineHeight: 22,
        textAlign: 'center',
        marginBottom: 24,
        fontWeight: '600',
    },
    authRow: {
        flexDirection: 'row',
        gap: 12,
    },
    authPill: {
        flex: 1,
        height: 52,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    googlePill: {
        backgroundColor: '#f8fafc',
    },
    applePill: {
        backgroundColor: '#000000',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    googleText: {
        color: '#0f172a',
        fontWeight: '800',
        fontSize: 14,
    },
    appleText: {
        color: '#ffffff',
        fontWeight: '800',
        fontSize: 14,
    },
    footer: {
        marginTop: 20,
        paddingBottom: 60,
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    footerLine: {
        width: '100%',
        height: 1,
        marginBottom: 24,
    },
    coffeeCard: {
        marginHorizontal: 20,
        marginBottom: 12,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(139,92,246,0.25)',
        backgroundColor: 'rgba(99,102,241,0.07)',
    },
    coffeeCardInner: {
        padding: 22,
    },
    coffeeCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8,
    },
    coffeeCardFlag: {
        fontSize: 18,
    },
    coffeeCardHeading: {
        color: '#c4b5fd',
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    coffeeCardBody: {
        color: '#94a3b8',
        fontSize: 13.5,
        lineHeight: 21,
        marginBottom: 18,
    },
    coffeeCta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    coffeeCtaText: {
        color: '#a78bfa',
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    versionText: {
        color: '#94a3b8',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 1.5,
    },
    ummahText: {
        color: '#64748b',
        fontSize: 12,
        marginTop: 6,
        fontWeight: '800',
    },
    creatorText: {
        color: '#94a3b8',
        fontSize: 11,
        marginTop: 8,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    themeSelector: {
        flexDirection: 'row',
        padding: 20,
        gap: 16,
    },
    themeOption: {
        alignItems: 'center',
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        width: 80,
    },
    themeOptionActive: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    themePreview: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginBottom: 8,
    },
    themeLabel: {
        fontSize: 12,
        fontWeight: '700',
    },
    activeDot: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    themeLockOverlay: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 8,
        padding: 2,
    },
    upgradeBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        marginHorizontal: 20,
        marginBottom: 16,
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 16,
        overflow: 'hidden',
    },
    upgradeBannerText: {
        color: '#000',
        fontWeight: '700',
        fontSize: 16,
        flex: 1,
    },
    methodSelector: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        gap: 10,
    },
    methodPill: {
        paddingTop: 10,
        paddingBottom: 14,
        paddingHorizontal: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        minWidth: 160,
    },
    methodBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        marginBottom: 6,
    },
    methodBadgeText: {
        fontSize: 8,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    methodName: {
        fontSize: 14,
        fontWeight: '800',
        marginBottom: 2,
    },
    methodSub: {
        fontSize: 11,
        fontWeight: '600',
        lineHeight: 14,
    },
    helperText: {
        fontSize: 12,
        fontStyle: 'italic',
        lineHeight: 17,
        marginTop: -4,
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    widgetModalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'flex-end',
    },
    // Android name-edit modal
    nameModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 28,
    },
    nameModalBox: {
        width: '100%',
        backgroundColor: '#0f172a',
        borderRadius: 24,
        padding: 28,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    nameModalTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: '#f8fafc',
        marginBottom: 6,
        letterSpacing: -0.3,
    },
    nameModalSub: {
        fontSize: 13,
        color: '#94a3b8',
        fontWeight: '600',
        marginBottom: 20,
    },
    nameModalInput: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: '#f8fafc',
        fontWeight: '700',
        marginBottom: 20,
    },
    nameModalRow: {
        flexDirection: 'row',
        gap: 12,
    },
    nameModalBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
    },
    nameModalBtnText: {
        fontSize: 15,
        fontWeight: '800',
    },
});

const settingsJumpStyles = StyleSheet.create({
    bar: {
        flexGrow: 0,
        paddingTop: 4,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.04)',
    },
    row: { paddingHorizontal: 16, gap: 8 },
    pill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
        borderWidth: 1,
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    pillText: { fontSize: 12, fontWeight: '700' },
});

const reciterStyles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginHorizontal: 12,
        marginBottom: 8,
        borderRadius: 14,
        borderWidth: 1,
        gap: 12,
    },
    name: { fontSize: 14, fontWeight: '700' },
    desc: { fontSize: 12, marginTop: 2 },
    checkWrap: {
        width: 22, height: 22, borderRadius: 11,
        alignItems: 'center', justifyContent: 'center',
    },
});
