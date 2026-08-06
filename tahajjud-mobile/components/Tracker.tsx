import React, { useEffect, useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, DeviceEventEmitter, Modal, Platform } from "react-native";
import { WidgetPromo, shouldShowWidgetPromo } from './WidgetPromo';
import { TahajjudJournalModal } from './TahajjudJournalModal';
import { TahajjudLetterModal } from './TahajjudLetterModal';
import { StreakMilestoneModal } from './StreakMilestoneModal';
import { AccountabilityPartner } from '../utils/accountabilityPartner';
import { Flame, Trophy, AlertCircle, Star, Sunrise, ShieldCheck, Moon, PenTool, MessageSquarePlus, Snowflake, PauseCircle, PlayCircle, Heart, ChevronRight } from "lucide-react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { GlassBg as BlurView } from './GlassBg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { subDays } from "date-fns";
import { useTheme } from '../context/ThemeContext';
import { usePurchases } from '../context/PurchasesContext';
import { haptic } from '../utils/haptic';
import { getAchievements, checkAchievements, Achievement } from '../utils/achievements';
import { calculateStreakWithGrace, isStreakPaused, startStreakPause, endStreakPause, getActivePause, PauseReason } from '../utils/graceDay';
import { logTahajjudToMap } from '../utils/tahajjudMap';
import { refreshWeeklyDigest } from '../utils/weeklyDigest';
import { TahajjudChallenge } from '../utils/tahajjudChallenge';
import { localDateStr } from '../utils/localDate';
import { track } from '../utils/analytics';
import { requestReviewAtMilestone } from '../utils/weeklyReview';
import { t } from '../utils/i18n';

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

