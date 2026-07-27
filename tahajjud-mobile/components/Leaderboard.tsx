/**
 * Dhikr & Quran-reading leaderboard — opt-in only (see utils/leaderboard.ts
 * for why: nobody appears here without deliberately choosing a nickname).
 * Same full-screen Modal shape as GlobalTahajjudMap, reached from a Home
 * card — not a new tab.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    Modal, View, Text, StyleSheet, TouchableOpacity, TextInput,
    FlatList, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, AppState,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Localization from 'expo-localization';
import { GlassBg as BlurView } from './GlassBg';
import { X, Trophy, Flag, ChevronRight, Pencil, ChevronUp, ChevronDown, Info } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { haptic } from '../utils/haptic';
import { t } from '../utils/i18n';
import {
    Leaderboard, LeaderboardMetric, LeaderboardWindow,
    LeaderboardEntry, LeaderboardStatus,
} from '../utils/leaderboard';
import { flagEmoji, countryName, isValidCountryCode } from '../utils/countries';
import { usePurchases } from '../context/PurchasesContext';
import { markFeatureUsed } from '../utils/featureDiscovery';
import type { FeatureId } from '../utils/featureDiscovery';
import Paywall from './Paywall';
import { CommunityProfileStore } from '../utils/communityProfile';
import { CountryPickerOverlay } from './CountryPickerOverlay';
import { STARS } from './DuaWall';

interface Props {
    visible: boolean;
    onClose: () => void;
}

function SegmentButton({ active, label, onPress, accent }: {
    active: boolean; label: string; onPress: () => void; accent: string;
}) {
    return (
        <TouchableOpacity
            onPress={() => { haptic.light(); onPress(); }}
            style={[styles.segment, active && { backgroundColor: accent, borderColor: accent }]}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
        >
            <Text
                style={[styles.segmentText, active && styles.segmentTextActive]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
            >{label}</Text>
        </TouchableOpacity>
    );
}

// Extra stars ON TOP OF the shared DuaWall STARS — kept separate rather than
// adding to that shared constant, since STARS is also used by the Dua Wall
// and this screen wanting a denser field shouldn't change the Wall's look.
const EXTRA_STARS = [
    { left: '62%', top: 45, size: 1.5, opacity: 0.32 },
    { left: '15%', top: 124, size: 2, opacity: 0.28 },
    { left: '42%', top: 50, size: 1, opacity: 0.32 },
    { left: '50%', top: 47, size: 2, opacity: 0.31 },
    { left: '63%', top: 578, size: 1.5, opacity: 0.32 },
    { left: '57%', top: 848, size: 1, opacity: 0.48 },
    { left: '17%', top: 452, size: 1.5, opacity: 0.33 },
    { left: '22%', top: 801, size: 1.5, opacity: 0.28 },
    { left: '38%', top: 387, size: 1.5, opacity: 0.43 },
    { left: '78%', top: 767, size: 1.5, opacity: 0.41 },
    { left: '93%', top: 407, size: 1, opacity: 0.42 },
    { left: '80%', top: 653, size: 1.5, opacity: 0.42 },
    { left: '68%', top: 66, size: 1, opacity: 0.48 },
    { left: '95%', top: 895, size: 1, opacity: 0.51 },
    { left: '38%', top: 484, size: 1.5, opacity: 0.30 },
    { left: '35%', top: 706, size: 1.5, opacity: 0.46 },
    { left: '66%', top: 93, size: 2, opacity: 0.44 },
    { left: '52%', top: 270, size: 1, opacity: 0.39 },
    { left: '27%', top: 967, size: 2, opacity: 0.32 },
    { left: '32%', top: 806, size: 1, opacity: 0.32 },
    { left: '5%', top: 343, size: 1.5, opacity: 0.33 },
    { left: '22%', top: 985, size: 2, opacity: 0.51 },
    { left: '32%', top: 691, size: 1.5, opacity: 0.37 },
    { left: '88%', top: 489, size: 1, opacity: 0.33 },
    { left: '25%', top: 594, size: 2, opacity: 0.33 },
    { left: '57%', top: 939, size: 2, opacity: 0.37 },
    { left: '23%', top: 161, size: 2, opacity: 0.40 },
    { left: '73%', top: 901, size: 1, opacity: 0.30 },
    { left: '17%', top: 716, size: 1.5, opacity: 0.43 },
    { left: '38%', top: 630, size: 1.5, opacity: 0.41 },
    { left: '93%', top: 901, size: 1, opacity: 0.45 },
    { left: '13%', top: 926, size: 2, opacity: 0.48 },
    { left: '74%', top: 368, size: 1, opacity: 0.34 },
    { left: '17%', top: 23, size: 1.5, opacity: 0.54 },
    { left: '74%', top: 539, size: 1, opacity: 0.51 },
    { left: '30%', top: 674, size: 2, opacity: 0.43 },
    { left: '16%', top: 800, size: 1, opacity: 0.41 },
    { left: '75%', top: 563, size: 1, opacity: 0.43 },
    { left: '48%', top: 134, size: 1.5, opacity: 0.51 },
    { left: '80%', top: 334, size: 1, opacity: 0.27 },
    { left: '85%', top: 989, size: 1, opacity: 0.28 },
    { left: '48%', top: 90, size: 2, opacity: 0.48 },
    { left: '14%', top: 506, size: 2, opacity: 0.30 },
    { left: '52%', top: 641, size: 1.5, opacity: 0.54 },
    { left: '89%', top: 793, size: 1, opacity: 0.46 },
    { left: '40%', top: 707, size: 1.5, opacity: 0.38 },
    { left: '51%', top: 143, size: 1, opacity: 0.32 },
    { left: '34%', top: 622, size: 2, opacity: 0.32 },
    { left: '23%', top: 92, size: 1, opacity: 0.32 },
    { left: '87%', top: 900, size: 1.5, opacity: 0.27 },
    { left: '24%', top: 705, size: 1.5, opacity: 0.31 },
    { left: '14%', top: 977, size: 2, opacity: 0.42 },
    { left: '25%', top: 504, size: 1.5, opacity: 0.31 },
    { left: '11%', top: 461, size: 1.5, opacity: 0.38 },
    { left: '46%', top: 766, size: 1, opacity: 0.45 },
    { left: '95%', top: 120, size: 1, opacity: 0.37 },
    { left: '34%', top: 902, size: 1, opacity: 0.32 },
    { left: '20%', top: 479, size: 1, opacity: 0.38 },
    { left: '28%', top: 275, size: 1, opacity: 0.38 },
    { left: '83%', top: 583, size: 1, opacity: 0.27 },
];

const MEDALS = ['🥇', '🥈', '🥉'];

/** Two-option segmented control: a single rounded track with equal-width
 *  halves, so it reads as "pick one of these two" instead of two unrelated
 *  pills. Fills its parent's row, letting several sit side by side. */
