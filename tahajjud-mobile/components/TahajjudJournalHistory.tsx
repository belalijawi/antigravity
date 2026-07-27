import React, { useEffect, useState, useCallback } from 'react';
import {
    Modal, View, Text, TouchableOpacity, StyleSheet,
    FlatList, Platform, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { X, BookHeart, Moon, ChevronDown, ChevronUp, Trash2, Heart, PenLine } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { TahajjudJournal, JournalEntry, STATE_OPTIONS } from '../utils/tahajjudJournal';
import { TahajjudJournalModal } from './TahajjudJournalModal';
import { haptic } from '../utils/haptic';
import { format, parseISO, subDays, isValid } from 'date-fns';
import { localDateStr } from '../utils/localDate';
import { t } from '../utils/i18n';

function stateLabel(key: string): string {
    switch (key) {
        case 'tired': return t('journalState.tired');
        case 'focused': return t('journalState.focused');
        case 'emotional': return t('journalState.emotional');
        case 'distracted': return t('journalState.distracted');
        case 'connected': return t('journalState.connected');
        default: return key;
    }
}

interface Props {
    visible: boolean;
    onClose: () => void;
}

function EntryCard({ entry, colors, onDelete, onToggleAnswered }: {
    entry: JournalEntry;
    colors: any;
    onDelete: (id: string) => void;
    onToggleAnswered: (id: string, val: boolean) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const stateOption = STATE_OPTIONS.find(s => s.key === entry.state);
    const hasDua = entry.duaText.trim().length > 0;

    return (
        // Plain View (no `entering`): entering animations on virtualized FlatList
        // rows can stick at opacity:0 on first mount, hiding the list until a
        // scroll — the same bug fixed in Stories.
        <View>
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
                                {isValid(parseISO(entry.date)) ? format(parseISO(entry.date), 'EEE, MMM d') : '—'}
                            </Text>
                            <Text style={styles.entrySub}>
                                {t('journalHist.rakatsCount', { n: entry.rakats })} · {stateOption ? stateLabel(stateOption.key) : ''}
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
                                <Text style={styles.duaLabel}>{t('journalHist.duaLabel')}</Text>
                                <Text style={styles.duaText}>{entry.duaText}</Text>
                                <TouchableOpacity
                                    onPress={() => { haptic.light(); onToggleAnswered(entry.id, !entry.duaAnswered); }}
                                    style={[
                                        styles.answeredBtn,
                                        entry.duaAnswered && { backgroundColor: '#22c55e14', borderColor: '#22c55e44' },
                                        !entry.duaAnswered && { borderColor: 'rgba(255,255,255,0.08)' },
                                    ]}
                                >
                                    <Heart
                                        size={13}
                                        color={entry.duaAnswered ? '#22c55e' : '#334155'}
                                        fill={entry.duaAnswered ? '#22c55e' : 'transparent'}
                                    />
                                    <Text style={[styles.answeredText, { color: entry.duaAnswered ? '#22c55e' : '#334155' }]}>
                                        {entry.duaAnswered ? t('journalHist.duaAnsweredCheck') : t('journalHist.markAnswered')}
                                    </Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <Text style={styles.noDua}>{t('journalHist.noDuaWritten')}</Text>
                        )}
                        <TouchableOpacity
                            onPress={() => { haptic.light(); onDelete(entry.id); }}
                            style={styles.deleteBtn}
                        >
                            <Trash2 size={14} color="#475569" />
                            <Text style={styles.deleteText}>{t('journalHist.deleteEntry')}</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </TouchableOpacity>
        </View>
    );
}

