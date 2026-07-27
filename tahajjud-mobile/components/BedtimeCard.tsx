import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, DeviceEventEmitter } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassBg as BlurView } from './GlassBg';
import { Bed, Moon } from 'lucide-react-native';
import { format, differenceInMinutes } from 'date-fns';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { SleepIntelligence, SleepSuggestion } from '../services/SleepIntelligence';
import { NightCalculation } from '../lib/prayer-times';
import { t } from '../utils/i18n';

interface Props { nightCalc: NightCalculation | null; }

/**
 * Bedtime intelligence card on Home.
 *
 * - If user hasn't enabled the feature: shows nothing (settings opt-in)
 * - Otherwise: today's bedtime, wake time, source badge ("via Apple Health · 14 nights")
 * - Hides automatically once it's already past the suggested bedtime tonight
 */
export function BedtimeCard({ nightCalc }: Props) {
    const { colors, blurIntensity, cardBg } = useTheme();
    const [enabled, setEnabled] = useState<boolean | null>(null);
    const [suggestion, setSuggestion] = useState<SleepSuggestion | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        SleepIntelligence.getEnabled().then(setEnabled).catch(() => setEnabled(false));
        // React to toggle changes from Settings without needing a remount.
        const sub = DeviceEventEmitter.addListener('sleepIntelChanged', (val: boolean) => {
            setEnabled(val);
        });
        return () => sub.remove();
    }, []);

    useEffect(() => {
        if (!enabled || !nightCalc) return;
        let active = true;
        setLoading(true);
        SleepIntelligence.getSuggestion(nightCalc.lastThirdStart, nightCalc.nightEnd)
            .then(s => { if (active) setSuggestion(s); })
            .catch(() => {})
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [enabled, nightCalc?.lastThirdStart?.getTime(), nightCalc?.nightEnd?.getTime()]);

    if (!enabled) return null;
    if (loading) {
        return (
            <View style={[styles.card, { borderColor: 'rgba(255,255,255,0.06)' }]}>
                <ActivityIndicator color={colors.accent} />
            </View>
        );
    }
    if (!suggestion) return null;

    const minsTillBed = differenceInMinutes(suggestion.bedtime, new Date());
    // Hide after bedtime has passed (no point nagging at 1am)
    if (minsTillBed < -120) return null;

    const sourceLabel = suggestion.source === 'healthkit'
        ? t('bedtime.sourceHealth', { n: suggestion.nightsAnalyzed })
        : suggestion.source === 'self-reported'
            ? t('bedtime.sourceSelfReported')
            : t('bedtime.sourceDefault');

    const bedtimeDisplay = format(suggestion.bedtime, 'h:mm a');
    const wakeDisplay = format(suggestion.suggestedWake, 'h:mm a');
    // Estimate the final morning wake-up: Fajr + the 30% of sleep that
    // happens AFTER the Tahajjud break. This is when the user will
    // naturally finish their second sleep block and start their day.
    const PRAY_BLOCK_MIN = 35;
    const postFajrSleepMin = Math.max(0, Math.round(suggestion.avgSleepMinutes * 0.3));
    const morningWake = nightCalc
        ? new Date(nightCalc.nightEnd.getTime() + (PRAY_BLOCK_MIN + postFajrSleepMin) * 60 * 1000)
        : null;
    const morningWakeDisplay = morningWake ? format(morningWake, 'h:mm a') : '—';

    let countdown: string;
    if (minsTillBed <= 0) {
        countdown = t('bedtime.pastBedtimeBy', { n: Math.abs(minsTillBed) });
    } else if (minsTillBed < 60) {
        countdown = t('bedtime.inMin', { n: minsTillBed });
    } else {
        countdown = t('bedtime.inHm', { h: Math.floor(minsTillBed / 60), m: minsTillBed % 60 });
    }

    return (
        <Animated.View
            entering={FadeInDown.duration(500)}
            style={[styles.card, { borderColor: colors.accent + '30' }]}
        >
            <LinearGradient colors={[colors.accent + '12', 'transparent']} style={StyleSheet.absoluteFill} />
            <BlurView intensity={Math.round(15 * blurIntensity)} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />

            <View style={styles.header}>
                <View style={[styles.iconWrap, { backgroundColor: colors.accent + '22', borderColor: colors.accent + '44' }]}>
                    <Bed size={14} color={colors.accent} />
                </View>
                <Text style={[styles.kicker, { color: colors.accent }]}>{t('bedtime.kicker')}</Text>
            </View>

            {/* Four phases — biphasic sleep with a Tahajjud-Fajr interruption */}
            <View style={styles.timesRow}>
                <View style={styles.timeBlock}>
                    <Text style={styles.timeLabel}>{t('bedtime.step1')}</Text>
                    <Text style={styles.timeValue}>{bedtimeDisplay}</Text>
                    <Text style={[styles.timeSub, { color: minsTillBed > 0 ? colors.accent : '#475569' }]}>
                        {countdown}
                    </Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.timeBlock}>
                    <View style={styles.wakeHeader}>
                        <Moon size={11} color={colors.accent} />
                        <Text style={styles.timeLabel}>{t('bedtime.step2')}</Text>
                    </View>
                    <Text style={styles.timeValue}>{wakeDisplay}</Text>
                    <Text style={[styles.timeSub, { color: colors.accent }]}>{t('bedtime.wakeBriefly')}</Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.timeBlock}>
                    <Text style={styles.timeLabel}>{t('bedtime.step3')}</Text>
                    <Text style={styles.timeValue}>{nightCalc ? format(nightCalc.nightEnd, 'h:mm a') : '—'}</Text>
                    <Text style={styles.timeSub}>{t('bedtime.morningPrayer')}</Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.timeBlock}>
                    <Text style={styles.timeLabel}>{t('bedtime.step4')}</Text>
                    <Text style={styles.timeValue}>{morningWakeDisplay}</Text>
                    <Text style={styles.timeSub}>{t('bedtime.startYourDay')}</Text>
                </View>
            </View>

            {/* Plain-language explanation of the routine */}
            <Text style={[styles.flow, { color: colors.secondaryText }]}>
                {t('bedtime.flow')}
            </Text>

            <Text style={styles.source}>
                {t('bedtime.sourceSummary', { h: Math.round(suggestion.avgSleepMinutes / 60 * 10) / 10, source: sourceLabel })}
            </Text>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    card: {
        marginHorizontal: 16,
        marginTop: 12,
        marginBottom: 4,
        padding: 18,
        borderRadius: 20,
        borderWidth: 1,
        overflow: 'hidden',
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
    iconWrap: {
        width: 24, height: 24, borderRadius: 12, borderWidth: 1,
        alignItems: 'center', justifyContent: 'center',
    },
    kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
    timesRow: { flexDirection: 'row', alignItems: 'stretch', marginBottom: 12 },
    timeBlock: { flex: 1, gap: 4 },
    wakeHeader: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    timeLabel: { color: '#475569', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
    timeValue: { color: '#f1f5f9', fontSize: 24, fontWeight: '800' },
    timeSub: { color: '#64748b', fontSize: 11, fontWeight: '600' },
    divider: { width: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 16 },
    flow: {
        fontSize: 12,
        lineHeight: 17,
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: 4,
        marginBottom: 4,
        paddingHorizontal: 8,
    },
    source: { color: '#475569', fontSize: 11, fontWeight: '600', textAlign: 'center', marginTop: 4 },
});
