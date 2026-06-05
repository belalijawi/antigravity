/**
 * MosqueEditModal — lets users view and manually fix any prayer time
 * in their imported mosque timetable. Opened from Settings → Prayer Times.
 *
 * Layout: scrollable list of all days → tap a time → inline wheel picker
 * (hours 00-23, minutes 00-59) → confirm → saved instantly.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Modal, View, Text, TouchableOpacity, StyleSheet,
    ScrollView, FlatList, Alert,
} from 'react-native';
import { X, Check } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import {
    getMosqueTimetable, saveMosqueTimetable,
    MosqueTimetable, MosqueDayTimes,
} from '../utils/mosqueTimetable';
import { localDateStr } from '../utils/localDate';
import { DeviceEventEmitter } from 'react-native';

interface Props {
    visible: boolean;
    onClose: () => void;
}

const PRAYERS: { key: keyof MosqueDayTimes; label: string }[] = [
    { key: 'fajr',    label: 'Fajr'    },
    { key: 'dhuhr',   label: 'Dhuhr'   },
    { key: 'asr',     label: 'Asr'     },
    { key: 'maghrib', label: 'Maghrib' },
    { key: 'isha',    label: 'Isha'    },
];

const MONTH_NAMES = ['January','February','March','April','May','June',
    'July','August','September','October','November','December'];

function fmt12(t: string | undefined): string {
    if (!t || !/^\d{2}:\d{2}$/.test(t)) return '--:--';
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'pm' : 'am';
    const hour = h % 12 || 12;
    return `${hour}:${m.toString().padStart(2, '0')}${ampm}`;
}

function dayLabel(dateStr: string): string {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
}

// ── Wheel picker for a single value (hours or minutes) ────────────────────────

const ITEM_H = 44;
const VISIBLE = 5; // rows visible at once

interface WheelProps {
    values: string[];
    selected: number;
    onChange: (idx: number) => void;
    accent: string;
}

function Wheel({ values, selected, onChange, accent }: WheelProps) {
    const ref = useRef<ScrollView>(null);
    // Use state (not ref) so the highlighted row re-renders as the user scrolls
    const [displayIdx, setDisplayIdx] = useState(selected);

    // Scroll to the correct position whenever this wheel is (re)mounted or
    // the initial selected value changes. We use a key prop on the parent
    // to force a fresh mount whenever a different prayer is opened for editing.
    useEffect(() => {
        ref.current?.scrollTo({ y: selected * ITEM_H, animated: false });
        setDisplayIdx(selected);
    }, [selected]);

    const onScroll = useCallback((e: any) => {
        const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
        const clamped = Math.max(0, Math.min(values.length - 1, idx));
        setDisplayIdx(clamped);
        onChange(clamped);
    }, [values.length, onChange]);

    return (
        <View style={wheel.wrap}>
            {/* highlight bar */}
            <View style={[wheel.bar, { borderColor: accent + '55' }]} pointerEvents="none" />
            <ScrollView
                ref={ref}
                showsVerticalScrollIndicator={false}
                snapToInterval={ITEM_H}
                decelerationRate="fast"
                onMomentumScrollEnd={onScroll}
                onScrollEndDrag={onScroll}
                contentContainerStyle={{ paddingVertical: ITEM_H * Math.floor(VISIBLE / 2) }}
                style={{ height: ITEM_H * VISIBLE }}
            >
                {values.map((v, i) => (
                    <View key={i} style={wheel.item}>
                        <Text style={[wheel.text, i === displayIdx && { color: accent, fontWeight: '800' }]}>
                            {v}
                        </Text>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}

const wheel = StyleSheet.create({
    wrap: { width: 64, alignItems: 'center' },
    bar: {
        position: 'absolute',
        top: ITEM_H * Math.floor(VISIBLE / 2),
        left: 4, right: 4,
        height: ITEM_H,
        borderRadius: 8,
        borderWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.12)',
        borderBottomColor: 'rgba(255,255,255,0.12)',
        backgroundColor: 'rgba(255,255,255,0.05)',
        zIndex: 1,
    },
    item: { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
    text: { color: '#475569', fontSize: 22, fontWeight: '500' },
});

const HOURS   = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

// ── Main modal ─────────────────────────────────────────────────────────────────

export function MosqueEditModal({ visible, onClose }: Props) {
    const { colors, blurIntensity } = useTheme();
    const [timetable, setTimetable] = useState<MosqueTimetable | null>(null);
    const [editing, setEditing] = useState<{ date: string; prayer: keyof MosqueDayTimes } | null>(null);
    const [editH, setEditH] = useState(0);
    const [editM, setEditM] = useState(0);
    const [saving, setSaving] = useState(false);
    const today = localDateStr(new Date());

    useEffect(() => {
        if (visible) {
            getMosqueTimetable().then(setTimetable).catch(() => {});
            setEditing(null);
        }
    }, [visible]);

    const sortedDays = timetable
        ? Object.entries(timetable.times).sort(([a], [b]) => a.localeCompare(b))
        : [];

    const openEditor = (date: string, prayer: keyof MosqueDayTimes) => {
        const current = timetable?.times[date]?.[prayer] ?? '00:00';
        const [h, m] = current.split(':').map(Number);
        setEditH(h);
        setEditM(m);
        setEditing({ date, prayer });
    };

    // Validates that a manually-entered time is plausible for a given prayer.
    // Isha is special: it can be either after 18:00 OR before 01:30 (past midnight),
    // matching the same rule used in mosqueTimetable.ts cleanDayTimes().
    const isPrayerTimeValid = (prayer: keyof MosqueDayTimes, totalMins: number): boolean => {
        switch (prayer) {
            case 'fajr':    return totalMins >= 60   && totalMins <= 7 * 60;
            case 'dhuhr':   return totalMins >= 11 * 60 && totalMins <= 15 * 60;
            case 'asr':     return totalMins >= 13 * 60 && totalMins <= 19 * 60;
            case 'maghrib': return totalMins >= 16 * 60 && totalMins <= 22 * 60;
            case 'isha':    return totalMins >= 18 * 60 || totalMins <= 90; // after 18:00 OR before 01:30
            default: return true;
        }
    };

    const PRAYER_RANGE_LABELS: Record<keyof MosqueDayTimes, string> = {
        fajr:    '01:00 – 07:00',
        dhuhr:   '11:00 – 15:00',
        asr:     '13:00 – 19:00',
        maghrib: '16:00 – 22:00',
        isha:    'after 18:00 or before 01:30',
    };

    const confirmEdit = async () => {
        if (!editing || !timetable) return;

        // Validate the time is sensible for this prayer
        const totalMins = editH * 60 + editM;
        if (!isPrayerTimeValid(editing.prayer, totalMins)) {
            const pLabel = PRAYERS.find(p => p.key === editing.prayer)?.label ?? editing.prayer;
            Alert.alert(
                'Time looks wrong',
                `${pLabel} time should be ${PRAYER_RANGE_LABELS[editing.prayer]}. Please check and try again.`,
            );
            return;
        }

        setSaving(true);
        try {
            const newTime = `${editH.toString().padStart(2, '0')}:${editM.toString().padStart(2, '0')}`;
            const updated: MosqueTimetable = {
                ...timetable,
                times: {
                    ...timetable.times,
                    [editing.date]: {
                        ...timetable.times[editing.date],
                        [editing.prayer]: newTime,
                    },
                },
            };
            await saveMosqueTimetable(updated);
            setTimetable(updated);
            DeviceEventEmitter.emit('mosqueTimetableUpdated');
            setEditing(null);
        } catch {
            Alert.alert('Error', 'Failed to save. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const prayerLabel = editing
        ? PRAYERS.find(p => p.key === editing.prayer)?.label ?? ''
        : '';
    const editingDayLabel = editing ? dayLabel(editing.date) : '';
    const currentValue = editing && timetable
        ? timetable.times[editing.date]?.[editing.prayer] ?? '00:00'
        : '00:00';

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.root, { backgroundColor: '#080d1f' }]}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <X size={20} color="#64748b" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Edit Times</Text>
                    <View style={{ width: 28 }} />
                </View>

                {!timetable ? (
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>No mosque timetable imported yet.</Text>
                    </View>
                ) : (
                    <>
                        <Text style={[styles.sub, { color: colors.secondaryText }]}>
                            {timetable.mosqueName ?? 'Mosque timetable'} · tap any time to correct it
                        </Text>

                        <FlatList
                            data={sortedDays}
                            keyExtractor={([date]) => date}
                            contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 16 }}
                            initialNumToRender={10}
                            getItemLayout={(_, i) => ({ length: 64, offset: 64 * i, index: i })}
                            ListHeaderComponent={
                                <View style={styles.tableHead}>
                                    <Text style={[styles.colDate, { color: colors.secondaryText }]}>Date</Text>
                                    {PRAYERS.map(p => (
                                        <Text key={p.key} style={[styles.colTime, { color: colors.secondaryText }]}>
                                            {p.label.slice(0, 3)}
                                        </Text>
                                    ))}
                                </View>
                            }
                            renderItem={({ item: [date, times] }) => {
                                const isToday = date === today;
                                return (
                                    <View style={[styles.row, isToday && { backgroundColor: colors.accent + '10', borderRadius: 10 }]}>
                                        <Text style={[styles.colDate, { color: isToday ? colors.accent : colors.primaryText, fontWeight: isToday ? '800' : '500' }]}>
                                            {dayLabel(date)}
                                        </Text>
                                        {PRAYERS.map(p => {
                                            const t = times[p.key];
                                            const isEditing = editing?.date === date && editing?.prayer === p.key;
                                            return (
                                                <TouchableOpacity
                                                    key={p.key}
                                                    style={[styles.colTime, isEditing && { backgroundColor: colors.accent + '25', borderRadius: 6 }]}
                                                    onPress={() => openEditor(date, p.key)}
                                                    activeOpacity={0.6}
                                                    hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
                                                >
                                                    <Text style={[styles.timeText, { color: isEditing ? colors.accent : colors.primaryText }]}>
                                                        {fmt12(t)}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                );
                            }}
                        />
                    </>
                )}

                {/* ── Time editor sheet ── */}
                {editing && (
                    <View style={[styles.editorSheet, { backgroundColor: '#0d1428', borderColor: colors.accent + '33' }]}>
                        <Text style={styles.editorTitle}>
                            {prayerLabel} · {editingDayLabel}
                        </Text>
                        <Text style={styles.editorCurrent}>
                            Currently: {fmt12(currentValue)}
                        </Text>

                        <View style={styles.wheels}>
                            {/* key forces remount on each new prayer so the wheel
                                scrolls to the correct position fresh every time */}
                            <Wheel
                                key={`h-${editing.date}-${editing.prayer}`}
                                values={HOURS}
                                selected={editH}
                                onChange={setEditH}
                                accent={colors.accent}
                            />
                            <Text style={styles.colon}>:</Text>
                            <Wheel
                                key={`m-${editing.date}-${editing.prayer}`}
                                values={MINUTES}
                                selected={editM}
                                onChange={setEditM}
                                accent={colors.accent}
                            />
                        </View>

                        <View style={styles.editorBtns}>
                            <TouchableOpacity
                                style={[styles.editorBtn, { borderColor: '#334155' }]}
                                onPress={() => setEditing(null)}
                            >
                                <Text style={{ color: '#64748b', fontWeight: '700' }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.editorBtn, { backgroundColor: colors.accent, borderColor: colors.accent }]}
                                onPress={confirmEdit}
                                disabled={saving}
                            >
                                <Check size={16} color="#fff" />
                                <Text style={{ color: '#fff', fontWeight: '800', marginLeft: 6 }}>
                                    {saving ? 'Saving…' : 'Save'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    headerTitle: { color: '#f1f5f9', fontSize: 17, fontWeight: '700' },
    sub: { fontSize: 13, paddingHorizontal: 16, paddingVertical: 10 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyText: { color: '#475569', fontSize: 15 },
    // Table
    tableHead: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
        marginBottom: 4,
    },
    row: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
    },
    colDate: { width: 68, fontSize: 12, fontWeight: '600' },
    colTime: { flex: 1, alignItems: 'center', paddingVertical: 3 },
    timeText: { fontSize: 11, fontWeight: '600' },
    // Editor sheet
    editorSheet: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        borderTopWidth: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingTop: 20, paddingBottom: 40, paddingHorizontal: 24,
    },
    editorTitle: { color: '#f1f5f9', fontSize: 17, fontWeight: '800', textAlign: 'center' },
    editorCurrent: { color: '#64748b', fontSize: 13, textAlign: 'center', marginTop: 4, marginBottom: 16 },
    wheels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    colon: { color: '#f1f5f9', fontSize: 28, fontWeight: '800', marginTop: -4 },
    editorBtns: { flexDirection: 'row', gap: 12, marginTop: 20 },
    editorBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 13, borderRadius: 14, borderWidth: 1,
    },
});
