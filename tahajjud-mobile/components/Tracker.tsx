import React, { useEffect, useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, DeviceEventEmitter, Modal } from "react-native";
import { WidgetPromo, shouldShowWidgetPromo } from './WidgetPromo';
import { TahajjudJournalModal } from './TahajjudJournalModal';
import { TahajjudLetterModal } from './TahajjudLetterModal';
import { StreakMilestoneModal } from './StreakMilestoneModal';
import { AccountabilityPartner } from '../utils/accountabilityPartner';
import { Flame, Trophy, AlertCircle, Star, Sunrise, ShieldCheck, Moon, PenTool, MessageSquarePlus, Snowflake } from "lucide-react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { subDays } from "date-fns";
import { useTheme } from '../context/ThemeContext';
import { usePurchases } from '../context/PurchasesContext';
import { haptic } from '../utils/haptic';
import { getAchievements, checkAchievements, Achievement } from '../utils/achievements';
import { calculateStreakWithGrace } from '../utils/graceDay';
import { refreshWeeklyDigest } from '../utils/weeklyDigest';
import { TahajjudChallenge } from '../utils/tahajjudChallenge';
import { localDateStr } from '../utils/localDate';
import { track } from '../utils/analytics';
import { maybeRequestWeeklyReview } from '../utils/weeklyReview';
import { logTahajjudToMap } from '../utils/tahajjudMap';

const TRACKER_KEY    = 'prayer-tracker-v2';
const BEST_STREAK_KEY = 'tahajjud-best-streak';
const OLD_TRACKER_KEY = 'tahajjud-tracker';
const MILESTONE_SEEN_KEY = 'milestone-seen-v1'; // CSV of milestones already celebrated

const MILESTONE_NIGHTS = [7, 30, 100];

export type PrayerKey = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha' | 'tahajjud';

export const PRAYERS: { key: PrayerKey; label: string }[] = [
    { key: 'fajr',     label: 'Fajr'     },
    { key: 'dhuhr',    label: 'Dhuhr'    },
    { key: 'asr',      label: 'Asr'      },
    { key: 'maghrib',  label: 'Maghrib'  },
    { key: 'isha',     label: 'Isha'     },
    { key: 'tahajjud', label: 'Tahajjud' },
];

const MILESTONES = [
    { days: 3,   label: '3',   color: '#94a3b8' },
    { days: 7,   label: '7',   color: '#f59e0b' },
    { days: 30,  label: '30',  color: '#f97316' },
    { days: 100, label: '100', color: '#a855f7' },
];

const ACHIEVEMENT_ICONS: Record<string, React.ElementType> = {
    Star, Sunrise, ShieldCheck, Moon, PenTool, MessageSquarePlus,
};

export type PrayerHistory = Record<PrayerKey, string[]>;

export function emptyHistory(): PrayerHistory {
    return { fajr: [], dhuhr: [], asr: [], maghrib: [], isha: [], tahajjud: [] };
}

function getMilestone(streak: number) {
    for (let i = MILESTONES.length - 1; i >= 0; i--) {
        if (streak >= MILESTONES[i].days) return MILESTONES[i];
    }
    return null;
}

export function todayStr() {
    return localDateStr(new Date());
}

export function isLoggedToday(dates: string[]) {
    return dates.some(d => localDateStr(d) === todayStr());
}

/**
 * Returns the earliest time (UTC ms) at which each prayer can be logged today,
 * based on the cached prayer times from NightCalculator. Returns null if the
 * times haven't been computed yet (first launch, no location, etc.) — in that
 * case Tracker falls back to allowing all logs.
 *
 * Tahajjud is allowed any time after Isha (so users can log it whenever they
 * actually pray it, even just before sleeping).
 */
export type PrayerStartTimes = Record<PrayerKey, Date>;
export async function loadPrayerStartTimes(): Promise<PrayerStartTimes | null> {
    try {
        const raw = await AsyncStorage.getItem('prayer_times_today_v1');
        if (!raw) return null;
        const j = JSON.parse(raw);
        if (j.date !== todayStr()) return null;
        return {
            fajr:    new Date(j.fajr),
            dhuhr:   new Date(j.dhuhr),
            asr:     new Date(j.asr),
            maghrib: new Date(j.maghrib),
            isha:    new Date(j.isha),
            // Only allow Tahajjud after Isha. Exception: before Fajr (midnight–Fajr)
            // the user is in the active Tahajjud window — last night's Isha has
            // already passed so we use epoch (always enabled) for that window.
            tahajjud: (() => {
                const now = new Date();
                const fajr = new Date(j.fajr);
                const isha = new Date(j.isha);
                return now < fajr ? new Date(0) : isha;
            })(),
        };
    } catch { return null; }
}

