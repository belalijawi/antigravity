import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, StyleSheet, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Moon, ChevronRight, Globe } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { tabletContentStyle } from '../utils/layout';
import { LOCALES, getLocale, setLocale, type Locale, t } from '../utils/i18n';
import { track } from '../utils/analytics';

interface WelcomeScreenProps {
    onComplete: (name?: string) => void;
}

export function WelcomeScreen({ onComplete }: WelcomeScreenProps) {
    const { colors } = useTheme();
    const [name, setName] = useState('');
    const [showLanguages, setShowLanguages] = useState(false);
    const currentLocale = getLocale();
    const currentNative = LOCALES.find(l => l.code === currentLocale)?.native ?? 'English';

    const handleGetStarted = () => {
        onComplete(name.trim() || undefined);
    };

    const pickLanguage = async (code: Locale) => {
        setShowLanguages(false);
        if (code === currentLocale) return;
        track('locale_changed', { locale: code, source: 'onboarding' });
        // setLocale broadcasts localeChanged → App.tsx remounts the tree, so this
        // screen re-renders fully in the chosen language.
        await setLocale(code);
    };

    return (
        <View style={styles.container}>
            {/* Background Layer */}
            <LinearGradient
                colors={['#000000', '#020617', '#000000']}
                style={StyleSheet.absoluteFill}
            />
            {/* Decorative Nebula Glows */}
            <View style={[styles.glow, { top: '10%', left: '-20%', backgroundColor: 'rgba(241, 245, 249, 0.08)' }]} />
            <View style={[styles.glow, { bottom: '10%', right: '-20%', backgroundColor: 'rgba(226, 232, 240, 0.05)' }]} />

            {/* Language chip — one tap, no extra onboarding step. First thing a
                non-English user can do is make the app theirs. */}
            <SafeAreaView style={styles.langChipWrap} pointerEvents="box-none">
                <Animated.View entering={FadeIn.delay(1000).duration(800)}>
                    <TouchableOpacity style={styles.langChip} onPress={() => setShowLanguages(true)} activeOpacity={0.7}>
                        <Globe size={14} color="#94a3b8" strokeWidth={2} />
                        <Text style={styles.langChipText}>{currentNative}</Text>
                    </TouchableOpacity>
                </Animated.View>
            </SafeAreaView>

            <Modal visible={showLanguages} transparent animationType="fade" onRequestClose={() => setShowLanguages(false)}>
                <TouchableOpacity style={styles.langOverlay} activeOpacity={1} onPress={() => setShowLanguages(false)}>
                    <View style={styles.langSheet}>
                        <ScrollView bounces={false}>
                            {LOCALES.map(loc => (
                                <TouchableOpacity
                                    key={loc.code}
                                    style={[styles.langRow, loc.code === currentLocale && styles.langRowActive]}
                                    onPress={() => pickLanguage(loc.code)}
                                >
                                    <Text style={[styles.langRowText, loc.code === currentLocale && { color: colors.accent, fontWeight: '800' }]}>
                                        {loc.native}
                                    </Text>
                                    <Text style={styles.langRowSub}>{loc.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <View style={[styles.content, tabletContentStyle()]}>
                    {/* Hero Visual */}
                    <Animated.View
                        entering={FadeInUp.delay(200).duration(1200)}
                        style={styles.heroContainer}
                    >
                        <View style={styles.moon}>
                            <LinearGradient
                                colors={['#94a3b8', '#64748b', '#334155']}
                                style={[StyleSheet.absoluteFill, { borderRadius: 60 }]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            />
                            {/* Texture: Lunar Seas */}
                            <View style={[styles.moonSea, { top: 30, left: 20, width: 45, height: 35, transform: [{ rotate: '30deg' }] }]} />
                            <View style={[styles.moonSea, { bottom: 25, right: 35, width: 35, height: 25, opacity: 0.03 }]} />

                            {/* Varied Craters */}
                            <View style={[styles.moonCrater, { top: 20, left: 40, width: 14, height: 14, opacity: 0.08 }]} />
                            <View style={[styles.moonCrater, { top: 60, left: 20, width: 10, height: 10, opacity: 0.06 }]} />
                            <View style={[styles.moonCrater, { bottom: 30, left: 50, width: 20, height: 20, opacity: 0.04 }]} />
                            <View style={[styles.moonCrater, { bottom: 65, right: 25, width: 12, height: 12, opacity: 0.1 }]} />

                            {/* Crescent Shadow */}
                            <View style={styles.moonShadow} />

                            <View style={styles.moonCraters} />
                        </View>
                        <View style={styles.moonAura} />
                    </Animated.View>

                    {/* Text Content */}
                    <View style={styles.textGroup}>
                        <Animated.Text
                            entering={FadeInDown.delay(400).duration(1000)}
                            style={[styles.title, { color: colors.accent }]}
                        >
                            Tahajjud+
                        </Animated.Text>
                        <Animated.Text
                            entering={FadeInDown.delay(600).duration(1000)}
                            style={styles.subtitle}
                        >
                            {t('welcome.subtitle')}
                        </Animated.Text>
                    </View>

                    {/* Action Group */}
                    <View style={styles.actionGroup}>
                        <Animated.View
                            entering={FadeInDown.delay(800).duration(1000)}
                            style={styles.inputWrapper}
                        >
                            <BlurView intensity={30} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
                            <TextInput
                                style={styles.input}
                                placeholder={t('welcome.namePlaceholder')}
                                placeholderTextColor="rgba(255, 255, 255, 0.3)"
                                value={name}
                                onChangeText={setName}
                                autoCapitalize="words"
                            />
                        </Animated.View>

                        <Animated.View
                            entering={FadeInDown.delay(1000).duration(1000)}
                            style={{ width: '100%' }}
                        >
                            <TouchableOpacity
                                onPress={handleGetStarted}
                                style={styles.mainButton}
                                activeOpacity={0.9}
                            >
                                <LinearGradient
                                    colors={['#f8fafc', '#cbd5e1']}
                                    style={StyleSheet.absoluteFill}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                />
                                <Text style={styles.buttonText}>{t('welcome.beginAscent')}</Text>
                                <ChevronRight size={20} color="#0f172a" strokeWidth={2.5} />
                            </TouchableOpacity>
                        </Animated.View>

                        <Animated.View entering={FadeIn.delay(1200).duration(1000)}>
                            <TouchableOpacity onPress={() => onComplete(undefined)} style={styles.skipLink}>
                                <Text style={styles.skipText}>{t('welcome.anonymousReflection')}</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    </View>
                </View>
            </KeyboardAvoidingView>

            {/* Footer quote — outside KeyboardAvoidingView so keyboard never pushes it up */}
            <SafeAreaView style={styles.footerSafeArea} edges={['bottom']}>
                <Animated.Text
                    entering={FadeIn.delay(1500).duration(1000)}
                    style={styles.footerQuote}
                >
                    "The Lord descends every night to the lowest heaven when the last third of the night remains..."
                </Animated.Text>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    glow: {
        position: 'absolute',
        width: 400,
        height: 400,
        borderRadius: 200,
        opacity: 0.5,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    heroContainer: {
        marginBottom: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    moon: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'transparent',
        shadowColor: '#ffffff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 40,
        elevation: 0,
    },
    moonCraters: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.03,
        backgroundColor: 'rgba(0,0,0,0.1)',
        borderRadius: 60,
    },
    moonSea: {
        position: 'absolute',
        backgroundColor: 'rgba(15, 23, 42, 0.05)',
        borderRadius: 60,
    },
    moonCrater: {
        position: 'absolute',
        borderRadius: 50,
        backgroundColor: 'rgba(0,0,0,0.06)',
    },
    moonShadow: {
        position: 'absolute',
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: 'rgba(2, 6, 23, 0.15)',
        top: -15,
        right: -45,
    },
    moonAura: {
        position: 'absolute',
        width: 160,
        height: 160,
        borderRadius: 80,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    textGroup: {
        alignItems: 'center',
        marginBottom: 60,
    },
    title: {
        fontSize: 48,
        fontWeight: '900',
        color: '#facc15',
        letterSpacing: -2,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        color: '#94a3b8',
        textAlign: 'center',
        lineHeight: 22,
        fontWeight: '500',
    },
    actionGroup: {
        width: '100%',
        gap: 16,
        alignItems: 'center',
    },
    inputWrapper: {
        width: '100%',
        height: 60,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        justifyContent: 'center',
        backgroundColor: 'transparent',
    },
    input: {
        flex: 1,
        paddingHorizontal: 20,
        color: '#ffffff',
        fontSize: 16,
        textAlign: 'center',
        fontWeight: '600',
    },
    mainButton: {
        width: '100%',
        height: 64,
        borderRadius: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        overflow: 'hidden',
        elevation: 0,
        shadowColor: '#06b6d4',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
    },
    buttonText: {
        color: '#0f172a',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 0.3,
    },
    skipLink: {
        paddingVertical: 10,
    },
    skipText: {
        color: '#475569',
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    footerSafeArea: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        pointerEvents: 'none',
    },
    footerQuote: {
        paddingBottom: 16,
        fontSize: 11,
        color: '#cbd5e1',
        textAlign: 'center',
        fontStyle: 'italic',
        paddingHorizontal: 40,
        lineHeight: 18,
        fontWeight: '600',
    },
    langChipWrap: {
        position: 'absolute',
        top: 0, right: 0,
        zIndex: 10,
        paddingTop: 8,
        paddingRight: 16,
    },
    langChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    langChipText: {
        color: '#94a3b8',
        fontSize: 12,
        fontWeight: '700',
    },
    langOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'center',
        paddingHorizontal: 40,
    },
    langSheet: {
        maxHeight: '65%',
        borderRadius: 20,
        backgroundColor: '#0b1120',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
    },
    langRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    langRowActive: {
        backgroundColor: 'rgba(255,255,255,0.04)',
    },
    langRowText: {
        color: '#e2e8f0',
        fontSize: 15,
        fontWeight: '600',
    },
    langRowSub: {
        color: '#475569',
        fontSize: 12,
        fontWeight: '600',
    },
});
