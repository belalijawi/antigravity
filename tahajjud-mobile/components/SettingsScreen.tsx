import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Switch, Platform, Linking, Modal, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, ChevronRight, User, Cloud, Shield, Bell, LogOut, Mail, Globe, Lock, MessageSquare, Palette, Moon, Trash2 } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { GoogleAuthProvider, OAuthProvider, signInWithCredential } from 'firebase/auth';

// Native modules — not available in Expo Go, so we load them safely
let AppleAuthentication: typeof import('expo-apple-authentication') | null = null;
let GoogleSignin: any = null;
let statusCodes: any = {};
try { AppleAuthentication = require('expo-apple-authentication'); } catch (_) { }
try { const gs = require('@react-native-google-signin/google-signin'); GoogleSignin = gs.GoogleSignin; statusCodes = gs.statusCodes; } catch (_) { }
import { syncLocalToCloud, deleteCloudData } from '../utils/syncService';
import { getFirebaseAuth } from '../utils/firebase';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useTheme, ThemeType, PREMIUM_THEMES, THEME_LABELS } from '../context/ThemeContext';
import { usePurchases } from '../context/PurchasesContext';
import { PrivacyPolicy } from './PrivacyPolicy';
import { haptic } from '../utils/haptic';
import { tabletContentStyle } from '../utils/layout';

