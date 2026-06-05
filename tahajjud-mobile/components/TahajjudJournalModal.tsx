import React, { useState, useRef, useEffect } from 'react';
import {
    Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
    KeyboardAvoidingView, Platform, ScrollView, Animated as RNAnimated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Moon, X, ChevronRight, Check, ArrowLeft } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TahajjudJournal, STATE_OPTIONS, SpiritualState, JournalEntry } from '../utils/tahajjudJournal';
import { haptic } from '../utils/haptic';
import { format, subDays } from 'date-fns';
import Animated, { FadeInUp, ZoomIn, FadeIn } from 'react-native-reanimated';

const RAKAT_OPTIONS = [2, 4, 6, 8, 10, 12];

import { JOURNAL_PROMPTS, getPromptForDate } from '../utils/journalPrompts';
import { localDateStr } from '../utils/localDate';

const MOOD_COLORS: Record<SpiritualState, string> = {
    tired:      '#818cf8',
    focused:    '#38bdf8',
    emotional:  '#f472b6',
    distracted: '#fb923c',
    connected:  '#fbbf24',
};

const DONE_MESSAGES: Record<SpiritualState, string> = {
    tired:      'Praying while tired carries extra reward. Allah saw your effort.',
    focused:    'A focused heart in sujood is a gift. May it be accepted.',
    emotional:  "Tears in prayer are answered duas. Allah is Al-Sami'.",
    distracted: 'Even a distracted prayer is better than none. Keep going.',
    connected:  'May this connection to Allah last well beyond tonight.',
};

const STARS = [
    { left: '8%',  top: 80,  size: 2,   opacity: 0.4 },
    { left: '22%', top: 44,  size: 1.5, opacity: 0.3 },
    { left: '44%', top: 130, size: 2,   opacity: 0.35 },
    { left: '61%', top: 58,  size: 1,   opacity: 0.5 },
    { left: '76%', top: 105, size: 2,   opacity: 0.3 },
    { left: '88%', top: 32,  size: 1.5, opacity: 0.4 },
    { left: '14%', top: 210, size: 1,   opacity: 0.25 },
    { left: '91%', top: 185, size: 1.5, opacity: 0.35 },
    { left: '34%', top: 260, size: 1,   opacity: 0.3 },
    { left: '71%', top: 160, size: 2,   opacity: 0.22 },
    { left: '5%',  top: 360, size: 1.5, opacity: 0.35 },
    { left: '93%', top: 400, size: 1,   opacity: 0.28 },
    { left: '55%', top: 320, size: 1.5, opacity: 0.25 },
    { left: '82%', top: 290, size: 1,   opacity: 0.3 },
    { left: '28%', top: 480, size: 2,   opacity: 0.2 },
];

interface Props { visible: boolean; onClose: () => void; initialEntry?: JournalEntry; }
type Step = 'mood' | 'write' | 'done';

