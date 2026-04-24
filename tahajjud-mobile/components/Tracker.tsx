import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { WidgetPromo, shouldShowWidgetPromo } from './WidgetPromo';
import { TahajjudJournalModal } from './TahajjudJournalModal';
import { TahajjudLetterModal } from './TahajjudLetterModal';
import { AccountabilityPartner } from '../utils/accountabilityPartner';
import { Flame, Trophy, AlertCircle } from "lucide-react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { subDays } from "date-fns";
import { useTheme } from '../context/ThemeContext';
import { usePurchases } from '../context/PurchasesContext';
import { haptic } from '../utils/haptic';

const TRACKER_KEY    = 'prayer-tracker-v2';
const BEST_STREAK_KEY = 'tahajjud-best-streak';
const OLD_TRACKER_KEY = 'tahajjud-tracker';

export type PrayerKey = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha' | 'tahajjud';

export const PRAYERS: { key: PrayerKey; label: string }[] = [
    { key: 'fajr',     label: 'Fajr'     },
    { key: 'dhuhr',    label: 'Dhuhr'    },
    { key: 'asr',      label: 'Asr'      },
    { key: 'maghrib',  label: 'Maghrib'  },
    { key: 'isha',     label: 'Isha'     },
    { key: 'tahajjud', label: 'Tahajjud' },
];

const MILESTONES = [
    { days: 3,   label: '3',   color: '#94a3b8' },
    { days: 7,   label: '7',   color: '#f59e0b' },
    { days: 30,  label: '30',  color: '#f97316' },
    { days: 100, label: '100', color: '#a855f7' },
];

export type PrayerHistory = Record<PrayerKey, string[]>;

export function emptyHistory(): PrayerHistory {
    return { fajr: [], dhuhr: [], asr: [], maghrib: [], isha: [], tahajjud: [] };
}

function getMilestone(streak: number) {
    for (let i = MILESTONES.length - 1; i >= 0; i--) {
        if (streak >= MILESTONES[i].days) return MILESTONES[i];
    }
    return null;
}

export function todayStr() {
    return new Date().toISOString().split('T')[0];
}

export function isLoggedToday(dates: string[]) {
    return dates.some(d => d.split('T')[0] === todayStr());
}

export function calculateStreak(dates: string[]): number {
    if (dates.length === 0) return 0;
    const today     = todayStr();
    const yesterday = subDays(new Date(), 1).toISOString().split('T')[0];
    const hasToday     = dates.some(d => d.split('T')[0] === today);
    const hasYesterday = dates.some(d => d.split('T')[0] === yesterday);
    if (!hasToday && !hasYesterday) return 0;
    let count = 0;
    let check = hasToday ? new Date() : subDays(new Date(), 1);
    while (true) {
        const str = check.toISOString().split('T')[0];
        if (!dates.some(d => d.split('T')[0] === str)) break;
        count++;
        check = subDays(check, 1);
    }
    return count;
}