export function calculateStreak(dates: string[]): number {
    if (dates.length === 0) return 0;
    const today     = todayStr();
    const yesterday = localDateStr(subDays(new Date(), 1));
    const hasToday     = dates.some(d => localDateStr(d) === today);
    const hasYesterday = dates.some(d => localDateStr(d) === yesterday);
    if (!hasToday && !hasYesterday) return 0;
    let count = 0;
    let check = hasToday ? new Date() : subDays(new Date(), 1);
    while (true) {
        const str = localDateStr(check);
        if (!dates.some(d => localDateStr(d) === str)) break;
        count++;
        check = subDays(check, 1);
    }
    return count;
}

export function Tracker() {
    const { colors, cardBg, blurIntensity } = useTheme();
    const { isPremium, openPaywall } = usePurchases();
    const [history, setHistory]           = useState<PrayerHistory>(emptyHistory());
    const [streaks, setStreaks]            = useState<Record<PrayerKey, number>>({
        fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0, tahajjud: 0,
    });
    const [bestStreak, setBestStreak]     = useState(0);
    const [showWidgetPromo, setShowWidgetPromo] = useState(false);
    const [showJournal, setShowJournal] = useState(false);
    const [showLetter, setShowLetter] = useState(false);
    const [milestoneToShow, setMilestoneToShow] = useState<number | null>(null);
    const [freezeAvailable, setFreezeAvailable] = useState(true);
    const loggingRef = useRef<Set<string>>(new Set()); // prevents race on rapid double-tap
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    const [badgeDetail, setBadgeDetail] = useState<Achievement | null>(null);
    // Cached per-prayer start times for today. Used to grey-out prayers that
    // haven't happened yet — you shouldn't be able to mark Isha as prayed
    // when it's 9 AM. `null` until the calculator finishes (first launch,
    // location pending, etc.) — we don't block logging in that case.
    const [startTimes, setStartTimes] = useState<PrayerStartTimes | null>(null);
    // Refresh every 30s so a prayer becomes loggable the moment its time arrives.
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const reload = () => loadPrayerStartTimes().then(setStartTimes).catch(() => {});
        reload();
        const sub = DeviceEventEmitter.addListener('prayerTimesUpdated', reload);
        const tick = setInterval(() => setNow(new Date()), 30_000);
        return () => { sub.remove(); clearInterval(tick); };
    }, []);

    useEffect(() => { load(); getAchievements().then(setAchievements).catch(() => {}); }, []);

    const load = async () => {
        try {
            const [raw, rawBest, oldRaw] = await Promise.all([
                AsyncStorage.getItem(TRACKER_KEY),
                AsyncStorage.getItem(BEST_STREAK_KEY),
                AsyncStorage.getItem(OLD_TRACKER_KEY),
            ]);
            let parsed: PrayerHistory = emptyHistory();
            if (raw) {
                parsed = { ...emptyHistory(), ...JSON.parse(raw) };
            } else if (oldRaw) {
                parsed.tahajjud = JSON.parse(oldRaw);
                await AsyncStorage.setItem(TRACKER_KEY, JSON.stringify(parsed));
            }
            setHistory(parsed);
            recalcStreaks(parsed);
            if (rawBest) setBestStreak(parseInt(rawBest, 10));
        } catch (e) {
            console.error('Failed to load tracker', e);
        }
    };

    const [graceUsedToday, setGraceUsedToday] = useState(false);

    const recalcStreaks = (h: PrayerHistory) => {
        const s = {} as Record<PrayerKey, number>;
        for (const p of PRAYERS) s[p.key] = calculateStreak(h[p.key]);
        setStreaks(s);
        // Apply weekly freeze to Tahajjud streak — keeps a streak alive across
        // one missed night per ISO week so users aren't punished for one slip.
        calculateStreakWithGrace(h.tahajjud, new Date(), isPremium ? 2 : 1).then(({ streak, graceUsedToday: usedNow, freezeAvailable: freezeOk }) => {
            setStreaks(prev => ({ ...prev, tahajjud: streak }));
            setGraceUsedToday(usedNow);
            setFreezeAvailable(freezeOk);
        }).catch(() => {});
    };


    const maybeShowMilestone = async (newStreak: number) => {
        const target = MILESTONE_NIGHTS.find(m => m === newStreak);
        if (!target) return;
        try {
            const raw = await AsyncStorage.getItem(MILESTONE_SEEN_KEY);
            const seen = raw ? raw.split(',').map(Number) : [];
            if (seen.includes(target)) return;
            await AsyncStorage.setItem(MILESTONE_SEEN_KEY, [...seen, target].join(','));
            track('streak_milestone', { nights: target });
            setMilestoneToShow(target);
        } catch { /* ignore */ }
    };

    // Show paywall to free users at streak milestones (3, 7 nights).
    // Each milestone shown at most once.
    const PAYWALL_STREAK_KEY = 'paywall-streak-shown-v1';
    const PAYWALL_STREAKS = [3, 7];
    const maybeShowStreakPaywall = async (tahajjudDates: string[]) => {
        if (isPremium) return;
        try {
            const streak = calculateStreak(tahajjudDates);
            const target = PAYWALL_STREAKS.find(n => streak === n);
            if (!target) return;
            const raw = await AsyncStorage.getItem(PAYWALL_STREAK_KEY);
            const seen = raw ? raw.split(',').map(Number) : [];
            if (seen.includes(target)) return;
            await AsyncStorage.setItem(PAYWALL_STREAK_KEY, [...seen, target].join(','));
            track('paywall_shown', { trigger: `streak_${target}` });
            // Slight delay so the letter modal has time to close first
            setTimeout(() => openPaywall(), 1800);
        } catch { /* ignore */ }
    };

    // At exactly 5 nights streak, schedule a push notification for the next
    // morning reminding the free user their journal is waiting. Fired once only.
    const STREAK_NOTIF_KEY = 'streak-5-notif-scheduled';
    const maybeScheduleStreakNotification = async (tahajjudDates: string[]) => {
        if (isPremium) return;
        try {
            const streak = calculateStreak(tahajjudDates);
            if (streak !== 5) return;
            const already = await AsyncStorage.getItem(STREAK_NOTIF_KEY);
            if (already) return;
            await AsyncStorage.setItem(STREAK_NOTIF_KEY, 'true');
            // Fire at 9 AM tomorrow — user will see it when they wake up
            const tomorrow9am = new Date();
            tomorrow9am.setDate(tomorrow9am.getDate() + 1);
            tomorrow9am.setHours(9, 0, 0, 0);
            const Notifications = await import('expo-notifications');
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: '5 nights of Tahajjud 🌙',
                    body: "Masha'Allah. Your journal and full history are waiting — try premium free for 7 days.",
                    sound: 'default',
                    data: { type: 'streak_paywall' },
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: tomorrow9am,
                },
            });
            track('streak_notif_scheduled', { streak: 5 });
        } catch { /* ignore */ }
    };

    const save = async (updated: PrayerHistory) => {
        setHistory(updated);
        recalcStreaks(updated);
        await AsyncStorage.setItem(TRACKER_KEY, JSON.stringify(updated));

        // Update best Tahajjud streak
        const s = calculateStreak(updated.tahajjud);
        const prev = await AsyncStorage.getItem(BEST_STREAK_KEY);
        const prevBest = prev ? parseInt(prev, 10) : 0;
        if (s > prevBest) {
            setBestStreak(s);
            await AsyncStorage.setItem(BEST_STREAK_KEY, s.toString());
        }
    };

    const logPrayer = async (key: PrayerKey) => {
        if (isLoggedToday(history[key])) return;
        if (loggingRef.current.has(key)) return; // already in-flight
        loggingRef.current.add(key);

        // Block logging a prayer whose time hasn't started yet (e.g. tapping
        // Isha at 10am). If we don't have today's prayer times yet, allow it
        // — better to not block legitimate logs while data is loading.
        if (startTimes && new Date() < startTimes[key]) {
            const label = PRAYERS.find(p => p.key === key)?.label ?? 'This prayer';
            const fmt = startTimes[key].toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            haptic.medium();
            Alert.alert(`${label} hasn't started yet`, `${label} time begins at ${fmt} today. Come back then.`);
            loggingRef.current.delete(key);
            return;
        }

        haptic.light();
        const isFirstTahajjudEver = key === 'tahajjud' && history.tahajjud.length === 0;
        const updated: PrayerHistory = {
            ...history,
            [key]: [...history[key], new Date().toISOString()],
        };
        try {
            await save(updated);
        } finally {
            // Release the in-flight lock — state now reflects the log so the
            // isLoggedToday guard catches any further taps
            loggingRef.current.delete(key);
        }
        track('prayer_logged', { prayer: key });

        // Weekly review prompt — fires at most once a week, only after 3+ total prayers
        const totalLogged = Object.values(updated).flat().length;
        maybeRequestWeeklyReview(totalLogged).catch(() => {});
        if (key === 'tahajjud') {
            // Check prayer achievements — show upsell to free users
            const totalTahajjud = updated.tahajjud.length;
            checkAchievements('prayer', totalTahajjud)
                .then(newAchievement => {
                    getAchievements().then(setAchievements).catch(() => {});
                    if (newAchievement) {
                        if (!isPremium) {
                            Alert.alert(
                                `🏅 ${newAchievement.title}`,
                                `${newAchievement.description}\n\nUnlock Premium to see your full journey — every prayer, every night, every achievement.`,
                                [
                                    { text: 'MashAllah!', style: 'cancel' },
                                    { text: 'Unlock Premium ⭐', onPress: openPaywall },
                                ]
                            );
                        } else {
                            Alert.alert(`🏅 ${newAchievement.title}`, `MashAllah! ${newAchievement.description}`, [{ text: 'MashAllah!' }]);
                        }
                    }
                })
                .catch(() => {});
            // Milestone celebration card for 7/30/100 night streaks
            calculateStreakWithGrace(updated.tahajjud, new Date(), isPremium ? 2 : 1).then(({ streak }) => {
                maybeShowMilestone(streak);
                // Review handled by maybeRequestWeeklyReview below
            }).catch(() => {});
            // Log for accountability partner
            AccountabilityPartner.logTahajjudForPartner().catch(() => {});
            // Add anonymous dot to global map
            logTahajjudToMap().catch(() => {});
            // Refresh the Friday digest so it reflects this week's count
            refreshWeeklyDigest().catch(() => {});
            // Tell HistoryCalendar + PrayerAnalytics to reload
            DeviceEventEmitter.emit('prayerLogged');
            // Tally toward the 40-night challenge if active
            TahajjudChallenge.recordTahajjudToday().catch(() => {});
            // End any Live Activity (Lock Screen countdown) — they prayed
            import('../utils/liveActivity').then(m => m.LiveActivity.endAll()).catch(() => {});
            // Premium → full journal, free → simple letter
            if (isPremium) {
                setShowJournal(true);
            } else {
                setShowLetter(true);
                maybeShowStreakPaywall(updated.tahajjud).catch(() => {});
                maybeScheduleStreakNotification(updated.tahajjud).catch(() => {});
            }
            if (isFirstTahajjudEver) {
                const show = await shouldShowWidgetPromo();
                if (show) setShowWidgetPromo(true);
            }
        }
    };

    const unlogPrayer = (key: PrayerKey) => {
        if (!isLoggedToday(history[key])) return;
        Alert.alert(
            'Remove log?',
            `Remove today's ${PRAYERS.find(p => p.key === key)?.label} log?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        haptic.light();
                        const today = todayStr();
                        const updated: PrayerHistory = {
                            ...history,
                            [key]: history[key].filter(d => localDateStr(d) !== today),
                        };
                        await save(updated);
                    },
                },
            ]
        );
    };

    // Yesterday's missed prayers — only show the 5 obligatory prayers,
    // not Tahajjud (which most users miss most nights — showing it daily is demoralising).
    // Also only show if the user has at least one log (avoid showing on first open).
    const yesterday = localDateStr(subDays(new Date(), 1));
    const hasAnyHistory = PRAYERS.some(p => history[p.key].length > 0);
    const missedYesterday = hasAnyHistory
        ? PRAYERS.filter(p => p.key !== 'tahajjud' && !history[p.key].some(d => localDateStr(d) === yesterday))
        : [];

    const tahajjudStreak = streaks.tahajjud;
    const milestone      = getMilestone(tahajjudStreak);
    const todayCount     = PRAYERS.filter(p => isLoggedToday(history[p.key])).length;

    return (
        <>
        <View style={styles.container}>
            <LinearGradient
                colors={[colors.shadow, 'rgba(79, 70, 229, 0.05)', 'transparent']}
                style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            />
            <BlurView intensity={Math.round(20 * blurIntensity)} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />

            <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.streakSide}>
                        <View style={styles.iconRow}>
                            {tahajjudStreak >= 3
                                ? <Flame size={26} color={milestone?.color ?? colors.accent} fill={milestone?.color ?? colors.accent} strokeWidth={1.5} />
                                : <Trophy size={22} color={tahajjudStreak > 0 ? colors.accent : colors.secondaryText} />
                            }
                            <Text style={[styles.streakValue, { color: milestone?.color ?? colors.accent }]}>
                                {tahajjudStreak}
                            </Text>
                            <Text style={[styles.streakUnit, { color: colors.secondaryText }]}>
                                {tahajjudStreak === 1 ? 'day' : 'days'}
                            </Text>
                        </View>
                        <View style={styles.freezeRow}>
                            <Text style={[styles.streakLabel, { color: colors.secondaryText }]}>Tahajjud streak</Text>
                            {tahajjudStreak > 0 && (
                                <View style={[
                                    styles.freezePill,
                                    freezeAvailable
                                        ? { backgroundColor: 'rgba(56,189,248,0.12)', borderColor: 'rgba(56,189,248,0.30)' }
                                        : { backgroundColor: 'rgba(100,116,139,0.10)', borderColor: 'rgba(100,116,139,0.20)' },
                                ]}>
                                    <Snowflake size={9} color={freezeAvailable ? '#38bdf8' : '#475569'} />
                                    <Text style={[styles.freezePillText, { color: freezeAvailable ? '#38bdf8' : '#475569' }]}>
                                        {freezeAvailable
                                            ? isPremium ? '2 freezes/week' : 'Freeze ready'
                                            : 'Used this week'}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>

                    <View style={styles.todaySide}>
                        <Text style={[styles.todayCount, { color: todayCount === 6 ? colors.success : colors.accent }]}>
                            {todayCount}/6
                        </Text>
                        <Text style={[styles.todayLabel, { color: colors.secondaryText }]}>today</Text>
                    </View>
                </View>

                {/* Milestone badges */}
                <View style={styles.milestonesRow}>
                    {MILESTONES.map(m => (
                        <View
                            key={m.days}
                            style={[
                                styles.badge,
                                tahajjudStreak >= m.days
                                    ? { backgroundColor: m.color + '22', borderColor: m.color + '66' }
                                    : { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }
                            ]}
                        >
                            <Text style={[styles.badgeText, { color: tahajjudStreak >= m.days ? m.color : '#475569' }]}>
                                {m.label}
                            </Text>
                        </View>
                    ))}
                </View>

                {/* Yesterday missed banner */}
                {missedYesterday.length > 0 && missedYesterday.length < 6 && (
                    <View style={styles.missedBanner}>
                        <AlertCircle size={11} color="#f59e0b" />
                        <Text style={styles.missedText}>
                            Missed yesterday: {missedYesterday.map(p => p.label).join(', ')}
                        </Text>
                    </View>
                )}

                {/* Prayer timeline */}
                <View style={styles.timelineContainer}>
                    {/* Track line */}
                    <View style={styles.trackLine} />

                    {/* Nodes row */}
                    <View style={styles.nodesRow}>
                        {PRAYERS.map(p => {
                            const logged     = isLoggedToday(history[p.key]);
                            const isTahajjud = p.key === 'tahajjud';
                            const streak     = streaks[p.key];
                            // Prayer's time hasn't arrived yet — show node dimmed
                            // and disable taps. If startTimes hasn't loaded yet
                            // we allow it (don't block during cold start).
                            const notYet = !!startTimes && now < startTimes[p.key] && !logged;
                            const nodeColor  = logged
                                ? (isTahajjud ? colors.accent : colors.success)
                                : 'transparent';
                            const borderColor = logged
                                ? nodeColor
                                : notYet
                                    ? 'rgba(255,255,255,0.08)'
                                    : (isTahajjud ? colors.accent + '55' : 'rgba(255,255,255,0.20)');
                            return (
                                <TouchableOpacity
                                    key={p.key}
                                    onPress={() => logPrayer(p.key)}
                                    onLongPress={() => unlogPrayer(p.key)}
                                    delayLongPress={500}
                                    disabled={notYet}
                                    style={[styles.nodeWrapper, notYet && { opacity: 0.35 }]}
                                    activeOpacity={0.7}
                                    accessibilityRole="button"
                                    accessibilityLabel={`${p.label} prayer, ${logged ? 'logged' : notYet ? 'time has not started' : 'not logged'}${streak > 0 ? `, ${streak} day streak` : ''}`}
                                    accessibilityHint={logged ? "Long press to remove today's log" : notYet ? 'This prayer time has not arrived yet' : 'Tap to log this prayer'}
                                    accessibilityState={{ checked: logged, disabled: notYet }}
                                >
                                    <View style={[styles.nodeCircle, { backgroundColor: nodeColor, borderColor }]}>
                                        {logged && <Text style={styles.nodeCheck}>✓</Text>}
                                    </View>
                                    <Text style={[
                                        styles.nodeLabel,
                                        { color: logged ? (isTahajjud ? colors.accent : colors.success) : colors.secondaryText },
                                    ]} numberOfLines={1}>
                                        {p.label}
                                    </Text>
                                    <Text style={[styles.nodeStreak, { color: streak > 0 ? '#64748b' : 'transparent' }]}>
                                        {streak > 0 ? `${streak}d` : '·'}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Achievements */}
                <View style={styles.achievementsSection}>
                    <Text style={[styles.achievementsTitle, { color: colors.secondaryText }]}>BADGES · TAP TO VIEW</Text>
                    <View style={styles.achievementsRow}>
                        {achievements.map(a => {
                            const IconComp = ACHIEVEMENT_ICONS[a.icon];
                            const unlocked = !!a.unlockedAt;
                            return (
                                <TouchableOpacity
                                    key={a.id}
                                    onPress={() => { haptic.light(); setBadgeDetail(a); }}
                                    activeOpacity={0.7}
                                    accessibilityRole="button"
                                    accessibilityLabel={`${a.title} badge, ${unlocked ? 'unlocked' : 'locked'}`}
                                    accessibilityHint="Tap to see how to earn this badge"
                                    style={[
                                        styles.achievementBadge,
                                        unlocked
                                            ? { backgroundColor: colors.accent + '20', borderColor: colors.accent + '50' }
                                            : { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' },
                                    ]}
                                >
                                    {IconComp && <IconComp size={16} color={unlocked ? colors.accent : '#273549'} />}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                <Text style={[styles.hint, { color: '#334155' }]}>Tap to log · Hold to undo</Text>
            </View>
        </View>

        {showWidgetPromo && (
            <WidgetPromo onDismiss={() => setShowWidgetPromo(false)} />
        )}
        <TahajjudJournalModal visible={showJournal} onClose={() => setShowJournal(false)} />
        <TahajjudLetterModal visible={showLetter} onClose={() => setShowLetter(false)} />
        <StreakMilestoneModal
            visible={milestoneToShow !== null}
            nights={milestoneToShow ?? 0}
            onClose={() => setMilestoneToShow(null)}
        />

        {/* Badge detail — shows how to earn / when earned */}
        <Modal
            visible={badgeDetail !== null}
            transparent
            animationType="fade"
            onRequestClose={() => setBadgeDetail(null)}
        >
            <TouchableOpacity
                style={badgeStyles.backdrop}
                activeOpacity={1}
                onPress={() => setBadgeDetail(null)}
            >
                {badgeDetail && (() => {
                    const IconComp = ACHIEVEMENT_ICONS[badgeDetail.icon];
                    const unlocked = !!badgeDetail.unlockedAt;
                    return (
                        <TouchableOpacity activeOpacity={1} style={[
                            badgeStyles.card,
                            { borderColor: unlocked ? colors.accent + '66' : 'rgba(255,255,255,0.10)' },
                        ]}>
                            <View style={[
                                badgeStyles.iconCircle,
                                unlocked
                                    ? { backgroundColor: colors.accent + '22', borderColor: colors.accent + '66' }
                                    : { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.10)' },
                            ]}>
                                {IconComp && <IconComp size={36} color={unlocked ? colors.accent : '#475569'} />}
                            </View>
                            <Text style={[badgeStyles.title, { color: unlocked ? colors.accent : '#cbd5e1' }]}>
                                {badgeDetail.title}
                            </Text>
                            <Text style={badgeStyles.desc}>{badgeDetail.description}</Text>
                            <View style={[badgeStyles.statusPill, unlocked
                                ? { backgroundColor: colors.accent + '22', borderColor: colors.accent + '55' }
                                : { backgroundColor: 'rgba(100,116,139,0.10)', borderColor: 'rgba(100,116,139,0.25)' },
                            ]}>
                                <Text style={[badgeStyles.statusText, { color: unlocked ? colors.accent : '#94a3b8' }]}>
                                    {unlocked
                                        ? `✓ Earned ${new Date(badgeDetail.unlockedAt!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                                        : 'Not yet earned'}
                                </Text>
                            </View>
                            <Text style={badgeStyles.dismissHint}>Tap anywhere to close</Text>
                        </TouchableOpacity>
                    );
                })()}
            </TouchableOpacity>
        </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        borderRadius: 20,
        overflow: 'hidden',
    },
    content: {
        padding: 16,
        gap: 12,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    streakSide: { gap: 2 },
    iconRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    streakValue: {
        fontSize: 26,
        fontWeight: '900',
    },
    streakUnit: {
        fontSize: 12,
        fontWeight: '600',
    },
    streakLabel: {
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    freezeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    freezePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
    },
    freezePillText: {
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 0.4,
    },
    todaySide: {
        alignItems: 'flex-end',
        gap: 2,
    },
    todayCount: {
        fontSize: 22,
        fontWeight: '800',
    },
    todayLabel: {
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    milestonesRow: {
        flexDirection: 'row',
        gap: 6,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        borderWidth: 1,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '700',
    },
    missedBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 7,
        paddingHorizontal: 10,
        borderRadius: 10,
        backgroundColor: 'rgba(245,158,11,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(245,158,11,0.20)',
    },
    missedText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#f59e0b',
        flex: 1,
    },
    timelineContainer: {
        position: 'relative',
        paddingTop: 4,
        paddingBottom: 4,
    },
    trackLine: {
        position: 'absolute',
        top: 20, // half of nodeCircle height (32/2) + paddingTop (4)
        left: '8%',
        right: '8%',
        height: 2,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    nodesRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    nodeWrapper: {
        flex: 1,
        alignItems: 'center',
        gap: 4,
    },
    nodeCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    nodeCheck: {
        color: '#0a0f1e',
        fontSize: 13,
        fontWeight: '900',
    },
    nodeLabel: {
        fontSize: 9,
        fontWeight: '700',
        textAlign: 'center',
    },
    nodeStreak: {
        fontSize: 9,
        fontWeight: '600',
    },
    hint: {
        fontSize: 10,
        textAlign: 'center',
    },
    achievementsSection: { gap: 8 },
    achievementsTitle: {
        fontSize: 9, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase',
    },
    achievementsRow: { flexDirection: 'row', gap: 8 },
    achievementBadge: {
        flex: 1, aspectRatio: 1, borderRadius: 12, borderWidth: 1,
        alignItems: 'center', justifyContent: 'center',
        minHeight: 40,
    },
});

const badgeStyles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.65)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    card: {
        width: '100%',
        maxWidth: 320,
        borderRadius: 24,
        borderWidth: 1,
        padding: 28,
        backgroundColor: '#0a1228',
        alignItems: 'center',
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 18,
    },
    title: {
        fontSize: 22,
        fontWeight: '900',
        letterSpacing: 0.3,
        marginBottom: 8,
        textAlign: 'center',
    },
    desc: {
        fontSize: 14,
        color: '#94a3b8',
        lineHeight: 21,
        textAlign: 'center',
        marginBottom: 20,
    },
    statusPill: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        marginBottom: 16,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    dismissHint: {
        fontSize: 11,
        color: '#475569',
        fontWeight: '600',
    },
});