// Live-translated prayer name — PRAYERS.label above stays English as a stable
// fallback/key for non-UI consumers; UI code in this file should call this
// instead so labels follow the current locale.
function prayerLabel(key: PrayerKey): string {
    return t(`prayer.${key}`);
}

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
            // Tahajjud unlock window: from Isha time until 3 hours after Fajr.
            // The 3-hour grace handles the common case where someone prays at
            // 3 AM but only remembers to log when they wake up at 7–8 AM.
            // Before Fajr: always unlocked (epoch = always in the past).
            // After Fajr: unlocked until fajr + 3 h, then locked for the day.
            tahajjud: (() => {
                const now = new Date();
                const fajr = new Date(j.fajr);
                const isha = new Date(j.isha);
                const graceEnd = new Date(fajr.getTime() + 3 * 60 * 60 * 1000);
                if (now < fajr) return new Date(0);          // pre-Fajr: always open
                if (now < graceEnd) return new Date(0);      // grace window: still open
                return isha;                                  // past grace: locked (isha is in the past → button greys out)
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
    // Mirrors `history` synchronously (no waiting for a re-render). Rapid
    // taps on two DIFFERENT prayers before React re-renders would otherwise
    // both read the same stale `history` closure value and the second
    // save() would overwrite (drop) the first log — reading from this ref
    // instead always sees the latest write immediately.
    const historyRef = useRef<PrayerHistory>(history);
    const [streaks, setStreaks]            = useState<Record<PrayerKey, number>>({
        fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0, tahajjud: 0,
    });
    const [bestStreak, setBestStreak]     = useState(0);
    const [showWidgetPromo, setShowWidgetPromo] = useState(false);
    const [showJournal, setShowJournal] = useState(false);
    const [showLetter, setShowLetter] = useState(false);
    const [milestoneToShow, setMilestoneToShow] = useState<number | null>(null);
    // A streak paywall queued to open AFTER the letter modal closes. Opening it
    // while the letter modal is still up would put two modals on screen at once
    // and freeze the UI, so we defer it to the letter's onClose.
    const pendingPaywallRef = useRef<string | null>(null);
    const [freezeAvailable, setFreezeAvailable] = useState(true);
    const [paused, setPaused] = useState(false);
    const [pauseModalVisible, setPauseModalVisible] = useState(false);
    const [showYesterdayModal, setShowYesterdayModal] = useState(false);
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

    // When the cloud restore merges anything new into local storage (fresh
    // reinstall, second device), re-read so the streak reappears instantly.
    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('prayerHistoryRestored', () => { load(); });
        return () => sub.remove();
    }, []);

    // A prayer can be logged from OUTSIDE this screen entirely — the
    // notification "Log" action (quickLogPrayer) or a widget tap
    // (drainPendingPrayerLogs) both write straight to AsyncStorage and emit
    // 'prayerLogged'. Without re-reading here, historyRef.current stays
    // stale, and the next in-app logPrayer()/unlogPrayer() call would build
    // its update from that stale snapshot and silently overwrite (drop) the
    // background-logged prayer on save().
    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('prayerLogged', () => { load(); });
        return () => sub.remove();
    }, []);

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
            historyRef.current = parsed;
            setHistory(parsed);
            const isPaused = await isStreakPaused();
            setPaused(isPaused);
            recalcStreaks(parsed, isPaused);
            if (rawBest) setBestStreak(parseInt(rawBest, 10));
        } catch (e) {
            console.error('Failed to load tracker', e);
        }
    };

    const [graceUsedToday, setGraceUsedToday] = useState(false);

    const recalcStreaks = (h: PrayerHistory, isPaused: boolean = paused) => {
        const s = {} as Record<PrayerKey, number>;
        for (const p of PRAYERS) s[p.key] = calculateStreak(h[p.key]);
        setStreaks(s);
        // Apply weekly freeze to Tahajjud streak — keeps a streak alive across
        // one missed night per ISO week so users aren't punished for one slip.
        // Exempt (paused) days are bridged inside calculateStreakWithGrace.
        calculateStreakWithGrace(h.tahajjud, new Date(), isPremium ? 2 : 1).then(({ streak, graceUsedToday: usedNow, freezeAvailable: freezeOk }) => {
            setStreaks(prev => ({ ...prev, tahajjud: streak }));
            setGraceUsedToday(usedNow);
            setFreezeAvailable(freezeOk);
            // Streak-at-risk reminder: if they have a streak but haven't prayed
            // tonight yet, remind them this evening so they don't lose it.
            // While paused (e.g. menstruation), never nudge — there is no
            // obligation to pray, so a guilt reminder would be wrong.
            const prayedTonight = isLoggedToday(h.tahajjud);
            import('../utils/streakReminder').then(m => {
                if (!isPaused && streak >= 2 && !prayedTonight) m.scheduleStreakAtRisk(streak);
                else m.cancelStreakAtRisk();
            }).catch(() => {});
            // Win-back reminders — anchored to the last Tahajjud log, so
            // logging again automatically pushes both further into the
            // future. See utils/winBackReminder.ts for the full design.
            // Math.max guards against `bestStreak` state lagging a render
            // behind a just-set new record (save() updates it after this runs).
            import('../utils/winBackReminder').then(m => {
                m.scheduleWinBack(h.tahajjud, Math.max(bestStreak, streak), isPaused);
            }).catch(() => {});
        }).catch(() => {});
    };


    // Begin a pause with the chosen (optional) reason — streak bridges these days.
    const beginPause = async (reason: PauseReason) => {
        haptic.light();
        await startStreakPause(reason);
        setPaused(true);
        setPauseModalVisible(false);
        recalcStreaks(history, true);
        track('streak_pause_started', { reason });
        // Stop any pending streak-at-risk nudge immediately.
        import('../utils/streakReminder').then(m => m.cancelStreakAtRisk()).catch(() => {});
    };

    // Resume — from today onward prayers count again; paused days stay bridged.
    const resumeStreak = async () => {
        haptic.light();
        await endStreakPause();
        setPaused(false);
        recalcStreaks(history, false);
        track('streak_pause_ended');
    };

    const onTogglePause = () => {
        haptic.light();
        if (paused) resumeStreak();
        else setPauseModalVisible(true);
    };

    const maybeShowMilestone = async (newStreak: number) => {
        maybeNudgeSignIn(newStreak).catch(() => {});
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

    // Loss-aversion sign-in nudge: fires ONCE, at a 3-night streak, only for
    // users without a linked account. A cold onboarding auth ask gets skipped;
    // "protect the streak you just built" converts. Streak data is cloud-backed
    // per Firebase uid, but only a real sign-in survives a reinstall.
    const maybeNudgeSignIn = async (newStreak: number) => {
        if (newStreak < 3) return;
        const NUDGE_KEY = 'signin-nudge-shown-v1';
        if (await AsyncStorage.getItem(NUDGE_KEY)) return;
        const { getFirebaseAuth } = await import('../utils/firebase');
        const user = getFirebaseAuth()?.currentUser;
        if (user && !user.isAnonymous) return; // already signed in
        await AsyncStorage.setItem(NUDGE_KEY, 'true');
        track('signin_nudge_shown', { streak: newStreak });
        Alert.alert(
            t('tracker.protectStreakTitle', { n: newStreak }),
            t('tracker.protectStreakBody'),
            [{ text: t('tracker.later'), style: 'cancel' }, { text: t('btn.ok') }],
        );
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
            // At a milestone night (7/30/100) the StreakMilestoneModal already
            // shows with its own "Unlock Premium" CTA. Auto-opening the paywall
            // on top of that modal collides (two modals) and freezes the UI, so
            // skip it here — the milestone modal handles the upsell.
            if (MILESTONE_NIGHTS.includes(target)) return;
            const raw = await AsyncStorage.getItem(PAYWALL_STREAK_KEY);
            const seen = raw ? raw.split(',').map(Number) : [];
            if (seen.includes(target)) return;
            await AsyncStorage.setItem(PAYWALL_STREAK_KEY, [...seen, target].join(','));
            track('paywall_shown', { trigger: `streak_${target}` });
            // Queue the paywall to open when the letter modal closes (see the
            // TahajjudLetterModal onClose). A fixed timer could fire while the
            // letter is still open → two modals → frozen UI.
            pendingPaywallRef.current = `streak_milestone_${target}`;
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
                    title: t('tracker.fiveNightsTitle'),
                    body: t('tracker.fiveNightsBody'),
                    sound: 'default',
                    data: { type: 'streak_paywall' },
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: tomorrow9am,
                    // 'prayers_adhan' is the only prayer-related channel the
                    // app still creates (see utils/notifications.ts) — the
                    // old 'prayers' id is never created on a fresh install,
                    // so pointing here at it left this notification on a
                    // channel that may not exist.
                    ...(Platform.OS === 'android' && { channelId: 'prayers_adhan' }),
                },
            });
            track('streak_notif_scheduled', { streak: 5 });
        } catch { /* ignore */ }
    };

    const save = async (updated: PrayerHistory) => {
        historyRef.current = updated;
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

        // Back up to the cloud — fire-and-forget, so a lost phone can never
        // erase a streak again.
        import('../utils/prayerHistorySync').then(m => m.pushPrayerHistory()).catch(() => {});
    };

    const logPrayer = async (key: PrayerKey) => {
        if (isLoggedToday(historyRef.current[key])) return;
        if (loggingRef.current.has(key)) return; // already in-flight
        loggingRef.current.add(key);

        // Block logging a prayer whose time hasn't started yet (e.g. tapping
        // Isha at 10am). If we don't have today's prayer times yet, allow it
        // — better to not block legitimate logs while data is loading.
        if (startTimes && new Date() < startTimes[key]) {
            const label = PRAYERS.find(p => p.key === key) ? prayerLabel(key) : t('tracker.thisPrayerFallback');
            const fmt = startTimes[key].toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            haptic.medium();
            Alert.alert(t('tracker.notStartedTitle', { label }), t('tracker.notStartedBody', { label, time: fmt }));
            loggingRef.current.delete(key);
            return;
        }

        haptic.light();
        const isFirstTahajjudEver = key === 'tahajjud' && historyRef.current.tahajjud.length === 0;
        // Read from historyRef, not the `history` closure — two different
        // prayers logged back-to-back before a re-render would otherwise
        // both build `updated` from the same stale snapshot, and the
        // second save() would silently overwrite (drop) the first log.
        const updated: PrayerHistory = {
            ...historyRef.current,
            [key]: [...historyRef.current[key], new Date().toISOString()],
        };
        try {
            await save(updated);
        } finally {
            // Release the in-flight lock — state now reflects the log so the
            // isLoggedToday guard catches any further taps
            loggingRef.current.delete(key);
        }
        track('prayer_logged', { prayer: key });
        if (key === 'tahajjud') {
            // Check prayer achievements — show upsell to free users
            const totalTahajjud = updated.tahajjud.length;
            checkAchievements('prayer', totalTahajjud)
                .then(newlyUnlocked => {
                    getAchievements().then(setAchievements).catch(() => {});
                    if (newlyUnlocked.length > 0) {
                        // On a milestone night (7/30/100) the StreakMilestoneModal
                        // is the celebration. Showing this achievement alert at the
                        // same moment races the modal's presentation and can freeze
                        // the UI, so suppress the alert here (the achievement is
                        // still recorded). It surfaces in the achievements list.
                        const streakNow = calculateStreak(updated.tahajjud);
                        if (MILESTONE_NIGHTS.includes(streakNow)) return;
                        // A bulk restore can cross several thresholds in one go —
                        // show each newly-earned badge one at a time so none of
                        // them go unnoticed.
                        const showNext = (i: number) => {
                            if (i >= newlyUnlocked.length) return;
                            const newAchievement = newlyUnlocked[i];
                            if (!isPremium) {
                                Alert.alert(
                                    `🏅 ${newAchievement.title}`,
                                    `${newAchievement.description}\n\n${t('tracker.unlockPremiumJourney')}`,
                                    [
                                        { text: t('tracker.mashallahExclaim'), style: 'cancel', onPress: () => showNext(i + 1) },
                                        { text: t('tracker.unlockPremiumBtn'), onPress: openPaywall },
                                    ]
                                );
                            } else {
                                Alert.alert(
                                    `🏅 ${newAchievement.title}`,
                                    `${t('tracker.mashallahExclaim')} ${newAchievement.description}`,
                                    [{ text: t('tracker.mashallahExclaim'), onPress: () => showNext(i + 1) }]
                                );
                            }
                        };
                        showNext(0);
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
            // Streak is safe tonight — cancel the at-risk reminder
            import('../utils/streakReminder').then(m => m.cancelStreakAtRisk()).catch(() => {});
            // Add anonymous dot to global map
            logTahajjudToMap().catch(() => {});
            // Leaderboard: one Tahajjud night = +1 (isLoggedToday above
            // already guards this to at most once per day). syncTahajjudNight
            // retries on failure instead of silently dropping this +1 (see
            // utils/tahajjudLeaderboardSync.ts).
            import('../utils/tahajjudLeaderboardSync').then(m => m.syncTahajjudNight()).catch(() => {});
            // Refresh the Friday digest so it reflects this week's count
            refreshWeeklyDigest().catch(() => {});
            // Tell HistoryCalendar + PrayerAnalytics to reload
            DeviceEventEmitter.emit('prayerLogged');
            // Tally toward the 40-night challenge if active
            TahajjudChallenge.recordTahajjudToday().catch(() => {});
            // End any Live Activity (Lock Screen countdown) — they prayed
            import('../utils/liveActivity').then(m => m.LiveActivity.endAll()).catch(() => {});
        }
        // Refresh the home-screen widget so its "Log X" button and streak
        // don't sit stale until some unrelated location/method change
        // happens to trigger NightCalculator's own widget refresh — reuses
        // today's already-cached prayer times instead of recomputing them.
        if (startTimes) {
            import('../utils/widgetBridge').then(m => m.updateWidget(startTimes)).catch(() => {});
        }
        if (key === 'tahajjud') {
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
        if (!isLoggedToday(historyRef.current[key])) return;
        Alert.alert(
            t('tracker.removeLogTitle'),
            t('tracker.removeLogBody', { label: prayerLabel(key) }),
            [
                { text: t('btn.cancel'), style: 'cancel' },
                {
                    text: t('tracker.removeBtn'),
                    style: 'destructive',
                    onPress: async () => {
                        haptic.light();
                        const today = todayStr();
                        // Read from historyRef — the confirmation dialog leaves
                        // plenty of time for a different prayer to be logged in
                        // the meantime, and building `updated` from a stale
                        // `history` closure would silently drop that log.
                        const updated: PrayerHistory = {
                            ...historyRef.current,
                            [key]: historyRef.current[key].filter(d => localDateStr(d) !== today),
                        };
                        await save(updated);
                        // Tell HistoryCalendar + PrayerAnalytics + HomeTab's
                        // "already logged today" gate to refresh — same event
                        // logPrayer emits, just missing on the undo path.
                        DeviceEventEmitter.emit('prayerLogged');
                    },
                },
            ]
        );
    };

    // Backfill: toggle one of YESTERDAY's prayers. Timestamps land on
    // yesterday's calendar date so streak math treats them like a normal log
    // (pre-dawn for Tahajjud, noon for the rest). Deliberately no global-map
    // write and no milestone celebration — the map is a live 24h view and
    // the celebratory moment has passed; the streak repair is the reward.
    const toggleYesterdayPrayer = async (key: PrayerKey) => {
        const ystr = localDateStr(subDays(new Date(), 1));
        const had = historyRef.current[key].some(d => localDateStr(d) === ystr);
        haptic.light();
        const ts = subDays(new Date(), 1);
        ts.setHours(key === 'tahajjud' ? 4 : 12, 0, 0, 0);
        const updated: PrayerHistory = {
            ...historyRef.current,
            [key]: had
                ? historyRef.current[key].filter(d => localDateStr(d) !== ystr)
                : [...historyRef.current[key], ts.toISOString()],
        };
        await save(updated);
        if (!had) {
            track('prayer_logged', { prayer: key, backfill: true });
            // Leaderboard: backfilled Tahajjud counts the same as same-night
            // logging — `had` above already guards this to at most once per
            // day. syncTahajjudNight retries on failure instead of silently
            // dropping this +1 (see utils/tahajjudLeaderboardSync.ts).
            if (key === 'tahajjud') {
                import('../utils/tahajjudLeaderboardSync').then(m => m.syncTahajjudNight()).catch(() => {});
            }
        }
        // Tell HistoryCalendar + PrayerAnalytics + HomeTab's "already logged
        // today" gate to refresh, same as logPrayer/unlogPrayer — this ran
        // every backfill toggle before without it.
        DeviceEventEmitter.emit('prayerLogged');
    };

    // Yesterday's missed prayers. The banner text lists only the 5 obligatory
    // prayers (Tahajjud is missed most nights — listing it daily is
    // demoralising), but the banner also appears when ONLY Tahajjud is
    // unlogged, with gentler copy — that's the "prayed but forgot to log"
    // case that kills streaks. Only shown once the user has some history.
    const yesterday = localDateStr(subDays(new Date(), 1));
    const hasAnyHistory = PRAYERS.some(p => history[p.key].length > 0);
    const missedYesterdayAll = hasAnyHistory
        ? PRAYERS.filter(p => !history[p.key].some(d => localDateStr(d) === yesterday))
        : [];
    const missedYesterday = missedYesterdayAll.filter(p => p.key !== 'tahajjud');

    const tahajjudStreak = streaks.tahajjud;
    const milestone      = getMilestone(tahajjudStreak);
    const todayCount     = PRAYERS.filter(p => isLoggedToday(history[p.key])).length;

    // Softer secondary metric — a number that survives a broken streak so a
    // single bad week never reads as total failure.
    const monthPrefix = localDateStr(new Date()).slice(0, 7); // YYYY-MM
    const nightsThisMonth = new Set(
        history.tahajjud.filter(d => localDateStr(d).startsWith(monthPrefix)).map(d => localDateStr(d))
    ).size;

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
                                {tahajjudStreak === 1 ? t('tracker.dayUnit') : t('tracker.daysUnit')}
                            </Text>
                        </View>
                        <View style={styles.freezeRow}>
                            <Text style={[styles.streakLabel, { color: colors.secondaryText }]}>{t('tracker.tahajjudStreak')}</Text>
                            {paused ? (
                                <View style={[styles.freezePill, { backgroundColor: 'rgba(167,139,250,0.14)', borderColor: 'rgba(167,139,250,0.34)' }]}>
                                    <PauseCircle size={9} color="#a78bfa" />
                                    <Text style={[styles.freezePillText, { color: '#a78bfa' }]}>{t('tracker.pausedSafe')}</Text>
                                </View>
                            ) : tahajjudStreak > 0 && (
                                <View style={[
                                    styles.freezePill,
                                    freezeAvailable
                                        ? { backgroundColor: 'rgba(56,189,248,0.12)', borderColor: 'rgba(56,189,248,0.30)' }
                                        : { backgroundColor: 'rgba(100,116,139,0.10)', borderColor: 'rgba(100,116,139,0.20)' },
                                ]}>
                                    <Snowflake size={9} color={freezeAvailable ? '#38bdf8' : '#475569'} />
                                    <Text style={[styles.freezePillText, { color: freezeAvailable ? '#38bdf8' : '#475569' }]}>
                                        {freezeAvailable
                                            ? isPremium ? t('tracker.freezesPerWeek') : t('tracker.freezeReady')
                                            : t('tracker.usedThisWeek')}
                                    </Text>
                                </View>
                            )}
                        </View>
                        {/* Softer fallback metric + pause control */}
                        <View style={styles.metaRow}>
                            {nightsThisMonth > 0 && (
                                <Text style={[styles.monthMetric, { color: colors.secondaryText }]}>
                                    {nightsThisMonth === 1 ? t('tracker.nightThisMonth') : t('tracker.nightsThisMonth', { n: nightsThisMonth })}
                                </Text>
                            )}
                            <TouchableOpacity
                                onPress={onTogglePause}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                style={styles.pauseToggle}
                                accessibilityRole="button"
                                accessibilityLabel={paused ? 'Resume streak' : 'Pause streak'}
                            >
                                {paused
                                    ? <PlayCircle size={11} color={colors.accent} />
                                    : <PauseCircle size={11} color={colors.secondaryText} />}
                                <Text style={[styles.pauseToggleText, { color: paused ? colors.accent : colors.secondaryText }]}>
                                    {paused ? t('tracker.resume') : t('tracker.pause')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.todaySide}>
                        <Text style={[styles.todayCount, { color: todayCount === 6 ? colors.success : colors.accent }]}>
                            {todayCount}/6
                        </Text>
                        <Text style={[styles.todayLabel, { color: colors.secondaryText }]}>{t('tracker.today')}</Text>
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

                {/* Yesterday missed banner — tap to backfill */}
                {missedYesterdayAll.length > 0 && (
                    <TouchableOpacity
                        style={styles.missedBanner}
                        onPress={() => { haptic.light(); track('prayer_backfill_opened'); setShowYesterdayModal(true); }}
                        activeOpacity={0.75}
                        accessibilityRole="button"
                        accessibilityHint="Opens a sheet to log yesterday's prayers"
                    >
                        <AlertCircle size={11} color="#f59e0b" />
                        <Text style={styles.missedText}>
                            {missedYesterday.length > 0
                                ? t('tracker.missedYesterday', { list: missedYesterday.map(p => prayerLabel(p.key)).join(', ') })
                                : t('tracker.forgotTahajjudYesterday')}
                        </Text>
                        <ChevronRight size={13} color="#f59e0b" />
                    </TouchableOpacity>
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
                                        {prayerLabel(p.key)}
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
                    <Text style={[styles.achievementsTitle, { color: colors.secondaryText }]}>{t('tracker.badgesTapToView')}</Text>
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

                <Text style={[styles.hint, { color: '#334155' }]}>{t('tracker.tapToLogHoldToUndo')}</Text>
            </View>
        </View>

        {/* Pause reason picker — every option is optional & private. */}
        <Modal
            visible={pauseModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setPauseModalVisible(false)}
        >
            <TouchableOpacity style={pauseStyles.backdrop} activeOpacity={1} onPress={() => setPauseModalVisible(false)}>
                <TouchableOpacity activeOpacity={1} style={[pauseStyles.card, { backgroundColor: '#0a1228', borderColor: colors.accent + '33' }]}>
                    <View style={[pauseStyles.iconWrap, { backgroundColor: '#a78bfa22', borderColor: '#a78bfa44' }]}>
                        <Heart size={20} color="#a78bfa" />
                    </View>
                    <Text style={[pauseStyles.title, { color: colors.primaryText }]}>{t('tracker.pauseYourStreak')}</Text>
                    <Text style={[pauseStyles.body, { color: colors.secondaryText }]}>
                        {t('tracker.pauseBody')}
                    </Text>
                    {([
                        { r: 'period' as PauseReason, label: t('tracker.reasonMenstruation') },
                        { r: 'postpartum' as PauseReason, label: t('tracker.reasonPostpartum') },
                        { r: 'illness' as PauseReason, label: t('tracker.reasonIllness') },
                        { r: 'unspecified' as PauseReason, label: t('tracker.reasonUnspecified') },
                    ]).map(opt => (
                        <TouchableOpacity
                            key={opt.r}
                            style={[pauseStyles.option, { borderColor: colors.accent + '2a' }]}
                            onPress={() => beginPause(opt.r)}
                            activeOpacity={0.7}
                        >
                            <Text style={[pauseStyles.optionText, { color: colors.primaryText }]}>{opt.label}</Text>
                        </TouchableOpacity>
                    ))}
                    <TouchableOpacity onPress={() => setPauseModalVisible(false)} style={pauseStyles.cancel}>
                        <Text style={[pauseStyles.cancelText, { color: colors.secondaryText }]}>{t('btn.cancel')}</Text>
                    </TouchableOpacity>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>

        {showWidgetPromo && (
            <WidgetPromo onDismiss={() => setShowWidgetPromo(false)} />
        )}
        {/* The journal/letter modals are gated on `milestoneToShow === null` so
            they NEVER present at the same time as the milestone modal. Two RN
            modals presenting at once freezes the UI (a dimmed overlay traps all
            touches) — that was the "completed 7-night streak → tapped MashAllah →
            frozen" bug. When the milestone modal is dismissed, the still-pending
            journal/letter (showJournal/showLetter) then presents on its own. */}
        <TahajjudJournalModal visible={showJournal && milestoneToShow === null} onClose={() => setShowJournal(false)} />

        {/* Backfill yesterday's prayers */}
        <Modal visible={showYesterdayModal} transparent animationType="fade" onRequestClose={() => setShowYesterdayModal(false)}>
            <View style={styles.yOverlay}>
                <View style={[styles.yCard, { borderColor: colors.accent + '33' }]}>
                    <Text style={[styles.yTitle, { color: colors.primaryText }]}>{t('tracker.yesterdayTitle')}</Text>
                    <Text style={[styles.ySubtitle, { color: colors.secondaryText }]}>{t('tracker.yesterdaySubtitle')}</Text>
                    {PRAYERS.map(p => {
                        const logged = history[p.key].some(d => localDateStr(d) === yesterday);
                        const isTahajjud = p.key === 'tahajjud';
                        return (
                            <TouchableOpacity
                                key={p.key}
                                style={styles.yRow}
                                onPress={() => toggleYesterdayPrayer(p.key)}
                                activeOpacity={0.7}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: logged }}
                            >
                                <View style={[styles.yCheck, {
                                    backgroundColor: logged ? (isTahajjud ? colors.accent : colors.success) : 'transparent',
                                    borderColor: logged ? 'transparent' : (isTahajjud ? colors.accent + '66' : 'rgba(255,255,255,0.25)'),
                                }]}>
                                    {logged && <Text style={styles.yCheckMark}>✓</Text>}
                                </View>
                                <Text style={[styles.yRowLabel, { color: colors.primaryText }, isTahajjud && { color: colors.accent, fontWeight: '800' }]}>
                                    {prayerLabel(p.key)}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                    <TouchableOpacity
                        style={[styles.yDone, { backgroundColor: colors.accent }]}
                        onPress={() => setShowYesterdayModal(false)}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.yDoneText}>{t('btn.done')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
        <TahajjudLetterModal
            visible={showLetter && milestoneToShow === null}
            onClose={() => {
                setShowLetter(false);
                // Open any queued streak paywall now that the letter is closing,
                // so the two modals never overlap (which would freeze the UI).
                const pending = pendingPaywallRef.current;
                if (pending) {
                    pendingPaywallRef.current = null;
                    setTimeout(() => openPaywall(pending), 350);
                }
            }}
        />
        <StreakMilestoneModal
            visible={milestoneToShow !== null}
            nights={milestoneToShow ?? 0}
            onClose={() => {
                const nights = milestoneToShow ?? 0;
                setMilestoneToShow(null);
                // Ask for a rating right after the celebration — the emotional
                // peak — instead of at a random prayer log.
                if (nights > 0) requestReviewAtMilestone(nights).catch(() => {});
            }}
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
                                        ? t('tracker.earnedOn', { date: new Date(badgeDetail.unlockedAt!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) })
                                        : t('tracker.notYetEarned')}
                                </Text>
                            </View>
                            <Text style={badgeStyles.dismissHint}>{t('tracker.tapToClose')}</Text>
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
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 6,
        flexWrap: 'wrap',
    },
    monthMetric: {
        fontSize: 11,
        fontWeight: '600',
    },
    pauseToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    pauseToggleText: {
        fontSize: 11,
        fontWeight: '700',
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
    yOverlay: {
        flex: 1,
        backgroundColor: 'rgba(2,6,23,0.85)',
        justifyContent: 'center',
        padding: 24,
    },
    yCard: {
        borderRadius: 20,
        borderWidth: 1,
        backgroundColor: '#0b1120',
        padding: 20,
    },
    yTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
    ySubtitle: { fontSize: 12, fontWeight: '500', lineHeight: 17, marginBottom: 14 },
    yRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.07)',
    },
    yCheck: {
        width: 26, height: 26, borderRadius: 13,
        borderWidth: 1.5,
        alignItems: 'center', justifyContent: 'center',
    },
    yCheckMark: { color: '#fff', fontSize: 13, fontWeight: '800' },
    yRowLabel: { fontSize: 15, fontWeight: '600' },
    yDone: {
        marginTop: 16,
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center',
    },
    yDoneText: { color: '#0a1228', fontSize: 15, fontWeight: '800' },
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

const pauseStyles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.65)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 28,
    },
    card: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 22,
        borderWidth: 1,
        padding: 22,
        alignItems: 'center',
    },
    iconWrap: {
        width: 44, height: 44, borderRadius: 22, borderWidth: 1,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 12,
    },
    title: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, marginBottom: 8 },
    body: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 18 },
    option: {
        width: '100%',
        borderWidth: 1,
        borderRadius: 14,
        paddingVertical: 13,
        paddingHorizontal: 16,
        marginBottom: 8,
        alignItems: 'center',
    },
    optionText: { fontSize: 14, fontWeight: '700' },
    cancel: { paddingVertical: 10, marginTop: 2 },
    cancelText: { fontSize: 13, fontWeight: '600' },
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