export function Tracker() {
    const { colors, cardBg, blurIntensity } = useTheme();
    const { isPremium } = usePurchases();
    const [history, setHistory]           = useState<PrayerHistory>(emptyHistory());
    const [streaks, setStreaks]            = useState<Record<PrayerKey, number>>({
        fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0, tahajjud: 0,
    });
    const [bestStreak, setBestStreak]     = useState(0);
    const [showWidgetPromo, setShowWidgetPromo] = useState(false);
    const [showJournal, setShowJournal] = useState(false);
    const [showLetter, setShowLetter] = useState(false);

    useEffect(() => { load(); }, []);

    const load = async () => {
        try {
            const [raw, rawBest, oldRaw] = await Promise.all([
                AsyncStorage.getItem(TRACKER_KEY),
                AsyncStorage.getItem(BEST_STREAK_KEY),
                AsyncStorage.getItem(OLD_TRACKER_KEY),
            ]);
            let parsed: PrayerHistory = emptyHistory();
            if (raw) {
                parsed = { ...emptyHistory(), ...JSON.parse(raw) };
            } else if (oldRaw) {
                parsed.tahajjud = JSON.parse(oldRaw);
                await AsyncStorage.setItem(TRACKER_KEY, JSON.stringify(parsed));
            }
            setHistory(parsed);
            recalcStreaks(parsed);
            if (rawBest) setBestStreak(parseInt(rawBest, 10));
        } catch (e) {
            console.error('Failed to load tracker', e);
        }
    };

    const recalcStreaks = (h: PrayerHistory) => {
        const s = {} as Record<PrayerKey, number>;
        for (const p of PRAYERS) s[p.key] = calculateStreak(h[p.key]);
        setStreaks(s);
    };

    const save = async (updated: PrayerHistory) => {
        setHistory(updated);
        recalcStreaks(updated);
        await AsyncStorage.setItem(TRACKER_KEY, JSON.stringify(updated));

        // Update best Tahajjud streak
        const s = calculateStreak(updated.tahajjud);
        const prev = await AsyncStorage.getItem(BEST_STREAK_KEY);
        const prevBest = prev ? parseInt(prev, 10) : 0;
        if (s > prevBest) {
            setBestStreak(s);
            await AsyncStorage.setItem(BEST_STREAK_KEY, s.toString());
        }
    };

    const logPrayer = async (key: PrayerKey) => {
        if (isLoggedToday(history[key])) return;
        haptic.light();
        const isFirstTahajjudEver = key === 'tahajjud' && history.tahajjud.length === 0;
        const updated: PrayerHistory = {
            ...history,
            [key]: [...history[key], new Date().toISOString()],
        };
        await save(updated);
        if (key === 'tahajjud') {
            // Log for accountability partner
            AccountabilityPartner.logTahajjudForPartner().catch(() => {});
            // Premium → full journal, free → simple letter
            if (isPremium) {
                setShowJournal(true);
            } else {
                setShowLetter(true);
            }
            if (isFirstTahajjudEver) {
                const show = await shouldShowWidgetPromo();
                if (show) setShowWidgetPromo(true);
            }
        }
    };

    const unlogPrayer = (key: PrayerKey) => {
        if (!isLoggedToday(history[key])) return;
        Alert.alert(
            'Remove log?',
            `Remove today's ${PRAYERS.find(p => p.key === key)?.label} log?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        haptic.light();
                        const today = todayStr();
                        const updated: PrayerHistory = {
                            ...history,
                            [key]: history[key].filter(d => d.split('T')[0] !== today),
                        };
                        await save(updated);
                    },
                },
            ]
        );
    };

    // Yesterday's missed prayers
    const yesterday = subDays(new Date(), 1).toISOString().split('T')[0];
    const missedYesterday = PRAYERS.filter(
        p => !history[p.key].some(d => d.split('T')[0] === yesterday)
    );

    const tahajjudStreak = streaks.tahajjud;
    const milestone      = getMilestone(tahajjudStreak);
    const todayCount     = PRAYERS.filter(p => isLoggedToday(history[p.key])).length;

    return (
        <>
        <View style={styles.container}>
            <LinearGradient
                colors={[colors.shadow, 'rgba(79, 70, 229, 0.05)', 'transparent']}
                style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            />
            <BlurView intensity={Math.round(20 * blurIntensity)} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />

            <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.streakSide}>
                        <View style={styles.iconRow}>
                            {tahajjudStreak >= 3
                                ? <Flame size={14} color={milestone?.color ?? colors.accent} />
                                : <Trophy size={14} color={tahajjudStreak > 0 ? colors.accent : colors.secondaryText} />
                            }
                            <Text style={[styles.streakValue, { color: milestone?.color ?? colors.accent }]}>
                                {tahajjudStreak}
                            </Text>
                            <Text style={[styles.streakUnit, { color: colors.secondaryText }]}>
                                {tahajjudStreak === 1 ? 'day' : 'days'}
                            </Text>
                        </View>
                        <Text style={[styles.streakLabel, { color: colors.secondaryText }]}>Tahajjud streak</Text>
                    </View>

                    <View style={styles.todaySide}>
                        <Text style={[styles.todayCount, { color: todayCount === 6 ? colors.success : colors.accent }]}>
                            {todayCount}/6
                        </Text>
                        <Text style={[styles.todayLabel, { color: colors.secondaryText }]}>today</Text>
                    </View>
                </View>

                {/* Milestone badges */}
                <View style={styles.milestonesRow}>
                    {MILESTONES.map(m => (
                        <View
                            key={m.days}
                            style={[
                                styles.badge,
                                tahajjudStreak >= m.days
                                    ? { backgroundColor: m.color + '22', borderColor: m.color + '66' }
                                    : { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }
                            ]}
                        >
                            <Text style={[styles.badgeText, { color: tahajjudStreak >= m.days ? m.color : '#475569' }]}>
                                {m.label}
                            </Text>
                        </View>
                    ))}
                </View>

                {/* Yesterday missed banner */}
                {missedYesterday.length > 0 && missedYesterday.length < 6 && (
                    <View style={styles.missedBanner}>
                        <AlertCircle size={11} color="#f59e0b" />
                        <Text style={styles.missedText}>
                            Missed yesterday: {missedYesterday.map(p => p.label).join(', ')}
                        </Text>
                    </View>
                )}

                {/* Prayer timeline */}
                <View style={styles.timelineContainer}>
                    {/* Track line */}
                    <View style={styles.trackLine} />

                    {/* Nodes row */}
                    <View style={styles.nodesRow}>
                        {PRAYERS.map(p => {
                            const logged     = isLoggedToday(history[p.key]);
                            const isTahajjud = p.key === 'tahajjud';
                            const streak     = streaks[p.key];
                            const nodeColor  = logged
                                ? (isTahajjud ? colors.accent : colors.success)
                                : 'transparent';
                            const borderColor = logged
                                ? nodeColor
                                : (isTahajjud ? colors.accent + '55' : 'rgba(255,255,255,0.20)');
                            return (
                                <TouchableOpacity
                                    key={p.key}
                                    onPress={() => logPrayer(p.key)}
                                    onLongPress={() => unlogPrayer(p.key)}
                                    delayLongPress={500}
                                    style={styles.nodeWrapper}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.nodeCircle, { backgroundColor: nodeColor, borderColor }]}>
                                        {logged && <Text style={styles.nodeCheck}>✓</Text>}
                                    </View>
                                    <Text style={[styles.nodeLabel, { color: logged ? (isTahajjud ? colors.accent : colors.success) : colors.secondaryText }]} numberOfLines={1}>
                                        {p.label}
                                    </Text>
                                    <Text style={[styles.nodeStreak, { color: streak > 0 ? '#64748b' : 'transparent' }]}>
                                        {streak > 0 ? `${streak}d` : '·'}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                <Text style={[styles.hint, { color: '#334155' }]}>Tap to log · Hold to undo</Text>
            </View>
        </View>

        {showWidgetPromo && (
            <WidgetPromo onDismiss={() => setShowWidgetPromo(false)} />
        )}
        <TahajjudJournalModal visible={showJournal} onClose={() => setShowJournal(false)} />
        <TahajjudLetterModal visible={showLetter} onClose={() => setShowLetter(false)} />
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        borderRadius: 20,
        overflow: 'hidden',
    },
    content: {
        padding: 16,
        gap: 12,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    streakSide: { gap: 2 },
    iconRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 4,
    },
    streakValue: {
        fontSize: 26,
        fontWeight: '900',
    },
    streakUnit: {
        fontSize: 12,
        fontWeight: '600',
    },
    streakLabel: {
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    todaySide: {
        alignItems: 'flex-end',
        gap: 2,
    },
    todayCount: {
        fontSize: 22,
        fontWeight: '800',
    },
    todayLabel: {
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    milestonesRow: {
        flexDirection: 'row',
        gap: 6,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        borderWidth: 1,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '700',
    },
    missedBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 7,
        paddingHorizontal: 10,
        borderRadius: 10,
        backgroundColor: 'rgba(245,158,11,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(245,158,11,0.20)',
    },
    missedText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#f59e0b',
        flex: 1,
    },
    timelineContainer: {
        position: 'relative',
        paddingTop: 4,
        paddingBottom: 4,
    },
    trackLine: {
        position: 'absolute',
        top: 20, // half of nodeCircle height (32/2) + paddingTop (4)
        left: '8%',
        right: '8%',
        height: 2,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    nodesRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    nodeWrapper: {
        flex: 1,
        alignItems: 'center',
        gap: 4,
    },
    nodeCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    nodeCheck: {
        color: '#0a0f1e',
        fontSize: 13,
        fontWeight: '900',
    },
    nodeLabel: {
        fontSize: 9,
        fontWeight: '700',
        textAlign: 'center',
    },
    nodeStreak: {
        fontSize: 9,
        fontWeight: '600',
    },
    hint: {
        fontSize: 10,
        textAlign: 'center',
    },
});
