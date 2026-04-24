import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { PrayerTimes } from '../lib/prayer-times';
import { format } from 'date-fns';

const PRAYER_ORDER = [
    { key: 'fajr',    label: 'Fajr'    },
    { key: 'dhuhr',   label: 'Dhuhr'   },
    { key: 'asr',     label: 'Asr'     },
    { key: 'maghrib', label: 'Maghrib' },
    { key: 'isha',    label: 'Isha'    },
] as const;

function formatCountdown(ms: number): string {
    if (ms <= 0) return '0m';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m`;
    return '<1m';
}

interface Props {
    prayerTimes: PrayerTimes | null;
}

export function PrayerCountdown({ prayerTimes }: Props) {
    const { colors, cardBg, blurIntensity } = useTheme();
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(t);
    }, []);

    if (!prayerTimes) return null;

    // Find next prayer
    const prayers = PRAYER_ORDER.map(p => ({
        key: p.key,
        label: p.label,
        time: prayerTimes[p.key] as Date,
    }));

    const next = prayers.find(p => p.time > now);
    const msLeft = next ? next.time.getTime() - now.getTime() : 0;

    return (
        <View style={styles.container}>
            <BlurView
                intensity={Math.round(18 * blurIntensity)}
                tint="dark"
                style={[StyleSheet.absoluteFill, { backgroundColor: cardBg, borderRadius: 20 }]}
            />
            <LinearGradient
                colors={[colors.accent + '18', 'transparent']}
                style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            />
            <View style={styles.content}>
                {/* Left: next prayer info */}
                <View style={styles.left}>
                    <Text style={[styles.nextLabel, { color: colors.secondaryText }]}>
                        {next ? 'Next prayer' : 'All done today'}
                    </Text>
                    <Text style={[styles.nextName, { color: colors.primaryText }]}>
                        {next?.label ?? '🌙'}
                    </Text>
                </View>

                {/* Center: countdown */}
                {next && (
                    <View style={styles.center}>
                        <Text style={[styles.countdown, { color: colors.accent }]}>
                            {formatCountdown(msLeft)}
                        </Text>
                    </View>
                )}

                {/* Right: today's times */}
                <View style={styles.right}>
                    {prayers.map(p => {
                        const isPast   = p.time <= now;
                        const isNext   = next?.key === p.key;
                        return (
                            <View key={p.key} style={styles.prayerRow}>
                                <Text style={[
                                    styles.prayerName,
                                    { color: isNext ? colors.accent : isPast ? '#334155' : colors.secondaryText }
                                ]}>
                                    {p.label}
                                </Text>
                                <Text style={[
                                    styles.prayerTime,
                                    { color: isNext ? colors.accent : isPast ? '#334155' : colors.secondaryText }
                                ]}>
                                    {format(p.time, 'h:mm a')}
                                </Text>
                            </View>
                        );
                    })}
                </View>
            </View>
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
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
    },
    left: {
        gap: 2,
        minWidth: 80,
    },
    nextLabel: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    nextName: {
        fontSize: 22,
        fontWeight: '900',
    },
    center: {
        flex: 1,
        alignItems: 'center',
    },
    countdown: {
        fontSize: 20,
        fontWeight: '900',
        fontVariant: ['tabular-nums'],
    },
    right: {
        gap: 3,
        minWidth: 100,
    },
    prayerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
    },
    prayerName: {
        fontSize: 11,
        fontWeight: '700',
    },
    prayerTime: {
        fontSize: 11,
        fontWeight: '500',
    },
});
