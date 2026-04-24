import React, { useState, useRef, useEffect } from 'react';
import {
    Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
    KeyboardAvoidingView, Platform, ScrollView, Animated as RNAnimated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Moon, X, ChevronRight, Check } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { TahajjudJournal, STATE_OPTIONS, SpiritualState } from '../utils/tahajjudJournal';
import { haptic } from '../utils/haptic';
import { format } from 'date-fns';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';

const RAKAT_OPTIONS = [2, 4, 6, 8, 10, 12];

interface Props {
    visible: boolean;
    onClose: () => void;
}

type Step = 'mood' | 'write' | 'done';

export function TahajjudJournalModal({ visible, onClose }: Props) {
    const { colors } = useTheme();
    const [step, setStep] = useState<Step>('mood');
    const [rakats, setRakats] = useState(2);
    const [state, setState] = useState<SpiritualState | null>(null);
    const [duaText, setDuaText] = useState('');
    const [saving, setSaving] = useState(false);
    const inputRef = useRef<TextInput>(null);
    const now = new Date();

    useEffect(() => {
        if (visible) {
            setStep('mood');
            setState(null);
            setRakats(2);
            setDuaText('');
        }
    }, [visible]);

    useEffect(() => {
        if (step === 'write') {
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [step]);

    const handleMoodNext = () => {
        if (!state) return;
        haptic.light();
        setStep('write');
    };

    const handleSave = async () => {
        setSaving(true);
        haptic.success();
        const today = now.toISOString().slice(0, 10);
        await TahajjudJournal.save({ date: today, rakats, state: state ?? 'focused', duaText });
        setSaving(false);
        setStep('done');
        setTimeout(() => onClose(), 1800);
    };

    const handleClose = () => {
        setStep('mood');
        setState(null);
        setRakats(2);
        setDuaText('');
        onClose();
    };

    const wordCount = duaText.trim().split(/\s+/).filter(Boolean).length;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <LinearGradient
                    colors={['#060d1f', '#0a1228', '#060d1f']}
                    style={{ flex: 1 }}
                >
                    {/* Top bar */}
                    <View style={styles.topBar}>
                        <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <X size={18} color="#475569" />
                        </TouchableOpacity>
                        <View style={styles.stepDots}>
                            {(['mood', 'write'] as Step[]).map((s, i) => (
                                <View
                                    key={s}
                                    style={[
                                        styles.dot,
                                        { backgroundColor: step === s || (step === 'done') ? colors.accent : 'rgba(255,255,255,0.12)' },
                                        step === 'write' && s === 'mood' && { backgroundColor: colors.accent + '66' },
                                    ]}
                                />
                            ))}
                        </View>
                        <View style={{ width: 34 }} />
                    </View>

                    {/* ── STEP: MOOD ── */}
                    {step === 'mood' && (
                        <Animated.View entering={FadeInUp.duration(350)} style={{ flex: 1 }}>
                            <ScrollView contentContainerStyle={styles.moodContent} keyboardShouldPersistTaps="handled">

                                {/* Date + greeting */}
                                <View style={styles.heroSection}>
                                    <View style={[styles.moonCircle, { borderColor: colors.accent + '40', backgroundColor: colors.accent + '12' }]}>
                                        <Moon size={28} color={colors.accent} />
                                    </View>
                                    <Text style={styles.dateText}>{format(now, 'EEEE, MMMM d')}</Text>
                                    <Text style={styles.heroTitle}>Alhamdulillah 🤲</Text>
                                    <Text style={styles.heroSub}>You prayed Tahajjud tonight. Take a moment to reflect.</Text>
                                </View>

                                {/* Rakats */}
                                <View style={styles.section}>
                                    <Text style={styles.sectionQ}>How many rakats?</Text>
                                    <View style={styles.rakatRow}>
                                        {RAKAT_OPTIONS.map(r => (
                                            <TouchableOpacity
                                                key={r}
                                                onPress={() => { setRakats(r); haptic.light(); }}
                                                style={[
                                                    styles.rakatBtn,
                                                    rakats === r && { backgroundColor: colors.accent + '28', borderColor: colors.accent },
                                                    rakats !== r && { borderColor: 'rgba(255,255,255,0.1)' },
                                                ]}
                                            >
                                                <Text style={[styles.rakatNum, { color: rakats === r ? colors.accent : '#475569' }]}>{r}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                {/* Mood */}
                                <View style={styles.section}>
                                    <Text style={styles.sectionQ}>How did your prayer feel?</Text>
                                    <View style={styles.moodGrid}>
                                        {STATE_OPTIONS.map(s => (
                                            <TouchableOpacity
                                                key={s.key}
                                                onPress={() => { setState(s.key); haptic.light(); }}
                                                style={[
                                                    styles.moodCard,
                                                    state === s.key && { borderColor: colors.accent, backgroundColor: colors.accent + '18' },
                                                    state !== s.key && { borderColor: 'rgba(255,255,255,0.07)', backgroundColor: 'rgba(255,255,255,0.03)' },
                                                ]}
                                                activeOpacity={0.7}
                                            >
                                                {state === s.key && (
                                                    <View style={[styles.moodCheck, { backgroundColor: colors.accent }]}>
                                                        <Check size={10} color="#fff" />
                                                    </View>
                                                )}
                                                <Text style={styles.moodEmoji}>{s.emoji}</Text>
                                                <Text style={[styles.moodLabel, { color: state === s.key ? colors.accent : '#64748b' }]}>{s.label}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                {/* Next button */}
                                <TouchableOpacity
                                    onPress={handleMoodNext}
                                    disabled={!state}
                                    style={[
                                        styles.nextBtn,
                                        { backgroundColor: state ? colors.accent : 'rgba(255,255,255,0.06)' },
                                    ]}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[styles.nextBtnText, { color: state ? '#fff' : '#334155' }]}>Continue</Text>
                                    <ChevronRight size={18} color={state ? '#fff' : '#334155'} />
                                </TouchableOpacity>

                                <TouchableOpacity onPress={handleClose} style={styles.skipBtn}>
                                    <Text style={styles.skipText}>Skip</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        </Animated.View>
                    )}

                    {/* ── STEP: WRITE ── */}
                    {step === 'write' && (
                        <Animated.View entering={FadeInUp.duration(350)} style={{ flex: 1 }}>
                            <View style={styles.writeHeader}>
                                <TouchableOpacity onPress={() => setStep('mood')} style={styles.backBtn}>
                                    <Text style={styles.backText}>← Back</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleSave}
                                    disabled={saving}
                                    style={[styles.saveBtn, { backgroundColor: colors.accent }]}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.writeArea}>
                                <Text style={styles.arabicBismillah}>بِسْمِ اللَّهِ</Text>
                                <Text style={styles.writePrompt}>Ya Allah, tonight I…</Text>
                                <TextInput
                                    ref={inputRef}
                                    style={styles.writeInput}
                                    placeholder="Write whatever is on your heart. Your duas, your worries, your gratitude…"
                                    placeholderTextColor="#1e3a5f"
                                    multiline
                                    value={duaText}
                                    onChangeText={setDuaText}
                                    textAlignVertical="top"
                                    scrollEnabled={false}
                                />
                                {wordCount > 0 && (
                                    <Text style={styles.wordCount}>{wordCount} word{wordCount !== 1 ? 's' : ''}</Text>
                                )}
                            </View>

                            <TouchableOpacity onPress={handleClose} style={styles.skipBtn}>
                                <Text style={styles.skipText}>Save without writing</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    )}

                    {/* ── STEP: DONE ── */}
                    {step === 'done' && (
                        <Animated.View entering={ZoomIn.duration(400)} style={styles.doneScreen}>
                            <View style={[styles.doneCircle, { borderColor: '#22c55e44', backgroundColor: '#22c55e12' }]}>
                                <Check size={40} color="#22c55e" />
                            </View>
                            <Text style={styles.doneTitle}>Saved 🌙</Text>
                            <Text style={styles.doneSub}>May Allah accept your Tahajjud</Text>
                        </Animated.View>
                    )}
                </LinearGradient>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    topBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
    },
    closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
    stepDots: { flexDirection: 'row', gap: 6 },
    dot: { width: 24, height: 4, borderRadius: 2 },

    // Mood step
    moodContent: { paddingHorizontal: 24, paddingBottom: 40, gap: 28 },
    heroSection: { alignItems: 'center', paddingTop: 8, gap: 10 },
    moonCircle: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    dateText: { color: '#475569', fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
    heroTitle: { color: '#f1f5f9', fontSize: 28, fontWeight: '800', textAlign: 'center' },
    heroSub: { color: '#475569', fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 260 },

    section: { gap: 14 },
    sectionQ: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },

    rakatRow: { flexDirection: 'row', gap: 8 },
    rakatBtn: {
        flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 1,
        alignItems: 'center', justifyContent: 'center',
    },
    rakatNum: { fontSize: 18, fontWeight: '800' },

    moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    moodCard: {
        width: '29%', flexGrow: 1, alignItems: 'center', paddingVertical: 16,
        borderRadius: 18, borderWidth: 1, gap: 6, position: 'relative',
    },
    moodCheck: {
        position: 'absolute', top: 8, right: 8,
        width: 18, height: 18, borderRadius: 9,
        alignItems: 'center', justifyContent: 'center',
    },
    moodEmoji: { fontSize: 30 },
    moodLabel: { fontSize: 12, fontWeight: '600' },

    nextBtn: {
        borderRadius: 18, paddingVertical: 16,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    },
    nextBtnText: { fontSize: 16, fontWeight: '800' },
    skipBtn: { alignItems: 'center', paddingVertical: 12 },
    skipText: { color: '#334155', fontSize: 13 },

    // Write step
    writeHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingBottom: 16,
    },
    backBtn: { padding: 4 },
    backText: { color: '#475569', fontSize: 14, fontWeight: '600' },
    saveBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
    saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

    writeArea: {
        flex: 1, marginHorizontal: 20, padding: 20,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 24, borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)', gap: 8,
    },
    arabicBismillah: { color: '#1e4d7a', fontSize: 20, textAlign: 'center', marginBottom: 4, fontFamily: Platform.OS === 'ios' ? 'Arial' : 'serif' },
    writePrompt: { color: '#1e4d7a', fontSize: 16, fontStyle: 'italic', fontWeight: '600' },
    writeInput: {
        flex: 1, color: '#94a3b8', fontSize: 16, lineHeight: 26,
        minHeight: 200,
    },
    wordCount: { color: '#1e3a5f', fontSize: 12, alignSelf: 'flex-end' },

    // Done step
    doneScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
    doneCircle: { width: 100, height: 100, borderRadius: 50, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    doneTitle: { color: '#f1f5f9', fontSize: 28, fontWeight: '800' },
    doneSub: { color: '#475569', fontSize: 15 },
});
