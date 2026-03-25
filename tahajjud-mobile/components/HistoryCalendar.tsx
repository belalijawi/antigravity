import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { usePurchases } from '../context/PurchasesContext';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
    return new Date(year, month, 1).getDay(); // 0=Sun
}

export function HistoryCalendar() {
    const { colors } = useTheme();
    const { isPremium } = usePurchases();
    const today = new Date();
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());
    const [loggedDates, setLoggedDates] = useState<Set<string>>(new Set());

    // Free users only see last 7 days
    const cutoffDate = isPremium ? null : (() => {
        const d = new Date(today);
        d.setDate(d.getDate() - 6); // today + 6 days back = 7 days
        d.setHours(0, 0, 0, 0);
        return d;
    })();

    const loadHistory = useCallback(async () => {
        try {
            const raw = await AsyncStorage.getItem('tahajjud-tracker');
            if (raw) {
                const dates: string[] = JSON.parse(raw);
                const normalized = new Set(dates.map(d => d.split('T')[0]));
                setLoggedDates(normalized);
            }
        } catch {}
    }, []);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    const prevMonth = () => {
        if (!isPremium) {
            Alert.alert('Tahajjud+ Premium', 'Upgrade to view your full prayer history across all months.');
            return;
        }
        if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
        else setViewMonth(m => m - 1);
    };

    const nextMonth = () => {
        // Don't go beyond current month
        if (viewYear === today.getFullYear() && viewMonth === today.getMonth()) return;
        if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
        else setViewMonth(m => m + 1);
    };

    const isNextDisabled = viewYear === today.getFullYear() && viewMonth === today.getMonth();

    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfWeek(viewYear, viewMonth);
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Count logged days this month
    const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-`;
    const loggedThisMonth = [...loggedDates].filter(d => d.startsWith(monthPrefix)).length;

    // Build grid cells: nulls for empty leading cells, then 1..daysInMonth
    const cells: (number | null)[] = [
        ...Array(firstDay).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    // Pad to complete the last row
    while (cells.length % 7 !== 0) cells.push(null);

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['rgba(79, 70, 229, 0.12)', 'rgba(6, 182, 212, 0.06)', 'transparent']}
                style={[StyleSheet.absoluteFill, { borderRadius: 32 }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />
            <BlurView intensity={20} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 32 }]} />

            <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={[styles.title, { color: colors.accent }]}>Prayer History</Text>
                    <View style={styles.navRow}>
                        <TouchableOpacity onPress={prevMonth} style={styles.navButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            {isPremium ? <ChevronLeft size={16} color={colors.primaryText} /> : <Lock size={12} color="#475569" />}
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
                </View>

                {/* Day of week labels */}
                <View style={styles.weekRow}>
                    {DAYS.map((d, i) => (
                        <Text key={i} style={styles.dayLabel}>{d}</Text>
                    ))}
                </View>

                {/* Calendar grid */}
                <View style={styles.grid}>
                    {cells.map((day, idx) => {
                        if (day === null) {
                            return <View key={`empty-${idx}`} style={styles.cell} />;
                        }
                        const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const cellDate = new Date(viewYear, viewMonth, day);
                        const isLogged = loggedDates.has(dateStr);
                        const isToday = dateStr === todayStr;
                        const isFuture = cellDate > today;
                        const isLocked = !isPremium && cutoffDate !== null && cellDate < cutoffDate;

                        return (
                            <TouchableOpacity
                                key={dateStr}
                                activeOpacity={isLocked ? 0.6 : 1}
                                onPress={isLocked ? () => Alert.alert('Tahajjud+ Premium', 'Upgrade to view your full 30-day prayer history.') : undefined}
                                style={[
                                    styles.cell,
                                    isLogged && !isLocked && styles.cellLogged,
                                    isToday && !isLogged && styles.cellToday,
                                    isLocked && styles.cellLocked,
                                ]}
                            >
                                {isLocked ? (
                                    <Lock size={9} color="#334155" />
                                ) : (
                                    <>
                                        <Text style={[
                                            styles.dayText,
                                            isLogged && styles.dayTextLogged,
                                            isToday && !isLogged && { color: colors.accent },
                                            isFuture && styles.dayTextFuture,
                                        ]}>
                                            {day}
                                        </Text>
                                        {isLogged && <View style={styles.dot} />}
                                    </>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Footer summary */}
                <View style={styles.footer}>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
                        <Text style={[styles.legendText, { color: colors.secondaryText }]}>Tahajjud prayed</Text>
                    </View>
                    <Text style={[styles.countText, { color: colors.accent }]}>
                        {loggedThisMonth} / {daysInMonth} nights
                    </Text>
                </View>

                {!isPremium && (
                    <TouchableOpacity
                        style={styles.upgradeBanner}
                        onPress={() => Alert.alert('Tahajjud+ Premium', 'Upgrade to unlock your full prayer history across all months.')}
                        activeOpacity={0.7}
                    >
                        <Lock size={11} color="#f59e0b" />
                        <Text style={styles.upgradeBannerText}>Upgrade for full history</Text>
                    </TouchableOpacity>
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
        gap: 14,
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
    navButtonDisabled: {
        opacity: 0.3,
    },
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
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    cell: {
        width: `${100 / 7}%`,
        aspectRatio: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 2,
    },
    cellLogged: {
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    cellToday: {
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        backgroundColor: 'rgba(255,255,255,0.04)',
    },
    cellLocked: {
        backgroundColor: 'rgba(30,41,59,0.3)',
        borderRadius: 8,
    },
    dayText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#94a3b8',
    },
    dayTextLogged: {
        color: '#10b981',
        fontWeight: '900',
    },
    dayTextFuture: {
        color: '#334155',
    },
    dot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: '#10b981',
        marginTop: 1,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 4,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    legendText: {
        fontSize: 10,
        fontWeight: '600',
    },
    countText: {
        fontSize: 12,
        fontWeight: '900',
    },
    upgradeBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 7,
        borderRadius: 10,
        backgroundColor: 'rgba(245,158,11,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(245,158,11,0.2)',
        marginTop: 2,
    },
    upgradeBannerText: {
        color: '#f59e0b',
        fontSize: 11,
        fontWeight: '700',
    },
});
