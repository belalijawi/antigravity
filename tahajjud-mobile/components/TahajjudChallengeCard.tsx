import React, { useEffect, useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Modal, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassBg as BlurView } from './GlassBg';
import { Trophy, Sparkles, X, Check } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { haptic } from '../utils/haptic';
import { TahajjudChallenge, ChallengeState } from '../utils/tahajjudChallenge';
import { t } from '../utils/i18n';

/**
 * Compact card on Home that surfaces:
 *   - A "Start 40-day challenge" CTA when no challenge is active
 *   - A progress indicator while one is in flight (X / 40 nights)
 *   - A celebratory state when completed
 * The card stays out of the way during the Tahajjud window — Night Home
 * has its own emphasis.
 */
export function TahajjudChallengeCard() {
    const { colors, blurIntensity, cardBg } = useTheme();
    const [state, setState] = useState<ChallengeState | null>(null);
    const [showStart, setShowStart] = useState(false);
    // What the NEXT challenge's target will be — shown before starting one
    // (either first-ever, or after finishing the last) so the escalation
    // (40 → 50 → 60...) is visible up front, not just once already in it.
    const [nextTarget, setNextTarget] = useState(TahajjudChallenge.BASE_TARGET);

    useEffect(() => {
        TahajjudChallenge.getState().then(setState).catch(() => {});
        TahajjudChallenge.getNextTarget().then(setNextTarget).catch(() => {});
        const unsub = TahajjudChallenge.subscribe(s => {
            setState(s);
            // A challenge just completed (or was reset) — refresh the preview
            // so it reflects the new escalated target immediately.
            TahajjudChallenge.getNextTarget().then(setNextTarget).catch(() => {});
        });
        return () => unsub();
    }, []);

    const handleStart = async () => {
        haptic.success();
        await TahajjudChallenge.start();
        setShowStart(false);
    };

    const handleAbandon = () => {
        Alert.alert(
            t('challenge40.endTitle'),
            t('challenge40.endBody'),
            [
                { text: t('btn.cancel'), style: 'cancel' },
                {
                    text: t('challenge40.endBtn'),
                    style: 'destructive',
                    onPress: async () => {
                        haptic.light();
                        await TahajjudChallenge.abandon();
                    },
                },
            ]
        );
    };

    // Active in-progress challenge
    if (state && !state.completedAt && !state.abandonedAt) {
        const remaining = TahajjudChallenge.daysRemaining(state);
        const progressPct = TahajjudChallenge.progressPercent(state);
        return (
            <Animated.View entering={FadeInDown.duration(500)} style={[styles.card, { borderColor: colors.accent + '40' }]}>
                <LinearGradient colors={[colors.accent + '15', 'transparent']} style={StyleSheet.absoluteFill} />
                <BlurView intensity={Math.round(15 * blurIntensity)} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />

                <View style={styles.cardHeader}>
                    <View style={[styles.iconWrap, { backgroundColor: colors.accent + '22', borderColor: colors.accent + '44' }]}>
                        <Trophy size={14} color={colors.accent} />
                    </View>
                    <Text style={[styles.kicker, { color: colors.accent }]}>{t('challenge40.kicker', { n: state.target })}</Text>
                    <TouchableOpacity onPress={handleAbandon} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <X size={14} color="#475569" />
                    </TouchableOpacity>
                </View>

                <Text style={styles.bigCount}>
                    <Text style={{ color: '#f1f5f9' }}>{state.progressDays.length}</Text>
                    <Text style={{ color: '#475569' }}> / {state.target}</Text>
                </Text>
                <Text style={styles.subText}>{t('challenge40.nightsToGo', { n: remaining })}</Text>

                {/* Progress bar */}
                <View style={[styles.progressTrack, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                    <View
                        style={[
                            styles.progressFill,
                            { backgroundColor: colors.accent, width: `${progressPct}%` },
                        ]}
                    />
                </View>
            </Animated.View>
        );
    }

    // Completed
    if (state?.completedAt) {
        return (
            <Animated.View entering={FadeInDown.duration(500)} style={[styles.card, { borderColor: '#22c55e55' }]}>
                <LinearGradient colors={['rgba(34,197,94,0.12)', 'transparent']} style={StyleSheet.absoluteFill} />
                <BlurView intensity={Math.round(15 * blurIntensity)} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />

                <View style={styles.cardHeader}>
                    <View style={[styles.iconWrap, { backgroundColor: 'rgba(34,197,94,0.18)', borderColor: 'rgba(34,197,94,0.4)' }]}>
                        <Check size={14} color="#22c55e" strokeWidth={3} />
                    </View>
                    <Text style={[styles.kicker, { color: '#22c55e' }]}>{t('challenge40.completeKicker', { n: state.target })}</Text>
                </View>

                <Text style={[styles.bigCount, { color: '#22c55e' }]}>{t('challenge40.mashaAllah')}</Text>
                <Text style={styles.subText}>{t('challenge40.completedOn', { date: state.completedAt })}</Text>

                <TouchableOpacity
                    onPress={() => TahajjudChallenge.reset()}
                    style={[styles.startBtn, { backgroundColor: colors.accent + '22', borderColor: colors.accent + '44' }]}
                >
                    <Text style={[styles.startBtnText, { color: colors.accent }]}>{t('challenge40.startNewBtn', { n: nextTarget })}</Text>
                </TouchableOpacity>
            </Animated.View>
        );
    }

    // No active challenge — show CTA
    return (
        <>
            <Animated.View entering={FadeInDown.duration(500)} style={[styles.card, { borderColor: 'rgba(255,255,255,0.06)' }]}>
                <BlurView intensity={Math.round(15 * blurIntensity)} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />

                <View style={styles.cardHeader}>
                    <View style={[styles.iconWrap, { backgroundColor: colors.accent + '15', borderColor: colors.accent + '33' }]}>
                        <Sparkles size={14} color={colors.accent} />
                    </View>
                    <Text style={[styles.kicker, { color: colors.accent }]}>{t('challenge40.kicker', { n: nextTarget })}</Text>
                </View>

                <Text style={styles.ctaText} maxFontSizeMultiplier={1.2}>
                    {t('challenge40.ctaText', { n: nextTarget })}
                </Text>

                <TouchableOpacity
                    onPress={() => setShowStart(true)}
                    activeOpacity={0.85}
                    style={[styles.startBtn, { backgroundColor: colors.accent }]}
                >
                    <Text style={[styles.startBtnText, { color: '#0a1228' }]} maxFontSizeMultiplier={1.2} numberOfLines={1}>{t('challenge40.startBtn')}</Text>
                </TouchableOpacity>
            </Animated.View>

            <Modal visible={showStart} animationType="fade" transparent onRequestClose={() => setShowStart(false)}>
                <View style={styles.modalRoot}>
                    <View style={[styles.modalCard, { borderColor: colors.accent + '33' }]}>
                        <LinearGradient colors={['#0a1228', '#040714']} style={StyleSheet.absoluteFill} />
                        <View style={[styles.iconWrapLarge, { backgroundColor: colors.accent + '22', borderColor: colors.accent + '44' }]}>
                            <Trophy size={28} color={colors.accent} />
                        </View>
                        <Text style={styles.modalTitle}>{t('challenge40.modalTitle', { n: nextTarget })}</Text>
                        <Text style={styles.modalBody}>
                            {t('challenge40.modalBody', { n: nextTarget })}
                        </Text>
                        <View style={styles.modalActions}>
                            <TouchableOpacity onPress={() => setShowStart(false)} style={styles.modalCancelBtn}>
                                <Text style={styles.modalCancelText}>{t('challenge40.maybeLater')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleStart}
                                style={[styles.modalConfirmBtn, { backgroundColor: colors.accent }]}
                            >
                                <Text style={styles.modalConfirmText}>{t('challenge40.imIn')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </>
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
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
    iconWrap: {
        width: 24, height: 24, borderRadius: 12, borderWidth: 1,
        alignItems: 'center', justifyContent: 'center',
    },
    kicker: { flex: 1, fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
    bigCount: { fontSize: 32, fontWeight: '800', marginBottom: 2 },
    subText: { color: '#64748b', fontSize: 12, fontWeight: '600', marginBottom: 12 },
    progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 2 },
    ctaText: { color: '#cbd5e1', fontSize: 13, lineHeight: 20, marginBottom: 14 },
    startBtn: {
        paddingVertical: 12, borderRadius: 12, alignItems: 'center',
        borderWidth: 1, borderColor: 'transparent',
    },
    startBtnText: { fontSize: 13, fontWeight: '800' },
    modalRoot: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
        alignItems: 'center', justifyContent: 'center', padding: 24,
    },
    modalCard: {
        width: '100%', borderRadius: 24, borderWidth: 1, padding: 28,
        alignItems: 'center', overflow: 'hidden',
    },
    iconWrapLarge: {
        width: 68, height: 68, borderRadius: 34, borderWidth: 1,
        alignItems: 'center', justifyContent: 'center', marginBottom: 18,
    },
    modalTitle: { color: '#f1f5f9', fontSize: 22, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
    modalBody: { color: '#94a3b8', fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 24 },
    modalActions: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
    modalCancelBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    modalCancelText: { color: '#94a3b8', fontSize: 14, fontWeight: '700' },
    modalConfirmBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 12 },
    modalConfirmText: { color: '#0a1228', fontSize: 14, fontWeight: '800' },
});