function Segmented({ options, value, onChange, accent }: {
    options: { key: string; label: string }[];
    value: string;
    onChange: (key: string) => void;
    accent: string;
}) {
    return (
        <View style={styles.segTrack}>
            {options.map(o => {
                const active = o.key === value;
                return (
                    <TouchableOpacity
                        key={o.key}
                        onPress={() => onChange(o.key)}
                        style={[styles.segItem, active && { backgroundColor: accent + '26' }]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                    >
                        <Text numberOfLines={1} style={[styles.segText, active && { color: accent }]}>
                            {o.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

export function LeaderboardModal({ visible, onClose }: Props) {
    const { colors } = useTheme();
    const [status, setStatus] = useState<LeaderboardStatus>({ optedIn: false });
    // Read inside loadBoard() without adding `status` to that effect's own
    // deps — this must stay a ref, not state, or the board-load effect would
    // re-run on every status change and reintroduce the very waterfall it
    // was fixed to avoid (see that effect's comment). Whenever a fresh
    // status happens to already be in hand, getMyRank can skip its own
    // duplicate doc read; when it isn't ready yet, getMyRank just falls back
    // to fetching it itself — purely additive, never a correctness risk.
    const statusRef = useRef(status);
    statusRef.current = status;
    const [statusLoading, setStatusLoading] = useState(true);
    // Per-(metric,window) cache — switching tabs used to always do a full
    // fresh fetch even for a combination you'd literally just looked at a
    // moment ago, which is what made flipping between Dhikr/Quran/Tahajjud
    // (or This Week/All-Time) feel slow every single time. Switching to an
    // already-cached combo now shows instantly with no spinner, then quietly
    // refreshes in the background so the data still stays current.
    const boardCacheRef = useRef<Map<string, {
        top: LeaderboardEntry[];
        rank: { rank: number; total: number; value: number } | null;
        total: number;
        rankChange: { direction: 'up' | 'down'; delta: number } | null;
    }>>(new Map());
    const [metric, setMetric] = useState<LeaderboardMetric>('dhikr');
    const [windowSel, setWindowSel] = useState<LeaderboardWindow>('week');
    const [topN, setTopN] = useState<LeaderboardEntry[]>([]);
    const [myRank, setMyRank] = useState<{ rank: number; total: number; value: number } | null>(null);
    const [communityTotal, setCommunityTotal] = useState<number | null>(null);
    const [rankChange, setRankChange] = useState<{ direction: 'up' | 'down'; delta: number } | null>(null);
    const [listLoading, setListLoading] = useState(false);

    // "Near You" — the 5 above/below your own rank instead of the top-50,
    // for when the board has hundreds of people and the top slice is
    // realistically unreachable. Ranks are approximated sequentially from
    // myRank.rank (correct as long as there's no exact value tie between
    // fetched neighbors — same assumption the top-N list already makes by
    // using its array index for rank).
    const [viewMode, setViewMode] = useState<'top' | 'nearby'>('top');
    // Global board vs. only people who picked the same country as you.
    // Premium-gated: free users see the control (so the value is visible)
    // but tapping it opens the paywall instead of switching.
    const [scope, setScope] = useState<'global' | 'country'>('global');
    const { isPremium, openPaywall } = usePurchases();
    // Paywall shown as a plain View INSIDE this modal, never as a second
    // <Modal>. iOS presents only one modal per view controller, so calling
    // the root-level openPaywall() from in here silently does nothing —
    // exactly the trap DuaWall documents. Verified: tapping the locked
    // country chip did nothing at all until this overlay existed.
    const [paywallOverlay, setPaywallOverlay] = useState<{ source: string; featureId?: FeatureId } | null>(null);
    const [nearbyList, setNearbyList] = useState<Array<LeaderboardEntry & { rank: number; isMe: boolean }>>([]);
    const [nearbyLoading, setNearbyLoading] = useState(false);

    // Profile form (shared between first-time opt-in and later editing).
    const [nicknameInput, setNicknameInput] = useState('');
    const [countryCode, setCountryCode] = useState<string | null>(null);
    const [editingProfile, setEditingProfile] = useState(false); // true = "Save changes", false = "Join"
    const [optingIn, setOptingIn] = useState(false);
    const [reportBusy, setReportBusy] = useState<Set<string>>(new Set());

    const [showCountryPicker, setShowCountryPicker] = useState(false);

    // Load opt-in status fresh every time the modal opens.
    useEffect(() => {
        if (!visible) return;
        let cancelled = false;
        setStatusLoading(true);
        Leaderboard.getStatus().then(s => {
            if (cancelled) return;
            setStatus(s);
            setStatusLoading(false);
            if (!s.optedIn) {
                // Prefill from the shared community name (set on the Dua Wall,
                // a comment reply, or the Partner circle) if one exists — same
                // name people already recognize you by elsewhere, rather than
                // a blank field every time. Falls back to the device's region
                // for country — self-reported, no permission prompt (see
                // utils/countries.ts for why this deliberately avoids GPS).
                // User can change either before joining.
                CommunityProfileStore.get().then(profile => {
                    if (cancelled) return;
                    if (profile?.nickname) setNicknameInput(profile.nickname);
                    if (profile?.country && isValidCountryCode(profile.country)) {
                        setCountryCode(profile.country);
                        return;
                    }
                    const suggested = Localization.getLocales()[0]?.regionCode;
                    if (suggested && isValidCountryCode(suggested)) setCountryCode(suggested);
                });
            } else {
                // Already opted in — silently re-sync if the name/country
                // changed on another surface (Dua Wall, Settings, a comment)
                // since the last time this was saved here, so the public
                // rank entry never quietly goes stale. Safe to do forward-only:
                // this screen's OWN edit flow already writes back to
                // CommunityProfileStore too (see handleSaveProfile), so the
                // only way these two can diverge is exactly this case.
                CommunityProfileStore.get().then(profile => {
                    if (cancelled || !profile?.nickname) return;
                    const nameChanged = profile.nickname !== s.nickname;
                    // Only ever sync a country FORWARD when the shared store
                    // actually has a different one — never treat "the store
                    // has none" as "the country was cleared." The store used
                    // to get silently wiped down to just a name by any reply
                    // post elsewhere (see CommunityProfileStore.set's fix);
                    // without this guard, reopening the leaderboard afterward
                    // would read that gap and downgrade an already-correct
                    // server-side country back to nothing, even though
                    // nothing was ever actually cleared.
                    const countryChanged = !!profile.country && profile.country !== s.country;
                    if (!nameChanged && !countryChanged) return;
                    const nextCountry = countryChanged ? profile.country : s.country;
                    Leaderboard.optIn(profile.nickname, nextCountry ?? null).then(result => {
                        if (!cancelled && result.ok) {
                            setStatus(prev => ({ ...prev, nickname: profile.nickname, country: nextCountry }));
                        }
                    });
                });
            }
        });
        return () => { cancelled = true; };
    }, [visible]);

    // Load the board whenever it's open, or the metric/window changes — and
    // again if the app comes back to the foreground while still open.
    // Debounced dhikr/Quran syncs flush on app-background (see App.tsx), so
    // a log made while this modal was open-but-backgrounded wouldn't
    // otherwise show up until you switched tabs or reopened it.
    //
    // Deliberately does NOT wait on status.optedIn: that's a SEPARATE
    // getStatus() fetch (above), and gating this effect on its result turned
    // every open into two sequential network round-trips (wait for status,
    // THEN start the board queries) instead of both firing at once — the
    // actual reason the leaderboard felt slow to load. The board simply
    // won't be rendered if the user turns out not to be opted in (the JSX
    // still checks status.optedIn), so firing the fetch early costs nothing
    // for that rarer case and cuts load time roughly in half for the common
    // (already opted-in) one.
    useEffect(() => {
        if (!visible) return;
        const state = { cancelled: false };
        // null in global scope, or when the user never set a country. Read
        // from `status` (not the ref) so that CHANGING your country in the
        // profile re-runs this effect and reloads the board for the new
        // country — see this effect's deps.
        const countryFilter = scope === 'country' ? (status.country ?? null) : null;
        const cacheKey = `${metric}-${windowSel}-${countryFilter ?? 'global'}`;

        // Rank-change vs. the last time this exact metric/window combination
        // was checked — a static "#12" doesn't feel alive; knowing you moved
        // up 3 spots since you last checked does. Delegates to
        // Leaderboard.trackRank, the single source of truth for the stored
        // previous rank — checkRankMilestones (fired after every count sync,
        // regardless of whether this screen is even open) reads/writes the
        // exact same AsyncStorage key, and having two independent places
        // update it would race: whichever ran second would compare against a
        // value the first one had already advanced moments earlier.
        const computeRankChange = async (
            rank: { rank: number; total: number; value: number } | null,
        ): Promise<{ direction: 'up' | 'down'; delta: number } | null> => {
            if (!rank || state.cancelled) return null;
            return Leaderboard.trackRank(metric, windowSel, rank.rank);
        };

        const loadBoard = (background: boolean) => {
            if (!background) {
                setListLoading(true);
                // Clear the PREVIOUS values before the new fetch resolves —
                // communityTotal and myRank aren't gated by listLoading in
                // the render below, so leaving the old numbers in place made
                // switching metrics (or refreshing on foreground) flash
                // stale data for a moment before snapping to the correct
                // one. Skipped for a background refresh behind cached data —
                // that would defeat the entire point of showing it instantly.
                setCommunityTotal(null);
                setMyRank(null);
            }
            // If a fresh, already-opted-in status is in hand, hand its value
            // straight to getMyRank so it can skip its own doc read (see
            // getMyRank's doc comment) — collapses it to one round-trip,
            // same as getTopN/getCommunityTotal, instead of two sequential
            // ones. Falls back to undefined (getMyRank fetches it itself)
            // whenever status hasn't resolved yet.
            const s = statusRef.current;
            const preloadedValue = s.optedIn ? s.values?.[metric]?.[windowSel] : undefined;
            Promise.all([
                Leaderboard.getTopN(metric, windowSel, 50, countryFilter),
                Leaderboard.getMyRank(metric, windowSel, countryFilter, preloadedValue),
                Leaderboard.getCommunityTotal(metric, windowSel),
            ]).then(async ([top, rank, total]) => {
                if (state.cancelled) return;
                const rankChange = await computeRankChange(rank);
                if (state.cancelled) return;
                setTopN(top);
                setMyRank(rank);
                setCommunityTotal(total);
                setRankChange(rankChange);
                setListLoading(false);
                boardCacheRef.current.set(cacheKey, { top, rank, total, rankChange });
            });
        };

        const cached = boardCacheRef.current.get(cacheKey);
        if (cached) {
            // Show instantly, no spinner, then quietly refresh in the
            // background so a switch back to an already-seen tab never
            // waits on the network at all before showing SOMETHING.
            setTopN(cached.top);
            setMyRank(cached.rank);
            setCommunityTotal(cached.total);
            setRankChange(cached.rankChange);
            loadBoard(true);
        } else {
            loadBoard(false);
        }

        const appStateSub = AppState.addEventListener('change', next => {
            if (next === 'active') loadBoard(false);
        });
        return () => { state.cancelled = true; appStateSub.remove(); };
    }, [visible, metric, windowSel, scope, status.country]);

    // "Near You" data — separate from the main load above since it depends
    // on myRank (fetched there) rather than being fetchable independently.
    // Cached per (metric, window) the same way the main board is — switching
    // straight back to a combination you'd already viewed in "Near You"
    // shows instantly instead of waiting on getNearbyEntries again.
    const nearbyCacheRef = useRef<Map<string, Array<LeaderboardEntry & { rank: number; isMe: boolean }>>>(new Map());
    useEffect(() => {
        if (viewMode !== 'nearby' || !myRank || !status.optedIn) return;
        let cancelled = false;
        const nearbyCountry = scope === 'country' ? (status.country ?? null) : null;
        const cacheKey = `${metric}-${windowSel}-${nearbyCountry ?? 'global'}`;
        const cached = nearbyCacheRef.current.get(cacheKey);
        if (cached) setNearbyList(cached);
        else { setNearbyLoading(true); setNearbyList([]); }
        Leaderboard.getNearbyEntries(metric, windowSel, myRank.value, 5, 5, nearbyCountry).then(({ above, below }) => {
            if (cancelled) return;
            const myRankNum = myRank.rank;
            const combined = [
                ...above.map((e, i) => ({ ...e, rank: myRankNum - (above.length - i), isMe: false })),
                { uid: 'me', nickname: status.nickname ?? '', country: status.country, value: myRank.value, rank: myRankNum, isMe: true },
                ...below.map((e, i) => ({ ...e, rank: myRankNum + 1 + i, isMe: false })),
            ];
            setNearbyList(combined);
            setNearbyLoading(false);
            nearbyCacheRef.current.set(cacheKey, combined);
        });
        return () => { cancelled = true; };
    }, [viewMode, scope, metric, windowSel, myRank, status.optedIn, status.nickname, status.country]);

    const startEditingProfile = () => {
        setNicknameInput(status.nickname ?? '');
        setCountryCode(status.country ?? null);
        setEditingProfile(true);
    };

    const handleSaveProfile = async () => {
        if (optingIn) return;
        if (nicknameInput.trim().length === 0) return;
        haptic.light();
        setOptingIn(true);
        const result = await Leaderboard.optIn(nicknameInput, countryCode);
        setOptingIn(false);
        if (!result.ok) {
            const messages: Record<string, string> = {
                'too-short': t('leaderboard.nicknameRequired'),
                'too-long': t('leaderboard.nicknameTooLong'),
                'profanity': t('leaderboard.nicknameProfanity'),
                'not-signed-in': 'Please try again.',
                'firestore-error': 'Could not join. Try again.',
            };
            Alert.alert(t('leaderboard.couldNotJoin'), messages[result.error ?? 'firestore-error']);
            return;
        }
        haptic.success();
        setStatus({ optedIn: true, nickname: nicknameInput.trim(), country: countryCode ?? undefined });
        setEditingProfile(false);
        // Propagate this name to the Dua Wall, comments, and Partner circle —
        // whichever surface you name yourself on first flows to the others.
        CommunityProfileStore.set(nicknameInput, countryCode).catch(() => {});
        setNicknameInput('');
    };

    const handleOptOut = () => {
        Alert.alert(
            t('leaderboard.leaveTitle'),
            t('leaderboard.leaveBody'),
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: t('leaderboard.leaveConfirm'),
                    style: 'destructive',
                    onPress: async () => {
                        const ok = await Leaderboard.optOut();
                        if (ok) {
                            haptic.light();
                            setStatus({ optedIn: false });
                            setTopN([]);
                            setMyRank(null);
                            setCommunityTotal(null);
                        }
                    },
                },
            ],
        );
    };

    const handleReport = (uid: string) => {
        if (reportBusy.has(uid)) return;
        Alert.alert(
            t('leaderboard.reportTitle'),
            t('leaderboard.reportBody'),
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: t('comments.report'),
                    style: 'destructive',
                    onPress: async () => {
                        setReportBusy(prev => new Set(prev).add(uid));
                        await Leaderboard.report(uid);
                        haptic.success();
                        setTopN(prev => prev.filter(e => e.uid !== uid));
                        Alert.alert('Reported', 'JazakAllah Khair.');
                    },
                },
            ],
        );
    };

    // The three metrics have non-obvious counting rules (Quran is volume
    // including repeats, not % complete; Tahajjud is nights, not minutes) —
    // this is the only place that explains them once the user is past the
    // one-time opt-in screen, so it needs to be reachable from the board
    // itself, not just shown once and forgotten.
    const showMetricInfo = () => {
        haptic.light();
        const titles: Record<LeaderboardMetric, string> = {
            dhikr: t('leaderboard.dhikr'),
            quranAyahs: t('leaderboard.quran'),
            tahajjud: t('leaderboard.tahajjud'),
        };
        const bodies: Record<LeaderboardMetric, string> = {
            dhikr: t('leaderboard.infoDhikr'),
            quranAyahs: t('leaderboard.infoQuran'),
            tahajjud: t('leaderboard.infoTahajjud'),
        };
        Alert.alert(titles[metric], bodies[metric]);
    };

    // Community total keyed per metric — the wording (dhikr said / ayahs
    // read / nights prayed) doesn't translate well as one generic template
    // interpolated with a noun, same reasoning as titles/bodies above.
    const communityTotalKeys: Record<LeaderboardMetric, string> = {
        dhikr: 'leaderboard.communityDhikr',
        quranAyahs: 'leaderboard.communityQuran',
        tahajjud: 'leaderboard.communityTahajjud',
    };

    // Shown for first-time opt-in AND for editing an existing profile —
    // same fields, same validation, different button copy/target state.
    const profileForm = (
        <KeyboardAvoidingView
            style={styles.optInWrap}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View style={[styles.trophyBadge, { backgroundColor: colors.accent + '1a', borderColor: colors.accent + '33' }]}>
                <Trophy size={36} color={colors.accent} />
            </View>
            <Text style={[styles.optInTitle, { color: colors.primaryText }]}>
                {editingProfile ? t('leaderboard.title') : t('leaderboard.optInTitle')}
            </Text>
            {!editingProfile && <Text style={styles.optInBody}>{t('leaderboard.optInBody')}</Text>}

            <TextInput
                value={nicknameInput}
                onChangeText={setNicknameInput}
                placeholder={t('leaderboard.nicknamePlaceholder')}
                placeholderTextColor="#3d4f68"
                style={[styles.nicknameInput, { color: colors.primaryText, borderColor: colors.accent + '33' }]}
                maxLength={Leaderboard.MAX_NICKNAME_LENGTH}
                autoCapitalize="none"
                autoCorrect={false}
            />

            <TouchableOpacity
                onPress={() => { haptic.light(); setShowCountryPicker(true); }}
                style={[styles.countryPickerBtn, { borderColor: colors.accent + '33' }]}
                activeOpacity={0.75}
            >
                {countryCode ? (
                    <>
                        <Text style={styles.countryPickerFlag}>{flagEmoji(countryCode)}</Text>
                        <Text style={[styles.countryPickerText, { color: colors.primaryText }]}>{countryName(countryCode)}</Text>
                    </>
                ) : (
                    <Text style={[styles.countryPickerText, { color: '#64748b' }]}>{t('leaderboard.selectCountry')}</Text>
                )}
                <ChevronRight size={16} color="#64748b" />
            </TouchableOpacity>

            <TouchableOpacity
                onPress={handleSaveProfile}
                disabled={optingIn || nicknameInput.trim().length === 0}
                style={[styles.joinBtn, {
                    backgroundColor: nicknameInput.trim().length > 0 ? colors.accent : 'rgba(255,255,255,0.08)',
                    shadowColor: colors.accent,
                }]}
                accessibilityRole="button"
            >
                {optingIn
                    ? <ActivityIndicator size="small" color="#0a1228" />
                    : <Text style={[styles.joinBtnText, {
                        color: nicknameInput.trim().length > 0 ? '#0a1228' : '#475569',
                    }]}>{editingProfile ? t('leaderboard.saveProfile') : t('leaderboard.join')}</Text>}
            </TouchableOpacity>

            {editingProfile && (
                <TouchableOpacity onPress={() => setEditingProfile(false)} style={{ marginTop: 4 }}>
                    <Text style={styles.leaveBtnText}>Cancel</Text>
                </TouchableOpacity>
            )}
        </KeyboardAvoidingView>
    );

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
            <View style={styles.root}>
                {/* Same night-sky treatment as the Dua Wall — shared gradient
                    + star field (STARS is exported from DuaWall.tsx) for a
                    consistent visual language across the app's "special"
                    full-screen surfaces, rather than this one being flat. */}
                <LinearGradient colors={['#08091e', '#0a1228', '#040714']} style={StyleSheet.absoluteFill} />
                {[...STARS, ...EXTRA_STARS].map((s, i) => (
                    <View key={i} pointerEvents="none" style={[
                        styles.star,
                        { left: s.left as any, top: s.top, width: s.size, height: s.size,
                          borderRadius: s.size / 2, opacity: s.opacity },
                    ]} />
                ))}

                {/* Gold "trophy room" glow layered on top — distinct from the
                    app's usual blue/cyan accent, signalling this specific
                    surface is an achievement space, not just another night-
                    sky screen. */}
                <LinearGradient
                    colors={['rgba(251,191,36,0.16)', 'transparent']}
                    style={styles.topGlow}
                    start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                />

                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={onClose}
                        style={styles.iconBtn}
                        hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                        accessibilityLabel="Close"
                        accessibilityRole="button"
                    >
                        <X size={20} color="#94a3b8" />
                    </TouchableOpacity>
                    <View style={styles.headerTitleRow}>
                        <Text style={styles.headerTrophy}>🏆</Text>
                        <Text style={[styles.headerTitle, { color: colors.primaryText }]}>{t('leaderboard.title')}</Text>
                    </View>
                    {status.optedIn ? (
                        <TouchableOpacity
                            onPress={() => { haptic.light(); startEditingProfile(); }}
                            style={styles.iconBtn}
                            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                            accessibilityLabel="Edit profile"
                            accessibilityRole="button"
                        >
                            <Pencil size={16} color="#94a3b8" />
                        </TouchableOpacity>
                    ) : <View style={{ width: 38 }} />}
                </View>

                {statusLoading ? (
                    <View style={styles.centerFill}><ActivityIndicator color={colors.accent} /></View>
                ) : (!status.optedIn || editingProfile) ? (
                    profileForm
                ) : (
                    <>
                        {/* Live participant count — social proof + liveliness,
                            reuses myRank.total (fetched in the same batch as
                            the rank itself) rather than firing a new query.
                            Paired with an info button so "what does this
                            number mean" is always one tap away, not just
                            explained once on the opt-in screen. */}
                        <View style={styles.metaRow}>
                            <Text style={styles.participantLine}>
                                {!!myRank && `🔥 ${t('leaderboard.participants', { n: myRank.total.toLocaleString() })}`}
                            </Text>
                            <TouchableOpacity
                                onPress={showMetricInfo}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                accessibilityLabel="How this is counted"
                                accessibilityRole="button"
                            >
                                <Info size={15} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.segmentRow}>
                            <SegmentButton active={metric === 'dhikr'} label={`🤲 ${t('leaderboard.dhikr')}`} onPress={() => setMetric('dhikr')} accent={colors.accent} />
                            <SegmentButton active={metric === 'quranAyahs'} label={`📖 ${t('leaderboard.quran')}`} onPress={() => setMetric('quranAyahs')} accent={colors.accent} />
                            <SegmentButton active={metric === 'tahajjud'} label={`🌙 ${t('leaderboard.tahajjud')}`} onPress={() => setMetric('tahajjud')} accent={colors.accent} />
                        </View>
                        {/* Filters are paired into full-width segmented
                            controls rather than loose auto-width pills. Three
                            stacked rows of differently-sized chips read as
                            clutter and gave no hint which options were
                            alternatives to each other; a segmented track makes
                            "one of these two" obvious at a glance and keeps the
                            rows aligned. Window and view sit together on one
                            row (both are "how am I looking at this"), with
                            scope — the bigger, premium decision — on its own
                            full-width row beneath. */}
                        <View style={styles.segRow}>
                            <Segmented
                                accent={colors.accent}
                                value={windowSel}
                                onChange={(v: string) => { haptic.light(); setWindowSel(v as LeaderboardWindow); }}
                                options={[
                                    { key: 'week', label: t('leaderboard.thisWeek') },
                                    { key: 'allTime', label: t('leaderboard.allTime') },
                                ]}
                            />
                            {!!myRank && (
                                <Segmented
                                    accent={colors.accent}
                                    value={viewMode}
                                    onChange={(v: string) => { haptic.light(); setViewMode(v as 'top' | 'nearby'); }}
                                    options={[
                                        { key: 'top', label: t('leaderboard.topView') },
                                        { key: 'nearby', label: t('leaderboard.nearbyView') },
                                    ]}
                                />
                            )}
                        </View>

                        {/* Global vs. your own country. Premium-gated, but the
                            control stays visible to everyone — hiding it means
                            free users never learn the feature exists. Only
                            rendered once a country is set, since there is
                            nothing to scope to otherwise. */}
                        {status.optedIn && status.country && (
                            <View style={styles.segRow}>
                                <Segmented
                                    accent={colors.accent}
                                    value={scope}
                                    onChange={(v: string) => {
                                        haptic.light();
                                        if (v === 'country' && !isPremium) {
                                            setPaywallOverlay({ source: 'feature_gate:country_leaderboard', featureId: 'country_leaderboard' });
                                            return;
                                        }
                                        setScope(v as 'global' | 'country');
                                        if (v === 'country') markFeatureUsed('country_leaderboard').catch(() => {});
                                    }}
                                    options={[
                                        { key: 'global', label: t('leaderboard.scopeGlobal') },
                                        {
                                            key: 'country',
                                            label: `${flagEmoji(status.country)} ${countryName(status.country)}${isPremium ? '' : ' 🔒'}`,
                                        },
                                    ]}
                                />
                            </View>
                        )}

                        {/* Combined total across every opted-in member — the
                            board itself only ever shows the top slice, so
                            this is the one place the community's total
                            effort (not just individual ranking) is visible. */}
                        {/* !== null, not truthy — a real 0 (e.g. nobody's
                            logged a Tahajjud night on the board yet) should
                            still render "0 ... by the community" instead of
                            silently vanishing, which looked like a bug next
                            to the other two tabs showing real numbers. null
                            only means "hasn't loaded yet". */}
                        {communityTotal !== null && (
                            <View style={styles.communityTotalRow}>
                                <Text style={styles.communityTotalText}>
                                    🌍 {t(communityTotalKeys[metric], { n: communityTotal.toLocaleString() })}
                                </Text>
                            </View>
                        )}

                        {myRank && (
                            <LinearGradient
                                colors={[colors.accent + '2a', colors.accent + '0a']}
                                style={[styles.myRankCard, { borderColor: colors.accent + '4d' }]}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                            >
                                <View style={[styles.myRankBadge, { backgroundColor: colors.accent }]}>
                                    <Text style={styles.myRankBadgeText}>#{myRank.rank}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        {!!status.country && <Text style={styles.myRankFlag}>{flagEmoji(status.country)}</Text>}
                                        <Text style={[styles.myRankLabel, { color: colors.accent }]}>{t('leaderboard.yourRank')}</Text>
                                    </View>
                                    <Text style={styles.myRankSub}>
                                        {t('leaderboard.of')} {myRank.total} · {myRank.value.toLocaleString()}
                                    </Text>
                                    {/* Motivational framing — same numbers already on
                                        screen, reframed as a goal rather than a flat
                                        fact. topN[0] is fetched in the same batch as
                                        myRank, so this is free (no extra query). */}
                                    <Text style={[styles.myRankGoal, { color: colors.accent }]}>
                                        {myRank.rank === 1
                                            ? t('leaderboard.rankFirst')
                                            : topN[0]
                                                ? t('leaderboard.rankGoal', { n: (topN[0].value - myRank.value).toLocaleString() })
                                                : ''}
                                    </Text>
                                </View>
                                {rankChange && (
                                    <View style={[
                                        styles.rankChangeBadge,
                                        { backgroundColor: rankChange.direction === 'up' ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.18)' },
                                    ]}>
                                        {rankChange.direction === 'up'
                                            ? <ChevronUp size={13} color="#22c55e" strokeWidth={3} />
                                            : <ChevronDown size={13} color="#ef4444" strokeWidth={3} />}
                                        <Text style={[styles.rankChangeText, { color: rankChange.direction === 'up' ? '#22c55e' : '#ef4444' }]}>
                                            {rankChange.delta}
                                        </Text>
                                    </View>
                                )}
                            </LinearGradient>
                        )}

                        {viewMode === 'nearby' ? (
                            nearbyLoading ? (
                                <View style={styles.centerFill}><ActivityIndicator color={colors.accent} /></View>
                            ) : (
                                <FlatList
                                    data={nearbyList}
                                    keyExtractor={e => e.uid}
                                    contentContainerStyle={styles.list}
                                    renderItem={({ item }) => {
                                        const isTop3 = item.rank <= 3;
                                        return (
                                            <View style={[
                                                styles.row,
                                                isTop3 && { backgroundColor: 'rgba(251,191,36,0.07)', borderColor: 'rgba(251,191,36,0.25)' },
                                                item.isMe && { borderColor: colors.accent + '88', backgroundColor: colors.accent + '14' },
                                            ]}>
                                                <Text style={styles.rankSlot}>
                                                    {isTop3 ? MEDALS[item.rank - 1] : String(item.rank)}
                                                </Text>
                                                {!!item.country && <Text style={styles.rowFlag}>{flagEmoji(item.country)}</Text>}
                                                <Text style={[styles.nickname, { color: item.isMe ? colors.accent : colors.primaryText }, item.isMe && { fontWeight: '800' }]} numberOfLines={1}>
                                                    {item.isMe ? t('leaderboard.you') : item.nickname}
                                                </Text>
                                                <Text style={[styles.value, { color: isTop3 ? '#fbbf24' : colors.accent }]}>
                                                    {item.value.toLocaleString()}
                                                </Text>
                                                {!item.isMe && (
                                                    <TouchableOpacity
                                                        onPress={() => handleReport(item.uid)}
                                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                        style={styles.flagBtn}
                                                        accessibilityLabel="Report entry"
                                                        accessibilityRole="button"
                                                    >
                                                        <Flag size={13} color="#475569" />
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        );
                                    }}
                                />
                            )
                        ) : listLoading ? (
                            <View style={styles.centerFill}><ActivityIndicator color={colors.accent} /></View>
                        ) : topN.length === 0 ? (
                            <View style={styles.centerFill}>
                                <Text style={styles.emptyIcon}>🌙</Text>
                                <Text style={[styles.emptyText, { color: colors.primaryText }]}>{t('leaderboard.empty')}</Text>
                                <Text style={styles.emptyBody}>{t('leaderboard.emptyBody')}</Text>
                            </View>
                        ) : (
                            <FlatList
                                data={topN}
                                keyExtractor={e => e.uid}
                                contentContainerStyle={styles.list}
                                renderItem={({ item, index }) => {
                                    const isTop3 = index < 3;
                                    // Relative to the #1 score — turns a flat list of
                                    // numbers into an actual leaderboard chart. Floored
                                    // at a small minimum so even a low entry still
                                    // reads as a visible bar, not a sliver.
                                    const leaderValue = topN[0]?.value || 1;
                                    const barWidth = Math.max(6, Math.min(100, (item.value / leaderValue) * 100));
                                    return (
                                        <View style={[
                                            styles.row,
                                            isTop3 && { backgroundColor: 'rgba(251,191,36,0.07)', borderColor: 'rgba(251,191,36,0.25)' },
                                        ]}>
                                            <View style={[
                                                styles.valueBar,
                                                { width: `${barWidth}%`, backgroundColor: isTop3 ? 'rgba(251,191,36,0.14)' : colors.accent + '14' },
                                            ]} pointerEvents="none" />
                                            <Text style={styles.rankSlot}>
                                                {isTop3 ? MEDALS[index] : String(index + 1)}
                                            </Text>
                                            {!!item.country && <Text style={styles.rowFlag}>{flagEmoji(item.country)}</Text>}
                                            <Text style={[styles.nickname, { color: colors.primaryText }]} numberOfLines={1}>
                                                {item.nickname}
                                            </Text>
                                            <Text style={[styles.value, { color: isTop3 ? '#fbbf24' : colors.accent }]}>
                                                {item.value.toLocaleString()}
                                            </Text>
                                            <TouchableOpacity
                                                onPress={() => handleReport(item.uid)}
                                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                style={styles.flagBtn}
                                                accessibilityLabel="Report entry"
                                                accessibilityRole="button"
                                            >
                                                <Flag size={13} color="#475569" />
                                            </TouchableOpacity>
                                        </View>
                                    );
                                }}
                            />
                        )}

                        <TouchableOpacity onPress={handleOptOut} style={styles.leaveBtn} accessibilityRole="button">
                            <Text style={styles.leaveBtnText}>{t('leaderboard.leave')}</Text>
                        </TouchableOpacity>
                    </>
                )}

                {/* Country picker — plain overlay, not a nested Modal (this
                    screen is already a Modal; a second one would silently
                    fail to present — see DuaWall for the documented case). */}
                {paywallOverlay && (
                    <View style={styles.paywallOverlay}>
                        <Paywall
                            onClose={() => setPaywallOverlay(null)}
                            source={paywallOverlay.source}
                            featureId={paywallOverlay.featureId}
                        />
                    </View>
                )}

                <CountryPickerOverlay
                    visible={showCountryPicker}
                    onClose={() => setShowCountryPicker(false)}
                    countryCode={countryCode}
                    onSelect={code => { setCountryCode(code); setShowCountryPicker(false); }}
                />
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#040714' },
    star: { position: 'absolute', backgroundColor: '#fff' },
    topGlow: {
        position: 'absolute', top: 0, left: 0, right: 0, height: 260,
    },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingBottom: 12,
        // No SafeAreaView on this full-screen Modal (same as GlobalTahajjudMap,
        // which uses this exact same constant) — without it, the header sits
        // right beside the status bar clock, and the X button's touch target
        // ends up mostly in the status bar's own gesture area rather than the
        // app's content, so taps don't register.
        paddingTop: Platform.OS === 'ios' ? 56 : 16,
    },
    iconBtn: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    headerTrophy: { fontSize: 16 },
    headerTitle: { fontSize: 17, fontWeight: '800' },
    centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    optInWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 },
    trophyBadge: {
        width: 76, height: 76, borderRadius: 38, borderWidth: 1,
        alignItems: 'center', justifyContent: 'center', marginBottom: 4,
    },
    optInTitle: { fontSize: 19, fontWeight: '800', textAlign: 'center' },
    optInBody: { fontSize: 13, color: '#94a3b8', textAlign: 'center', lineHeight: 19 },
    nicknameInput: {
        width: '100%', borderWidth: 1, borderRadius: 14,
        paddingHorizontal: 16, paddingVertical: 12, fontSize: 15,
        marginTop: 6, backgroundColor: 'rgba(255,255,255,0.03)',
    },
    countryPickerBtn: {
        width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10,
        borderWidth: 1, borderRadius: 14,
        paddingHorizontal: 16, paddingVertical: 12,
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    countryPickerFlag: { fontSize: 18 },
    countryPickerText: { flex: 1, fontSize: 14, fontWeight: '600' },
    joinBtn: {
        width: '100%', paddingVertical: 13, borderRadius: 14,
        alignItems: 'center', justifyContent: 'center',
        shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    },
    joinBtnText: { fontSize: 14, fontWeight: '800' },
    segmentRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 10 },
    // Deliberately smaller/lighter than segment/segmentText — this is a
    // secondary refinement of the metric choice above it, not an equal peer,
    // so it needs to visually read as "smaller" rather than another full row.
    windowRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 },
    segRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 10 },
    paywallOverlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 10,
        backgroundColor: '#08091e',
    },
    segTrack: {
        flex: 1, flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12, padding: 3,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    segItem: { flex: 1, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    segText: { fontSize: 12, fontWeight: '700', color: '#94a3b8' },
    windowChip: {
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    windowChipText: { fontSize: 11.5, fontWeight: '700', color: '#94a3b8' },
    communityTotalRow: {
        marginHorizontal: 16, marginBottom: 12,
        paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    },
    communityTotalText: { fontSize: 12, fontWeight: '700', color: '#94a3b8', textAlign: 'center' },
    segment: {
        flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    segmentText: { fontSize: 12.5, fontWeight: '700', color: '#94a3b8' },
    segmentTextActive: { color: '#0a1228', fontWeight: '800' },
    myRankCard: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        marginHorizontal: 16, marginTop: 6, marginBottom: 12,
        paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1,
    },
    myRankBadge: {
        paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12,
    },
    myRankBadgeText: { fontSize: 15, fontWeight: '900', color: '#0a1228' },
    myRankLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
    myRankSub: { fontSize: 12, color: '#94a3b8', fontWeight: '600', marginTop: 2 },
    myRankFlag: { fontSize: 13 },
    rankChangeBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 2,
        paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10,
    },
    rankChangeText: { fontSize: 12, fontWeight: '800' },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    emptyText: { fontSize: 16, fontWeight: '800', textAlign: 'center', paddingHorizontal: 40, marginBottom: 6 },
    emptyBody: { color: '#64748b', fontSize: 13, textAlign: 'center', paddingHorizontal: 48, lineHeight: 19 },
    metaRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, marginBottom: 10,
    },
    participantLine: {
        flex: 1,
        color: '#94a3b8', fontSize: 11.5, fontWeight: '700',
    },
    myRankGoal: { fontSize: 11.5, fontWeight: '700', marginTop: 4 },
    list: { paddingHorizontal: 16, paddingBottom: 24, gap: 6 },
    row: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingVertical: 11, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1,
        borderColor: 'transparent',
        backgroundColor: 'rgba(255,255,255,0.03)',
        overflow: 'hidden', // clips the value bar to the row's rounded corners
    },
    // Positioned first in the row so it paints BEHIND the text content
    // (later siblings in RN stack on top of earlier ones by default).
    valueBar: {
        position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 12,
    },
    rankSlot: { width: 26, textAlign: 'center', fontSize: 14, fontWeight: '800', color: '#64748b' },
    rowFlag: { fontSize: 14 },
    nickname: { flex: 1, fontSize: 14, fontWeight: '600' },
    value: { fontSize: 13, fontWeight: '800' },
    flagBtn: { padding: 2 },
    leaveBtn: { alignItems: 'center', paddingVertical: 16 },
    leaveBtnText: { color: '#64748b', fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' },
});
