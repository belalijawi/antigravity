import React, { useEffect, useState, useCallback } from 'react';
import {
    Modal, View, Text, TouchableOpacity, StyleSheet,
    FlatList, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { X, BookHeart, Moon, ChevronDown, ChevronUp, Trash2 } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { TahajjudJournal, JournalEntry, STATE_OPTIONS } from '../utils/tahajjudJournal';
import { haptic } from '../utils/haptic';
import { format, parseISO } from 'date-fns';
import Animated, { FadeInDown } from 'react-native-reanimated';

interface Props {
    visible: boolean;
    onClose: () => void;
}

function EntryCard({ entry, colors, onDelete }: { entry: JournalEntry; colors: any; onDelete: (id: string) => void }) {
    const [expanded, setExpanded] = useState(false);
    const stateOption = STATE_OPTIONS.find(s => s.key === entry.state);
    const hasDua = entry.duaText.trim().length > 0;

    return (
        <Animated.View entering={FadeInDown.duration(300)}>
            <TouchableOpacity
                onPress={() => { setExpanded(v => !v); haptic.light(); }}
                activeOpacity={0.85}
                style={[styles.entryCard, { borderColor: expanded ? colors.accent + '40' : 'rgba(255,255,255,0.07)' }]}
            >
                {/* Top row */}
                <View style={styles.entryTop}>
                    <View style={styles.entryLeft}>
                        <Text style={styles.entryEmoji}>{stateOption?.emoji ?? '🌙'}</Text>
                        <View>
                            <Text style={styles.entryDate}>
                                {format(parseISO(entry.date), 'EEE, MMM d')}
                            </Text>
                            <Text style={styles.entrySub}>
                                {entry.rakats} rakats · {stateOption?.label}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.entryRight}>
                        {hasDua && !expanded && (
                            <View style={[styles.duaBadge, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '33' }]}>
                                <BookHeart size={10} color={colors.accent} />
                            </View>
                        )}
                        {expanded
                            ? <ChevronUp size={16} color="#475569" />
                            : <ChevronDown size={16} color="#475569" />
                        }
                    </View>
                </View>

                {/* Expanded body */}
                {expanded && (
                    <View style={styles.entryBody}>
                        <View style={[styles.divider, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />
                        {hasDua ? (
                            <>
                                <Text style={styles.duaLabel}>Ya Allah, tonight I…</Text>
                                <Text style={styles.duaText}>{entry.duaText}</Text>
                            </>
                        ) : (
                            <Text style={styles.noDua}>No dua written this night</Text>
                        )}
                        <TouchableOpacity
                            onPress={() => { haptic.light(); onDelete(entry.id); }}
                            style={styles.deleteBtn}
                        >
                            <Trash2 size={14} color="#475569" />
                            <Text style={styles.deleteText}>Delete entry</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </TouchableOpacity>
        </Animated.View>
    );
}

export function TahajjudJournalHistory({ visible, onClose }: Props) {
    const { colors } = useTheme();
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        const all = await TahajjudJournal.getAll();
        setEntries(all);
        setLoading(false);
    }, []);

    useEffect(() => {
        if (visible) load();
    }, [visible, load]);

    const handleDelete = async (id: string) => {
        await TahajjudJournal.delete(id);
        setEntries(prev => prev.filter(e => e.id !== id));
        haptic.light();
    };

    // Stats
    const totalNights = entries.length;
    const totalRakats = entries.reduce((sum, e) => sum + e.rakats, 0);
    const mostCommonState = (() => {
        if (!entries.length) return null;
        const counts: Record<string, number> = {};
        entries.forEach(e => { counts[e.state] = (counts[e.state] ?? 0) + 1; });
        const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
        return STATE_OPTIONS.find(s => s.key === top);
    })();

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <LinearGradient colors={['#060d1f', '#0a1228', '#060d1f']} style={{ flex: 1 }}>

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <X size={18} color="#475569" />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Moon size={15} color={colors.accent} />
                        <Text style={[styles.headerTitle, { color: colors.accent }]}>NIGHT JOURNAL</Text>
                    </View>
                    <View style={{ width: 34 }} />
                </View>

                {/* Stats bar */}
                {totalNights > 0 && (
                    <View style={styles.statsRow}>
                        <View style={[styles.statBox, { borderColor: 'rgba(255,255,255,0.07)' }]}>
                            <Text style={[styles.statNum, { color: colors.accent }]}>{totalNights}</Text>
                            <Text style={styles.statLabel}>nights</Text>
                        </View>
                        <View style={[styles.statBox, { borderColor: 'rgba(255,255,255,0.07)' }]}>
                            <Text style={[styles.statNum, { color: colors.accent }]}>{totalRakats}</Text>
                            <Text style={styles.statLabel}>rakats total</Text>
                        </View>
                        {mostCommonState && (
                            <View style={[styles.statBox, { borderColor: 'rgba(255,255,255,0.07)' }]}>
                                <Text style={styles.statEmoji}>{mostCommonState.emoji}</Text>
                                <Text style={styles.statLabel}>usually {mostCommonState.label.toLowerCase()}</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* List */}
                {loading ? (
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>Loading…</Text>
                    </View>
                ) : entries.length === 0 ? (
                    <View style={styles.empty}>
                        <Text style={styles.emptyEmoji}>🌙</Text>
                        <Text style={styles.emptyTitle}>No entries yet</Text>
                        <Text style={styles.emptyText}>Your journal will fill as you pray Tahajjud each night</Text>
                    </View>
                ) : (
                    <FlatList
                        data={entries}
                        keyExtractor={e => e.id}
                        contentContainerStyle={styles.list}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item }) => (
                            <EntryCard entry={item} colors={colors} onDelete={handleDelete} />
                        )}
                    />
                )}
            </LinearGradient>
        </Modal>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    closeBtn: {
        width: 34, height: 34, borderRadius: 17,
        backgroundColor: 'rgba(255,255,255,0.06)',
        alignItems: 'center', justifyContent: 'center',
    },
    headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    headerTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },

    statsRow: {
        flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingVertical: 16,
    },
    statBox: {
        flex: 1, alignItems: 'center', paddingVertical: 14,
        borderRadius: 16, borderWidth: 1,
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    statNum: { fontSize: 22, fontWeight: '800' },
    statEmoji: { fontSize: 22 },
    statLabel: { color: '#475569', fontSize: 11, fontWeight: '600', marginTop: 2 },

    list: { padding: 20, gap: 10, paddingBottom: 60 },

    entryCard: {
        borderRadius: 18, borderWidth: 1,
        backgroundColor: 'rgba(255,255,255,0.03)',
        overflow: 'hidden',
    },
    entryTop: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', padding: 16,
    },
    entryLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    entryEmoji: { fontSize: 28 },
    entryDate: { color: '#f1f5f9', fontSize: 15, fontWeight: '700' },
    entrySub: { color: '#475569', fontSize: 12, marginTop: 2 },
    entryRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    duaBadge: {
        width: 22, height: 22, borderRadius: 11, borderWidth: 1,
        alignItems: 'center', justifyContent: 'center',
    },

    entryBody: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
    divider: { height: 1, marginBottom: 4 },
    duaLabel: { color: '#334155', fontSize: 12, fontStyle: 'italic' },
    duaText: { color: '#94a3b8', fontSize: 15, lineHeight: 24 },
    noDua: { color: '#334155', fontSize: 13, fontStyle: 'italic' },
    deleteBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingTop: 8, alignSelf: 'flex-start',
    },
    deleteText: { color: '#475569', fontSize: 12 },

    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40 },
    emptyEmoji: { fontSize: 48 },
    emptyTitle: { color: '#f1f5f9', fontSize: 20, fontWeight: '700' },
    emptyText: { color: '#475569', fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
