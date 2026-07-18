import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassBg as BlurView } from './GlassBg';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { usePurchases } from '../context/PurchasesContext';
import type { PrayerKey } from './Tracker';
import { localDateStr } from '../utils/localDate';
import { t, getLocale } from '../utils/i18n';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
function getMonths(): string[] {
    return ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].map(k => t(`months.${k}`));
}

const PRAYER_KEYS: PrayerKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha', 'tahajjud'];

const PRAYER_COLORS: Record<PrayerKey, string> = {
    fajr:     '#38bdf8',
    dhuhr:    '#fbbf24',
    asr:      '#fb923c',
    maghrib:  '#f472b6',
    isha:     '#a78bfa',
    tahajjud: '#34d399',
};

// Map of dateStr -> set of logged prayer keys
type DateMap = Record<string, Set<PrayerKey>>;

const CELL = 11;
const GAP  = 2;

function prayerCountColor(count: number): string {
    if (count === 0) return 'rgba(255,255,255,0.06)';
    const opacity = 0.2 + (count / 6) * 0.8;
    return `rgba(52, 211, 153, ${opacity.toFixed(2)})`;
}

function YearHeatmap({ dateMap, colors }: { dateMap: DateMap; colors: any }) {
    // Build 52 weeks ending today. Time flows left-to-right: oldest week
    // is on the far left, the CURRENT week sits on the far right — matches
    // GitHub / Apple Health / Strava heatmap conventions.
    const today = new Date();
    const weeks: Date[][] = [];
    // Start from the Sunday 51 weeks ago
    const start = new Date(today);
    start.setDate(start.getDate() - (start.getDay()) - 51 * 7);

    for (let w = 0; w < 53; w++) {
        const week: Date[] = [];
        for (let d = 0; d < 7; d++) {
            const day = new Date(start);
            day.setDate(start.getDate() + w * 7 + d);
            if (day <= today) week.push(day);
        }
        if (week.length > 0) weeks.push(week);
    }

    // Month labels: find where each month starts
    const monthLabels: { label: string; weekIdx: number }[] = [];
    weeks.forEach((week, wi) => {
        const firstDay = week[0];
        if (firstDay.getDate() <= 7) {
            monthLabels.push({
                label: firstDay.toLocaleString(getLocale(), { month: 'short' }),
                weekIdx: wi,
            });
        }
    });

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            // Open scrolled to the far right so the user sees TODAY first,
            // not the start of the year.
            contentOffset={{ x: weeks.length * (CELL + GAP), y: 0 }}
        >
            <View>
                {/* Month labels */}
                <View style={{ flexDirection: 'row', marginBottom: 4 }}>
                    {weeks.map((week, wi) => {
                        const label = monthLabels.find(m => m.weekIdx === wi);
                        return (
                            <View key={wi} style={{ width: CELL + GAP }}>
                                {label && (
                                    <Text style={{ fontSize: 8, color: '#475569', fontWeight: '700' }}>
                                        {label.label}
                                    </Text>
                                )}
                            </View>
                        );
                    })}
                </View>

                {/* Grid: 7 rows x N weeks */}
                {[0,1,2,3,4,5,6].map(dayOfWeek => (
                    <View key={dayOfWeek} style={{ flexDirection: 'row', marginBottom: GAP }}>
                        {weeks.map((week, wi) => {
                            const day = week[dayOfWeek];
                            if (!day) return <View key={wi} style={{ width: CELL + GAP }} />;
                            const dateStr = localDateStr(day);
                            const isToday = dateStr === localDateStr(today);
                            const count = dateMap[dateStr]?.size ?? 0;
                            return (
                                <View
                                    key={wi}
                                    style={{
                                        width: CELL,
                                        height: CELL,
                                        borderRadius: 2,
                                        marginRight: GAP,
                                        backgroundColor: prayerCountColor(count),
                                        borderWidth: isToday ? 1 : 0,
                                        borderColor: 'rgba(255,255,255,0.4)',
                                    }}
                                />
                            );
                        })}
                    </View>
                ))}

                {/* Legend */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
                    <Text style={{ fontSize: 9, color: '#475569' }}>{t('historyCal.less')}</Text>
                    {[0, 1, 2, 4, 6].map(count => (
                        <View key={count} style={{ width: CELL, height: CELL, borderRadius: 2, backgroundColor: prayerCountColor(count) }} />
                    ))}
                    <Text style={{ fontSize: 9, color: '#475569' }}>{t('historyCal.more')}</Text>
                </View>
            </View>
        </ScrollView>
    );
}

function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfWeek(year: number, month: number) {
    return new Date(year, month, 1).getDay();
}

