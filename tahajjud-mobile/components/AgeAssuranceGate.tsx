/**
 * Retroactive age assurance for users who installed BEFORE this gate
 * existed. New installs answer this as part of OnboardingFlow; existing
 * users who were already onboarded (and so skip that flow entirely) never
 * saw the question — this screen closes that gap by asking on next launch,
 * before MainApp mounts. Same copy, same slider, same on-device-only,
 * pass/fail-only persistence as the onboarding version — see utils/ageGate.ts.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { CalendarDays } from 'lucide-react-native';
import Slider from '@react-native-community/slider';
import { useTheme } from '../context/ThemeContext';
import { haptic } from '../utils/haptic';
import { track } from '../utils/analytics';
import { t } from '../utils/i18n';
import { APP_URLS, localizedUrl } from '../utils/urls';
import { MIN_COMMUNITY_AGE, MAX_AGE_SLIDER, meetsCommunityAge, setAgeStatus } from '../utils/ageGate';

interface Props {
    onComplete: () => void;
}

export function AgeAssuranceGate({ onComplete }: Props) {
    const { colors } = useTheme();
    const [age, setAge] = useState(MIN_COMMUNITY_AGE);
    const [ageBlocked, setAgeBlocked] = useState(false);

    return (
        <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
            <LinearGradient colors={['#040714', '#07091e', '#040714']} style={StyleSheet.absoluteFill} />

            <View style={styles.content}>
                <View style={[styles.iconWrap, { backgroundColor: colors.accent + '15', borderColor: colors.accent + '33' }]}>
                    <CalendarDays size={40} color={colors.accent} strokeWidth={1.5} />
                </View>
                <Text style={[styles.title, { color: colors.primaryText }]}>{t('onboard.age.title')}</Text>
                <Text style={[styles.body, { color: colors.secondaryText }]}>{t('onboard.age.requirement')}</Text>
            </View>

            <View style={styles.footer}>
                {ageBlocked ? (
                    <>
                        <Text style={[styles.blockedBody, { color: colors.primaryText }]}>
                            {t('onboard.age.blocked')}
                        </Text>
                        <TouchableOpacity
                            style={[styles.socialBtn, { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }]}
                            onPress={() => { haptic.light(); setAgeBlocked(false); setAge(MIN_COMMUNITY_AGE); }}
                            activeOpacity={0.85}
                        >
                            <Text style={[styles.socialBtnText, { color: colors.primaryText }]}>{t('onboard.age.change')}</Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <View style={styles.ageDisplay}>
                            <Text style={[styles.ageNumber, { color: colors.primaryText }]}>{age}</Text>
                        </View>
                        <Slider
                            style={styles.ageSlider}
                            minimumValue={MIN_COMMUNITY_AGE}
                            maximumValue={MAX_AGE_SLIDER}
                            step={1}
                            value={age}
                            onValueChange={(v: number) => {
                                const rounded = Math.round(v);
                                setAge(prev => {
                                    if (rounded !== prev) haptic.selection();
                                    return rounded;
                                });
                            }}
                            minimumTrackTintColor={colors.accent}
                            maximumTrackTintColor="rgba(255,255,255,0.15)"
                            thumbTintColor={colors.accent}
                        />
                        <View style={styles.ageBounds}>
                            <Text style={[styles.ageBoundText, { color: colors.secondaryText }]}>{MIN_COMMUNITY_AGE}</Text>
                            <Text style={[styles.ageBoundText, { color: colors.secondaryText }]}>{MAX_AGE_SLIDER}</Text>
                        </View>
                        <Text style={[styles.ageNote, { color: colors.secondaryText }]}>
                            {t('onboard.age.body')}
                        </Text>
                        <TouchableOpacity
                            style={[styles.cta, { backgroundColor: colors.accent, marginTop: 18 }]}
                            onPress={async () => {
                                haptic.light();
                                // Only the pass/fail result is persisted — the
                                // age itself never leaves this state.
                                const passed = meetsCommunityAge(age);
                                await setAgeStatus(passed);
                                if (!passed) {
                                    track('age_gate_retroactive_blocked');
                                    setAgeBlocked(true);
                                    return;
                                }
                                track('age_gate_retroactive_passed');
                                onComplete();
                            }}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.ctaText}>{t('btn.continue')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => Linking.openURL(localizedUrl(APP_URLS.terms))}
                            hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
                        >
                            <Text style={[styles.termsText, { color: colors.secondaryText }]}>
                                {t('onboard.age.terms')}
                            </Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, alignItems: 'center' },
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
    blockedBody: {
        fontSize: 15, lineHeight: 24, fontWeight: '500',
        textAlign: 'center', marginBottom: 18,
    },
    footer: {
        width: '100%',
        paddingHorizontal: 24,
        paddingBottom: Platform.OS === 'ios' ? 12 : 24,
    },
    ageDisplay: { alignItems: 'center', marginBottom: 8 },
    ageNumber: { fontSize: 56, fontWeight: '800' },
    ageSlider: { width: '100%', height: 40 },
    ageBounds: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch', marginTop: -4 },
    ageBoundText: { fontSize: 12, fontWeight: '600' },
    ageNote: { fontSize: 12.5, lineHeight: 17, textAlign: 'center', marginTop: 16, paddingHorizontal: 8 },
    termsText: { fontSize: 11.5, lineHeight: 16, textAlign: 'center', marginTop: 14, textDecorationLine: 'underline' },
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
});
