import React, { useState, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Moon, Droplets, BookOpen, Check, ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, differenceInMinutes } from 'date-fns';
import { useTheme } from '../context/ThemeContext';
import { useQuranAudio } from '../context/QuranAudioContext';
import { haptic } from '../utils/haptic';
import { NightCalculation } from '../lib/prayer-times';
import { todayStr, PrayerHistory, emptyHistory } from './Tracker';
import { t } from '../utils/i18n';

interface Props {
    nightCalc: NightCalculation;
    onPrayedTahajjud: () => void;
    onSkip: () => void;
}

const WUDU_KEY_PREFIX = 'wudu-';

/**
 * Night-mode home screen — the app's face during the Tahajjud window.
 * Replaces the regular dashboard with a focused ritual stack:
 *   1. Awaken the heart (dhikr counter)
 *   2. Make wudu (toggle)
 *   3. Pray 2 rakats with optional Surah Mulk audio
 *   4. Make dua
 *   5. Log Tahajjud
 *
 * Calmer palette than daytime — deep navy, single accent. No carousels.
 */
export function NightHomeScreen({ nightCalc, onPrayedTahajjud, onSkip }: Props) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const audio = useQuranAudio();

    const [istighfarCount, setIstighfarCount] = useState(0);
    const [wuduDone, setWuduDone] = useState(false);
    const [recentDua, setRecentDua] = useState<string | null>(null);

    const fajrTime = format(nightCalc.nightEnd, 'h:mm a');
    const minsToFajr = Math.max(0, differenceInMinutes(nightCalc.nightEnd, new Date()));

    useEffect(() => {
        // Restore wudu state for today
        AsyncStorage.getItem(WUDU_KEY_PREFIX + todayStr())
            .then(v => setWuduDone(v === 'true')).catch(() => {});
        // Pull last journal entry's dua text for inspiration
        AsyncStorage.getItem('tahajjud_journal_v1').then(raw => {
            if (!raw) return;
            try {
                const entries = JSON.parse(raw);
                if (entries.length > 0 && entries[0].duaText?.trim()) {
                    setRecentDua(entries[0].duaText);
                }
            } catch { /* ignore */ }
        }).catch(() => {});
    }, []);

    const toggleWudu = async () => {
        haptic.light();
        const next = !wuduDone;
        setWuduDone(next);
        await AsyncStorage.setItem(WUDU_KEY_PREFIX + todayStr(), next ? 'true' : 'false');
    };

    const incrementIstighfar = () => {
        if (istighfarCount < 10) {
            haptic.light();
            setIstighfarCount(istighfarCount + 1);
        }
    };

    const playMulk = async () => {
        try {
            haptic.light();
            await audio.startPlaylist([67], 'Tahajjud — Surah Mulk');
        } catch {
            Alert.alert(t('nightHome.audioErrorTitle'), t('nightHome.audioErrorBody'));
        }
    };

    const handlePrayed = () => {
        haptic.success();
        onPrayedTahajjud();
    };

    return (
        <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
            <LinearGradient
                colors={['#040714', '#06091e', '#040714']}
                style={StyleSheet.absoluteFill}
            />

            <ScrollView
                contentContainerStyle={[
                    styles.content,
                    // Floating tab bar = 64pt tall + ~insets.bottom offset. Add
                    // a generous buffer so the "I prayed Tahajjud" button isn't
                    // hidden under it.
                    { paddingBottom: 64 + Math.max(insets.bottom, 14) + 32 },
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/* Hero — last third indicator */}
                <View>
                    <View style={styles.heroIcon}>
                        <Moon size={32} color={colors.accent} strokeWidth={1.5} />
                    </View>
                    <Text style={styles.heroKicker}>{t('nightHome.lastThirdKicker')}</Text>
                    <Text style={styles.heroSub}>
                        {t('nightHome.fajrIn', { time: minsToFajr < 60 ? `${minsToFajr} min` : `${Math.floor(minsToFajr / 60)}h ${minsToFajr % 60}m` })}
                    </Text>
                    <Text style={styles.heroFajr}>{fajrTime}</Text>
                </View>

                <View style={styles.divider} />

                {/* Step 1 — Dhikr */}
                <View>
                    <Step
                        n={1}
                        title={t('nightHome.step1Title')}
                        sub={t('nightHome.step1Sub', { n: 10 })}
                        done={istighfarCount >= 10}
                        accent={colors.accent}
                    />
                    <TouchableOpacity
                        onPress={incrementIstighfar}
                        activeOpacity={0.85}
                        style={[
                            styles.dhikrCard,
                            { borderColor: istighfarCount >= 10 ? colors.accent + '66' : colors.accent + '22' },
                        ]}
                    >
                        <Text style={[styles.dhikrArabic, { color: colors.accent }]}>أَسْتَغْفِرُ اللَّهَ</Text>
                        <Text style={[styles.dhikrTransliteration, { color: '#cbd5e1' }]}>Astaghfirullah</Text>
                        <View style={styles.dhikrCounter}>
                            <Text style={[styles.dhikrCount, { color: colors.accent }]}>
                                {istighfarCount} / 10
                            </Text>
                        </View>
                        {istighfarCount < 10 && (
                            <Text style={[styles.dhikrTap, { color: '#475569' }]}>{t('nightHome.tapToCount')}</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Step 2 — Wudu */}
                <View>
                    <Step
                        n={2}
                        title={t('nightHome.step2Title')}
                        sub={wuduDone ? t('nightHome.step2SubDone') : t('nightHome.step2SubPending')}
                        done={wuduDone}
                        accent={colors.accent}
                    />
                    <TouchableOpacity
                        onPress={toggleWudu}
                        activeOpacity={0.85}
                        style={[
                            styles.actionCard,
                            { borderColor: wuduDone ? colors.accent + '66' : 'rgba(255,255,255,0.08)',
                              backgroundColor: wuduDone ? colors.accent + '14' : 'rgba(255,255,255,0.03)' },
                        ]}
                    >
                        <Droplets size={20} color={wuduDone ? colors.accent : '#64748b'} />
                        <Text style={[styles.actionCardText, { color: wuduDone ? colors.accent : '#cbd5e1' }]}>
                            {wuduDone ? t('nightHome.wuduDoneBtn') : t('nightHome.wuduPendingBtn')}
                        </Text>
                        {wuduDone && <Check size={18} color={colors.accent} strokeWidth={3} />}
                    </TouchableOpacity>
                </View>

                {/* Step 3 — Pray */}
                <View>
                    <Step
                        n={3}
                        title={t('nightHome.step3Title')}
                        sub={t('nightHome.step3Sub')}
                        done={false}
                        accent={colors.accent}
                    />
                    <TouchableOpacity
                        onPress={playMulk}
                        activeOpacity={0.85}
                        style={[styles.actionCard, { borderColor: colors.accent + '33', backgroundColor: colors.accent + '08' }]}
                    >
                        <BookOpen size={20} color={colors.accent} />
                        <Text style={[styles.actionCardText, { color: colors.accent }]}>
                            {t('nightHome.playMulkBtn')}
                        </Text>
                        <ChevronRight size={16} color={colors.accent} />
                    </TouchableOpacity>
                </View>

                {/* Step 4 — Dua (with flashback if available) */}
                {recentDua && (
                    <View>
                        <Step
                            n={4}
                            title={t('nightHome.step4Title')}
                            sub={t('nightHome.step4Sub')}
                            done={false}
                            accent={colors.accent}
                        />
                        <View style={[styles.duaCard, { borderColor: 'rgba(255,255,255,0.06)' }]}>
                            <Text style={styles.duaText} numberOfLines={4}>
                                "{recentDua.slice(0, 200)}{recentDua.length > 200 ? '…' : ''}"
                            </Text>
                        </View>
                    </View>
                )}

                {/* Final — log Tahajjud */}
                <View>
                    <TouchableOpacity
                        onPress={handlePrayed}
                        activeOpacity={0.9}
                        style={[
                            styles.logBtn,
                            { backgroundColor: colors.accent, shadowColor: colors.accent },
                        ]}
                    >
                        <Check size={18} color="#0a1228" strokeWidth={3} />
                        <Text style={styles.logBtnText}>{t('nightHome.logBtnText')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={onSkip} style={styles.skipBtn}>
                        <Text style={styles.skipText}>{t('nightHome.skipToHome')}</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}

function Step({ n, title, sub, done, accent }: { n: number; title: string; sub: string; done: boolean; accent: string }) {
    return (
        <View style={styles.step}>
            <View style={[
                styles.stepBadge,
                done
                    ? { backgroundColor: accent, borderColor: accent }
                    : { borderColor: 'rgba(255,255,255,0.15)' },
            ]}>
                {done
                    ? <Check size={12} color="#0a1228" strokeWidth={3} />
                    : <Text style={[styles.stepNumber, { color: accent }]}>{n}</Text>
                }
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>{title}</Text>
                <Text style={styles.stepSub}>{sub}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    content: { padding: 24 },

    heroIcon: {
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: 'rgba(99,102,241,0.1)',
        borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)',
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 16,
    },
    heroKicker: { color: '#64748b', fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: 6 },
    heroSub: { color: '#cbd5e1', fontSize: 14, fontWeight: '600', marginBottom: 4 },
    heroFajr: { color: '#f1f5f9', fontSize: 28, fontWeight: '800' },

    divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 28 },

    step: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    stepBadge: {
        width: 26, height: 26, borderRadius: 13, borderWidth: 1.5,
        alignItems: 'center', justifyContent: 'center',
    },
    stepNumber: { fontSize: 12, fontWeight: '800' },
    stepTitle: { color: '#f1f5f9', fontSize: 15, fontWeight: '700' },
    stepSub: { color: '#64748b', fontSize: 12, marginTop: 2 },

    dhikrCard: {
        marginLeft: 38, marginBottom: 24,
        padding: 18, borderRadius: 16, borderWidth: 1,
        backgroundColor: 'rgba(255,255,255,0.02)',
        alignItems: 'center', gap: 6,
    },
    dhikrArabic: { fontSize: 26, fontFamily: 'AmiriQuran', textAlign: 'center', lineHeight: 42 },
    dhikrTransliteration: { fontSize: 13, fontWeight: '600', fontStyle: 'italic' },
    dhikrCounter: { marginTop: 8 },
    dhikrCount: { fontSize: 14, fontWeight: '800', letterSpacing: 1 },
    dhikrTap: { fontSize: 11, fontWeight: '600', marginTop: 2 },

    actionCard: {
        marginLeft: 38, marginBottom: 24,
        flexDirection: 'row', alignItems: 'center', gap: 12,
        padding: 16, borderRadius: 14, borderWidth: 1,
    },
    actionCardText: { flex: 1, fontSize: 14, fontWeight: '700' },

    duaCard: {
        marginLeft: 38, marginBottom: 24,
        padding: 16, borderRadius: 14, borderWidth: 1,
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    duaText: { color: '#94a3b8', fontSize: 13, lineHeight: 21, fontStyle: 'italic' },

    logBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        paddingVertical: 18, borderRadius: 18, marginTop: 8,
        shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
        elevation: 12,
    },
    logBtnText: { color: '#0a1228', fontSize: 16, fontWeight: '800' },

    skipBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 8 },
    skipText: { color: '#475569', fontSize: 13, fontWeight: '600' },
});

// Re-export so HomeTab gating logic is co-located.
// Returns true during the last third AND during a 3-hour grace window after
// Fajr, so the "Did you pray?" prompt (and log button) stays available for
// users who prayed at 3 AM but only open the app at 7 AM.
export function isInTahajjudWindow(nightCalc: NightCalculation | null, now: Date): boolean {
    if (!nightCalc) return false;
    const graceEnd = new Date(nightCalc.nightEnd.getTime() + 3 * 60 * 60 * 1000);
    return now >= nightCalc.lastThirdStart && now < graceEnd;
}
