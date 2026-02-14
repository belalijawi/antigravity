import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert, Switch, Platform, Linking, Modal } from 'react-native';
import { X, ChevronRight, User, Cloud, Shield, Bell, LogOut, Mail, Globe, Lock, MessageSquare, Palette, Moon, Trash2 } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { supabase } from '../utils/supabase';
import { syncLocalToCloud, deleteCloudData } from '../utils/syncService';
import { getFirebaseAuth } from '../utils/firebase';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useTheme, ThemeType } from '../context/ThemeContext';
import { PrivacyPolicy } from './PrivacyPolicy';
import { haptic } from '../utils/haptic';

interface SettingsScreenProps {
    onClose: () => void;
}
export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onClose }) => {
    const { theme, setTheme, colors } = useTheme();
    const [userName, setUserName] = useState<string>('');
    const [isSyncEnabled, setIsSyncEnabled] = useState(false);
    const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [showPrivacy, setShowPrivacy] = useState(false);
    const [prayerMethod, setPrayerMethod] = useState<number>(2);

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
        const name = await AsyncStorage.getItem('user-name');
        setUserName(name || 'Servant');
        const biometricStatus = await AsyncStorage.getItem('biometric-lock-enabled');
        setIsBiometricEnabled(biometricStatus === 'true');
        const method = await AsyncStorage.getItem('prayer_calculation_method');
        if (method) setPrayerMethod(parseInt(method, 10));
    };

    const updatePrayerMethod = async (id: number) => {
        haptic.light();
        setPrayerMethod(id);
        await AsyncStorage.setItem('prayer_calculation_method', id.toString());
        Alert.alert("Method Updated", "Prayer times will refresh upon returning to the home screen.");
    };

    const checkUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
        setIsSyncEnabled(!!user);
    };

    const handleSocialLogin = async (provider: 'google' | 'apple') => {
        haptic.medium();
        Alert.alert(
            "Sync Your Journey",
            `Connecting to ${provider}... Your Tahajjud Letters and consistency will be preserved in the celestial cloud.`,
            [{
                text: "Continue", onPress: () => {
                    // Real auth flow triggered via supabase wrapper which points to Firebase
                    // The actual implementation depends on native modules being configured
                    Alert.alert("Social Sign-In", "Please ensure Google/Apple Sign-In is configured in your Expo environment.");
                }
            }, { text: "Cancel", style: 'cancel' }]
        );
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
        const { error } = await supabase.auth.signOut();
        if (!error) {
            setUser(null);
            setIsSyncEnabled(false);
            Alert.alert("Signed Out", "Cloud sync paused.");
        }
    };

    const handleDeleteAccount = async () => {
        if (!user) return;
        haptic.medium();

        Alert.alert(
            "Erase Your Journey?",
            "This will permanently delete your spiritual name, your Tahajjud letters, and all synchronized history. This action is irreversible.",
            [
                { text: "Keep My Journey", style: 'cancel' },
                {
                    text: "Delete Forever",
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            // 1. Delete Firestore Data
                            await deleteCloudData(user.id);

                            // 2. Clear Local Storage
                            const keys = await AsyncStorage.getAllKeys();
                            await AsyncStorage.multiRemove(keys);

                            // 3. Sign Out (Supabase)
                            await supabase.auth.signOut();

                            setUser(null);
                            setIsSyncEnabled(false);

                            Alert.alert("Data Deleted", "Your journey and all associated data have been removed.");
                            onClose();
                        } catch (e) {
                            console.error('Deletion error:', e);
                            Alert.alert("Support Required", "We couldn't fully erase your account. Please email tahajjud.letters@gmail.com to complete deletion.");
                        }
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.backButton}>
                    <BlurView intensity={20} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
                    <X color="#ffffff" size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Account Settings</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
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
                            {(['silver', 'teal'] as ThemeType[]).map((t) => (
                                <TouchableOpacity
                                    key={t}
                                    onPress={() => setTheme(t)}
                                    style={[
                                        styles.themeOption,
                                        theme === t && styles.themeOptionActive,
                                        { borderColor: theme === t ? colors.accent : 'rgba(255, 255, 255, 0.1)' }
                                    ]}
                                >
                                    <LinearGradient
                                        colors={
                                            t === 'silver' ? ['#f1f5f9', '#cbd5e1'] :
                                                ['#22d3ee', '#06b6d4']
                                        }
                                        style={styles.themePreview}
                                    />
                                    {theme === t && (
                                        <View style={[styles.activeDot, { backgroundColor: '#ffffff' }]} />
                                    )}
                                    <Text style={[styles.themeLabel, { color: theme === t ? colors.primaryText : colors.secondaryText }]}>
                                        {t === 'silver' ? 'White' : 'Blue'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
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
                        <View style={styles.cardItem}>
                            <View style={styles.cardIconContainer}>
                                <User size={20} color="#f8fafc" strokeWidth={2.5} />
                            </View>
                            <View style={styles.cardTextContainer}>
                                <Text style={styles.cardLabel}>Spiritual Name</Text>
                                <Text style={styles.cardValue}>{userName}</Text>
                            </View>
                            <ChevronRight size={18} color="#475569" />
                        </View>
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
                                        style={[styles.authPill, styles.googlePill]}
                                        onPress={() => handleSocialLogin('google')}
                                    >
                                        <Globe size={18} color="#0f172a" />
                                        <Text style={styles.googleText}>Google</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.authPill, styles.applePill]}
                                        onPress={() => handleSocialLogin('apple')}
                                    >
                                        <Shield size={18} color="#ffffff" />
                                        <Text style={styles.appleText}>Apple</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    )}
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
                    <Text style={styles.versionText}>TAHAJJUD PLUS v1.5.0</Text>
                    <Text style={styles.ummahText}>Bespoke spiritual tool for the Ummah</Text>
                    <Text style={styles.creatorText}>Created by a Palestinian 🇵🇸</Text>
                </View>
            </ScrollView >

            <Modal
                animationType="slide"
                transparent={false}
                visible={showPrivacy}
                onRequestClose={() => setShowPrivacy(false)}
            >
                <PrivacyPolicy onClose={() => setShowPrivacy(false)} />
            </Modal>
        </SafeAreaView >
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
    content: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 40,
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
});
