import React, { useState, useEffect } from 'react';
import {
    Modal, View, Text, TouchableOpacity, StyleSheet,
    ActivityIndicator, Platform,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
    Play, Pause, SkipBack, SkipForward, ChevronDown,
    Moon, Gauge, X,
} from 'lucide-react-native';
import { useProgress } from 'react-native-track-player';
import { useQuranAudio } from '../context/QuranAudioContext';
import { useTheme } from '../context/ThemeContext';
import { getCurrentReciter, subscribeReciter } from '../utils/reciters';

interface Props { visible: boolean; onClose: () => void; }

const PLAYBACK_RATES = [0.75, 0.9, 1.0, 1.25, 1.5];
const SLEEP_OPTIONS: Array<0 | 15 | 30 | 60> = [0, 15, 30, 60];

function fmt(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export function FullScreenPlayer({ visible, onClose }: Props) {
    const audio = useQuranAudio();
    const { colors, blurIntensity } = useTheme();
    const progress = useProgress(500);
    const [reciterName, setReciterName] = useState(getCurrentReciter().name);
    const [rate, setRateLocal] = useState(1.0);

    useEffect(() => {
        const unsub = subscribeReciter(() => setReciterName(getCurrentReciter().name));
        return () => unsub();
    }, []);

    const handleRate = (r: number) => {
        setRateLocal(r);
        audio.setRate(r);
    };

    const dur = progress.duration || 0;
    const pos = progress.position || 0;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
            <View style={styles.root}>
                <LinearGradient
                    colors={['#06091e', '#0a1228', '#040714']}
                    style={StyleSheet.absoluteFill}
                />

                {/* Top bar — close + reciter */}
                <View style={styles.topBar}>
                    <TouchableOpacity onPress={onClose} style={styles.iconBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                        <ChevronDown size={26} color="#94a3b8" />
                    </TouchableOpacity>
                    <View style={styles.topMeta}>
                        <Text style={styles.kicker}>NOW PLAYING</Text>
                        <Text style={styles.reciter} numberOfLines={1}>{reciterName}</Text>
                    </View>
                    <View style={{ width: 40 }} />
                </View>

                {/* Hero — surah artwork (icon) + name */}
                <View style={styles.hero}>
                    <View style={[styles.artwork, { borderColor: colors.accent + '44', backgroundColor: colors.accent + '10' }]}>
                        <BlurView intensity={Math.round(20 * blurIntensity)} tint="dark" style={StyleSheet.absoluteFill} />
                        <Moon size={84} color={colors.accent} strokeWidth={1.5} />
                    </View>
                    <Text style={styles.surahName} numberOfLines={1}>
                        {audio.currentSurahName ?? '—'}
                    </Text>
                    <Text style={styles.queueIndicator}>
                        {audio.playlistName && audio.queueTotal > 0
                            ? `${audio.playlistName} · ${audio.queueIndex + 1} of ${audio.queueTotal}`
                            : 'Quran'}
                    </Text>
                </View>

                {/* Seek bar */}
                <View style={styles.seekArea}>
                    <Slider
                        style={{ width: '100%', height: 40 }}
                        minimumValue={0}
                        maximumValue={dur || 1}
                        value={pos}
                        onSlidingComplete={(v: number) => audio.seekTo(v)}
                        minimumTrackTintColor={colors.accent}
                        maximumTrackTintColor="rgba(255,255,255,0.15)"
                        thumbTintColor={colors.accent}
                    />
                    <View style={styles.timeRow}>
                        <Text style={styles.timeText}>{fmt(pos)}</Text>
                        <Text style={styles.timeText}>{fmt(dur)}</Text>
                    </View>
                </View>

                {/* Transport controls */}
                <View style={styles.transport}>
                    <TouchableOpacity
                        onPress={audio.skipPrev}
                        style={styles.transportBtn}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        accessibilityRole="button"
                        accessibilityLabel="Previous surah"
                    >
                        <SkipBack size={32} color="#cbd5e1" fill="#cbd5e1" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={audio.togglePlayPause}
                        style={[styles.playBtn, { backgroundColor: colors.accent, shadowColor: colors.accent }]}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel={audio.isPlaying ? 'Pause recitation' : 'Play recitation'}
                        accessibilityState={{ busy: audio.isLoading }}
                    >
                        {audio.isLoading
                            ? <ActivityIndicator size="large" color="#0a1228" />
                            : audio.isPlaying
                                ? <Pause size={36} color="#0a1228" fill="#0a1228" />
                                : <Play size={36} color="#0a1228" fill="#0a1228" style={{ marginLeft: 4 }} />
                        }
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={audio.skipNext}
                        style={styles.transportBtn}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        accessibilityRole="button"
                        accessibilityLabel="Next surah"
                    >
                        <SkipForward size={32} color="#cbd5e1" fill="#cbd5e1" />
                    </TouchableOpacity>
                </View>

                {/* Bottom — speed + sleep timer */}
                <View style={styles.toolsRow}>
                    {/* Playback rate */}
                    <View style={[styles.toolCard, { borderColor: 'rgba(255,255,255,0.06)' }]}>
                        <View style={styles.toolHeader}>
                            <Gauge size={14} color={colors.accent} />
                            <Text style={styles.toolLabel}>SPEED</Text>
                        </View>
                        <View style={styles.toolPills}>
                            {PLAYBACK_RATES.map(r => (
                                <TouchableOpacity
                                    key={r}
                                    onPress={() => handleRate(r)}
                                    style={[
                                        styles.pill,
                                        rate === r
                                            ? { backgroundColor: colors.accent, borderColor: colors.accent }
                                            : { borderColor: 'rgba(255,255,255,0.08)' },
                                    ]}
                                >
                                    <Text style={[styles.pillText, { color: rate === r ? '#0a1228' : '#cbd5e1' }]}>
                                        {r === 1.0 ? '1×' : `${r}×`}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Sleep timer */}
                    <View style={[styles.toolCard, { borderColor: 'rgba(255,255,255,0.06)' }]}>
                        <View style={styles.toolHeader}>
                            <Moon size={14} color={colors.accent} />
                            <Text style={styles.toolLabel}>
                                SLEEP {audio.sleepSecondsLeft > 0 && `· ${fmt(audio.sleepSecondsLeft)}`}
                            </Text>
                        </View>
                        <View style={styles.toolPills}>
                            {SLEEP_OPTIONS.map(m => (
                                <TouchableOpacity
                                    key={m}
                                    onPress={() => audio.setSleepTimer(m)}
                                    style={[
                                        styles.pill,
                                        audio.sleepTimerMins === m
                                            ? { backgroundColor: colors.accent, borderColor: colors.accent }
                                            : { borderColor: 'rgba(255,255,255,0.08)' },
                                    ]}
                                >
                                    <Text style={[styles.pillText, { color: audio.sleepTimerMins === m ? '#0a1228' : '#cbd5e1' }]}>
                                        {m === 0 ? 'Off' : `${m}m`}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </View>

                {/* Stop button */}
                <TouchableOpacity onPress={() => { audio.stop(); onClose(); }} style={styles.stopBtn}>
                    <X size={14} color="#64748b" />
                    <Text style={styles.stopText}>Stop & close</Text>
                </TouchableOpacity>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#040714', paddingTop: Platform.OS === 'ios' ? 56 : 24 },
    topBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingBottom: 16,
    },
    iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    topMeta: { flex: 1, alignItems: 'center' },
    kicker: { color: '#475569', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
    reciter: { color: '#cbd5e1', fontSize: 13, fontWeight: '700', marginTop: 2 },

    hero: { alignItems: 'center', marginTop: 30, marginBottom: 32 },
    artwork: {
        width: 240, height: 240, borderRadius: 28,
        borderWidth: 1, alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', marginBottom: 28,
    },
    surahName: { color: '#f1f5f9', fontSize: 26, fontWeight: '800', letterSpacing: 0.3 },
    queueIndicator: { color: '#64748b', fontSize: 12, fontWeight: '700', marginTop: 6, letterSpacing: 0.5 },

    seekArea: { paddingHorizontal: 24, marginBottom: 12 },
    timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
    timeText: { color: '#475569', fontSize: 11, fontWeight: '700' },

    transport: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 36, marginVertical: 28,
    },
    transportBtn: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
    playBtn: {
        width: 80, height: 80, borderRadius: 40,
        alignItems: 'center', justifyContent: 'center',
        shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 8 },
        elevation: 12,
    },

    toolsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 20 },
    toolCard: {
        flex: 1, borderRadius: 16, borderWidth: 1,
        backgroundColor: 'rgba(255,255,255,0.03)', padding: 12,
    },
    toolHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
    toolLabel: { color: '#94a3b8', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
    toolPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    pill: {
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
        borderWidth: 1, minWidth: 36, alignItems: 'center',
    },
    pillText: { fontSize: 11, fontWeight: '700' },

    stopBtn: {
        flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 6,
        paddingVertical: 12, paddingHorizontal: 16,
    },
    stopText: { color: '#64748b', fontSize: 12, fontWeight: '600' },
});
