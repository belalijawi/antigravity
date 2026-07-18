/**
 * Prayer Analytics — premium stats screen showing consistency, patterns
 * and insights across all 6 prayers.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, DeviceEventEmitter } from 'react-native';
import { GlassBg as BlurView } from './GlassBg';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { localDateStr } from '../utils/localDate';
import { subDays } from 'date-fns';
import { t, getLocale } from '../utils/i18n';

type PrayerKey = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha' | 'tahajjud';
type PrayerHistory = Record<PrayerKey, string[]>;

const PRAYERS: { key: PrayerKey; label: string; emoji: string }[] = [
    { key: 'fajr',     label: 'Fajr',     emoji: '🌅' },
    { key: 'dhuhr',    label: 'Dhuhr',    emoji: '☀️' },
    { key: 'asr',      label: 'Asr',      emoji: '🌤' },
    { key: 'maghrib',  label: 'Maghrib',  emoji: '🌇' },
    { key: 'isha',     label: 'Isha',     emoji: '🌃' },
    { key: 'tahajjud', label: 'Tahajjud', emoji: '🌙' },
];

// 2023-01-01 was a Sunday — reference date for deriving localized weekday abbreviations.
function getDayAbbrevs(): string[] {
    return Array.from({ length: 7 }, (_, i) => new Date(2023, 0, 1 + i).toLocaleDateString(getLocale(), { weekday: 'short' }));
}

const PRAYER_COLORS: Record<PrayerKey, string> = {
    fajr: '#38bdf8', dhuhr: '#fbbf24', asr: '#fb923c',
    maghrib: '#f472b6', isha: '#a78bfa', tahajjud: '#34d399',
};

interface Analytics {
    totalLogged: number;
    daysTracked: number;
    overallPct: number;
    perPrayer: Record<PrayerKey, { count: number; pct: number }>;
    bestPrayer: PrayerKey;
    weakestPrayer: PrayerKey;
    bestDay: string;         // e.g. "Friday"
    last30Days: number;      // total prayers in last 30 days
    last30Pct: number;
    dailyByWeekday: number[]; // avg prayers per weekday [Sun..Sat]
}

function emptyHistory(): PrayerHistory {
    return { fajr: [], dhuhr: [], asr: [], maghrib: [], isha: [], tahajjud: [] };
}

async function computeAnalytics(): Promise<Analytics | null> {
    const raw = await AsyncStorage.getItem('prayer-tracker-v2');
    if (!raw) return null;
    const h: PrayerHistory = { ...emptyHistory(), ...JSON.parse(raw) };

    // Collect all unique dates across all prayers
    const allDatesSet = new Set<string>();
    for (const key of Object.keys(h) as PrayerKey[]) {
        for (const ts of h[key]) allDatesSet.add(localDateStr(ts));
    }
    const allDates = Array.from(allDatesSet);
    if (allDates.length === 0) return null;

    // Days tracked = from first ever log to today
    const sorted = [...allDates].sort();
    const firstDate = new Date(sorted[0]);
    const today = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysTracked = Math.max(1, Math.floor((today.getTime() - firstDate.getTime()) / msPerDay) + 1);

    // Per-prayer stats
    const perPrayer = {} as Record<PrayerKey, { count: number; pct: number }>;
    let totalLogged = 0;
    for (const { key } of PRAYERS) {
        const uniqueDays = new Set(h[key].map(ts => localDateStr(ts)));
        const count = uniqueDays.size;
        totalLogged += count;
        perPrayer[key] = { count, pct: Math.round((count / daysTracked) * 100) };
    }

    // Best + weakest prayer (excluding tahajjud from daily-5 comparison for fairness)
    const dailyPrayers: PrayerKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
    const sorted5 = [...dailyPrayers].sort((a, b) => perPrayer[b].pct - perPrayer[a].pct);
    const bestPrayer = sorted5[0];
    const weakestPrayer = sorted5[sorted5.length - 1];

    // Overall %
    const maxPossible = daysTracked * 6;
    const overallPct = Math.round((totalLogged / maxPossible) * 100);

    // Last 30 days
    const cutoff30 = localDateStr(subDays(new Date(), 30));
    let last30 = 0;
    for (const { key } of PRAYERS) {
        for (const ts of h[key]) {
            if (localDateStr(ts) >= cutoff30) last30++;
        }
    }
    const last30Pct = Math.round((last30 / (30 * 6)) * 100);

    // Best day of week — count prayers per weekday
    const weekdayCounts = new Array(7).fill(0);
    const weekdayDays   = new Array(7).fill(0); // how many of each weekday we've tracked
    for (let i = 0; i < daysTracked; i++) {
        const d = subDays(today, i);
        weekdayDays[d.getDay()]++;
    }
    for (const { key } of PRAYERS) {
        for (const ts of h[key]) {
            weekdayCounts[new Date(ts).getDay()]++;
        }
    }
    // Avg prayers per weekday (normalise by how many of that weekday we've had)
    const dailyByWeekday = weekdayCounts.map((c, i) =>
        weekdayDays[i] > 0 ? c / weekdayDays[i] : 0
    );
    const bestDayIdx = dailyByWeekday.indexOf(Math.max(...dailyByWeekday));
    // 2023-01-01 was a Sunday — used purely as a stable reference date to
    // derive the localized weekday name for bestDayIdx (0=Sun..6=Sat).
    const bestDay = new Date(2023, 0, 1 + bestDayIdx).toLocaleDateString(getLocale(), { weekday: 'long' });

    return { totalLogged, daysTracked, overallPct, perPrayer, bestPrayer, weakestPrayer, bestDay, last30Days: last30, last30Pct, dailyByWeekday };
}

function BarCell({ value, max, color }: { value: number; max: number; color: string }) {
    const pct = max > 0 ? value / max : 0;
    return (
        <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 60, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden', justifyContent: 'flex-end' }}>
                <View style={{ width: '100%', height: `${Math.round(pct * 100)}%`, backgroundColor: color, borderRadius: 4 }} />
            </View>
        </View>
    );
}

export function PrayerAnalytics() {
    const { colors, cardBg, blurIntensity } = useTheme();
    const [data, setData] = useState<Analytics | null>(null);
    const [loading, setLoading] = useState(true);

    const reload = () => {
        setLoading(true);
        computeAnalytics()
            .then(setData)
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    };

    useEffect(() => { reload(); }, []);

    // Refresh whenever a prayer is logged from any screen
    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('prayerLogged', reload);
        return () => sub.remove();
    }, []);

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator color={colors.accent} />
            </View>
        );
    }

    if (!data) {
        return (
            <View style={styles.center}>
                <Text style={styles.emptyTitle}>{t('prayerAnalytics.noDataYet')}</Text>
                <Text style={styles.emptySub}>{t('prayerAnalytics.noDataSub')}</Text>
            </View>
        );
    }

    const maxWeekday = Math.max(...data.dailyByWeekday);

    return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

            {/* ── Overview ── */}
            <View style={styles.row}>
                <View style={[styles.card, { flex: 1 }]}>
                    <BlurView intensity={Math.round(20 * blurIntensity)} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />
                    <Text style={styles.statNum}>{data.overallPct}%</Text>
                    <Text style={[styles.statLabel, { color: colors.secondaryText }]}>{t('prayerAnalytics.overallConsistency')}</Text>
                </View>
                <View style={[styles.card, { flex: 1 }]}>
                    <BlurView intensity={Math.round(20 * blurIntensity)} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />
                    <Text style={styles.statNum}>{data.totalLogged}</Text>
                    <Text style={[styles.statLabel, { color: colors.secondaryText }]}>{t('prayerAnalytics.totalLoggedLabel')}</Text>
                </View>
            </View>

            <View style={styles.row}>
                <View style={[styles.card, { flex: 1 }]}>
                    <BlurView intensity={Math.round(20 * blurIntensity)} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />
                    <Text style={styles.statNum}>{data.last30Pct}%</Text>
                    <Text style={[styles.statLabel, { color: colors.secondaryText }]}>{t('prayerAnalytics.last30DaysLabel')}</Text>
                </View>
                <View style={[styles.card, { flex: 1 }]}>
                    <BlurView intensity={Math.round(20 * blurIntensity)} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />
                    <Text style={styles.statNum}>{data.daysTracked}</Text>
                    <Text style={[styles.statLabel, { color: colors.secondaryText }]}>{t('prayerAnalytics.daysTrackedLabel')}</Text>
                </View>
            </View>

            {/* ── Insights ── */}
            <View style={[styles.insightCard, { borderColor: '#22c55e33' }]}>
                <BlurView intensity={Math.round(20 * blurIntensity)} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />
                <Text style={styles.insightEmoji}>
                    {PRAYERS.find(p => p.key === data.bestPrayer)?.emoji}
                </Text>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.insightTitle, { color: '#22c55e' }]}>{t('prayerAnalytics.strongestPrayer')}</Text>
                    <Text style={[styles.insightValue, { color: colors.primaryText }]}>
                        {t('prayerAnalytics.pctOfDays', { label: t(`prayer.${data.bestPrayer}`), pct: data.perPrayer[data.bestPrayer].pct })}
                    </Text>
                </View>
            </View>

            <View style={[styles.insightCard, { borderColor: '#ef444433' }]}>
                <BlurView intensity={Math.round(20 * blurIntensity)} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />
                <Text style={styles.insightEmoji}>
                    {PRAYERS.find(p => p.key === data.weakestPrayer)?.emoji}
                </Text>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.insightTitle, { color: '#ef4444' }]}>{t('prayerAnalytics.needsAttention')}</Text>
                    <Text style={[styles.insightValue, { color: colors.primaryText }]}>
                        {t('prayerAnalytics.pctOfDays', { label: t(`prayer.${data.weakestPrayer}`), pct: data.perPrayer[data.weakestPrayer].pct })}
                    </Text>
                </View>
            </View>

            <View style={[styles.insightCard, { borderColor: colors.accent + '33' }]}>
                <BlurView intensity={Math.round(20 * blurIntensity)} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />
                <Text style={styles.insightEmoji}>📅</Text>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.insightTitle, { color: colors.accent }]}>{t('prayerAnalytics.bestDayOfWeek')}</Text>
                    <Text style={[styles.insightValue, { color: colors.primaryText }]}>{data.bestDay}</Text>
                </View>
            </View>

            {/* ── Per-prayer bars ── */}
            <Text style={[styles.sectionTitle, { color: colors.secondaryText }]}>{t('prayerAnalytics.consistencyPerPrayer')}</Text>
            <View style={[styles.fullCard, { borderColor: 'rgba(255,255,255,0.07)' }]}>
                <BlurView intensity={Math.round(20 * blurIntensity)} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />
                {PRAYERS.map(({ key, emoji }) => {
                    const { count, pct } = data.perPrayer[key];
                    return (
                        <View key={key} style={styles.prayerRow}>
                            <Text style={styles.prayerEmoji}>{emoji}</Text>
                            <Text style={[styles.prayerLabel, { color: colors.primaryText }]}>{t(`prayer.${key}`)}</Text>
                            <View style={styles.barTrack}>
                                <LinearGradient
                                    colors={[PRAYER_COLORS[key], PRAYER_COLORS[key] + '88']}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                    style={[styles.barFill, { width: `${pct}%` }]}
                                />
                            </View>
                            <Text style={[styles.prayerPct, { color: colors.secondaryText }]}>{pct}%</Text>
                        </View>
                    );
                })}
            </View>

            {/* ── Day of week ── */}
            <Text style={[styles.sectionTitle, { color: colors.secondaryText }]}>{t('prayerAnalytics.bestDayUpper')}</Text>
            <View style={[styles.fullCard, { borderColor: 'rgba(255,255,255,0.07)', paddingBottom: 16 }]}>
                <BlurView intensity={Math.round(20 * blurIntensity)} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 80 }}>
                    {data.dailyByWeekday.map((v, i) => (
                        <BarCell key={i} value={v} max={maxWeekday} color={i === data.dailyByWeekday.indexOf(Math.max(...data.dailyByWeekday)) ? colors.accent : 'rgba(255,255,255,0.2)'} />
                    ))}
                </View>
                <View style={{ flexDirection: 'row', gap: 4, marginTop: 6 }}>
                    {getDayAbbrevs().map((d, i) => (
                        <Text key={i} style={[styles.dayLabel, { flex: 1, color: colors.secondaryText }]}>{d}</Text>
                    ))}
                </View>
            </View>

        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scroll: { padding: 16, paddingBottom: 60 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
    emptyTitle: { color: '#f1f5f9', fontSize: 18, fontWeight: '800' },
    emptySub: { color: '#64748b', fontSize: 14, textAlign: 'center' },
    row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    card: {
        borderRadius: 18, overflow: 'hidden', padding: 18,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
        alignItems: 'center',
    },
    statNum: { color: '#f1f5f9', fontSize: 32, fontWeight: '800' },
    statLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 4 },
    insightCard: {
        flexDirection: 'row', alignItems: 'center', gap: 14,
        borderRadius: 16, overflow: 'hidden', padding: 16,
        borderWidth: 1, marginBottom: 10,
    },
    insightEmoji: { fontSize: 28 },
    insightTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
    insightValue: { fontSize: 15, fontWeight: '700', marginTop: 2 },
    sectionTitle: {
        fontSize: 11, fontWeight: '800', letterSpacing: 1.5,
        marginBottom: 10, marginTop: 8,
    },
    fullCard: {
        borderRadius: 18, overflow: 'hidden', padding: 16,
        borderWidth: 1, marginBottom: 16,
    },
    prayerRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
    },
    prayerEmoji: { fontSize: 16, width: 24 },
    prayerLabel: { width: 62, fontSize: 13, fontWeight: '600' },
    barTrack: {
        flex: 1, height: 6, borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden',
    },
    barFill: { height: '100%', borderRadius: 3 },
    prayerPct: { width: 34, fontSize: 12, fontWeight: '700', textAlign: 'right' },
    dayLabel: { fontSize: 9, fontWeight: '700', textAlign: 'center' },
});