export function HistoryCalendar() {
    const { colors, cardBg, blurIntensity } = useTheme();
    const { isPremium, openPaywall } = usePurchases();
    const MONTHS = getMonths();
    const today = new Date();
    const [viewYear, setViewYear]   = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());
    const [dateMap, setDateMap]       = useState<DateMap>({});
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'week' | 'month' | 'year'>('week');

    const loadHistory = useCallback(async () => {
        try {
            const raw = await AsyncStorage.getItem('prayer-tracker-v2');
            if (!raw) return;
            const parsed = JSON.parse(raw) as Record<PrayerKey, string[]>;
            const map: DateMap = {};
            for (const key of PRAYER_KEYS) {
                const dates: string[] = parsed[key] ?? [];
                for (const iso of dates) {
                    const d = localDateStr(iso);
                    if (!map[d]) map[d] = new Set();
                    map[d].add(key);
                }
            }
            setDateMap(map);
        } catch {}
    }, []);

    useEffect(() => { loadHistory(); }, [loadHistory]);

    // Reload whenever a prayer is logged from any screen (Tracker or Night Mode)
    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('prayerLogged', loadHistory);
        return () => sub.remove();
    }, [loadHistory]);

    const prevMonth = () => {
        if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
        else setViewMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (viewYear === today.getFullYear() && viewMonth === today.getMonth()) return;
        if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
        else setViewMonth(m => m + 1);
    };

    const isNextDisabled = viewYear === today.getFullYear() && viewMonth === today.getMonth();
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay    = getFirstDayOfWeek(viewYear, viewMonth);
    const todayStr    = localDateStr(today);
    const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-`;

    // Average completion % this month (exclude future days)
    const pastDays = [...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
        .filter(d => {
            const ds = `${monthPrefix}${String(d).padStart(2, '0')}`;
            return new Date(viewYear, viewMonth, d) <= today;
        });
    const totalPossible = pastDays.length * 6;
    const totalLogged   = pastDays.reduce((sum, d) => {
        const ds = `${monthPrefix}${String(d).padStart(2, '0')}`;
        return sum + (dateMap[ds]?.size ?? 0);
    }, 0);
    const avgPct = totalPossible > 0 ? Math.round((totalLogged / totalPossible) * 100) : 0;

    const cells: (number | null)[] = [
        ...Array(firstDay).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    // Free users see last 5 days; premium sees full 7
    const daysToShow = isPremium ? 7 : 5;
    const last7: Date[] = Array.from({ length: daysToShow }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - (daysToShow - 1 - i));
        return d;
    });

    // Week completion %
    const weekLogged = last7.reduce((sum, d) => {
        const ds = localDateStr(d);
        return sum + (dateMap[ds]?.size ?? 0);
    }, 0);
    const weekPct = Math.round((weekLogged / (daysToShow * 6)) * 100);



    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['rgba(79, 70, 229, 0.12)', 'rgba(6, 182, 212, 0.06)', 'transparent']}
                style={[StyleSheet.absoluteFill, { borderRadius: 32 }]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            />
            <BlurView
                intensity={Math.round(20 * blurIntensity)}
                tint="dark"
                style={[StyleSheet.absoluteFill, { backgroundColor: cardBg, borderRadius: 32 }]}
            />

            <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={[styles.title, { color: colors.accent }]}>{t('historyCal.title')}</Text>
                    {viewMode === 'month' && (
                        <View style={styles.navRow}>
                            <TouchableOpacity onPress={prevMonth} style={styles.navButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <ChevronLeft size={16} color={colors.primaryText} />
                            </TouchableOpacity>
                            <Text style={[styles.monthLabel, { color: colors.primaryText }]}>
                                {MONTHS[viewMonth]} {viewYear}
                            </Text>
                            <TouchableOpacity
                                onPress={nextMonth}
                                style={[styles.navButton, isNextDisabled && styles.navButtonDisabled]}
                                disabled={isNextDisabled}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <ChevronRight size={16} color={isNextDisabled ? '#334155' : colors.primaryText} />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* View toggle */}
                <View style={styles.viewToggle}>
                    {(['week', 'month', 'year'] as const).map(mode => {
                        const locked = (mode === 'month' || mode === 'year') && !isPremium;
                        const active = viewMode === mode;
                        return (
                            <TouchableOpacity
                                key={mode}
                                onPress={() => locked ? openPaywall('feature_gate:history_view') : setViewMode(mode)}
                                style={[
                                    styles.toggleBtn,
                                    active && { backgroundColor: colors.accent + '22', borderColor: colors.accent + '55' },
                                ]}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                    <Text style={[styles.toggleText, { color: active ? colors.accent : locked ? '#334155' : colors.secondaryText }]}>
                                        {mode === 'week' ? t('historyCal.viewWeek') : mode === 'month' ? t('historyCal.viewMonth') : t('historyCal.viewYear')}
                                    </Text>
                                    {locked && <Lock size={9} color="#f59e0b" />}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* ── Week View ── */}
                {viewMode === 'week' && (
                    <>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekGrid}>
                            {last7.map((date, i) => {
                                const ds = localDateStr(date);
                                const prayers = dateMap[ds] ?? new Set<PrayerKey>();
                                const count = prayers.size;
                                const isToday = ds === todayStr;
                                const isSelected = selectedDate === ds;
                                const bgOpacity = count / 6 * 0.3;
                                const dayName = date.toLocaleDateString(getLocale(), { weekday: 'short' });
                                return (
                                    <TouchableOpacity
                                        key={ds}
                                        activeOpacity={0.75}
                                        onPress={() => setSelectedDate(isSelected ? null : ds)}
                                        style={[
                                            styles.weekCell,
                                            isToday && { borderColor: 'rgba(255,255,255,0.25)' },
                                            isSelected && { borderColor: colors.accent + '88' },
                                            { backgroundColor: `rgba(16,185,129,${bgOpacity})` },
                                        ]}
                                    >
                                        <Text style={[styles.weekDayName, { color: isToday ? colors.accent : '#475569' }]}>
                                            {dayName}
                                        </Text>
                                        <Text style={[styles.weekDayNum, { color: isToday ? colors.accent : colors.primaryText, fontWeight: isToday ? '900' : '700' }]}>
                                            {date.getDate()}
                                        </Text>
                                        {/* 6 prayer dots in 2 rows */}
                                        <View style={styles.dotsContainer}>
                                            {[PRAYER_KEYS.slice(0, 3), PRAYER_KEYS.slice(3)].map((row, ri) => (
                                                <View key={ri} style={styles.dotsRow}>
                                                    {row.map(pk => (
                                                        <View
                                                            key={pk}
                                                            style={[
                                                                styles.prayerDot,
                                                                { backgroundColor: prayers.has(pk) ? PRAYER_COLORS[pk] : 'rgba(255,255,255,0.10)' },
                                                            ]}
                                                        />
                                                    ))}
                                                </View>
                                            ))}
                                        </View>
                                        <Text style={[styles.weekCount, { color: count === 6 ? colors.accent : '#334155' }]}>
                                            {count}/6
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        {/* Day detail */}
                        {selectedDate && (() => {
                            const prayers = dateMap[selectedDate] ?? new Set<PrayerKey>();
                            const parts = selectedDate.split('-');
                            const label = parts.length === 3
                                ? `${parseInt(parts[2])} ${MONTHS[parseInt(parts[1]) - 1] ?? ''}`
                                : selectedDate;
                            return (
                                <View style={styles.detailPanel}>
                                    <Text style={[styles.detailDate, { color: colors.accent }]}>{label}</Text>
                                    <View style={styles.detailRow}>
                                        {PRAYER_KEYS.map(pk => {
                                            const done = prayers.has(pk);
                                            return (
                                                <View key={pk} style={styles.detailItem}>
                                                    <View style={[styles.detailDot, { backgroundColor: done ? PRAYER_COLORS[pk] : 'rgba(255,255,255,0.08)' }]} />
                                                    <Text style={[styles.detailLabel, { color: done ? PRAYER_COLORS[pk] : '#334155' }]}>
                                                        {t(`prayer.${pk}`)}
                                                    </Text>
                                                </View>
                                            );
                                        })}
                                    </View>
                                    <Text style={[styles.detailSummary, { color: colors.secondaryText }]}>
                                        {t('historyCal.prayersLogged', { n: prayers.size })}
                                    </Text>
                                </View>
                            );
                        })()}

                        {/* Legend */}
                        <View style={styles.legend}>
                            {PRAYER_KEYS.map(pk => (
                                <View key={pk} style={styles.legendItem}>
                                    <View style={[styles.legendDot, { backgroundColor: PRAYER_COLORS[pk] }]} />
                                    <Text style={[styles.legendText, { color: colors.secondaryText }]}>
                                        {t(`prayer.${pk}`)}
                                    </Text>
                                </View>
                            ))}
                        </View>

                        {/* Week footer */}
                        <View style={styles.footer}>
                            <Text style={[styles.footerLabel, { color: colors.secondaryText }]}>{t('historyCal.thisWeekCompletion')}</Text>
                            <Text style={[styles.footerValue, { color: weekPct >= 80 ? colors.success : colors.accent }]}>
                                {weekPct}%
                            </Text>
                        </View>

                    </>
                )}

                {/* ── Month View (premium) ── */}
                {viewMode === 'month' && (
                    <View style={{ minHeight: 300 }}>
                    <>
                        <View style={styles.weekRow}>
                            {DAYS.map((d, i) => (
                                <Text key={i} style={styles.dayLabel}>{d}</Text>
                            ))}
                        </View>

                        <View style={styles.grid}>
                            {cells.map((day, idx) => {
                                if (day === null) return <View key={`empty-${idx}`} style={styles.cell} />;
                                const dateStr  = `${monthPrefix}${String(day).padStart(2, '0')}`;
                                const cellDate = new Date(viewYear, viewMonth, day);
                                const prayers  = dateMap[dateStr] ?? new Set<PrayerKey>();
                                const count    = prayers.size;
                                const isToday  = dateStr === todayStr;
                                const isFuture = cellDate > today;
                                const bgOpacity = isFuture ? 0 : count / 6 * 0.25;
                                const isSelected = selectedDate === dateStr;
                                return (
                                    <TouchableOpacity
                                        key={dateStr}
                                        activeOpacity={0.75}
                                        onPress={() => setSelectedDate(isSelected ? null : dateStr)}
                                        style={[
                                            styles.cell,
                                            isToday && styles.cellToday,
                                            isSelected && { borderWidth: 1, borderColor: colors.accent + '88', borderRadius: 8 },
                                            { backgroundColor: `rgba(16,185,129,${bgOpacity})` },
                                        ]}
                                    >
                                        <Text style={[
                                            styles.dayText,
                                            isToday && { color: colors.accent, fontWeight: '900' },
                                            isFuture && styles.dayTextFuture,
                                            !isFuture && count > 0 && { color: colors.primaryText },
                                        ]}>
                                            {day}
                                        </Text>
                                        {!isFuture && (
                                            <View style={styles.dotsContainer}>
                                                {[PRAYER_KEYS.slice(0, 3), PRAYER_KEYS.slice(3)].map((row, ri) => (
                                                    <View key={ri} style={styles.dotsRow}>
                                                        {row.map(pk => (
                                                            <View
                                                                key={pk}
                                                                style={[styles.prayerDot, { backgroundColor: prayers.has(pk) ? PRAYER_COLORS[pk] : 'rgba(255,255,255,0.10)' }]}
                                                            />
                                                        ))}
                                                    </View>
                                                ))}
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {selectedDate && (() => {
                            const prayers  = dateMap[selectedDate] ?? new Set<PrayerKey>();
                            const parts = selectedDate.split('-');
                            const label = parts.length === 3
                                ? `${parseInt(parts[2])} ${MONTHS[parseInt(parts[1]) - 1] ?? ''}`
                                : selectedDate;
                            return (
                                <View style={styles.detailPanel}>
                                    <Text style={[styles.detailDate, { color: colors.accent }]}>{label}</Text>
                                    <View style={styles.detailRow}>
                                        {PRAYER_KEYS.map(pk => {
                                            const done = prayers.has(pk);
                                            return (
                                                <View key={pk} style={styles.detailItem}>
                                                    <View style={[styles.detailDot, { backgroundColor: done ? PRAYER_COLORS[pk] : 'rgba(255,255,255,0.08)' }]} />
                                                    <Text style={[styles.detailLabel, { color: done ? PRAYER_COLORS[pk] : '#334155' }]}>
                                                        {t(`prayer.${pk}`)}
                                                    </Text>
                                                </View>
                                            );
                                        })}
                                    </View>
                                    <Text style={[styles.detailSummary, { color: colors.secondaryText }]}>
                                        {t('historyCal.prayersLogged', { n: prayers.size })}
                                    </Text>
                                </View>
                            );
                        })()}

                        <View style={styles.legend}>
                            {PRAYER_KEYS.map(pk => (
                                <View key={pk} style={styles.legendItem}>
                                    <View style={[styles.legendDot, { backgroundColor: PRAYER_COLORS[pk] }]} />
                                    <Text style={[styles.legendText, { color: colors.secondaryText }]}>
                                        {t(`prayer.${pk}`)}
                                    </Text>
                                </View>
                            ))}
                        </View>

                        <View style={styles.footer}>
                            <Text style={[styles.footerLabel, { color: colors.secondaryText }]}>{t('historyCal.thisMonthCompletion')}</Text>
                            <Text style={[styles.footerValue, { color: avgPct >= 80 ? colors.success : colors.accent }]}>
                                {avgPct}%
                            </Text>
                        </View>
                    </>
                    {!isPremium && (
                        <View style={styles.lockedOverlay}>
                            <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
                            <View style={styles.lockedContent}>
                                <Lock size={22} color="#f59e0b" />
                                <Text style={styles.lockedTitle}>{t('historyCal.lockedMonthTitle')}</Text>
                                <Text style={styles.lockedSub}>{t('historyCal.lockedMonthSub')}</Text>
                                <TouchableOpacity style={[styles.lockedBtn, { backgroundColor: colors.accent }]} onPress={() => openPaywall('feature_gate:history_month')}>
                                    <Text style={styles.lockedBtnText}>{t('historyCal.unlockBtn')}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                    </View>
                )}

                {/* ── Year View (premium) ── */}
                {viewMode === 'year' && (
                    <View style={{ minHeight: 300 }}>
                        <YearHeatmap dateMap={dateMap} colors={colors} />
                        {!isPremium && (
                            <View style={styles.lockedOverlay}>
                                <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
                                <View style={styles.lockedContent}>
                                    <Lock size={22} color="#f59e0b" />
                                    <Text style={styles.lockedTitle}>{t('historyCal.lockedYearTitle')}</Text>
                                    <Text style={styles.lockedSub}>{t('historyCal.lockedYearSub')}</Text>
                                    <TouchableOpacity style={[styles.lockedBtn, { backgroundColor: colors.accent }]} onPress={() => openPaywall('feature_gate:history_year')}>
                                        <Text style={styles.lockedBtnText}>{t('historyCal.unlockBtn')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: 32,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
    },
    content: {
        padding: 20,
        gap: 12,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: {
        fontSize: 11,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
    },
    navRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    navButton: {
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    navButtonDisabled: { opacity: 0.3 },
    monthLabel: {
        fontSize: 13,
        fontWeight: '800',
        minWidth: 110,
        textAlign: 'center',
    },
    weekRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    dayLabel: {
        flex: 1,
        textAlign: 'center',
        fontSize: 10,
        fontWeight: '700',
        color: '#475569',
        textTransform: 'uppercase',
    },
    weekGrid: {
        flexDirection: 'row',
        gap: 4,
    },
    weekCell: {
        width: 52,
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        gap: 4,
    },
    weekDayName: {
        fontSize: 8,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    weekDayNum: {
        fontSize: 13,
    },
    weekCount: {
        fontSize: 8,
        fontWeight: '700',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    cell: {
        width: `${100 / 7}%`,
        minHeight: 54,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 4,
        borderRadius: 8,
        gap: 3,
    },
    cellToday: {
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.20)',
    },
    dayText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#475569',
    },
    dayTextFuture: {
        color: '#1e293b',
    },
    dotsContainer: {
        gap: 2,
        alignItems: 'center',
    },
    dotsRow: {
        flexDirection: 'row',
        gap: 2,
    },
    prayerDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
    },
    detailPanel: {
        padding: 12,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        gap: 8,
    },
    detailDate: {
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    detailRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    detailDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    detailLabel: {
        fontSize: 11,
        fontWeight: '600',
    },
    detailSummary: {
        fontSize: 10,
        fontWeight: '600',
    },
    legend: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        paddingTop: 4,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    legendDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
    },
    legendText: {
        fontSize: 10,
        fontWeight: '600',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    footerLabel: {
        fontSize: 11,
        fontWeight: '600',
    },
    footerValue: {
        fontSize: 16,
        fontWeight: '900',
    },
    viewToggle: {
        flexDirection: 'row',
        gap: 8,
    },
    toggleBtn: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.10)',
        backgroundColor: 'rgba(255,255,255,0.04)',
    },
    toggleText: {
        fontSize: 12,
        fontWeight: '700',
    },
    lockedOverlay: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        borderRadius: 20, overflow: 'hidden',
        alignItems: 'center', justifyContent: 'center',
    },
    lockedContent: {
        alignItems: 'center', gap: 10, paddingHorizontal: 32,
    },
    lockedTitle: {
        color: '#f1f5f9', fontSize: 18, fontWeight: '800', textAlign: 'center',
    },
    lockedSub: {
        color: '#94a3b8', fontSize: 13, textAlign: 'center', lineHeight: 19,
    },
    lockedBtn: {
        marginTop: 4, paddingHorizontal: 24, paddingVertical: 11,
        borderRadius: 22,
    },
    lockedBtnText: {
        color: '#fff', fontSize: 14, fontWeight: '800',
    },
});