interface SettingsScreenProps {
    onClose: () => void;
}
export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onClose }) => {
    const { theme, setTheme, colors, userName, setUserName } = useTheme();
    const { isPremium } = usePurchases();
    const [isDeleting, setIsDeleting] = useState(false);
    const insets = useSafeAreaInsets();
    const [isSyncEnabled, setIsSyncEnabled] = useState(false);
    const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [showPrivacy, setShowPrivacy] = useState(false);
    const [prayerMethod, setPrayerMethod] = useState<number>(2);
    const [isSigningIn, setIsSigningIn] = useState(false);
    const [showNameModal, setShowNameModal] = useState(false);
    const [nameInput, setNameInput] = useState('');
    const [allPrayersEnabled, setAllPrayersEnabled] = useState(false);

    const prayerMethods = [
        { id: 2, name: 'ISNA', sub: 'North America (15°)' },
        { id: 3, name: 'MWL', sub: 'Europe, Far East (17°)' },
        { id: 4, name: 'Umm al-Qura', sub: 'Makkah, Saudi Arabia' },
        { id: 1, name: 'Karachi', sub: 'South Asia (18°)' },
        { id: 13, name: 'Diyanet', sub: 'Turkey' },
    ];

    useEffect(() => {
        loadSettings();

        // Use the auth listener for more reliable state tracking
        const check = async () => {
            const authInstance = getFirebaseAuth();
            if (authInstance) {
                const unsubscribe = authInstance.onAuthStateChanged((firebaseUser) => {
                    if (firebaseUser) {
                        setUser({
                            id: firebaseUser.uid,
                            email: firebaseUser.email
                        });
                        setIsSyncEnabled(true);
                    } else {
                        setUser(null);
                        setIsSyncEnabled(false);
                    }
                });
                return unsubscribe;
            } else {
                // Fallback to manual check if listener can't be attached yet
                checkUser();
            }
        };

        let unmount: any;
        check().then(u => unmount = u);

        return () => {
            if (unmount) unmount();
        };
    }, []);

    const loadSettings = async () => {
        const biometricStatus = await AsyncStorage.getItem('biometric-lock-enabled');
        setIsBiometricEnabled(biometricStatus === 'true');
        const method = await AsyncStorage.getItem('prayer_calculation_method');
        if (method) setPrayerMethod(parseInt(method, 10));

        const allPrayers = await AsyncStorage.getItem('notification_all_prayers_enabled');
        setAllPrayersEnabled(allPrayers === 'true');
    };

    const updatePrayerMethod = async (id: number) => {
        haptic.light();
        setPrayerMethod(id);
        await AsyncStorage.setItem('prayer_calculation_method', id.toString());
        Alert.alert("Method Updated", "Prayer times will refresh upon returning to the home screen.");
    };

    const handleEditName = () => {
        haptic.medium();
        if (Platform.OS === 'android') {
            setNameInput(userName === 'Servant' ? '' : userName);
            setShowNameModal(true);
        } else {
            Alert.prompt(
                "Spiritual Name",
                "How should we address you in your journey?",
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Update",
                        onPress: async (newName: string | undefined) => {
                            if (newName && newName.trim()) {
                                const trimmed = newName.trim();
                                await setUserName(trimmed);
                                haptic.success();
                            }
                        }
                    }
                ],
                'plain-text',
                userName === 'Servant' ? '' : userName
            );
        }
    };

    const checkUser = async () => {
        // Firebase auth state is handled by the listener in useEffect
        // This fallback is intentionally a no-op
    };

    // ─── Google Sign-In ──────────────────────────────────────────────
    const handleGoogleSignIn = async () => {
        haptic.medium();
        if (!GoogleSignin) {
            Alert.alert('Not Available', 'Google Sign-In requires a production build.');
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
            // Note: hasPlayServices() is Android-only — do NOT call it on iOS as it crashes
            const signInResult = await GoogleSignin.signIn();
            const idToken = signInResult.data?.idToken;
            if (!idToken) throw new Error('No ID token from Google');

            const auth = getFirebaseAuth();
            if (!auth) throw new Error('Firebase not initialised');

            const credential = GoogleAuthProvider.credential(idToken);
            const result = await signInWithCredential(auth, credential);
            setUser(result.user);
            setIsSyncEnabled(true);
            haptic.success();
            Alert.alert('✅ Signed In', `Welcome, ${result.user.displayName || result.user.email}!`);
        } catch (error: any) {
            if (error.code === statusCodes.SIGN_IN_CANCELLED) {
                // user cancelled — no alert needed
            } else if (error.code === statusCodes.IN_PROGRESS) {
                Alert.alert('Sign-In In Progress', 'Please wait...');
            } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
                Alert.alert('Error', 'Google Play Services not available.');
            } else {
                console.error('Google sign-in error:', error);
                Alert.alert('Sign-In Failed', error.message || 'Could not sign in with Google.');
            }
        } finally {
            setIsSigningIn(false);
        }
    };

    // ─── Apple Sign-In ───────────────────────────────────────────────
    const handleAppleSignIn = async () => {
        haptic.medium();
        if (!AppleAuthentication) {
            Alert.alert('Not Available', 'Apple Sign-In requires a production build.');
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
            const result = await signInWithCredential(auth, firebaseCredential);

            // Apple only gives name on first sign-in — persist it
            const displayName = credential.fullName
                ? `${credential.fullName.givenName ?? ''} ${credential.fullName.familyName ?? ''}`.trim()
                : result.user.displayName;

            setUser({ ...result.user, displayName });
            setIsSyncEnabled(true);
            haptic.success();
            Alert.alert('✅ Signed In', `Welcome${displayName ? `, ${displayName}` : ''}!`);
        } catch (error: any) {
            if (error.code === 'ERR_REQUEST_CANCELED') {
                // user cancelled — no alert needed
            } else {
                console.error('Apple sign-in error:', error);
                Alert.alert('Sign-In Failed', error.message || 'Could not sign in with Apple.');
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
                Alert.alert("Incompatible", "Biometric hardware not found or not enrolled.");
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
            setUser(null);
            setIsSyncEnabled(false);
            Alert.alert("Signed Out", "Cloud sync paused.");
        } catch (e) {
            console.error('Logout error:', e);
        }
    };

    const handleDeleteAccount = async () => {
        if (!user) return;
        haptic.medium();

        Alert.alert(
            "Delete Account?",
            "This will permanently erase your spiritual name, Tahajjud letters, and journey history. This action cannot be undone.",
            [
                { text: "Cancel", style: 'cancel' },
                {
                    text: "Delete Forever",
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
                                "Account Deleted",
                                "Your account and data have been fully erased. Restart the app for a fresh journey."
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
                                    "Verification Required",
                                    "For security, please sign out and sign back in before deleting.",
                                    [
                                        { text: "Cancel", style: 'cancel' },
                                        {
                                            text: "Sign Out & Re-verify",
                                            onPress: async () => {
                                                const authInst = getFirebaseAuth();
                                                await authInst?.signOut();
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
                                    "Partially Deleted",
                                    "Cloud removal failed (network error), but your local device is wiped. For full removal, email: tahajjud.letters@gmail.com",
                                    [
                                        {
                                            text: "Email Support",
                                            onPress: () => Linking.openURL('mailto:tahajjud.letters@gmail.com?subject=Cloud%20Deletion%20Request')
                                        },
                                        { text: "OK", onPress: onClose }
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
                    <Text style={[styles.headerTitle, { color: colors.accent }]}>Settings</Text>
                    <Text style={[styles.headerSubtitle, { color: colors.secondaryText }]}>Customize your experience</Text>
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
                        <BlurView intensity={20} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
                        <X color="#ffffff" size={24} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.scrollContent, tabletContentStyle()]}
            >
                <Animated.View entering={FadeInDown.delay(100).duration(800)} style={styles.section}>
                    <Text style={[styles.sectionHeader, { color: colors.secondaryText }]}>Appearance</Text>
                    <View style={styles.card}>
                        <BlurView intensity={20} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
                        <View style={styles.cardItem}>
                            <View style={styles.cardIconContainer}>
                                <Palette size={20} color={colors.primaryText} strokeWidth={2.5} />
                            </View>
                            <View style={styles.cardTextContainer}>
                                <Text style={[styles.cardLabel, { color: colors.primaryText }]}>Theme Color</Text>
                                <Text style={[styles.cardSub, { color: colors.secondaryText }]}>Customize your night sky</Text>
                            </View>
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.themeSelector}>
                            {(['silver', 'teal', 'emerald', 'gold', 'rose', 'purple'] as ThemeType[]).map((t) => {
                                const isPremiumTheme = PREMIUM_THEMES.includes(t);
                                const isLocked = isPremiumTheme && !isPremium;
                                const GRADIENTS: Record<ThemeType, [string, string]> = {
                                    silver: ['#f1f5f9', '#cbd5e1'],
                                    teal: ['#22d3ee', '#06b6d4'],
                                    emerald: ['#34d399', '#10b981'],
                                    gold: ['#fbbf24', '#f59e0b'],
                                    rose: ['#f472b6', '#ec4899'],
                                    purple: ['#a78bfa', '#8b5cf6'],
                                };
                                return (
                                    <TouchableOpacity
                                        key={t}
                                        onPress={() => {
                                            if (isLocked) {
                                                Alert.alert('Premium Theme', 'Upgrade to Tahajjud+ to unlock all themes.');
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
                    </View>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(150).duration(800)} style={styles.section}>
                    <Text style={[styles.sectionHeader, { color: colors.secondaryText }]}>Prayer Times</Text>
                    <View style={styles.card}>
                        <BlurView intensity={20} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
                        <View style={styles.cardItem}>
                            <View style={styles.cardIconContainer}>
                                <Moon size={20} color={colors.primaryText} strokeWidth={2.5} />
                            </View>
                            <View style={styles.cardTextContainer}>
                                <Text style={[styles.cardLabel, { color: colors.primaryText }]}>Calculation Method</Text>
                                <Text style={[styles.cardSub, { color: colors.secondaryText }]}>
                                    {prayerMethods.find(m => m.id === prayerMethod)?.name || 'ISNA'}
                                </Text>
                            </View>
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.methodSelector}>
                            {prayerMethods.map((m) => (
                                <TouchableOpacity
                                    key={m.id}
                                    onPress={() => updatePrayerMethod(m.id)}
                                    style={[
                                        styles.methodPill,
                                        prayerMethod === m.id && { backgroundColor: colors.accent, borderColor: colors.accent }
                                    ]}
                                >
                                    <Text style={[
                                        styles.methodName,
                                        { color: prayerMethod === m.id ? '#0f172a' : colors.primaryText }
                                    ]}>{m.name}</Text>
                                    <Text style={[
                                        styles.methodSub,
                                        { color: prayerMethod === m.id ? 'rgba(15, 23, 42, 0.7)' : colors.secondaryText }
                                    ]}>{m.sub}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(200).duration(800)} style={styles.section}>
                    <Text style={[styles.sectionHeader, { color: colors.secondaryText }]}>Profile</Text>
                    <View style={styles.card}>
                        <BlurView intensity={20} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
                        <TouchableOpacity style={styles.cardItem} onPress={handleEditName}>
                            <View style={styles.cardIconContainer}>
                                <User size={20} color="#f8fafc" strokeWidth={2.5} />
                            </View>
                            <View style={styles.cardTextContainer}>
                                <Text style={styles.cardLabel}>Spiritual Name</Text>
                                <Text style={styles.cardValue}>{userName}</Text>
                            </View>
                            <ChevronRight size={18} color="#475569" />
                        </TouchableOpacity>
                    </View>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(200).duration(800)} style={styles.section}>
                    <Text style={styles.sectionHeader}>Sync & Cloud</Text>
                    {user ? (
                        <View style={styles.crystallineCard}>
                            <BlurView intensity={20} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
                            <LinearGradient
                                colors={['rgba(34, 197, 94, 0.1)', 'transparent']}
                                style={StyleSheet.absoluteFill}
                            />
                            <Cloud size={24} color="#22c55e" />
                            <View style={styles.cardTextContainer}>
                                <Text style={styles.syncStatusTitle}>Journey Synchronized</Text>
                                <Text style={styles.syncStatusSub}>{user.email}</Text>
                            </View>
                            <TouchableOpacity onPress={handleLogout} style={styles.iconAction}>
                                <LogOut size={18} color="#ef4444" />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.card}>
                            <BlurView intensity={20} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
                            <View style={styles.authArea}>
                                <Text style={styles.authInfo}>
                                    Preserve your Tahajjud letters and growth across all devices.
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
                                    <TouchableOpacity
                                        style={[styles.authPill, styles.applePill, isSigningIn && { opacity: 0.6 }]}
                                        onPress={() => handleSocialLogin('apple')}
                                        disabled={isSigningIn}
                                    >
                                        {isSigningIn ? <ActivityIndicator size="small" color="#ffffff" /> : <Shield size={18} color="#ffffff" />}
                                        <Text style={styles.appleText}>Apple</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    )}
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(300).duration(800)} style={styles.section}>
                    <Text style={[styles.sectionHeader, { color: colors.secondaryText }]}>Notifications</Text>
                    <View style={styles.card}>
                        <BlurView intensity={20} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />

                        <View style={styles.cardItem}>
                            <View style={styles.cardIconContainer}>
                                <Bell size={20} color={colors.primaryText} strokeWidth={2.5} />
                            </View>
                            <View style={styles.cardTextContainer}>
                                <Text style={[styles.cardLabel, { color: colors.primaryText }]}>Daily Prayer Times</Text>
                                <Text style={[styles.cardSub, { color: colors.secondaryText }]}>Alerts for all 5 daily prayers</Text>
                            </View>
                            <Switch
                                value={allPrayersEnabled}
                                onValueChange={toggleAllPrayers}
                                trackColor={{ false: '#0f172a', true: colors.accent }}
                                thumbColor={allPrayersEnabled ? '#ffffff' : '#94a3b8'}
                            />
                        </View>
                    </View>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(300).duration(800)} style={styles.section}>
                    <Text style={styles.sectionHeader}>Guardian Settings</Text>
                    <View style={styles.card}>
                        <BlurView intensity={20} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
                        <View style={[styles.cardItem, styles.cardItemBorder]}>
                            <View style={styles.cardIconContainer}>
                                <Lock size={20} color="#f8fafc" strokeWidth={2.5} />
                            </View>
                            <View style={styles.cardTextContainer}>
                                <Text style={styles.cardLabel}>Secure Journal</Text>
                                <Text style={styles.cardSub}>Biometric Privacy</Text>
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
                        >
                            <View style={styles.cardIconContainer}>
                                <Shield size={20} color="#f8fafc" strokeWidth={2.5} />
                            </View>
                            <View style={styles.cardTextContainer}>
                                <Text style={styles.cardLabel}>Privacy Trust</Text>
                                <Text style={styles.cardSub}>Data commitment</Text>
                            </View>
                            <ChevronRight size={18} color="#475569" />
                        </TouchableOpacity>
                    </View>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(400).duration(800)} style={styles.section}>
                    <Text style={styles.sectionHeader}>Support & Community</Text>
                    <View style={styles.card}>
                        <BlurView intensity={20} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
                        <TouchableOpacity
                            style={styles.cardItem}
                            onPress={() => Linking.openURL('https://tahajjud-2d7bf.web.app/support.html')}
                        >
                            <View style={styles.cardIconContainer}>
                                <Globe size={20} color="#f8fafc" strokeWidth={2.5} />
                            </View>
                            <View style={styles.cardTextContainer}>
                                <Text style={styles.cardLabel}>Official Support</Text>
                                <Text style={styles.cardSub}>Visit our support center</Text>
                            </View>
                            <ChevronRight size={18} color="#475569" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.cardItem}
                            onPress={() => Linking.openURL('mailto:tahajjud.letters@gmail.com')}
                        >
                            <View style={styles.cardIconContainer}>
                                <Mail size={20} color="#f8fafc" strokeWidth={2.5} />
                            </View>
                            <View style={styles.cardTextContainer}>
                                <Text style={styles.cardLabel}>Direct Email</Text>
                                <Text style={styles.cardSub}>tahajjud.letters@gmail.com</Text>
                            </View>
                            <ChevronRight size={18} color="#475569" />
                        </TouchableOpacity>
                    </View>
                </Animated.View>

                {user && (
                    <Animated.View entering={FadeInDown.delay(500).duration(800)} style={styles.section}>
                        <Text style={[styles.sectionHeader, { color: '#ef4444' }]}>Danger Zone</Text>
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
                                    <Text style={[styles.cardLabel, { color: '#ef4444' }]}>Delete Account</Text>
                                    <Text style={styles.cardSub}>Permanently erase all your data</Text>
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
                    <Text style={styles.versionText}>TAHAJJUD PLUS v1.5.3 (Build 12)</Text>
                    <Text style={styles.ummahText}>Bespoke spiritual tool for the Ummah</Text>
                    <Text style={styles.creatorText}>Created by a Palestinian 🇵🇸</Text>
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

            {/* Android Name Edit Modal */}
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
    methodSelector: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        gap: 10,
    },
    methodPill: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        minWidth: 140,
    },
    methodName: {
        fontSize: 14,
        fontWeight: '800',
        marginBottom: 2,
    },
    methodSub: {
        fontSize: 10,
        fontWeight: '600',
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
