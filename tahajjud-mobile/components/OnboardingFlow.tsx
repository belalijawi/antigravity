/**
 * Multi-step onboarding shown ONCE on first launch (after the welcome / name
 * screen). Walks the user through:
 *
 *   1. What is Tahajjud
 *   2. The "last third" gate concept
 *   3. Location permission (for prayer times)
 *   4. Notification permission (for the Tahajjud reminder)
 *   5. Optional: pick a calculation method (or auto-detect)
 *   6. Done
 *
 * Persists `onboarding_complete_v1` so it never reappears for the same user.
 * Skippable on every step.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Moon, MapPin, Bell, BookHeart, ChevronRight, Check } from 'lucide-react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { SlideInRight, SlideOutLeft } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { haptic } from '../utils/haptic';
import Paywall from './Paywall';

const STORAGE_KEY = 'onboarding_complete_v1';

interface Slide {
    icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
    title: string;
    body: string;
    cta?: string;
    skip?: string;
    action?: 'location' | 'notifications' | 'premium' | null;
}

const SLIDES: Slide[] = [
    {
        icon: Moon,
        title: 'What is Tahajjud?',
        body: 'Tahajjud is the optional night prayer in the last third of the night — when Allah descends to the lowest heaven and calls out, "Who asks of Me, that I may give him? Who seeks My forgiveness, that I may forgive him?" (Bukhari).',
        cta: 'Continue',
    },
    {
        icon: BookHeart,
        title: 'Your Nightly Gate',
        body: 'Tahajjud+ calculates the precise window of the last third every night and gently reminds you when the gate opens — so you never miss it.',
        cta: 'Sounds good',
    },
    {
        icon: MapPin,
        title: 'Where are you?',
        body: "We need your location to calculate accurate prayer times and the start of your last third. Your location stays on-device — we never send it anywhere.",
        cta: 'Allow location',
        skip: 'Not now',
        action: 'location',
    },
    {
        icon: Bell,
        title: 'Wake at the right moment',
        body: "We'll send a quiet notification a few minutes before the last third begins. You'll never sleep through it again.",
        cta: 'Enable reminders',
        skip: 'Not now',
        action: 'notifications',
    },
    {
        // Premium step renders the real Paywall component (see early return);
        // these fields are placeholders since the slide UI isn't used for it.
        // This is the LAST step — onboarding ends when the paywall is
        // accepted or skipped, then the user lands in the app.
        icon: Moon,
        title: 'Unlock the full experience',
        body: '',
        action: 'premium',
    },
];

interface Props {
    onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: Props) {
    const { colors } = useTheme();
    const [step, setStep] = useState(0);

    const slide = SLIDES[step];
    const Icon = slide.icon;
    const isLast = step === SLIDES.length - 1;

    const finish = async () => {
        try { await AsyncStorage.setItem(STORAGE_KEY, 'true'); } catch { /* ignore */ }
        haptic.success();
        onComplete();
    };

    const next = () => {
        haptic.light();
        if (isLast) { finish(); return; }
        setStep(s => s + 1);
    };

    const handleAction = async () => {
        if (slide.action === 'location') {
            try { await Location.requestForegroundPermissionsAsync(); } catch { /* ignore */ }
        } else if (slide.action === 'notifications') {
            try {
                const res = await Notifications.requestPermissionsAsync({
                    ios: { allowAlert: true, allowBadge: true, allowSound: true },
                });
                if (res.status === 'granted') {
                    import('../utils/accountabilityPartner')
                        .then(m => m.saveExpoPushToken())
                        .catch(() => { /* ignore */ });
                }
            } catch { /* ignore */ }
        }
        next();
    };

    // Premium step uses the real Paywall (same as Settings), fitted into the
    // onboarding flow — its X / successful purchase both advance onboarding.
    if (slide.action === 'premium') {
        return <Paywall onClose={next} />;
    }

    return (
        <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
            <LinearGradient
                colors={['#040714', '#07091e', '#040714']}
                style={StyleSheet.absoluteFill}
            />

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

                <Text style={[styles.title, { color: colors.primaryText }]}>{slide.title}</Text>
                <Text style={[styles.body, { color: colors.secondaryText }]}>{slide.body}</Text>
            </Animated.View>

            <View style={styles.footer}>
                <TouchableOpacity
                    onPress={slide.action ? handleAction : next}
                    style={[styles.cta, { backgroundColor: colors.accent, shadowColor: colors.accent }]}
                    activeOpacity={0.85}
                >
                    <Text style={styles.ctaText}>{slide.cta ?? 'Continue'}</Text>
                    {isLast ? (
                        <Check size={18} color="#0a1228" strokeWidth={3} />
                    ) : (
                        <ChevronRight size={18} color="#0a1228" strokeWidth={3} />
                    )}
                </TouchableOpacity>

                {slide.skip ? (
                    <TouchableOpacity onPress={slide.action ? handleAction : next} style={styles.skip} hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}>
                        <Text style={[styles.skipText, { color: colors.secondaryText }]}>{slide.skip}</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={{ height: 24 }} />
                )}
            </View>
        </SafeAreaView>
    );
}