export function TahajjudJournalHistory({ visible, onClose }: Props) {
    const { colors } = useTheme();
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddJournal, setShowAddJournal] = useState(false);

    const todayStr = localDateStr(new Date());
    const hasToday = entries.some(e => e.date === todayStr);
    const todayEntry = entries.find(e => e.date === todayStr);

    const load = useCallback(async () => {
        setLoading(true);
        const all = await TahajjudJournal.getAll();
        setEntries(all);
        setLoading(false);
    }, []);

    useEffect(() => {
        if (visible) load();
    }, [visible, load]);

    // Live subscription — refresh the list the moment any entry is saved/deleted
    useEffect(() => {
        const unsub = TahajjudJournal.subscribe(setEntries);
        return () => unsub();
    }, []);

    const handleDelete = (id: string) => {
        // Journal entries can be very personal — never delete without confirming.
        Alert.alert(
            t('journalHist.deleteEntryTitle'),
            t('journalHist.deleteEntryBody'),
            [
                { text: t('btn.cancel'), style: 'cancel' },
                {
                    text: t('btn.delete'),
                    style: 'destructive',
                    onPress: async () => {
                        haptic.medium();
                        await TahajjudJournal.delete(id);
                        setEntries(prev => prev.filter(e => e.id !== id));
                    },
                },
            ],
            { cancelable: true },
        );
    };

    const handleToggleAnswered = async (id: string, val: boolean) => {
        await TahajjudJournal.markAnswered(id, val);
        setEntries(prev => prev.map(e => e.id === id ? { ...e, duaAnswered: val } : e));
        if (val) haptic.success();
    };

    // Stats
    const totalNights = entries.length;
    const totalRakats = entries.reduce((sum, e) => sum + e.rakats, 0);
    const answeredDuas = entries.filter(e => e.duaAnswered).length;
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
                        <Text style={[styles.headerTitle, { color: colors.accent }]}>{t('journalHist.nightJournalTitle')}</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => { haptic.light(); setShowAddJournal(true); }}
                        style={[styles.writeBtn, { backgroundColor: hasToday ? colors.accent + '22' : colors.accent, borderColor: colors.accent }]}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <PenLine size={14} color={hasToday ? colors.accent : '#fff'} />
                        <Text style={[styles.writeBtnText, { color: hasToday ? colors.accent : '#fff' }]}>
                            {hasToday ? t('journalHist.editBtn') : t('duasTab.writeBtn')}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Stats bar */}
                {totalNights > 0 && (
                    <View style={styles.statsRow}>
                        <View style={[styles.statBox, { borderColor: 'rgba(255,255,255,0.07)' }]}>
                            <Text style={[styles.statNum, { color: colors.accent }]}>{totalNights}</Text>
                            <Text style={styles.statLabel}>{t('journalHist.nightsLabel')}</Text>
                        </View>
                        <View style={[styles.statBox, { borderColor: 'rgba(255,255,255,0.07)' }]}>
                            <Text style={[styles.statNum, { color: colors.accent }]}>{totalRakats}</Text>
                            <Text style={styles.statLabel}>{t('journalHist.rakatsTotal')}</Text>
                        </View>
                        {answeredDuas > 0 && (
                            <View style={[styles.statBox, { borderColor: 'rgba(34,197,94,0.2)', backgroundColor: 'rgba(34,197,94,0.05)' }]}>
                                <Text style={[styles.statNum, { color: '#22c55e' }]}>{answeredDuas}</Text>
                                <Text style={styles.statLabel}>{t('journalHist.duasAnswered')}</Text>
                            </View>
                        )}
                        {!answeredDuas && mostCommonState && (
                            <View style={[styles.statBox, { borderColor: 'rgba(255,255,255,0.07)' }]}>
                                <Text style={styles.statEmoji}>{mostCommonState.emoji}</Text>
                                <Text style={styles.statLabel}>{t('journalHist.usuallyState', { state: stateLabel(mostCommonState.key).toLowerCase() })}</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* 7-day grid */}
                {!loading && entries.length > 0 && (
                    <View style={[styles.weekGrid, { borderColor: 'rgba(255,255,255,0.06)' }]}>
                        <Text style={[styles.weekTitle, { color: colors.secondaryText }]}>{t('journalHist.last7Nights')}</Text>
                        <View style={styles.weekRow}>
                            {Array.from({ length: 7 }).map((_, i) => {
                                const d = subDays(new Date(), 6 - i);
                                const ds = localDateStr(d);
                                const entry = entries.find(e => e.date === ds);
                                const isToday = ds === todayStr;
                                return (
                                    <View key={i} style={styles.weekCell}>
                                        <View style={[
                                            styles.weekCircle,
                                            entry
                                                ? { backgroundColor: colors.accent + '22', borderColor: colors.accent + '55' }
                                                : { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)' },
                                            isToday && !entry && { borderColor: colors.accent + '30' },
                                        ]}>
                                            {entry
                                                ? <Moon size={11} color={colors.accent} />
                                                : <View style={[styles.weekEmpty, { backgroundColor: isToday ? colors.accent + '30' : 'rgba(255,255,255,0.08)' }]} />
                                            }
                                        </View>
                                        <Text style={[styles.weekDayLabel, { color: isToday ? colors.accent : '#334155' }]}>
                                            {format(d, 'EEE').slice(0, 2)}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* List */}
                {loading ? (
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>{t('miniPlayer.loading')}</Text>
                    </View>
                ) : entries.length === 0 ? (
                    <View style={styles.empty}>
                        <Text style={styles.emptyEmoji}>🌙</Text>
                        <Text style={styles.emptyTitle}>{t('journalHist.noEntriesYet')}</Text>
                        <Text style={styles.emptyText}>{t('journalHist.emptyBody')}</Text>
                    </View>
                ) : (
                    <FlatList
                        data={entries}
                        keyExtractor={e => e.id}
                        contentContainerStyle={styles.list}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item }) => (
                            <EntryCard entry={item} colors={colors} onDelete={handleDelete} onToggleAnswered={handleToggleAnswered} />
                        )}
                    />
                )}
            </LinearGradient>

            {/* Add / edit tonight's entry */}
            <TahajjudJournalModal
                visible={showAddJournal}
                initialEntry={todayEntry}
                onClose={() => { setShowAddJournal(false); load(); }}
            />
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
    writeBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 12, paddingVertical: 7,
        borderRadius: 20, borderWidth: 1,
    },
    writeBtnText: { fontSize: 12, fontWeight: '700' },

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
    answeredBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        alignSelf: 'flex-start', paddingVertical: 7, paddingHorizontal: 12,
        borderRadius: 20, borderWidth: 1,
        marginTop: 2,
    },
    answeredText: { fontSize: 12, fontWeight: '600' },
    deleteBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingTop: 8, alignSelf: 'flex-start',
    },
    deleteText: { color: '#475569', fontSize: 12 },

    weekGrid: {
        marginHorizontal: 20, marginBottom: 4,
        borderRadius: 18, borderWidth: 1,
        backgroundColor: 'rgba(255,255,255,0.02)',
        paddingHorizontal: 16, paddingVertical: 14, gap: 12,
    },
    weekTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
    weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
    weekCell: { alignItems: 'center', gap: 6, flex: 1 },
    weekCircle: {
        width: 34, height: 34, borderRadius: 17, borderWidth: 1,
        alignItems: 'center', justifyContent: 'center',
    },
    weekEmpty: { width: 6, height: 6, borderRadius: 3 },
    weekDayLabel: { fontSize: 10, fontWeight: '700' },

    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40 },
    emptyEmoji: { fontSize: 48 },
    emptyTitle: { color: '#f1f5f9', fontSize: 20, fontWeight: '700' },
    emptyText: { color: '#475569', fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
