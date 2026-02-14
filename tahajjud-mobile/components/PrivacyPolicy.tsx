import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Dimensions, Linking } from 'react-native';
import { X, Shield, Lock, Eye, Database } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

interface Props {
    onClose: () => void;
}

export function PrivacyPolicy({ onClose }: Props) {
    const { colors } = useTheme();

    const Section = ({ icon: Icon, title, content }: { icon: any, title: string, content: string }) => (
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <View style={[styles.iconContainer, { backgroundColor: colors.accent + '15' }]}>
                    <Icon size={18} color={colors.accent} />
                </View>
                <Text style={[styles.sectionTitle, { color: colors.primaryText }]}>{title}</Text>
            </View>
            <Text style={[styles.sectionContent, { color: colors.secondaryText }]}>{content}</Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={[styles.title, { color: colors.accent }]}>Privacy Trust</Text>
                    <Text style={[styles.subtitle, { color: colors.secondaryText }]}>Your spiritual journey is private</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <X color={colors.primaryText} size={24} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.heroCard}>
                    <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                    <Shield color={colors.accent} size={48} strokeWidth={1} style={styles.heroIcon} />
                    <Text style={[styles.heroText, { color: colors.primaryText }]}>
                        We believe spiritual growth belongs to the soul. Your data never leaves your control.
                    </Text>
                </View>

                <Section
                    icon={Lock}
                    title="Edge Encryption"
                    content="All your Tahajjud letters and personal reflections are stored locally on your device or encrypted within your private Supabase container. We cannot read your entries."
                />

                <Section
                    icon={Database}
                    title="Data Sovereignty"
                    content="You own your data. If you choose to use Cloud Sync, your data is protected by industry-standard encryption. You can delete your entire journey at any time."
                />

                <Section
                    icon={Eye}
                    title="No Surveillance"
                    content="Tahajjud does not use third-party tracking, advertising, or data brokerage. We do not sell or share your spiritual metrics with anyone."
                />

                <View style={styles.footer}>
                    <Text style={[styles.footerText, { color: colors.secondaryText }]}>
                        Last Updated: February 2026{'\n'}
                        Contact: tahajjud.letters@gmail.com{'\n\n'}
                        Official Privacy Policy:{'\n'}
                        <Text
                            style={{ color: colors.accent, textDecorationLine: 'underline' }}
                            onPress={() => Linking.openURL('https://tahajjud-2d7bf.web.app')}
                        >
                            tahajjud-2d7bf.web.app
                        </Text>
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#020617',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 14,
        fontWeight: '600',
        marginTop: 2,
    },
    closeButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    heroCard: {
        padding: 32,
        borderRadius: 32,
        marginBottom: 32,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
    },
    heroIcon: {
        marginBottom: 16,
    },
    heroText: {
        fontSize: 18,
        textAlign: 'center',
        lineHeight: 28,
        fontWeight: '600',
    },
    section: {
        marginBottom: 32,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '800',
    },
    sectionContent: {
        fontSize: 16,
        lineHeight: 24,
        fontWeight: '500',
    },
    footer: {
        marginTop: 16,
        paddingTop: 32,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.05)',
    },
    footerText: {
        fontSize: 13,
        lineHeight: 20,
        textAlign: 'center',
        fontWeight: '600',
    },
});
