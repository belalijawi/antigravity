import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert, Switch, Platform, Linking } from 'react-native';
import { X, ChevronRight, User, Cloud, Shield, Bell, LogOut, Mail, Globe, Lock, MessageSquare } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { supabase } from '../utils/supabase';
import { syncLocalToCloud } from '../utils/syncService';

interface SettingsScreenProps {
    onClose: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onClose }) => {
    const [userName, setUserName] = useState<string>('');
    const [isSyncEnabled, setIsSyncEnabled] = useState(false);
    const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        loadSettings();
        checkUser();
    }, []);

    const loadSettings = async () => {
        const name = await AsyncStorage.getItem('user-name');
        setUserName(name || 'Servant of Allah');

        const biometricStatus = await AsyncStorage.getItem('biometric-lock-enabled');
        setIsBiometricEnabled(biometricStatus === 'true');
    };

    const checkUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
        setIsSyncEnabled(!!user);
    };

    const handleSocialLogin = async (provider: 'google' | 'apple') => {
        // This is a placeholder for the actual Supabase Auth implementation
        // which requires redirects/URL handling in a real device.
        Alert.alert(
            "Social Login",
            `Connecting to ${provider}... Once signed in, your journey will sync to the cloud.`,
            [{
                text: "Simulate Success", onPress: async () => {
                    // For demonstration, we simulate a successful login and trigger sync
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        await syncLocalToCloud(user.id);
                        setUser(user);
                        setIsSyncEnabled(true);
                    } else {
                        Alert.alert("Supabase Not Ready", "Please add your Supabase URL and Key in utils/supabase.ts first.");
                    }
                }
            }, { text: "Cancel" }]
        );
    };

    const toggleBiometric = async (value: boolean) => {
        if (value) {
            // Check if device has biometric hardware
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            const isEnrolled = await LocalAuthentication.isEnrolledAsync();

            if (!hasHardware || !isEnrolled) {
                Alert.alert(
                    "Not Compatible",
                    "Your device does not support biometric authentication or doesn't have any fingerprints/faces enrolled."
                );
                return;
            }

            // Test authentication before enabling
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Confirm to enable lock',
                fallbackLabel: 'Use PIN',
            });

            if (result.success) {
                setIsBiometricEnabled(true);
                await AsyncStorage.setItem('biometric-lock-enabled', 'true');
            }
        } else {
            setIsBiometricEnabled(false);
            await AsyncStorage.setItem('biometric-lock-enabled', 'false');
        }
    };

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (!error) {
            setUser(null);
            setIsSyncEnabled(false);
            Alert.alert("Signed Out", "Your local data is safe, but spiritual journey backup is paused.");
        }
    };

    const handleContactSupport = () => {
        Linking.openURL('mailto:tahajjud.stories@gmail.com?subject=Support Request - Tahajjud+');
    };

    const handleOpenPrivacyPolicy = () => {
        Linking.openURL('https://tahajjud.app/privacy');
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.backButton}>
                    <X color="#f8fafc" size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Spiritual Settings</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.content}>
                {/* Profile Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionHeader}>Profile</Text>
                    <View style={styles.settingItem}>
                        <View style={styles.settingIconContainer}>
                            <User size={20} color="#94a3b8" />
                        </View>
                        <View style={styles.settingTextContainer}>
                            <Text style={styles.settingLabel}>Display Name</Text>
                            <Text style={styles.settingValue}>{userName}</Text>
                        </View>
                        <ChevronRight size={20} color="#475569" />
                    </View>
                </View>

                {/* Cloud Sync Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionHeader}>Spiritual Journey Backup</Text>
                    {user ? (
                        <View style={styles.syncStatusCard}>
                            <Cloud size={24} color="#22c55e" />
                            <View style={styles.syncStatusText}>
                                <Text style={styles.syncStatusTitle}>Safe & Connected</Text>
                                <Text style={styles.syncStatusSub}>{user.email || 'Anonymous Backup Active'}</Text>
                            </View>
                            <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
                                <LogOut size={18} color="#ef4444" />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.authContainer}>
                            <Text style={styles.authDescription}>
                                Connect an account to ensure your Tahajjud Letters and streaks are never lost.
                            </Text>

                            <TouchableOpacity
                                style={[styles.authButton, styles.googleButton]}
                                onPress={() => handleSocialLogin('google')}
                            >
                                <Globe size={18} color="#0f172a" />
                                <Text style={styles.authButtonText}>Continue with Google</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.authButton, styles.appleButton]}
                                onPress={() => handleSocialLogin('apple')}
                            >
                                <Shield size={18} color="#ffffff" />
                                <Text style={[styles.authButtonText, { color: '#ffffff' }]}>Continue with Apple</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Privacy Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionHeader}>Privacy</Text>
                    <View style={styles.settingItem}>
                        <View style={styles.settingIconContainer}>
                            <Shield size={20} color="#94a3b8" />
                        </View>
                        <View style={styles.settingTextContainer}>
                            <Text style={styles.settingLabel}>Lock Tahajjud Letters</Text>
                            <Text style={styles.settingSub}>Requires FaceID or PIN</Text>
                        </View>
                        <Switch
                            value={isBiometricEnabled}
                            onValueChange={toggleBiometric}
                            trackColor={{ false: '#1e293b', true: '#4f46e5' }}
                        />
                    </View>

                    <TouchableOpacity style={styles.settingItem} onPress={handleOpenPrivacyPolicy}>
                        <View style={styles.settingIconContainer}>
                            <Lock size={20} color="#94a3b8" />
                        </View>
                        <View style={styles.settingTextContainer}>
                            <Text style={styles.settingLabel}>Privacy Policy</Text>
                            <Text style={styles.settingSub}>Our commitment to your privacy</Text>
                        </View>
                        <ChevronRight size={20} color="#475569" />
                    </TouchableOpacity>
                </View>

                {/* Support Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionHeader}>Support</Text>
                    <TouchableOpacity style={styles.settingItem} onPress={handleContactSupport}>
                        <View style={styles.settingIconContainer}>
                            <MessageSquare size={20} color="#94a3b8" />
                        </View>
                        <View style={styles.settingTextContainer}>
                            <Text style={styles.settingLabel}>Contact Support</Text>
                            <Text style={styles.settingSub}>Get help with your journey</Text>
                        </View>
                        <ChevronRight size={20} color="#475569" />
                    </TouchableOpacity>
                </View>

                {/* Footer Info */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>Tahajjud v1.2.0 • Build 42</Text>
                    <Text style={styles.footerText}>Made with love for the Ummah</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
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
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#ffffff',
    },
    content: {
        flex: 1,
    },
    section: {
        paddingTop: 24,
        paddingHorizontal: 20,
    },
    sectionHeader: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 16,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
    },
    settingIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(148, 163, 184, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    settingTextContainer: {
        flex: 1,
    },
    settingLabel: {
        fontSize: 16,
        color: '#ffffff',
        fontWeight: '500',
    },
    settingValue: {
        fontSize: 14,
        color: '#94a3b8',
        marginTop: 2,
    },
    settingSub: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    authContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    authDescription: {
        color: '#94a3b8',
        fontSize: 14,
        lineHeight: 22,
        textAlign: 'center',
        marginBottom: 24,
    },
    authButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 56,
        borderRadius: 16,
        marginBottom: 12,
        gap: 12,
    },
    googleButton: {
        backgroundColor: '#f8fafc',
    },
    appleButton: {
        backgroundColor: '#000000',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    authButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    syncStatusCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(34, 197, 94, 0.05)',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(34, 197, 94, 0.2)',
    },
    syncStatusText: {
        flex: 1,
        marginLeft: 16,
    },
    syncStatusTitle: {
        color: '#22c55e',
        fontWeight: 'bold',
        fontSize: 16,
    },
    syncStatusSub: {
        color: '#94a3b8',
        fontSize: 12,
        marginTop: 2,
    },
    logoutButton: {
        padding: 8,
    },
    footer: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    footerText: {
        color: '#475569',
        fontSize: 12,
        marginBottom: 4,
    }
});
