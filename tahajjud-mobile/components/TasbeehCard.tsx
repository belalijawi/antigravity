import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, Pressable, TouchableOpacity,
    ScrollView, Platform, Vibration, Modal, TextInput,
    KeyboardAvoidingView, Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useSharedValue, useAnimatedStyle, withSpring, withSequence,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle } from 'react-native-svg';
import { Plus, Target, X } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

const SESSIONS_KEY     = 'tasbeeh-sessions';
const CUSTOM_KEY       = 'tasbeeh-custom-dhikrs';
const GOAL_KEY         = 'tasbeeh-daily-goal';

const GOAL_PRESETS = [100, 200, 300, 500, 1000];

interface Dhikr {
    id: string;
    arabic: string;
    transliteration: string;
    target: number;
    custom?: boolean;
}

interface Session {
    dhikrId: string;
    dhikrLabel: string;
    count: number;
    date: string;
}

const BUILT_IN: Dhikr[] = [
    { id: 'subhan',    arabic: 'سُبْحَانَ اللَّهِ',              transliteration: 'SubhanAllah',              target: 33  },
    { id: 'hamd',      arabic: 'الْحَمْدُ لِلَّهِ',              transliteration: 'Alhamdulillah',             target: 33  },
    { id: 'akbar',     arabic: 'اللَّهُ أَكْبَرُ',               transliteration: 'Allahu Akbar',              target: 34  },
    { id: 'istighfar', arabic: 'أَسْتَغْفِرُ اللَّهَ',            transliteration: 'Astaghfirullah',            target: 100 },
    { id: 'tahleel',   arabic: 'لَا إِلَٰهَ إِلَّا اللَّهُ',     transliteration: 'La ilaha illallah',         target: 100 },
    { id: 'salawat',   arabic: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّد', transliteration: "Allahuma Salli 'ala Muhammad", target: 100 },
];

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

    const [customDhikrs, setCustomDhikrs]   = useState<Dhikr[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [count, setCount]                 = useState(0);
    const [rounds, setRounds]               = useState(0);
    const [sessions, setSessions]           = useState<Session[]>([]);
    const [dailyGoal, setDailyGoal]         = useState<number>(0); // 0 = no goal

    // Modals
    const [showCustomModal, setShowCustomModal] = useState(false);
    const [showGoalModal, setShowGoalModal]     = useState(false);

    // Custom dhikr form
    const [newTranslit, setNewTranslit] = useState('');
    const [newArabic, setNewArabic]     = useState('');
    const [newTarget, setNewTarget]     = useState('33');

    const tapScale = useSharedValue(1);

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
            if (rawSessions) setSessions(JSON.parse(rawSessions));
            if (rawCustom)   setCustomDhikrs(JSON.parse(rawCustom));
            if (rawGoal)     setDailyGoal(parseInt(rawGoal, 10) || 0);
        } catch (_) {}
    };

    // ── Derived: today's sessions ──────────────────────────────────────────────
    const todaySessions = sessions.filter(s => new Date(s.date).toDateString() === todayKey());
    const dailyTotal    = todaySessions.reduce((sum, s) => sum + s.count, 0) + count;
    const goalProgress  = dailyGoal > 0 ? Math.min(dailyTotal / dailyGoal, 1) : 0;

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
        Alert.alert('Delete dhikr?', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => {
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

                {/* Header: daily total + goal button */}
                <View style={styles.headerRow}>
                    <View>
                        <Text style={[styles.headerLabel, { color: colors.secondaryText }]}>Today's Dhikr</Text>
                        <Text style={[styles.headerTotal, { color: dailyGoal > 0 && dailyTotal >= dailyGoal ? colors.success : colors.accent }]}>
                            {dailyTotal.toLocaleString()}
                            {dailyGoal > 0 && <Text style={[styles.headerGoalOf, { color: colors.secondaryText }]}> / {dailyGoal.toLocaleString()}</Text>}
                        </Text>
                    </View>
                    <TouchableOpacity onPress={() => setShowGoalModal(true)} style={[styles.goalBtn, { borderColor: dailyGoal > 0 ? colors.accent + '55' : 'rgba(255,255,255,0.10)' }]}>
                        <Target size={12} color={dailyGoal > 0 ? colors.accent : colors.secondaryText} />
                        <Text style={[styles.goalBtnText, { color: dailyGoal > 0 ? colors.accent : colors.secondaryText }]}>
                            {dailyGoal > 0 ? `Goal: ${dailyGoal.toLocaleString()}` : 'Set goal'}
                        </Text>
                    </TouchableOpacity>
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
                    <TouchableOpacity onPress={() => setShowCustomModal(true)} style={styles.pillAdd}>
                        <Plus size={12} color={colors.secondaryText} />
                    </TouchableOpacity>
                </ScrollView>

                {/* Counter ring */}
                <Pressable onPress={handleTap} onLongPress={handleReset} delayLongPress={600} style={styles.counterArea}>
                    <Animated.View style={[styles.ring, tapAnimStyle]}>
                        <Ring count={count} target={dhikr.target} accent={colors.accent} />
                        <View style={styles.countInner}>
                            <Text style={[styles.arabicText, { color: colors.primaryText }]}>{dhikr.arabic}</Text>
                            <Text style={[styles.countNum, { color: colors.accent }]}>{count}</Text>
                            <Text style={[styles.targetText, { color: colors.secondaryText }]}>/ {dhikr.target}</Text>
                        </View>
                    </Animated.View>
                </Pressable>

                {/* Rounds + hint */}
                <Text style={[styles.hintText, { color: rounds > 0 ? colors.success : '#334155' }]}>
                    {rounds > 0 ? `${rounds}× round${rounds > 1 ? 's' : ''} completed` : 'Tap to count · Hold to reset'}
                </Text>

                {/* Today's sessions */}
                {todaySessions.length > 0 && (
                    <View style={styles.sessionsSection}>
                        <Text style={[styles.sessionsTitle, { color: colors.secondaryText }]}>Today's Sessions</Text>
                        {todaySessions.slice(0, 5).map((s, i) => (
                            <View key={i} style={styles.sessionRow}>
                                <Text style={[styles.sessionLabel, { color: colors.primaryText }]}>{s.dhikrLabel}</Text>
                                <Text style={[styles.sessionCount, { color: colors.accent }]}>×{s.count}</Text>
                            </View>
                        ))}
                        {todaySessions.length > 5 && (
                            <Text style={[styles.moreText, { color: '#475569' }]}>+{todaySessions.length - 5} more</Text>
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
                            <Text style={[styles.modalTitle, { color: colors.primaryText }]}>New Dhikr</Text>
                            <TouchableOpacity onPress={() => setShowCustomModal(false)}>
                                <X size={20} color={colors.secondaryText} />
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>Name *</Text>
                        <TextInput
                            style={[styles.input, { color: colors.primaryText, borderColor: 'rgba(255,255,255,0.15)' }]}
                            placeholder="e.g. HasbunAllah"
                            placeholderTextColor="#475569"
                            value={newTranslit}
                            onChangeText={setNewTranslit}
                            autoFocus
                        />

                        <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>Arabic (optional)</Text>
                        <TextInput
                            style={[styles.input, styles.inputArabic, { color: colors.primaryText, borderColor: 'rgba(255,255,255,0.15)' }]}
                            placeholder="حَسْبُنَا اللَّهُ"
                            placeholderTextColor="#475569"
                            value={newArabic}
                            onChangeText={setNewArabic}
                            textAlign="right"
                        />

                        <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>Target count</Text>
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
                            placeholder="Or type custom number"
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
                            <Text style={styles.saveBtnText}>Add Dhikr</Text>
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
                            <Text style={[styles.modalTitle, { color: colors.primaryText }]}>Daily Goal</Text>
                            <TouchableOpacity onPress={() => setShowGoalModal(false)}>
                                <X size={20} color={colors.secondaryText} />
                            </TouchableOpacity>
                        </View>
                        <Text style={[styles.goalSubtitle, { color: colors.secondaryText }]}>
                            Set a total daily dhikr target across all sessions
                        </Text>
                        <View style={styles.goalPresets}>
                            {GOAL_PRESETS.map(n => (
                                <TouchableOpacity
                                    key={n}
                                    onPress={() => saveGoal(n)}
                                    style={[styles.goalPresetBtn, dailyGoal === n && { backgroundColor: colors.accent + '25', borderColor: colors.accent + '66' }]}
                                >
                                    <Text style={[styles.goalPresetNum, { color: dailyGoal === n ? colors.accent : colors.primaryText }]}>{n}</Text>
                                    <Text style={[styles.goalPresetLabel, { color: colors.secondaryText }]}>dhikr</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={[styles.inputLabel, { color: colors.secondaryText }]}>Custom amount</Text>
                        <View style={styles.customGoalRow}>
                            <TextInput
                                style={[styles.input, { flex: 1, color: colors.primaryText, borderColor: 'rgba(255,255,255,0.15)' }]}
                                placeholder="e.g. 750"
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
                                <Text style={styles.saveBtnText}>Set</Text>
                            </TouchableOpacity>
                        </View>

                        {dailyGoal > 0 && (
                            <TouchableOpacity onPress={() => saveGoal(0)} style={styles.removeGoalBtn}>
                                <Text style={styles.removeGoalText}>Remove goal</Text>
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
});
