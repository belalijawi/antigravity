/**
 * Home-tab card showing the user's currently-active weekly + monthly
 * challenges, their progress, and a celebration state on completion.
 *
 * No premium gate, no points / XP gaming — just a steady focus point
 * to keep the user motivated. Refreshes when the user returns to Home.
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, DeviceEventEmitter } from 'react-native';
import { GlassBg as BlurView } from './GlassBg';
import { Trophy, CheckCircle2 } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { currentWeeklyAdaptive, currentMonthlyAdaptive, progressFor, ChallengeDef } from '../utils/challenges';
import { track } from '../utils/analytics';
import { t } from '../utils/i18n';

export function ChallengesCard() {
    const { colors, blurIntensity, cardBg } = useTheme();
    const [weekly, setWeekly] = useState<{ c: ChallengeDef; current: number; target: number; complete: boolean } | null>(null);
    const [monthly, setMonthly] = useState<{ c: ChallengeDef; current: number; target: number; complete: boolean } | null>(null);
    // Tracks which challenge ids we've already fired a completion event for,
    // so a re-render (e.g. another prayer logged the same day) doesn't double-count.
    const completedIdsRef = useRef<Set<string>>(new Set());

    const refresh = useCallback(async () => {
        const [w, m] = await Promise.all([currentWeeklyAdaptive(), currentMonthlyAdaptive()]);
        const [wp, mp] = await Promise.all([progressFor(w), progressFor(m)]);
        setWeekly({ c: w, ...wp });
        setMonthly({ c: m, ...mp });
        for (const [kind, def, prog] of [['weekly', w, wp], ['monthly', m, mp]] as const) {
            if (prog.complete && !completedIdsRef.current.has(def.id)) {
                completedIdsRef.current.add(def.id);
                track('challenge_completed', { kind, metric: def.metric, target: prog.target });
            }
        }
    }, []);

    useEffect(() => {
        refresh();
        // Refresh whenever a prayer is logged so progress feels live.
        // NOTE: the event is 'prayerLogged' (emitted by Tracker/HomeTab) — the
        // old 'prayer-logged' name never matched, so the card never updated live.
        const sub = DeviceEventEmitter.addListener('prayerLogged', refresh);
        return () => sub.remove();
    }, [refresh]);

    if (!weekly || !monthly) return null;

    return (
        <Animated.View
            entering={FadeInDown.duration(400).delay(150)}
            style={[styles.card, { borderColor: colors.accent + '30' }]}
        >
            <BlurView
                intensity={Math.round(15 * blurIntensity)}
                tint="dark"
                style={[StyleSheet.absoluteFill, { backgroundColor: cardBg, borderRadius: 20 }]}
            />

            <View style={styles.header}>
                <View style={[styles.iconWrap, { backgroundColor: colors.accent + '22', borderColor: colors.accent + '44' }]}>
                    <Trophy size={14} color={colors.accent} />
                </View>
                <Text style={[styles.kicker, { color: colors.accent }]}>{t('challenges.kicker')}</Text>
            </View>

            <ChallengeRow data={weekly} colors={colors} />
            <View style={styles.spacer} />
            <ChallengeRow data={monthly} colors={colors} />
        </Animated.View>
    );
}

function ChallengeRow({
    data, colors,
}: {
    data: { c: ChallengeDef; current: number; target: number; complete: boolean };
    colors: any;
}) {
    const { c, current, target, complete } = data;
    const percent = Math.min(100, Math.round((current / target) * 100));
    return (
        <View style={styles.row}>
            <View style={styles.rowHead}>
                <Text style={[styles.periodLabel, { color: colors.accent }]}>
                    {c.kind === 'weekly' ? t('challenges.thisWeek') : t('challenges.thisMonth')}
                </Text>
                <Text style={[styles.progress, { color: complete ? colors.success : colors.secondaryText }]}>
                    {current} / {target}
                </Text>
            </View>
            <Text style={[styles.title, { color: colors.primaryText }]}>{c.title}</Text>
            <Text style={[styles.body, { color: colors.secondaryText }]} numberOfLines={2}>
                {complete ? c.reward : c.body}
            </Text>
            <View style={styles.barTrack}>
                <View style={[
                    styles.barFill,
                    { width: `${percent}%`, backgroundColor: complete ? colors.success : colors.accent },
                ]} />
            </View>
            {complete && (
                <View style={styles.completeRow}>
                    <CheckCircle2 size={12} color={colors.success} />
                    <Text style={[styles.completeText, { color: colors.success }]}>{t('challenges.completed')}</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        marginHorizontal: 16, marginTop: 12, marginBottom: 4,
        padding: 18, borderRadius: 20, borderWidth: 1, overflow: 'hidden',
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
    iconWrap: {
        width: 24, height: 24, borderRadius: 12, borderWidth: 1,
        alignItems: 'center', justifyContent: 'center',
    },
    kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
    row: { gap: 4 },
    rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
    periodLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
    progress: { fontSize: 12, fontWeight: '700' },
    title: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
    body: { fontSize: 12, lineHeight: 17, fontWeight: '500' },
    barTrack: {
        height: 5, borderRadius: 3, marginTop: 6,
        backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden',
    },
    barFill: { height: '100%', borderRadius: 3 },
    completeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
    completeText: { fontSize: 11, fontWeight: '700' },
    spacer: { height: 18 },
});