/** Has the user completed onboarding? */
export async function hasCompletedOnboarding(): Promise<boolean> {
    try { return (await AsyncStorage.getItem(STORAGE_KEY)) === 'true'; }
    catch { return true; /* fail-open — don't trap users */ }
}

const styles = StyleSheet.create({
    root: { flex: 1, alignItems: 'center' },
    dots: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 16,
        marginBottom: 32,
        alignItems: 'center',
    },
    dot: { height: 6, borderRadius: 3 },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    iconWrap: {
        width: 96, height: 96, borderRadius: 48,
        borderWidth: 1,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 32,
    },
    title: {
        fontSize: 28, fontWeight: '900',
        letterSpacing: -0.5, textAlign: 'center',
        marginBottom: 18,
    },
    body: {
        fontSize: 15, lineHeight: 24, fontWeight: '500',
        textAlign: 'center',
        maxWidth: 380,
    },
    footer: {
        width: '100%',
        paddingHorizontal: 24,
        paddingBottom: Platform.OS === 'ios' ? 12 : 24,
    },
    cta: {
        flexDirection: 'row',
        alignItems: 'center', justifyContent: 'center', gap: 8,
        paddingVertical: 16, borderRadius: 18,
        shadowOpacity: 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 8 },
        elevation: 8,
    },
    ctaText: { color: '#0a1228', fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
    skip: { alignItems: 'center', paddingVertical: 14, marginTop: 8 },
    skipText: { fontSize: 14, fontWeight: '600' },
    contentPremium: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingHorizontal: 24,
        paddingTop: 4,
        width: '100%',
    },
    premiumSub: {
        fontSize: 14,
        fontWeight: '500',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 18,
        paddingTop: 4,
    },
    featureList: {
        width: '100%',
        gap: 10,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 14,
        borderWidth: 1,
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    featureIcon: {
        width: 34,
        height: 34,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    featureLabel: {
        fontSize: 14,
        fontWeight: '700',
    },
    featureDesc: {
        fontSize: 11,
        fontWeight: '500',
        marginTop: 1,
    },
    pkgBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
        marginBottom: -1,
        marginLeft: 12,
    },
    pkgBadgeText: { fontSize: 10, fontWeight: '900', color: '#000' },
    pkgCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 14,
        padding: 14,
        gap: 12,
        backgroundColor: 'rgba(255,255,255,0.04)',
    },
    pkgTitle: { fontSize: 14, fontWeight: '800' },
    pkgDesc:  { fontSize: 11, fontWeight: '500', marginTop: 2 },
    pkgPrice: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pkgPriceText: { fontSize: 13, fontWeight: '900', color: '#000' },
});