export function TahajjudJournalModal({ visible, onClose, initialEntry }: Props) {
    const { colors, cardBorder } = useTheme();
    const insets = useSafeAreaInsets();
    const [step, setStep]       = useState<Step>('mood');
    const [rakats, setRakats]   = useState(2);
    const [mood, setMood]       = useState<SpiritualState | null>(null);
    const [duaText, setDuaText] = useState('');
    const [saving, setSaving]   = useState(false);
    const [prompt, setPrompt]   = useState(getPromptForDate());
    const [displayedPrompt, setDisplayedPrompt] = useState('');
    const [flashback, setFlashback] = useState<JournalEntry | null>(null);
    const inputRef = useRef<TextInput>(null);
    const moodScales = useRef<Record<SpiritualState, RNAnimated.Value>>(
        Object.fromEntries(STATE_OPTIONS.map(s => [s.key, new RNAnimated.Value(1)])) as any
    );
    const now = new Date();

    useEffect(() => {
        if (visible) {
            if (initialEntry) {
                setStep('mood');
                setMood(initialEntry.state);
                setRakats(initialEntry.rakats);
                setDuaText(initialEntry.duaText);
            } else {
                setStep('mood'); setMood(null); setRakats(2); setDuaText('');
            }
            setFlashback(null);
            loadContext();
        }
    }, [visible]);

    const loadContext = async () => {
        try {
            const all = await TahajjudJournal.getAll();
            // Today's prompt rotates by date, not entry count — so every user
            // sees the same prompt on the same night, and writing twice in one
            // night keeps you on the same prompt.
            setPrompt(getPromptForDate());
            const windowEnd   = localDateStr(subDays(new Date(), 25));
            const windowStart = localDateStr(subDays(new Date(), 35));
            const fb = all.find(e => e.date <= windowEnd && e.date >= windowStart && e.duaText.trim().length > 0);
            setFlashback(fb ?? null);
        } catch { /* ignore */ }
    };

    useEffect(() => {
        if (step === 'write') {
            setTimeout(() => inputRef.current?.focus(), 300);
            setDisplayedPrompt('');
            let i = 0;
            const iv = setInterval(() => {
                i++;
                setDisplayedPrompt(prompt.slice(0, i));
                if (i >= prompt.length) clearInterval(iv);
            }, 36);
            return () => clearInterval(iv);
        }
    }, [step, prompt]);

    const selectMood = (key: SpiritualState) => {
        setMood(key); haptic.light();
        const scale = moodScales.current[key];
        RNAnimated.sequence([
            RNAnimated.spring(scale, { toValue: 1.1, useNativeDriver: true, speed: 50, bounciness: 8 }),
            RNAnimated.spring(scale, { toValue: 1,   useNativeDriver: true, speed: 30, bounciness: 4 }),
        ]).start();
    };

    const handleNext = () => { if (!mood) return; haptic.light(); setStep('write'); };

    const handleSave = async () => {
        setSaving(true); haptic.success();
        await TahajjudJournal.save({ date: localDateStr(now), rakats, state: mood ?? 'focused', duaText });
        setSaving(false); setStep('done');
        setTimeout(() => onClose(), 2000);
    };

    const handleClose = () => { setStep('mood'); setMood(null); setRakats(2); setDuaText(''); onClose(); };
    const wordCount = duaText.trim().split(/\s+/).filter(Boolean).length;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleClose}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

                {/* Background */}
                <LinearGradient colors={['#09071a', '#0b0f24', '#070614']} style={StyleSheet.absoluteFill} />
                {/* Accent glow in top-right corner */}
                <View style={[styles.bgGlow, { backgroundColor: colors.accent + '12' }]} />
                {/* Stars */}
                {STARS.map((s, i) => (
                    <View key={i} pointerEvents="none" style={[styles.star, {
                        left: s.left as any, top: s.top,
                        width: s.size, height: s.size,
                        borderRadius: s.size / 2, opacity: s.opacity,
                    }]} />
                ))}

                {/* ── Top bar — unified across mood / write steps ──
                    On 'mood'  : [X close] · step dots · (empty spacer)
                    On 'write' : [← back ] · step dots · [Save button]
                    Previously the write step rendered an EXTRA top bar
                    on its own row, which made the modal look like it had
                    two stacked headers. */}
                <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
                    {step === 'write' ? (
                        <TouchableOpacity onPress={() => setStep('mood')} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <ArrowLeft size={18} color="#4a5568" />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <X size={17} color="#4a5568" />
                        </TouchableOpacity>
                    )}
                    <View style={styles.stepDots}>
                        {(['mood', 'write'] as Step[]).map(s => (
                            <View key={s} style={[
                                styles.dot,
                                step === s || step === 'done'
                                    ? { backgroundColor: colors.accent, width: 28 }
                                    : { backgroundColor: 'rgba(255,255,255,0.1)', width: 8 },
                                step === 'write' && s === 'mood' && { backgroundColor: colors.accent + '55', width: 8 },
                            ]} />
                        ))}
                    </View>
                    {step === 'write' ? (
                        <TouchableOpacity
                            onPress={handleSave}
                            disabled={saving}
                            style={[styles.saveBtn, { backgroundColor: colors.accent, shadowColor: colors.accent, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 }]}
                        >
                            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={{ width: 34 }} />
                    )}
                </View>

                {/* ══ MOOD STEP ══ */}
                {step === 'mood' && (
                    <Animated.View entering={FadeInUp.duration(300)} style={{ flex: 1 }}>
                        <ScrollView contentContainerStyle={styles.moodScroll} showsVerticalScrollIndicator={false}>

                            {/* Hero */}
                            <View style={styles.hero}>
                                <View style={[styles.moonWrap, { borderColor: colors.accent + '50', backgroundColor: colors.accent + '18' }]}>
                                    <Moon size={28} color={colors.accent} />
                                </View>
                                <View style={styles.heroText}>
                                    <Text style={[styles.dateLabel, { color: colors.secondaryText + '70' }]}>{format(now, 'EEEE, MMMM d').toUpperCase()}</Text>
                                    <Text style={[styles.heroTitle, { color: colors.primaryText }]}>Alhamdulillah 🤲</Text>
                                    <Text style={[styles.heroSub, { color: colors.secondaryText + '90' }]}>You prayed Tahajjud. Take a moment to reflect.</Text>
                                </View>
                            </View>

                            {/* Rakats */}
                            <View style={[styles.card, { borderColor: cardBorder }]}>
                                <Text style={[styles.cardLabel, { color: colors.secondaryText }]}>Rakats prayed</Text>
                                <View style={styles.rakatRow}>
                                    {RAKAT_OPTIONS.map(r => {
                                        const sel = rakats === r;
                                        return (
                                            <TouchableOpacity
                                                key={r}
                                                onPress={() => { setRakats(r); haptic.light(); }}
                                                style={[styles.rakatBtn, sel
                                                    ? { backgroundColor: colors.accent, borderColor: colors.accent }
                                                    : { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }
                                                ]}
                                            >
                                                <Text style={[styles.rakatNum, { color: sel ? '#fff' : colors.secondaryText + '80' }]}>{r}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>

                            {/* Mood */}
                            <View style={[styles.card, { borderColor: cardBorder }]}>
                                <Text style={[styles.cardLabel, { color: colors.secondaryText }]}>How did it feel?</Text>
                                <View style={styles.moodRow}>
                                    {STATE_OPTIONS.slice(0, 3).map(s => {
                                        const mc = MOOD_COLORS[s.key];
                                        const sel = mood === s.key;
                                        return (
                                            <RNAnimated.View key={s.key} style={[{ flex: 1 }, { transform: [{ scale: moodScales.current[s.key] }] }]}>
                                                <TouchableOpacity
                                                    onPress={() => selectMood(s.key)}
                                                    style={[styles.moodCard, sel
                                                        ? { borderColor: mc, backgroundColor: mc + '1a' }
                                                        : { borderColor: 'rgba(255,255,255,0.07)', backgroundColor: 'rgba(255,255,255,0.03)' }
                                                    ]}
                                                    activeOpacity={0.7}
                                                >
                                                    {sel && <View style={[styles.moodDot, { backgroundColor: mc }]} />}
                                                    <Text style={styles.moodEmoji}>{s.emoji}</Text>
                                                    <Text style={[styles.moodLabel, { color: sel ? mc : colors.secondaryText + '80' }]}>{s.label}</Text>
                                                </TouchableOpacity>
                                            </RNAnimated.View>
                                        );
                                    })}
                                </View>
                                <View style={[styles.moodRow, { justifyContent: 'center' }]}>
                                    {STATE_OPTIONS.slice(3).map(s => {
                                        const mc = MOOD_COLORS[s.key];
                                        const sel = mood === s.key;
                                        return (
                                            <RNAnimated.View key={s.key} style={{ width: '47%', transform: [{ scale: moodScales.current[s.key] }] }}>
                                                <TouchableOpacity
                                                    onPress={() => selectMood(s.key)}
                                                    style={[styles.moodCard, { width: '100%' }, sel
                                                        ? { borderColor: mc, backgroundColor: mc + '1a' }
                                                        : { borderColor: 'rgba(255,255,255,0.07)', backgroundColor: 'rgba(255,255,255,0.03)' }
                                                    ]}
                                                    activeOpacity={0.7}
                                                >
                                                    {sel && <View style={[styles.moodDot, { backgroundColor: mc }]} />}
                                                    <Text style={styles.moodEmoji}>{s.emoji}</Text>
                                                    <Text style={[styles.moodLabel, { color: sel ? mc : colors.secondaryText + '80' }]}>{s.label}</Text>
                                                </TouchableOpacity>
                                            </RNAnimated.View>
                                        );
                                    })}
                                </View>
                            </View>

                            {/* Continue */}
                            <TouchableOpacity
                                onPress={handleNext}
                                disabled={!mood}
                                activeOpacity={0.85}
                                style={[styles.continueBtn, mood
                                    ? { backgroundColor: colors.accent, shadowColor: colors.accent, shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 12 }
                                    : { backgroundColor: 'rgba(255,255,255,0.05)' }
                                ]}
                            >
                                <Text style={[styles.continueBtnText, { color: mood ? '#fff' : colors.secondaryText + '50' }]}>Continue</Text>
                                <ChevronRight size={18} color={mood ? '#fff' : colors.secondaryText + '50'} />
                            </TouchableOpacity>

                            <TouchableOpacity onPress={handleClose} style={styles.skipBtn}>
                                <Text style={[styles.skipText, { color: colors.secondaryText + '60' }]}>Skip for now</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </Animated.View>
                )}

                {/* ══ WRITE STEP ══ */}
                {step === 'write' && (
                    <Animated.View entering={FadeInUp.duration(300)} style={{ flex: 1 }}>
                        {/* (back + save buttons moved into the unified top bar above) */}
                        <View style={[styles.writeSurface, { borderColor: colors.accent + '30' }]}>
                            {/* Guide lines */}
                            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                                {Array.from({ length: 20 }).map((_, i) => (
                                    <View key={i} style={[styles.guideLine, { top: 80 + i * 28, backgroundColor: colors.accent + '14' }]} />
                                ))}
                            </View>

                            <ScrollView
                                style={{ flex: 1 }}
                                showsVerticalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                                keyboardDismissMode="on-drag"
                                automaticallyAdjustKeyboardInsets
                            >
                                <Text style={[styles.bismillah, { color: colors.accent }]}>بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيم</Text>
                                <View style={[styles.bismillahDivider, { backgroundColor: colors.accent + '25' }]} />

                                {flashback && (
                                    <View style={styles.flashbackCard}>
                                        <Text style={[styles.flashbackLabel, { color: colors.secondaryText + '70' }]}>🕰  This night last month…</Text>
                                        <Text style={[styles.flashbackText, { color: colors.secondaryText + '80' }]} numberOfLines={3}>{flashback.duaText}</Text>
                                    </View>
                                )}

                                <Text style={[styles.writePrompt, { color: colors.accent }]}>
                                    {displayedPrompt}<Text style={{ opacity: 0.3 }}>|</Text>
                                </Text>

                                <TextInput
                                    ref={inputRef}
                                    style={[styles.writeInput, { color: colors.primaryText }]}
                                    placeholder="Write whatever is on your heart…"
                                    placeholderTextColor={colors.secondaryText + '40'}
                                    multiline
                                    value={duaText}
                                    onChangeText={setDuaText}
                                    textAlignVertical="top"
                                    scrollEnabled={false}
                                />

                                {wordCount > 0 && (
                                    <Text style={[styles.wordCount, { color: colors.secondaryText + '50' }]}>{wordCount} word{wordCount !== 1 ? 's' : ''}</Text>
                                )}
                            </ScrollView>
                        </View>

                        <TouchableOpacity onPress={handleClose} style={styles.skipBtn}>
                            <Text style={[styles.skipText, { color: colors.secondaryText + '60' }]}>Save without writing</Text>
                        </TouchableOpacity>
                    </Animated.View>
                )}

                {/* ══ DONE STEP ══ */}
                {step === 'done' && (
                    <Animated.View entering={ZoomIn.duration(400)} style={styles.doneScreen}>
                        <View style={styles.doneGlow} />
                        <View style={styles.doneCircle}>
                            <Check size={44} color="#22c55e" />
                        </View>
                        <Text style={[styles.doneTitle, { color: colors.primaryText }]}>Saved 🌙</Text>
                        <Text style={[styles.doneSub, { color: colors.secondaryText }]}>
                            {mood ? DONE_MESSAGES[mood] : 'May Allah accept your Tahajjud'}
                        </Text>
                    </Animated.View>
                )}

            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    // Background
    bgGlow: {
        position: 'absolute', width: 280, height: 280, borderRadius: 140,
        top: -80, right: -80,
        backgroundColor: 'rgba(79,70,229,0.07)',
    },
    star: { position: 'absolute', backgroundColor: '#fff' },

    // Top bar
    topBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8,
    },
    closeBtn: {
        width: 34, height: 34, borderRadius: 17,
        backgroundColor: 'rgba(255,255,255,0.06)',
        alignItems: 'center', justifyContent: 'center',
    },
    stepDots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dot: { height: 4, borderRadius: 2 },

    // Mood scroll
    moodScroll: { paddingHorizontal: 20, paddingBottom: 60, gap: 14 },

    // Hero
    hero: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 10 },
    moonWrap: {
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: 'rgba(99,102,241,0.15)',
        borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)',
        alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
    },
    heroText: { flex: 1, gap: 3 },
    dateLabel: { color: '#2d3a52', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
    heroTitle: { color: '#f1f5f9', fontSize: 24, fontWeight: '800' },
    heroSub: { color: '#3d4f68', fontSize: 13, lineHeight: 18 },

    // Cards
    card: {
        borderRadius: 22, borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(255,255,255,0.04)',
        padding: 18, gap: 14,
    },
    cardLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },

    // Rakats
    rakatRow: { flexDirection: 'row', gap: 8 },
    rakatBtn: {
        flex: 1, paddingVertical: 15, borderRadius: 14, borderWidth: 1.5,
        alignItems: 'center', justifyContent: 'center',
    },
    rakatNum: { fontSize: 16, fontWeight: '800' },

    // Mood
    moodRow: { flexDirection: 'row', gap: 10 },
    moodCard: {
        flex: 1, alignItems: 'center', paddingVertical: 20,
        borderRadius: 18, borderWidth: 1.5, gap: 8, position: 'relative',
    },
    moodDot: {
        position: 'absolute', top: 8, right: 8,
        width: 8, height: 8, borderRadius: 4,
    },
    moodEmoji: { fontSize: 36 },
    moodLabel: { fontSize: 12, fontWeight: '700' },

    // Continue
    continueBtn: {
        borderRadius: 18, paddingVertical: 18,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    },
    continueBtnText: { fontSize: 16, fontWeight: '800' },
    skipBtn: { alignItems: 'center', paddingVertical: 14 },
    skipText: { color: '#2d3a52', fontSize: 13 },

    // Write step
    writeTopBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingBottom: 12,
    },
    backBtn: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.06)',
        alignItems: 'center', justifyContent: 'center',
    },
    saveBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 22 },
    saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

    writeSurface: {
        flex: 1, marginHorizontal: 16, marginBottom: 4,
        borderRadius: 24, overflow: 'hidden',
        borderWidth: 1, borderColor: 'rgba(99,102,241,0.18)',
        backgroundColor: 'rgba(10,14,40,0.7)',
        paddingHorizontal: 22, paddingTop: 22, paddingBottom: 16,
    },
    guideLine: {
        position: 'absolute', left: 22, right: 22,
        height: 1, backgroundColor: 'rgba(99,102,241,0.08)',
    },
    bismillah: {
        color: '#7c6ef5', fontSize: 22, textAlign: 'center',
        fontFamily: 'AmiriQuran',
        lineHeight: 42,
        marginBottom: 10,
    },
    bismillahDivider: {
        height: 1, backgroundColor: 'rgba(99,102,241,0.15)',
        marginBottom: 16,
    },
    flashbackCard: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
        padding: 12, gap: 4, marginBottom: 14,
    },
    flashbackLabel: { color: '#3d4f68', fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
    flashbackText: { color: '#4a5f7a', fontSize: 13, lineHeight: 20, fontStyle: 'italic' },
    writePrompt: { color: '#818cf8', fontSize: 17, fontStyle: 'italic', fontWeight: '600', marginBottom: 10 },
    writeInput: { color: '#e2e8f0', fontSize: 16, lineHeight: 28, minHeight: 200 },
    wordCount: { color: '#2d3a52', fontSize: 12, alignSelf: 'flex-end', marginTop: 6 },

    // Done
    doneScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 40 },
    doneGlow: {
        position: 'absolute', width: 220, height: 220, borderRadius: 110,
        backgroundColor: 'rgba(34,197,94,0.06)',
    },
    doneCircle: {
        width: 108, height: 108, borderRadius: 54,
        backgroundColor: 'rgba(34,197,94,0.12)',
        borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)',
        alignItems: 'center', justifyContent: 'center',
    },
    doneTitle: { color: '#f1f5f9', fontSize: 30, fontWeight: '800' },
    doneSub: { color: '#4a5f7a', fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
