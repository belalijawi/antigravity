import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, Pressable, TouchableOpacity,
    ScrollView, Platform, Vibration, Modal, TextInput,
    KeyboardAvoidingView, Alert,
} from 'react-native';
import { GlassBg as BlurView } from './GlassBg';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useSharedValue, useAnimatedStyle, withSpring, withSequence,
    withTiming, withDelay, runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle } from 'react-native-svg';
import { Plus, Target, X, Lock, BarChart2 } from 'lucide-react-native';
import { subDays } from 'date-fns';
import { useTheme } from '../context/ThemeContext';
import { usePurchases } from '../context/PurchasesContext';
import { t, getLocale } from '../utils/i18n';

const SESSIONS_KEY     = 'tasbeeh-sessions';
const CUSTOM_KEY       = 'tasbeeh-custom-dhikrs';
const GOAL_KEY         = 'tasbeeh-daily-goal';

const GOAL_PRESETS = [100, 200, 300, 500, 1000];

interface Dhikr {
    id: string;
    arabic: string;
    transliteration: string;
    meaning?: string;
    target: number;
    custom?: boolean;
}

interface Session {
    dhikrId: string;
    dhikrLabel: string;
    count: number;
    date: string;
}

function getBuiltIn(): Dhikr[] {
    return [
        { id: 'subhan',    arabic: 'سُبْحَانَ اللَّهِ',              transliteration: 'SubhanAllah',                  meaning: t('tasbeeh.meaningSubhan'),     target: 33  },
        { id: 'hamd',      arabic: 'الْحَمْدُ لِلَّهِ',              transliteration: 'Alhamdulillah',                 meaning: t('tasbeeh.meaningHamd'),       target: 33  },
        { id: 'akbar',     arabic: 'اللَّهُ أَكْبَرُ',               transliteration: 'Allahu Akbar',                  meaning: t('tasbeeh.meaningAkbar'),      target: 34  },
        { id: 'istighfar', arabic: 'أَسْتَغْفِرُ اللَّهَ',            transliteration: 'Astaghfirullah',                meaning: t('tasbeeh.meaningIstighfar'),  target: 100 },
        { id: 'tahleel',   arabic: 'لَا إِلَٰهَ إِلَّا اللَّهُ',     transliteration: 'La ilaha illallah',             meaning: t('tasbeeh.meaningTahleel'),    target: 100 },
        { id: 'salawat',   arabic: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّد', transliteration: "Allahuma Salli 'ala Muhammad",  meaning: t('tasbeeh.meaningSalawat'),    target: 100 },
    ];
}

function todayKey() {
    return new Date().toDateString();
}

function Ring({ count, target, accent }: { count: number; target: number; accent: string }) {
    const SIZE = 140;
    const STROKE = 5;
    const R = (SIZE - STROKE) / 2;
    const CIRC = 2 * Math.PI * R;
    const offset = CIRC * (1 - Math.min(count / target, 1));
    return (
        <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
            <Circle cx={SIZE/2} cy={SIZE/2} r={R} stroke="rgba(255,255,255,0.08)" strokeWidth={STROKE} fill="none" />
            <Circle
                cx={SIZE/2} cy={SIZE/2} r={R}
                stroke={accent} strokeWidth={STROKE} fill="none"
                strokeLinecap="round"
                strokeDasharray={`${CIRC}`}
                strokeDashoffset={offset}
                rotation="-90"
                origin={`${SIZE/2}, ${SIZE/2}`}
            />
        </Svg>
    );
}

export function TasbeehCard() {
    const { colors, cardBg, blurIntensity } = useTheme();
    const { isPremium, openPaywall } = usePurchases();

    const [customDhikrs, setCustomDhikrs]   = useState<Dhikr[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [count, setCount]                 = useState(0);
    const [rounds, setRounds]               = useState(0);
    const [sessions, setSessions]           = useState<Session[]>([]);
    const [dailyGoal, setDailyGoal]         = useState<number>(0); // 0 = no goal

    // Views
    const [showStats, setShowStats] = useState(false);

    // Modals
    const [showCustomModal, setShowCustomModal] = useState(false);
    const [showGoalModal, setShowGoalModal]     = useState(false);

    // Custom dhikr form
    const [newTranslit, setNewTranslit] = useState('');
    const [newArabic, setNewArabic]     = useState('');
    const [newTarget, setNewTarget]     = useState('33');

    const tapScale       = useSharedValue(1);
    const celebScale     = useSharedValue(1);
    const celebOpacity   = useSharedValue(0);
    const [celebText, setCelebText] = useState('');
    const goalCelebratedRef = useRef<string>(''); // tracks which day+goal we already celebrated
    const hasLoadedRef      = useRef(false);       // prevents celebration firing on initial mount
    const prevGoalRef       = useRef<number>(0);   // detects goal changes vs count crossings

    const BUILT_IN = getBuiltIn();
    const allDhikrs: Dhikr[] = [...BUILT_IN, ...customDhikrs];
    const dhikr = allDhikrs[selectedIndex] ?? BUILT_IN[0];

    // ── Load ──────────────────────────────────────────────────────────────────
    useEffect(() => { load(); }, []);

    const load = async () => {
        try {
            const [rawSessions, rawCustom, rawGoal] = await Promise.all([
                AsyncStorage.getItem(SESSIONS_KEY),
                AsyncStorage.getItem(CUSTOM_KEY),
                AsyncStorage.getItem(GOAL_KEY),
            ]);
            // Guard: only accept arrays — corrupt/migrated storage could hold a
            // non-array, which would crash .filter/.reduce at render time.
            if (rawSessions) { const s = JSON.parse(rawSessions); if (Array.isArray(s)) setSessions(s); }
            if (rawCustom)   { const c = JSON.parse(rawCustom);   if (Array.isArray(c)) setCustomDhikrs(c); }
            if (rawGoal)     setDailyGoal(parseInt(rawGoal, 10) || 0);
        } catch (_) {}
        hasLoadedRef.current = true; // mark initial load complete
    };

    // ── Derived: today's sessions ──────────────────────────────────────────────
    const todaySessions = sessions.filter(s => new Date(s.date).toDateString() === todayKey());
    const dailyTotal    = todaySessions.reduce((sum, s) => sum + s.count, 0) + count;
    const goalProgress  = dailyGoal > 0 ? Math.min(dailyTotal / dailyGoal, 1) : 0;

    // ── Goal completion celebration ───────────────────────────────────────────
    useEffect(() => {
        if (!hasLoadedRef.current) return; // don't fire on initial load
        // Only celebrate when the COUNT crossed the goal — not when the user
        // lowered their goal below a total they'd already reached.
        const goalChanged = prevGoalRef.current !== dailyGoal;
        prevGoalRef.current = dailyGoal;
        if (goalChanged) return;
        if (dailyGoal <= 0 || dailyTotal < dailyGoal) return;
        const key = `${todayKey()}_${dailyGoal}`;
        if (goalCelebratedRef.current === key) return; // already celebrated today
        goalCelebratedRef.current = key;

        // Strong haptic
        if (Platform.OS === 'ios') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 150);
        } else {
            Vibration.vibrate([0, 80, 60, 120, 60, 80]);
        }

        // Pop + fade animation on the ring
        setCelebText(t('tasbeeh.goalReached'));
        celebScale.value = withSequence(
            withSpring(1.18, { damping: 6, stiffness: 180 }),
            withSpring(1.0, { damping: 12 }),
        );
        celebOpacity.value = withSequence(
            withTiming(1, { duration: 200 }),
            withDelay(1600, withTiming(0, { duration: 400 })),
        );
    }, [dailyTotal, dailyGoal]);

    const celebAnimStyle = useAnimatedStyle(() => ({
        transform: [{ scale: celebScale.value }],
    }));
    const celebTextStyle = useAnimatedStyle(() => ({
        opacity: celebOpacity.value,
        transform: [{ translateY: celebOpacity.value * -8 + 8 }],
    }));

    // ── Stats computation ─────────────────────────────────────────────────────
    const allTimeTotal = sessions.reduce((sum, s) => sum + s.count, 0) + count;

    // Per-dhikr totals (all time) — skip sessions with no label
    const dhikrTotals = sessions.reduce<Record<string, number>>((acc, s) => {
        const label = s.dhikrLabel?.trim();
        if (!label || label === 'undefined') return acc;
        acc[label] = (acc[label] || 0) + s.count;
        return acc;
    }, {});
    const topDhikr = Object.entries(dhikrTotals).sort((a, b) => b[1] - a[1])[0];

    // Last 7 days totals
    const last7 = Array.from({ length: 7 }, (_, i) => {
        const d = subDays(new Date(), 6 - i);
        const key = d.toDateString();
        const total = sessions.filter(s => new Date(s.date).toDateString() === key)
            .reduce((sum, s) => sum + s.count, 0);
        return { label: d.toLocaleDateString(getLocale(), { weekday: 'short' }), total, isToday: i === 6 };
    });
    const maxDay = Math.max(...last7.map(d => d.total), 1);

    // Daily streak — consecutive days with at least one session
    const dailyStreak = (() => {
        let streak = 0;
        for (let i = 1; i <= 365; i++) {
            const key = subDays(new Date(), i).toDateString();
            const hadSession = sessions.some(s => new Date(s.date).toDateString() === key);
            if (hadSession) streak++;
            else break;
        }
        // Count today if already has sessions
        if (dailyTotal > 0) streak++;
        return streak;
    })();

    // ── Save session ──────────────────────────────────────────────────────────
    const saveSession = async (finalCount: number) => {
        if (finalCount === 0) return;
        const session: Session = {
            dhikrId:    dhikr.id,
            dhikrLabel: dhikr.transliteration,
            count:      finalCount,
            date:       new Date().toISOString(),
        };
        const updated = [session, ...sessions].slice(0, 100);
        setSessions(updated);
        try { await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(updated)); } catch (_) {}
        // Analytics: report the number of presses so PostHog can SUM them into a
        // global total — every press counts (full + partial rounds), one event
        // per session rather than one per tap.
        import('../utils/analytics').then(m => m.track('tasbeeh_count', { count: finalCount, dhikr: dhikr.id })).catch(() => {});
    };

    // ── Counter tap ───────────────────────────────────────────────────────────
    const handleTap = useCallback(() => {
        const newCount = count + 1;
        if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        else Vibration.vibrate(20);

        tapScale.value = withSequence(
            withSpring(0.93, { damping: 15 }),
            withSpring(1.0,  { damping: 12 }),
        );

        if (newCount >= dhikr.target) {
            setRounds(r => r + 1);
            setCount(0);
            if (Platform.OS === 'ios') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            else Vibration.vibrate([0, 80, 50, 80]);
            saveSession(dhikr.target);
            import('../utils/analytics').then(m => m.track('tasbeeh_round', { dhikr: dhikr.id, target: dhikr.target })).catch(() => {});
        } else {
            setCount(newCount);
        }
    }, [count, dhikr, rounds, sessions]);

    const handleReset = () => {
        if (count > 0) saveSession(count);
        setCount(0);
        setRounds(0);
    };

    const selectDhikr = (index: number) => {
        if (count > 0) saveSession(count);
        setSelectedIndex(index);
        setCount(0);
        setRounds(0);
    };

    // ── Custom dhikr ──────────────────────────────────────────────────────────
    const saveCustomDhikr = async () => {
        if (!newTranslit.trim()) return;
        const newDhikr: Dhikr = {
            id:              `custom_${Date.now()}`,
            arabic:          newArabic.trim(),
            transliteration: newTranslit.trim(),
            target:          parseInt(newTarget, 10) || 33,
            custom:          true,
        };
        const updated = [...customDhikrs, newDhikr];
        setCustomDhikrs(updated);
        try { await AsyncStorage.setItem(CUSTOM_KEY, JSON.stringify(updated)); } catch (_) {}
        setShowCustomModal(false);
        setNewTranslit(''); setNewArabic(''); setNewTarget('33');
        // Select the new dhikr
        setSelectedIndex(BUILT_IN.length + updated.length - 1);
        setCount(0); setRounds(0);
    };

    const deleteCustomDhikr = async (id: string) => {
        Alert.alert(t('tasbeeh.deleteDhikrTitle'), t('tasbeeh.cannotBeUndone'), [
            { text: t('btn.cancel'), style: 'cancel' },
            { text: t('btn.delete'), style: 'destructive', onPress: async () => {
                const updated = customDhikrs.filter(d => d.id !== id);
                setCustomDhikrs(updated);
                setSelectedIndex(0); setCount(0); setRounds(0);
                try { await AsyncStorage.setItem(CUSTOM_KEY, JSON.stringify(updated)); } catch (_) {}
            }},
        ]);
    };

    // ── Daily goal ────────────────────────────────────────────────────────────
    const [customGoalInput, setCustomGoalInput] = useState('');

    const saveGoal = async (goal: number) => {
        setDailyGoal(goal);
        setShowGoalModal(false);
        setCustomGoalInput('');
        try { await AsyncStorage.setItem(GOAL_KEY, goal.toString()); } catch (_) {}
    };

    const saveCustomGoal = async () => {
        const n = parseInt(customGoalInput, 10);
        if (!n || n < 1) return;
        await saveGoal(n);
    };

    const tapAnimStyle = useAnimatedStyle(() => ({
        transform: [{ scale: tapScale.value }],
    }));

    return (
        <View style={styles.container}>
            <BlurView intensity={Math.round(20 * blurIntensity)} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: cardBg, borderRadius: 20 }]} />
            <LinearGradient colors={[colors.shadow, 'rgba(79,70,229,0.04)', 'transparent']} style={[StyleSheet.absoluteFill, { borderRadius: 20 }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />

            <View style={styles.content}>

                {/* Header: daily total + stats + goal button */}
                <View style={styles.headerRow}>
                    <View>
                        <Text style={[styles.headerLabel, { color: colors.secondaryText }]}>{t('tasbeeh.todaysDhikr')}</Text>
                        <Text style={[styles.headerTotal, { color: dailyGoal > 0 && dailyTotal >= dailyGoal ? colors.success : colors.accent }]}>
                            {dailyTotal.toLocaleString()}
                            {dailyGoal > 0 && <Text style={[styles.headerGoalOf, { color: colors.secondaryText }]}> / {dailyGoal.toLocaleString()}</Text>}
                        </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                            onPress={() => {
                                if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                else Vibration.vibrate(20);
                                if (isPremium) {
                                    setShowStats(s => !s);
                                    import('../utils/featureDiscovery').then(m => m.markFeatureUsed('tasbeeh_stats')).catch(() => {});
                                } else {
                                    openPaywall('feature_gate:dhikr_stats');
                                }
                            }}
                            style={[styles.goalBtn, { borderColor: showStats ? colors.accent + '55' : 'rgba(255,255,255,0.10)', backgroundColor: showStats ? colors.accent + '15' : 'rgba(255,255,255,0.04)' }]}
                        >
                            {showStats
                                ? <X size={12} color={colors.accent} />
                                : isPremium
                                    ? <BarChart2 size={12} color={colors.secondaryText} />
                                    : <Lock size={11} color="#f59e0b" />}
                            <Text style={[styles.goalBtnText, { color: showStats ? colors.accent : colors.secondaryText }]}>
                                {showStats ? t('tasbeeh.doneBtn') : t('tasbeeh.statsBtn')}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setShowGoalModal(true)} style={[styles.goalBtn, { borderColor: dailyGoal > 0 ? colors.accent + '55' : 'rgba(255,255,255,0.10)' }]}>
                            <Target size={12} color={dailyGoal > 0 ? colors.accent : colors.secondaryText} />
                            <Text style={[styles.goalBtnText, { color: dailyGoal > 0 ? colors.accent : colors.secondaryText }]}>
                                {dailyGoal > 0 ? t('tasbeeh.goalWithN', { n: dailyGoal.toLocaleString() }) : t('tasbeeh.goalBtn')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Goal progress bar */}
                {dailyGoal > 0 && (
                    <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, {
                            width: `${goalProgress * 100}%` as any,
                            backgroundColor: goalProgress >= 1 ? colors.success : colors.accent,
                        }]} />
                    </View>
                )}

                {/* ── Stats view ── */}
                {showStats && (
                    <View style={styles.statsSection}>
                        {/* Top row: all-time + streak */}
                        <View style={styles.statsTopRow}>
                            <View style={[styles.statBox, { borderColor: 'rgba(255,255,255,0.07)' }]}>
                                <Text style={[styles.statBoxNum, { color: colors.accent }]}>{allTimeTotal.toLocaleString()}</Text>
                                <Text style={[styles.statBoxLabel, { color: colors.secondaryText }]}>{t('tasbeeh.allTime')}</Text>
                            </View>
                            <View style={[styles.statBox, { borderColor: 'rgba(255,255,255,0.07)' }]}>
                                <Text style={[styles.statBoxNum, { color: colors.accent }]}>{dailyStreak}</Text>
                                <Text style={[styles.statBoxLabel, { color: colors.secondaryText }]}>{t('tasbeeh.dayStreak')}</Text>
                            </View>
                            {topDhikr && topDhikr[0] && (
                                <View style={[styles.statBox, { borderColor: 'rgba(255,255,255,0.07)', flex: 1.4 }]}>
                                    <Text style={[styles.statBoxNum, { color: colors.accent }]} numberOfLines={1}>{topDhikr[0]}</Text>
                                    <Text style={[styles.statBoxLabel, { color: colors.secondaryText }]}>{t('tasbeeh.mostRecited')}</Text>
                                </View>
                            )}
                        </View>

                        {/* 7-day bar chart */}
                        <Text style={[styles.statsChartLabel, { color: colors.secondaryText }]}>{t('tasbeeh.last7Days')}</Text>
                        <View style={styles.barChart}>
                            {last7.map((d, i) => (
                                <View key={i} style={styles.barCol}>
                                    <Text style={[styles.barValue, { color: colors.secondaryText }]}>
                                        {d.total > 0 ? d.total >= 1000 ? `${(d.total/1000).toFixed(1)}k` : d.total : ''}
                                    </Text>
                                    <View style={styles.barTrack}>
                                        <View style={[
                                            styles.barFill,
                                            {
                                                height: `${Math.round((d.total / maxDay) * 100)}%` as any,
                                                backgroundColor: d.isToday ? colors.accent : colors.accent + '55',
                                            }
                                        ]} />
                                    </View>
                                    <Text style={[styles.barDayLabel, { color: d.isToday ? colors.accent : colors.secondaryText }]}>{d.label}</Text>
                                </View>
                            ))}
                        </View>

                        {/* Per-dhikr breakdown today */}
                        {Object.keys(dhikrTotals).length > 0 && (
                            <>
                                <Text style={[styles.statsChartLabel, { color: colors.secondaryText }]}>{t('tasbeeh.allTimeBreakdown')}</Text>
                                {Object.entries(dhikrTotals)
                                    .sort((a, b) => b[1] - a[1])
                                    .slice(0, 5)
                                    .map(([label, total]) => {
                                        const pct = allTimeTotal > 0 ? total / allTimeTotal : 0;
                                        return (
                                            <View key={label} style={styles.breakdownRow}>
                                                <Text style={[styles.breakdownLabel, { color: colors.primaryText }]} numberOfLines={1}>{label}</Text>
                                                <View style={styles.breakdownBarTrack}>
                                                    <LinearGradient
                                                        colors={[colors.accent, colors.accent + '66']}
                                                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                                        style={[styles.breakdownBarFill, { width: `${Math.round(pct * 100)}%` as any }]}
                                                    />
                                                </View>
                                                <Text style={[styles.breakdownCount, { color: colors.secondaryText }]}>{total.toLocaleString()}</Text>
                                            </View>
                                        );
                                    })}
                            </>
                        )}
                    </View>
                )}

                {/* Dhikr selector pills */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow}>
                    {allDhikrs.map((d, i) => (
                        <TouchableOpacity
                            key={d.id}
                            onPress={() => selectDhikr(i)}
                            onLongPress={() => d.custom && deleteCustomDhikr(d.id)}
                            delayLongPress={600}
                            style={[
                                styles.pill,
                                i === selectedIndex && { backgroundColor: colors.accent + '25', borderColor: colors.accent + '66' },
                            ]}
                        >
                            <Text style={[styles.pillText, { color: i === selectedIndex ? colors.accent : colors.secondaryText }]}>
                                {d.transliteration}
                            </Text>
                        </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                        onPress={() => isPremium ? setShowCustomModal(true) : openPaywall('feature_gate:custom_dhikr')}
                        style={styles.pillAdd}
                    >
                        {isPremium
                            ? <Plus size={12} color={colors.secondaryText} />
                            : <Lock size={11} color="#f59e0b" />}
                    </TouchableOpacity>
                </ScrollView>

                {/* Counter ring */}
                <View style={{ alignItems: 'center' }}>
                    <Pressable onPress={handleTap} onLongPress={handleReset} delayLongPress={600} style={styles.counterArea}>
                        <Animated.View style={[styles.ring, tapAnimStyle, celebAnimStyle]}>
                            <Ring count={count} target={dhikr.target} accent={colors.accent} />
                            <View style={styles.countInner}>
                                <Text style={[styles.arabicText, { color: colors.primaryText }]}>{dhikr.arabic}</Text>
                                {dhikr.meaning ? (
                                    <Text style={[styles.translitText, { color: colors.secondaryText }]}>{dhikr.meaning}</Text>
                                ) : null}
                                <Text style={[styles.countNum, { color: colors.accent }]}>{count}</Text>
                                <Text style={[styles.targetText, { color: colors.secondaryText }]}>/ {dhikr.target}</Text>
                            </View>
                        </Animated.View>
                    </Pressable>
                </View>

                {/* Rounds + hint — replaced by celebration text when goal just hit */}
                <View style={{ height: 18, justifyContent: 'center', alignItems: 'center' }}>
                    <Animated.Text style={[styles.celebText, celebTextStyle, { position: 'absolute' }]}>
                        {celebText}
                    </Animated.Text>
                    <Animated.Text style={[styles.hintText, { color: rounds > 0 ? colors.success : '#334155' }, useAnimatedStyle(() => ({ opacity: 1 - celebOpacity.value }))]}>
                        {rounds > 0 ? (rounds > 1 ? t('tasbeeh.roundsCompletedPlural', { n: rounds }) : t('tasbeeh.roundsCompleted', { n: rounds })) : t('tasbeeh.tapToCountHint')}
                    </Animated.Text>
                </View>

                {/* Today's sessions — premium only */}
                {isPremium && todaySessions.length > 0 && (
                    <View style={styles.sessionsSection}>
                        <Text style={[styles.sessionsTitle, { color: colors.secondaryText }]}>{t('tasbeeh.todaysSessions')}</Text>
                        {todaySessions.slice(0, 5).map((s, i) => (
                            <View key={i} style={styles.sessionRow}>
                                <Text style={[styles.sessionLabel, { color: colors.primaryText }]}>{s.dhikrLabel}</Text>
                                <Text style={[styles.sessionCount, { color: colors.accent }]}>×{s.count}</Text>
                            </View>
                        ))}
                        {todaySessions.length > 5 && (
                            <Text style={[styles.moreText, { color: '#475569' }]}>{t('tasbeeh.moreCount', { n: todaySessions.length - 5 })}</Text>
                        )}
                    </View>
                )}
            </View>

            {/* ── Custom Dhikr Modal ── */}
            <Modal visible={showCustomModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCustomModal(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
                    <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.primaryText }]}>{t('tasbeeh.newDhikr')}</Text>
                            <TouchableOpacity onPress={() => setShowCustomModal(false)}>
                                <X size={20} color={colors.secondaryText} />
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>{t('tasbeeh.nameRequired')}</Text>
                        <TextInput
                            style={[styles.input, { color: colors.primaryText, borderColor: 'rgba(255,255,255,0.15)' }]}
                            placeholder={t('tasbeeh.namePlaceholder')}
                            placeholderTextColor="#475569"
                            value={newTranslit}
                            onChangeText={setNewTranslit}
                            autoFocus
                        />

                        <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>{t('tasbeeh.arabicOptional')}</Text>
                        <TextInput
                            style={[styles.input, styles.inputArabic, { color: colors.primaryText, borderColor: 'rgba(255,255,255,0.15)' }]}
                            placeholder="حَسْبُنَا اللَّهُ"
                            placeholderTextColor="#475569"
                            value={newArabic}
                            onChangeText={setNewArabic}
                            textAlign="right"
                        />

                        <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>{t('tasbeeh.targetCount')}</Text>
                        <View style={styles.targetPresets}>
                            {[33, 34, 100, 1000].map(n => (
                                <TouchableOpacity
                                    key={n}
                                    onPress={() => setNewTarget(n.toString())}
                                    style={[styles.targetPill, newTarget === n.toString() && { backgroundColor: colors.accent + '25', borderColor: colors.accent + '66' }]}
                                >
                                    <Text style={[styles.targetPillText, { color: newTarget === n.toString() ? colors.accent : colors.secondaryText }]}>{n}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <TextInput
                            style={[styles.input, { color: colors.primaryText, borderColor: 'rgba(255,255,255,0.15)' }]}
                            placeholder={t('tasbeeh.customNumberPlaceholder')}
                            placeholderTextColor="#475569"
                            value={newTarget}
                            onChangeText={setNewTarget}
                            keyboardType="number-pad"
                        />

                        <TouchableOpacity
                            onPress={saveCustomDhikr}
                            style={[styles.saveBtn, { backgroundColor: colors.accent }]}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.saveBtnText}>{t('tasbeeh.addDhikr')}</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* ── Goal Modal ── */}
            <Modal visible={showGoalModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowGoalModal(false)}>
                <View style={styles.modalContainer}>
                    <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.primaryText }]}>{t('tasbeeh.dailyGoalTitle')}</Text>
                            <TouchableOpacity onPress={() => setShowGoalModal(false)}>
                                <X size={20} color={colors.secondaryText} />
                            </TouchableOpacity>
                        </View>
                        <Text style={[styles.goalSubtitle, { color: colors.secondaryText }]}>
                            {t('tasbeeh.goalSubtitle')}
                        </Text>
                        <View style={styles.goalPresets}>
                            {GOAL_PRESETS.map(n => (
                                <TouchableOpacity
                                    key={n}
                                    onPress={() => saveGoal(n)}
                                    style={[styles.goalPresetBtn, dailyGoal === n && { backgroundColor: colors.accent + '25', borderColor: colors.accent + '66' }]}
                                >
                                    <Text style={[styles.goalPresetNum, { color: dailyGoal === n ? colors.accent : colors.primaryText }]}>{n}</Text>
                                    <Text style={[styles.goalPresetLabel, { color: colors.secondaryText }]}>{t('tasbeeh.dhikrWord')}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>{t('tasbeeh.customAmount')}</Text>
                        <View style={styles.customGoalRow}>
                            <TextInput
                                style={[styles.input, { flex: 1, color: colors.primaryText, borderColor: 'rgba(255,255,255,0.15)' }]}
                                placeholder={t('tasbeeh.customGoalPlaceholder')}
                                placeholderTextColor="#475569"
                                value={customGoalInput}
                                onChangeText={setCustomGoalInput}
                                keyboardType="number-pad"
                            />
                            <TouchableOpacity
                                onPress={saveCustomGoal}
                                style={[styles.customGoalSaveBtn, { backgroundColor: colors.accent }]}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.saveBtnText}>{t('tasbeeh.setBtn')}</Text>
                            </TouchableOpacity>
                        </View>

                        {dailyGoal > 0 && (
                            <TouchableOpacity onPress={() => saveGoal(0)} style={styles.removeGoalBtn}>
                                <Text style={styles.removeGoalText}>{t('tasbeeh.removeGoal')}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    content: {
        paddingHorizontal: 16,
        paddingVertical: 20,
        alignItems: 'center',
        gap: 14,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
    },
    headerLabel: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    headerTotal: {
        fontSize: 28,
        fontWeight: '900',
    },
    headerGoalOf: {
        fontSize: 16,
        fontWeight: '600',
    },
    goalBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        borderWidth: 1,
        backgroundColor: 'rgba(255,255,255,0.04)',
    },
    goalBtnText: {
        fontSize: 11,
        fontWeight: '700',
    },
    progressTrack: {
        width: '100%',
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    progressFill: {
        height: 4,
        borderRadius: 2,
    },
    pillsRow: {
        flexDirection: 'row',
        gap: 6,
        paddingVertical: 2,
    },
    pill: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.10)',
        backgroundColor: 'rgba(255,255,255,0.04)',
    },
    pillText: {
        fontSize: 11,
        fontWeight: '700',
    },
    pillAdd: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        backgroundColor: 'rgba(255,255,255,0.04)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    counterArea: {
        width: 140,
        height: 140,
    },
    ring: {
        width: 140,
        height: 140,
        alignItems: 'center',
        justifyContent: 'center',
    },
    countInner: {
        alignItems: 'center',
        gap: 2,
    },
    arabicText: {
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'center',
    },
    translitText: {
        fontSize: 10,
        fontWeight: '600',
        textAlign: 'center',
    },
    countNum: {
        fontSize: 30,
        fontWeight: '900',
        lineHeight: 34,
    },
    targetText: {
        fontSize: 11,
        fontWeight: '600',
    },
    hintText: {
        fontSize: 11,
        fontWeight: '600',
    },
    sessionsSection: {
        width: '100%',
        gap: 6,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
    },
    sessionsTitle: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 2,
    },
    sessionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sessionLabel: {
        fontSize: 13,
        fontWeight: '600',
    },
    sessionCount: {
        fontSize: 13,
        fontWeight: '800',
    },
    moreText: {
        fontSize: 11,
        fontWeight: '500',
        textAlign: 'center',
        marginTop: 2,
    },
    // ── Modals ──
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(2,6,23,0.95)',
    },
    modalContent: {
        padding: 24,
        paddingTop: 32,
        gap: 12,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '900',
    },
    inputLabel: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginTop: 4,
    },
    input: {
        height: 44,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 14,
        fontSize: 15,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    inputArabic: {
        fontSize: 18,
        fontWeight: '600',
    },
    targetPresets: {
        flexDirection: 'row',
        gap: 8,
    },
    targetPill: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        backgroundColor: 'rgba(255,255,255,0.04)',
    },
    targetPillText: {
        fontSize: 13,
        fontWeight: '700',
    },
    saveBtn: {
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
    },
    saveBtnText: {
        fontSize: 15,
        fontWeight: '900',
        color: '#000',
    },
    goalSubtitle: {
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 8,
    },
    goalPresets: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    goalPresetBtn: {
        flex: 1,
        minWidth: '28%',
        paddingVertical: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        backgroundColor: 'rgba(255,255,255,0.04)',
        alignItems: 'center',
        gap: 2,
    },
    goalPresetNum: {
        fontSize: 20,
        fontWeight: '900',
    },
    goalPresetLabel: {
        fontSize: 10,
        fontWeight: '600',
    },
    removeGoalBtn: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    removeGoalText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#ef4444',
    },
    customGoalRow: {
        flexDirection: 'row',
        gap: 10,
        alignItems: 'center',
    },
    customGoalSaveBtn: {
        height: 44,
        paddingHorizontal: 20,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    celebText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#34d399',
        textAlign: 'center',
    },
    // ── Stats ──
    statsSection: {
        width: '100%',
        gap: 12,
        paddingTop: 4,
        paddingBottom: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
    },
    statsTopRow: {
        flexDirection: 'row',
        gap: 8,
    },
    statBox: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 12,
        padding: 10,
        alignItems: 'center',
        gap: 2,
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    statBoxNum: {
        fontSize: 18,
        fontWeight: '900',
    },
    statBoxLabel: {
        fontSize: 9,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        textAlign: 'center',
    },
    statsChartLabel: {
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginBottom: -4,
    },
    barChart: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        height: 70,
        gap: 4,
    },
    barCol: {
        flex: 1,
        alignItems: 'center',
        height: '100%',
        justifyContent: 'flex-end',
        gap: 3,
    },
    barValue: {
        fontSize: 8,
        fontWeight: '700',
    },
    barTrack: {
        width: '100%',
        height: 44,
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
        justifyContent: 'flex-end',
    },
    barFill: {
        width: '100%',
        borderRadius: 4,
        minHeight: 2,
    },
    barDayLabel: {
        fontSize: 9,
        fontWeight: '700',
    },
    breakdownRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    breakdownLabel: {
        width: 90,
        fontSize: 11,
        fontWeight: '600',
    },
    breakdownBarTrack: {
        flex: 1,
        height: 5,
        borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.07)',
        overflow: 'hidden',
    },
    breakdownBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    breakdownCount: {
        fontSize: 11,
        fontWeight: '700',
        width: 44,
        textAlign: 'right',
    },
});
