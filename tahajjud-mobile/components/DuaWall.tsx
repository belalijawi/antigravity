import React, { useEffect, useState, useRef } from 'react';
import {
    Modal, View, Text, TouchableOpacity, StyleSheet, FlatList,
    TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard,
    Animated as RNAnimated, DeviceEventEmitter,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Heart, Flag, PenLine, Moon, Sparkles, Star, Globe, Check, Crown, ListChecks, ChevronRight, Trash2 } from 'lucide-react-native';
import { SEED_DUAS, isSeedDua } from '../utils/duaWallSeeds';
import Animated, { FadeInDown, FadeIn, ZoomIn, useSharedValue, useAnimatedStyle, withSequence, withSpring } from 'react-native-reanimated';
import { formatDistanceToNowStrict } from 'date-fns';
import { useTheme } from '../context/ThemeContext';
import { usePurchases } from '../context/PurchasesContext';
import { isCurrentUserAdmin } from '../utils/admins';
import type { FeatureId } from '../utils/featureDiscovery';
import { t } from '../utils/i18n';
import { DuaWall, PublicDua, formatDuaAuthor } from '../utils/duaWall';
import { haptic } from '../utils/haptic';
import { getFirebaseAuth } from '../utils/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TopPicksService } from '../utils/topPicks';
import { CommentThread } from './CommentThread';
import { DuasHistoryScreen } from './DuasHistoryScreen';
import { KnownNameField } from './KnownNameField';
import { CountryPickerOverlay } from './CountryPickerOverlay';
import Paywall from './Paywall';
import { CommunityProfileStore } from '../utils/communityProfile';
import { flagEmoji, countryName, isValidCountryCode } from '../utils/countries';

const AMEEN_KEY = 'dua_wall_ameened';
const PRAY_KEY = 'dua_wall_prayed';
// One-time "what is this" hint — shown once, first time the Wall opens,
// dismissed like the map-pin nudge (see showMapNudge). Small and
// corner-anchored rather than a blocking modal: explains the concept without
// making anyone tap through a screen before they can even see a dua.
const WALL_INTRO_SEEN_KEY = 'dua_wall_intro_seen_v1';
// One-time nudge toward the map-pin toggle — shown once, on the user's 2nd
// ever compose open, only if they've never used it (piggybacks on the same
// "own map duas" storage the map uses to highlight your pin).
const COMPOSE_OPEN_COUNT_KEY = 'dua_wall_compose_open_count';
const MAP_NUDGE_SHOWN_KEY = 'dua_wall_map_nudge_shown';

async function loadReactionSet(key: string): Promise<Set<string>> {
    try {
        const raw = await AsyncStorage.getItem(key);
        return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch { return new Set(); }
}

async function saveReactionSet(key: string, set: Set<string>): Promise<void> {
    try { await AsyncStorage.setItem(key, JSON.stringify([...set])); } catch {}
}

interface Props {
    visible: boolean;
    onClose: () => void;
    /** Deep-link target: scroll to this dua and auto-expand its reply thread
     * (set when the user tapped a "someone replied" notification). */
    focusDuaId?: string | null;
    /**
     * Render as a plain inline view (the Duas tab's "Wall" segment) instead
     * of a native modal. Inline mode drops the modal-only workarounds: the
     * close button disappears, and the paywall presents through the normal
     * global route (no overlay hack needed — there's no presented modal to
     * block it).
     */
    inline?: boolean;
}

// Decorative star field — sprinkled across the entire screen for a night-sky feel.
// Stars are absolute-positioned inside the root View, so they stay fixed while
// the list scrolls (parallax effect). Positions distributed top-to-bottom.
// Exported so other "night sky" surfaces (e.g. the Leaderboard) can reuse
// the exact same star field for a consistent visual language, rather than
// duplicating this positional data.
export const STARS = [
    // Top band (around the header)
    { left: '6%',  top: 30,   size: 2,   opacity: 0.5 },
    { left: '18%', top: 90,   size: 1.5, opacity: 0.35 },
    { left: '32%', top: 50,   size: 2,   opacity: 0.4 },
    { left: '52%', top: 100,  size: 1,   opacity: 0.55 },
    { left: '70%', top: 70,   size: 2,   opacity: 0.35 },
    { left: '85%', top: 40,   size: 1.5, opacity: 0.45 },
    { left: '92%', top: 110,  size: 1,   opacity: 0.4 },
    // Upper-mid
    { left: '11%', top: 180,  size: 1,   opacity: 0.3 },
    { left: '40%', top: 200,  size: 1,   opacity: 0.35 },
    { left: '60%', top: 160,  size: 1.5, opacity: 0.4 },
    { left: '80%', top: 230,  size: 1,   opacity: 0.3 },
    { left: '25%', top: 260,  size: 2,   opacity: 0.3 },
    // Mid screen
    { left: '8%',  top: 340,  size: 1.5, opacity: 0.35 },
    { left: '45%', top: 320,  size: 1,   opacity: 0.4 },
    { left: '72%', top: 360,  size: 2,   opacity: 0.3 },
    { left: '90%', top: 300,  size: 1,   opacity: 0.4 },
    { left: '16%', top: 420,  size: 1,   opacity: 0.32 },
    { left: '55%', top: 440,  size: 1.5, opacity: 0.35 },
    { left: '82%', top: 460,  size: 1,   opacity: 0.3 },
    // Lower-mid
    { left: '5%',  top: 540,  size: 1.5, opacity: 0.4 },
    { left: '38%', top: 520,  size: 1,   opacity: 0.35 },
    { left: '65%', top: 580,  size: 2,   opacity: 0.3 },
    { left: '88%', top: 560,  size: 1,   opacity: 0.35 },
    { left: '22%', top: 640,  size: 1,   opacity: 0.32 },
    { left: '50%', top: 660,  size: 1.5, opacity: 0.4 },
    { left: '78%', top: 700,  size: 1,   opacity: 0.3 },
    // Bottom band
    { left: '12%', top: 780,  size: 1.5, opacity: 0.35 },
    { left: '42%', top: 810,  size: 1,   opacity: 0.3 },
    { left: '68%', top: 770,  size: 2,   opacity: 0.32 },
    { left: '90%', top: 840,  size: 1,   opacity: 0.35 },
    { left: '28%', top: 900,  size: 1,   opacity: 0.3 },
    { left: '58%', top: 920,  size: 1.5, opacity: 0.4 },
    { left: '85%', top: 960,  size: 1,   opacity: 0.32 },
];

export function DuaWallModal({ visible, onClose, focusDuaId, inline }: Props) {
    const { colors } = useTheme();
    const { isPremium, openPaywall } = usePurchases();
    // Admin gets no daily posting limit at all — separate from isPremium,
    // which still gates the map-pin feature below (that's not what was
    // asked for). Client-side only, same trust model as every other
    // premium/admin gate in this app.
    const canPostUnlimited = isPremium || isCurrentUserAdmin();
    const [duas, setDuas] = useState<PublicDua[]>([]);
    // This device's own dua ids — lets a card show a delete action instead
    // of (or alongside) the report button for content you posted yourself.
    // Same client-only "own" tracking as ownMapDuaIds on the map — there's
    // no account system, so "is this mine" can only ever be answered
    // locally, never derived from the doc itself.
    const [ownDuaIds, setOwnDuaIds] = useState<Set<string>>(new Set());
    useEffect(() => {
        DuaWall.getOwnDuaIds().then(ids => setOwnDuaIds(new Set(ids)));
    }, []);
    const [deletingDuaIds, setDeletingDuaIds] = useState<Set<string>>(new Set());
    // True until the first server-confirmed snapshot arrives. Prevents the
    // empty local-cache snapshot (cold start) from rendering as a final
    // "seeds only" state — that race made the wall show just the universal
    // duas on first open until an app refresh warmed the cache.
    const [loadingLive, setLoadingLive] = useState(true);
    const [showCompose, setShowCompose] = useState(false);
    // Paywall shown as an overlay INSIDE this modal — the root-level paywall
    // Modal can't present while this pageSheet is up (iOS one-modal rule),
    // and nested Modals have burned this component before (see compose note).
    // Carries WHICH paywall to show — the reply-gate and the map-pin gate
    // both need this overlay, each with its own source/featureId.
    const [paywallOverlay, setPaywallOverlay] = useState<{ source: string; featureId?: FeatureId } | null>(null);
    const [composeText, setComposeText] = useState('');
    // Optional first name — same "Anonymous" fallback pattern as comments.
    const [composeName, setComposeName] = useState('');
    // Known name from CommunityProfileStore — see KnownNameField. Renders as
    // static "Posting as X · not you?" instead of an editable box once a name
    // is already known anywhere in the app.
    const [composeProfileName, setComposeProfileName] = useState<string | null>(null);
    const [editingComposeName, setEditingComposeName] = useState(false);
    // Optional country shown beside the name ("John, Ireland") — shared via
    // CommunityProfileStore exactly like the nickname, but NOT tied to the
    // Leaderboard's opt-in (same reasoning as the name: showing where you're
    // from shouldn't silently opt you into a public ranking).
    const [composeCountryCode, setComposeCountryCode] = useState<string | null>(null);
    const [showComposeCountryPicker, setShowComposeCountryPicker] = useState(false);
    // Opt-in map pin for this dua. Off by default — attaching a city to
    // written content is a consent decision, made per-dua.
    const [showOnMap, setShowOnMap] = useState(false);
    // One-time adoption nudge toward the map toggle (see key comments above).
    const [showMapNudge, setShowMapNudge] = useState(false);
    // One-time "what is this" corner hint (see WALL_INTRO_SEEN_KEY above).
    const [showWallIntro, setShowWallIntro] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [ameened, setAmeened] = useState<Set<string>>(new Set());
    const [praying, setPraying] = useState<Set<string>>(new Set());
    // Admin-picked "Top Dua of the Day" — pinned above the regular feed.
    // Fetched separately since the pick may not be among the 50 most recent.
    const [topDua, setTopDua] = useState<PublicDua | null>(null);
    // Combined "My Duas" / "Answered Duas" screen — one entry point with
    // text-labeled tabs instead of two separate icon buttons a user has to
    // guess between.
    const [showDuasHistory, setShowDuasHistory] = useState(false);
    // Always-current mirrors of the reaction sets. The tap handlers read/write
    // THESE (not the `ameened`/`praying` state) because DuaCard is memoized and
    // ignores callback identity — so a card that didn't re-render still holds an
    // old handler closure capturing a stale set. Reading the stale set made
    // tapping a second dua overwrite the first ("the other one disappears").
    // Refs are updated synchronously on every tap, so they never go stale.
    const ameenedRef = React.useRef<Set<string>>(ameened);
    const prayingRef = React.useRef<Set<string>>(praying);
    // Guard against setState on unmounted modal (Firestore writes can outlive the modal)
    const duaWallMountedRef = React.useRef(true);
    React.useEffect(() => {
        duaWallMountedRef.current = true;
        return () => { duaWallMountedRef.current = false; };
    }, []);

    // Re-check the shared community name every time compose opens, not just
    // once when the Dua Wall first mounts — the wall can stay mounted for an
    // entire app session, so a name set LATER (in Settings, the Leaderboard,
    // a comment, the Partner circle) would otherwise never be picked up.
    useEffect(() => {
        if (!showCompose) return;
        setEditingComposeName(false);
        CommunityProfileStore.get().then(profile => {
            if (!duaWallMountedRef.current) return;
            if (profile?.nickname) {
                setComposeProfileName(profile.nickname);
                setComposeName(prev => prev || profile.nickname);
            }
            if (profile?.country && isValidCountryCode(profile.country)) {
                setComposeCountryCode(prev => prev ?? profile.country ?? null);
            }
        });
    }, [showCompose]);

    // Patch our own state the moment ANY screen marks a dua answered — the
    // Dua Wall list, the map pin detail, and the Duas History screen are
    // separately-mounted components each holding their own copy, so marking
    // answered from the map (say) left this list showing stale "not
    // answered" until its own Firestore listener happened to re-fire for an
    // unrelated reason. See utils/duaWall.ts markAnswered for the full
    // reasoning.
    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('duaAnswered', ({ duaId }: { duaId: string }) => {
            setDuas(prev => prev.map(d => d.id === duaId ? { ...d, answered: true } : d));
        });
        return () => sub.remove();
    }, []);

    // Keep the Ameen state in step with the SAME dua shown on the map's pin
    // card. Both surfaces persist to the same AsyncStorage key, but this
    // component only re-reads that key when its `visible` effect runs — and
    // inline (the Duas tab's Wall segment) `visible` is a constant `true`, so
    // if the wall is already mounted when you tap Ameen on the map it would
    // otherwise keep showing the dua as un-Ameened until it remounted.
    // Mirroring the change in memory here means the two always agree
    // instantly, in both directions, without another storage read.
    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('duaAmeenChanged',
            ({ duaId, ameened: isAmeened, source }: { duaId: string; ameened: boolean; source?: string }) => {
                // Ignore our own emit — handleAmeen already applied it, and the
                // Firestore snapshot supplies the authoritative count.
                if (source === 'wall') return;
                if (ameenedRef.current.has(duaId) === isAmeened) return; // already agrees
                const next = new Set(ameenedRef.current);
                if (isAmeened) next.add(duaId); else next.delete(duaId);
                ameenedRef.current = next;
                setAmeened(next);
                // Reflect the count too, so the number under the dua doesn't
                // sit stale until Firestore's next snapshot lands.
                setDuas(prev => prev.map(d => d.id === duaId
                    ? { ...d, ameenCount: Math.max(0, d.ameenCount + (isAmeened ? 1 : -1)) }
                    : d));
            });
        return () => sub.remove();
    }, []);
    // Guard against double-tap races — the Firestore writes are a non-atomic
    // check-then-act (getDoc then increment), so two overlapping taps on the
    // same dua before the first resolves can double-count the reaction.
    const ameenInFlightRef = React.useRef<Set<string>>(new Set());
    const prayingInFlightRef = React.useRef<Set<string>>(new Set());
    const listRef = React.useRef<FlatList>(null);

    useEffect(() => {
        if (!visible) {
            // The wall was closed — make sure the compose overlay never
            // survives into the next open (a stale-open compose was part of
            // the frozen-app bug this component had with a second <Modal>).
            setShowCompose(false);
            setShowComposeCountryPicker(false);
            setPaywallOverlay(null);
            setShowDuasHistory(false);
            return;
        }
        setLoadingLive(true);
        const unsub = DuaWall.subscribeWall(50, (live, fromCache) => {
            if (!duaWallMountedRef.current) return;
            setDuas(live);
            // Keep showing the loading hint until the server confirms — an empty
            // cache snapshot (fromCache) is not a trustworthy "no duas" answer.
            if (!fromCache) setLoadingLive(false);
        });
        Promise.all([loadReactionSet(AMEEN_KEY), loadReactionSet(PRAY_KEY)]).then(([a, p]) => {
            if (!duaWallMountedRef.current) return;
            ameenedRef.current = a;
            prayingRef.current = p;
            setAmeened(a);
            setPraying(p);
        });
        AsyncStorage.getItem(WALL_INTRO_SEEN_KEY).then(seen => {
            if (!seen && duaWallMountedRef.current) setShowWallIntro(true);
        });
        return () => unsub();
    }, [visible]);

    const dismissWallIntro = () => {
        setShowWallIntro(false);
        AsyncStorage.setItem(WALL_INTRO_SEEN_KEY, '1').catch(() => {});
    };

    // Admin-picked Top Dua of the Day — live so it updates instantly if the
    // admin changes it while the wall is open.
    useEffect(() => {
        if (!visible) return;
        const unsub = TopPicksService.subscribe(picks => {
            if (!duaWallMountedRef.current) return;
            if (!picks.topDuaId) { setTopDua(null); return; }
            DuaWall.getById(picks.topDuaId).then(d => {
                if (duaWallMountedRef.current) setTopDua(d);
            });
        });
        return unsub;
    }, [visible]);

    // One-time nudge toward the map toggle — on the user's 2nd ever compose
    // open, only if they've never used it. "Never used it" reuses the map's
    // own-pin storage rather than a separate flag: if it's non-empty, they've
    // published a pinned dua before and don't need the nudge.
    useEffect(() => {
        if (!showCompose) return;
        let cancelled = false;
        (async () => {
            try {
                const [countRaw, everUsedIds, alreadyShown] = await Promise.all([
                    AsyncStorage.getItem(COMPOSE_OPEN_COUNT_KEY),
                    DuaWall.getOwnMapDuaIds(),
                    AsyncStorage.getItem(MAP_NUDGE_SHOWN_KEY),
                ]);
                const nextCount = (parseInt(countRaw ?? '0', 10) || 0) + 1;
                AsyncStorage.setItem(COMPOSE_OPEN_COUNT_KEY, String(nextCount)).catch(() => {});
                if (cancelled) return;
                if (nextCount === 2 && everUsedIds.size === 0 && !alreadyShown) {
                    setShowMapNudge(true);
                }
            } catch {}
        })();
        return () => { cancelled = true; };
    }, [showCompose]);

    const dismissMapNudge = () => {
        setShowMapNudge(false);
        AsyncStorage.setItem(MAP_NUDGE_SHOWN_KEY, '1').catch(() => {});
    };

    // Deep-link scroll: once live duas have loaded, bring the focused dua
    // into view. Its thread auto-expands via initialExpanded on CommentThread.
    useEffect(() => {
        if (!visible || !focusDuaId || loadingLive) return;
        const idx = displayDuas.findIndex(d => d.id === focusDuaId);
        if (idx < 0) return; // aged out of the 50 most recent — thread still opens if visible
        const timer = setTimeout(() => {
            try {
                listRef.current?.scrollToIndex({ index: idx, viewPosition: 0.15, animated: true });
            } catch { /* scrollToIndex can throw before layout; non-critical */ }
        }, 350);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, focusDuaId, loadingLive]);

    // Merge live duas with the curated seed list so the wall never feels
    // empty for new users. Live duas show first (chronological); seed
    // duas fill the rest. Each seed dua carries an isSeed flag so the UI
    // can show a "Universal" badge instead of pretending it's user-posted.
    const displayDuas = React.useMemo(() => {
        // Exclude the Top Dua of the Day — it's pinned separately above the
        // list, so leaving it in here too would show it twice.
        const rest = topDua ? duas.filter(d => d.id !== topDua.id) : duas;
        const merged: (PublicDua | (PublicDua & { isSeed?: true }))[] = [...rest];
        // Seeds join only AFTER the server confirms the live order. Merging
        // them during the cache window painted seeds/stale items first, then
        // the server snapshot shoved fresh duas on top — a visible reshuffle
        // on every open. One extra beat of the loading hint beats the jumble.
        if (!loadingLive) {
            const liveIds = new Set(rest.map(d => d.id));
            for (const seed of SEED_DUAS) {
                if (!liveIds.has(seed.id)) merged.push(seed);
            }
        }
        return merged;
    }, [duas, topDua, loadingLive]);

    // Activity indicator: how recently was the live feed updated?
    // `duas` is the 50 most-recent non-hidden duas EVER, not scoped to any
    // time window — once the wall passes 50 total posts, `duas.length` is
    // permanently 50 regardless of actual recent activity. Count only the
    // ones actually posted within the last 24h for an honest "tonight" figure
    // (matches the same rolling window used by the Global Tahajjud Map).
    const TONIGHT_WINDOW_MS = 24 * 60 * 60 * 1000;
    const tonightCount = duas.filter(d => Date.now() - d.createdAt.getTime() <= TONIGHT_WINDOW_MS).length;
    const lastLiveAt = duas[0]?.createdAt;
    const minutesAgo = lastLiveAt
        ? Math.max(0, Math.floor((Date.now() - lastLiveAt.getTime()) / 60000))
        : null;
    const activityLabel = loadingLive
        ? 'Loading tonight\'s duas…'
        : tonightCount === 0
        ? t('duaWall.quietTonight')
        : minutesAgo == null
            ? `${tonightCount} tonight`
            : minutesAgo < 1
                ? `${tonightCount} tonight · just now`
                : minutesAgo < 60
                    ? `${tonightCount} tonight · last ${minutesAgo}m ago`
                    : `${tonightCount} tonight`;

    const handleAmeen = async (id: string) => {
        if (ameenInFlightRef.current.has(id)) return;
        haptic.light();
        // Read the LATEST set from the ref (not the possibly-stale closure state),
        // then write the ref back synchronously so a tap on another dua sees it.
        const wasAmeened = ameenedRef.current.has(id);
        const next = new Set(ameenedRef.current);
        if (wasAmeened) next.delete(id); else next.add(id);
        ameenedRef.current = next;
        setAmeened(next);
        saveReactionSet(AMEEN_KEY, next);
        // Tell any other mounted surface showing this dua (the map's pin card)
        // to update its own button immediately — see the listener below.
        DeviceEventEmitter.emit('duaAmeenChanged', { duaId: id, ameened: !wasAmeened, source: 'wall' });
        if (!wasAmeened) {
            import('../utils/analytics').then(m => m.track('dua_ameen')).catch(() => {});
        }
        // Seed duas don't write to Firestore; the local toggle is the whole thing.
        if (id.startsWith('seed-')) return;
        // Persist to the backend (count + author milestone notification). The
        // local toggle above is authoritative for the button and is ALREADY
        // saved to AsyncStorage, so we deliberately do NOT roll it back on a
        // backend failure — the press must stick (and survive app restarts)
        // regardless of a transient network issue. The marker write is
        // idempotent, so a re-tap or next session reconciles the count safely.
        ameenInFlightRef.current.add(id);
        try {
            if (wasAmeened) await DuaWall.unameen(id); else await DuaWall.ameen(id);
        } catch { /* best-effort — local state already persisted */ }
        finally {
            ameenInFlightRef.current.delete(id);
        }
    };

    const handlePraying = async (id: string) => {
        if (prayingInFlightRef.current.has(id)) return;
        haptic.light();
        // Read/write the ref (not the stale closure state) — see handleAmeen.
        const wasPraying = prayingRef.current.has(id);
        const next = new Set(prayingRef.current);
        if (wasPraying) next.delete(id); else next.add(id);
        prayingRef.current = next;
        setPraying(next);
        saveReactionSet(PRAY_KEY, next);
        if (id.startsWith('seed-')) return;
        // Best-effort backend write; the local toggle is authoritative and
        // already persisted, so it is never auto-reverted (see handleAmeen).
        prayingInFlightRef.current.add(id);
        try {
            if (wasPraying) await DuaWall.unpray(id); else await DuaWall.prayingFor(id);
        } catch { /* best-effort — local state already persisted */ }
        finally {
            prayingInFlightRef.current.delete(id);
        }
    };

    const handleReport = (id: string) => {
        Alert.alert(
            'Report this dua?',
            'Thank you for keeping the wall safe. We\'ll review this submission within 24 hours.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Report',
                    style: 'destructive',
                    onPress: async () => {
                        await DuaWall.report(id);
                        haptic.success();
                        Alert.alert('Reported', 'JazakAllah Khair.');
                    },
                },
            ],
        );
    };

    const handleDeleteDua = (id: string) => {
        if (deletingDuaIds.has(id)) return;
        Alert.alert(
            t('duaWall.deleteConfirmTitle'),
            t('duaWall.deleteConfirmBody'),
            [
                { text: t('btn.cancel'), style: 'cancel' },
                {
                    text: t('btn.delete'),
                    style: 'destructive',
                    onPress: async () => {
                        haptic.light();
                        setDeletingDuaIds(prev => new Set(prev).add(id));
                        const ok = await DuaWall.deleteMine(id);
                        // No manual removal from `duas` needed on success — the
                        // wall's own onSnapshot listener (subscribeWall) will
                        // simply stop returning the deleted doc on its next
                        // update. If the delete itself failed, just clear the
                        // in-flight marker so the button is tappable again.
                        setDeletingDuaIds(prev => {
                            const next = new Set(prev);
                            next.delete(id);
                            return next;
                        });
                        if (!ok) Alert.alert('Could not delete', 'Please try again.');
                    },
                },
            ],
        );
    };

    const handlePublish = async () => {
        if (publishing) return;
        const user = getFirebaseAuth()?.currentUser;
        if (!user) {
            Alert.alert('Sign in required', 'Please sign in to publish anonymously to the wall.');
            return;
        }
        setPublishing(true);
        // Resolve city-level coords only if the author opted in AND is premium.
        // The isPremium re-check is defense-in-depth — the toggle is already
        // gated so showOnMap shouldn't reach here true for a free user, but
        // premium status can change between toggling and publishing.
        //
        // allowPrompt=false — DELIBERATE, do not flip back to true. Passing
        // true here caused a live native crash (NSInvalidArgumentException
        // deep in RCTNetworking, "nil object from objects[3]"): presenting
        // the OS location-permission alert from THIS exact moment lands in
        // the middle of a burst of concurrent network activity (Firestore
        // write + analytics + RevenueCat's offerings/customer-info calls all
        // firing together right after Publish), and that combination is a
        // known class of RN bridge race — a native modal presented while
        // several network completions are in flight. This also matches the
        // app's existing policy elsewhere (see logTahajjudToMap): never pop
        // a permission prompt from a background/compose flow, only from a
        // dedicated screen (the map already has its own "Enable Location").
        // If permission isn't already granted, the pin is silently skipped —
        // tell the user afterward rather than leaving them to wonder.
        let location: { lat: number; lng: number } | null = null;
        let mapPinSkippedNoPermission = false;
        if (showOnMap && isPremium) {
            const { getRoundedLocation } = await import('../utils/tahajjudMap');
            location = await getRoundedLocation(false);
            if (!location) mapPinSkippedNoPermission = true;
        }
        const result = await DuaWall.publish(composeText, {
            location,
            displayName: composeName,
            country: composeCountryCode ?? undefined,
            isPremium,
        });
        if (!duaWallMountedRef.current) return;
        setPublishing(false);
        if (!result.ok) {
            const messages: Record<string, string> = {
                'too-short': `Please write at least ${DuaWall.MIN_WORDS} words.`,
                'too-long': `Please keep your dua under ${DuaWall.MAX_LENGTH} characters.`,
                'rate-limited': isPremium
                    ? "You've reached today's limit of 3 duas. The wall renews tomorrow."
                    : "You've already published today. Premium members can post up to 3 times a day.",
                'profanity': "Please rephrase — your dua contains words our filter flagged.",
                'not-signed-in': 'Please sign in to publish.',
                'firestore-error': 'Could not publish. Try again.',
            };
            Alert.alert('Could not publish', messages[result.error ?? 'firestore-error'] ?? 'Try again.');
            return;
        }
        haptic.success();
        // Propagate whatever name they used to the Leaderboard, comments, and
        // Partner circle — whichever surface you name yourself on first flows
        // to the others. Skipped if they posted anonymously (blank name).
        if (composeName.trim()) CommunityProfileStore.set(composeName, composeCountryCode).catch(() => {});
        if (duaWallMountedRef.current) {
            setShowOnMap(false);
            setComposeName('');
            setComposeText('');
            setShowCompose(false);
        }
        import('../utils/featureDiscovery').then(m => m.markFeatureUsed('dua_wall')).catch(() => {});
        import('../utils/analytics').then(m => m.track('dua_posted')).catch(() => {});
        // Tell the user when the pin silently didn't attach — previously this
        // failed with zero feedback, leaving them to wrongly assume it was
        // pinned. Location permission can be granted from the Map screen.
        if (mapPinSkippedNoPermission) {
            Alert.alert(
                'Published 🌙',
                "May Allah accept your dua. It wasn't added to the map — enable location access (from the Map screen) to pin future duas.",
            );
        } else {
            Alert.alert('Published 🌙', 'May Allah accept your dua.');
        }
    };

    // Character count color shifts as user approaches limit
    const remaining = DuaWall.MAX_LENGTH - composeText.length;
    const countColor = remaining < 20 ? '#ef4444' : remaining < 50 ? '#f59e0b' : colors.secondaryText;

    const content = (
            <View style={styles.root}>
                <LinearGradient colors={['#08091e', '#0a1228', '#040714']} style={StyleSheet.absoluteFill} />

                {/* Stars in the background — only behind hero, not the list */}
                {STARS.map((s, i) => (
                    <View key={i} pointerEvents="none" style={[
                        styles.star,
                        { left: s.left as any, top: s.top, width: s.size, height: s.size,
                          borderRadius: s.size / 2, opacity: s.opacity },
                    ]} />
                ))}

                {/* ── Single header: close + title block + share ──
                    Inline, the X returns to the Library segment (the Duas
                    header is hidden while the wall is full-bleed). ── */}
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

                    <View style={styles.headerCenter}>
                        <Text style={[styles.headerTitle, { color: colors.primaryText }]}>{t('duaWall.title')}</Text>
                        <Text style={[styles.headerSub, { color: colors.secondaryText }]}>
                            {activityLabel}
                        </Text>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                            onPress={() => { haptic.light(); setShowDuasHistory(true); }}
                            style={styles.iconBtn}
                            accessibilityLabel={t('duaWall.duasHistoryTitle')}
                            accessibilityRole="button"
                        >
                            <ListChecks size={16} color="#94a3b8" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => { haptic.light(); setShowCompose(true); }}
                            style={[styles.publishBtn, { backgroundColor: colors.accent, shadowColor: colors.accent }]}
                            accessibilityLabel="Publish a dua"
                            accessibilityRole="button"
                        >
                            <PenLine size={14} color="#0a1228" strokeWidth={2.5} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* One-time "what is this" hint — small, corner-anchored,
                    dismissed forever once tapped away. Not a modal: the wall
                    itself is already understood by most first-time users,
                    per feedback, so this stays out of the way of the actual
                    content instead of blocking it. */}
                {showWallIntro && (
                    <View style={styles.wallIntroWrap} pointerEvents="box-none">
                        <View style={[styles.wallIntroCard, { borderColor: colors.accent + '44', backgroundColor: colors.accent + '14' }]}>
                            <Text style={[styles.wallIntroText, { color: colors.primaryText }]}>
                                {t('duaWall.introHint')}
                            </Text>
                            <TouchableOpacity
                                onPress={dismissWallIntro}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                accessibilityLabel="Dismiss"
                                accessibilityRole="button"
                            >
                                <X size={12} color={colors.secondaryText} />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* ── Duas list ──
                    Wrapped in its own KeyboardAvoidingView (same behavior as the
                    compose overlay below) so replying inline to a dua/reply deep
                    in the list — via CommentThread inside DuaCard — doesn't get
                    covered by the keyboard: "padding" shrinks the list's own
                    height, and automaticallyAdjustKeyboardInsets lets the FlatList
                    scroll the focused input above the keyboard automatically.
                    keyboardVerticalOffset adds a little EXTRA padding beyond the
                    keyboard's exact height (RN's own formula is frame.bottom -
                    keyboardScreenY + offset, so a positive offset only ever
                    enlarges the gap) — without it the compose box's bottom edge
                    sits flush against the keyboard with no breathing room. */}
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={20}>
                <FlatList
                    ref={listRef}
                    data={displayDuas}
                    keyExtractor={d => d.id}
                    onScrollToIndexFailed={info => {
                        // Row not rendered yet — jump approximately, then retry.
                        listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
                        setTimeout(() => {
                            try { listRef.current?.scrollToIndex({ index: info.index, viewPosition: 0.15, animated: true }); } catch {}
                        }, 250);
                    }}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    automaticallyAdjustKeyboardInsets
                    initialNumToRender={6}
                    maxToRenderPerBatch={6}
                    windowSize={7}
                    // removeClippedSubviews is disabled on Android: RN's clipped-view
                    // detach/reattach races with the render thread and crashes with
                    // "NullPointerException: mViewFlags on a null object reference"
                    // (confirmed in Play Console crash reports across 1.8.5-1.8.9).
                    removeClippedSubviews={false}
                    ListHeaderComponent={
                        <>
                            {topDua && (
                                <View style={styles.topPickWrap}>
                                    <View style={styles.topPickBadgeRow}>
                                        <Star size={12} color="#facc15" fill="#facc15" />
                                        <Text style={styles.topPickBadgeText}>{t('duaWall.topPickBadge')}</Text>
                                    </View>
                                    <DuaCard
                                        dua={topDua}
                                        index={0}
                                        userTapped={ameened.has(topDua.id)}
                                        userPraying={praying.has(topDua.id)}
                                        accent={colors.accent}
                                        onAmeen={() => handleAmeen(topDua.id)}
                                        onPraying={() => handlePraying(topDua.id)}
                                        onReport={() => handleReport(topDua.id)}
                                        isSeed={false}
                                        isOwn={ownDuaIds.has(topDua.id)}
                                        onDelete={() => handleDeleteDua(topDua.id)}
                                        deleting={deletingDuaIds.has(topDua.id)}
                                        onRequestPaywall={inline ? undefined : () => setPaywallOverlay({ source: 'comment_free_limit', featureId: 'dua_replies' })}
                                    />
                                </View>
                            )}
                            {/* Cold-start hint: live duas are still loading from the
                                server, so the seed duas below aren't the whole story. */}
                            {loadingLive && duas.length === 0 && (
                                <View style={styles.loadingRow}>
                                    <ActivityIndicator size="small" color={colors.accent} />
                                    <Text style={[styles.loadingText, { color: colors.secondaryText }]}>
                                        Loading tonight's duas…
                                    </Text>
                                </View>
                            )}
                        </>
                    }
                    ListEmptyComponent={
                        <Animated.View entering={FadeIn.delay(200).duration(500)} style={styles.empty}>
                            <View style={[styles.emptyOrb, { borderColor: colors.accent + '33' }]}>
                                <Sparkles size={28} color={colors.accent + '88'} strokeWidth={1.5} />
                            </View>
                            <Text style={[styles.emptyTitle, { color: colors.primaryText }]}>No duas yet</Text>
                            <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>
                                Be the first to share one.{'\n'}
                                Others will say Ameen.
                            </Text>
                            <TouchableOpacity
                                onPress={() => setShowCompose(true)}
                                style={[styles.emptyCTA, { backgroundColor: colors.accent }]}
                            >
                                <PenLine size={14} color="#0a1228" strokeWidth={2.5} />
                                <Text style={styles.emptyCTAText}>{t('duaWall.share')}</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    }
                    renderItem={({ item, index }) => (
                        <DuaCard
                            dua={item}
                            index={index}
                            userTapped={ameened.has(item.id)}
                            userPraying={praying.has(item.id)}
                            accent={colors.accent}
                            onAmeen={() => handleAmeen(item.id)}
                            onPraying={() => handlePraying(item.id)}
                            onReport={() => handleReport(item.id)}
                            isSeed={isSeedDua(item)}
                            isOwn={ownDuaIds.has(item.id)}
                            onDelete={() => handleDeleteDua(item.id)}
                            deleting={deletingDuaIds.has(item.id)}
                            onRequestPaywall={inline ? undefined : () => setPaywallOverlay({ source: 'comment_free_limit', featureId: 'dua_replies' })}
                            autoExpandReplies={item.id === focusDuaId}
                        />
                    )}
                />
                </KeyboardAvoidingView>

                {/* ══ Compose overlay — a plain View INSIDE the wall modal, never
                    a second <Modal>. iOS lets a view controller present only one
                    modal at a time: a second <Modal> (nested OR sibling) silently
                    fails to appear while the wall sheet is up, and dismissing the
                    wall while it is still marked visible strands an invisible
                    native transition layer that blocks every touch in the app
                    until the user force-kills it. ══ */}
                {showCompose && (
                    // Plain View, no `entering` fade: this app has a history of
                    // reanimated entering animations sticking at opacity 0, and
                    // an invisible copy of this overlay would block every touch
                    // in the modal — the exact bug the overlay refactor fixed.
                    <View style={styles.composeOverlay}>
                    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                        <LinearGradient colors={['#08091e', '#040714']} style={StyleSheet.absoluteFill} />

                        {/* Compose header */}
                        <View style={styles.composeHeader}>
                            <TouchableOpacity onPress={() => setShowCompose(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                                <Text style={[styles.composeCancel, { color: colors.secondaryText }]}>Cancel</Text>
                            </TouchableOpacity>

                            <Text style={[styles.composeBrandText, { color: colors.primaryText }]}>Your dua</Text>

                            <TouchableOpacity
                                onPress={handlePublish}
                                disabled={publishing || composeText.trim().length < 5}
                                style={[
                                    styles.composePublishBtn,
                                    {
                                        backgroundColor: composeText.trim().length >= 5 ? colors.accent : 'rgba(255,255,255,0.08)',
                                        opacity: publishing ? 0.6 : 1,
                                    },
                                ]}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                {publishing
                                    ? <ActivityIndicator size="small" color="#0a1228" />
                                    : <Text style={[styles.composePublishText, { color: composeText.trim().length >= 5 ? '#0a1228' : '#475569' }]}>Publish</Text>
                                }
                            </TouchableOpacity>
                        </View>

                        {/* Bismillah header */}
                        <View style={styles.bismillahWrap}>
                            <Text style={[styles.bismillah, { color: colors.accent + 'cc' }]}>بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيم</Text>
                            <View style={[styles.bismillahDivider, { backgroundColor: colors.accent + '22' }]} />
                        </View>

                        {/* One-time adoption nudge — points at the toggle right
                            below it. Dismissed permanently either via the X or
                            by the user discovering the toggle on their own. */}
                        {showMapNudge && (
                            <View style={[styles.mapNudge, { borderColor: colors.accent + '44', backgroundColor: colors.accent + '14' }]}>
                                <Text style={[styles.mapNudgeText, { color: colors.primaryText }]}>
                                    {t('duaWall.mapNudge')}
                                </Text>
                                <TouchableOpacity
                                    onPress={dismissMapNudge}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    accessibilityLabel="Dismiss tip"
                                    accessibilityRole="button"
                                >
                                    <X size={13} color={colors.secondaryText} />
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Opt-in map pin — ABOVE the writing surface so neither
                            the keyboard nor the floating tab bar can cover it
                            (it was originally below and invisible in inline mode).
                            PREMIUM-GATED: tapping it as a free user opens the
                            paywall instead of toggling — same "always tappable,
                            branch inside onPress" pattern used elsewhere in the
                            app (e.g. NightCalculator's reminders gate). Note this
                            is client-enforced only — premium status never syncs
                            to Firestore, same trust model as the free-reply gate. */}
                        <TouchableOpacity
                            onPress={() => {
                                haptic.light();
                                if (!isPremium) {
                                    if (inline) openPaywall('feature_gate:dua_map_pin', 'dua_map_pin');
                                    else setPaywallOverlay({ source: 'feature_gate:dua_map_pin', featureId: 'dua_map_pin' });
                                    return;
                                }
                                setShowOnMap(v => !v);
                                // They found it themselves — stop pointing at it.
                                if (showMapNudge) dismissMapNudge();
                            }}
                            style={[styles.mapOptRow, { borderColor: showOnMap ? colors.accent + '55' : 'rgba(255,255,255,0.08)' }]}
                            activeOpacity={0.7}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: showOnMap, disabled: !isPremium }}
                            accessibilityLabel={isPremium ? t('duaWall.showOnMap') : `${t('duaWall.showOnMap')} — ${t('duaWall.premiumFeature')}`}
                        >
                            {isPremium ? (
                                <View style={[styles.mapOptCheck, {
                                    backgroundColor: showOnMap ? colors.accent : 'transparent',
                                    borderColor: showOnMap ? colors.accent : '#3d4f68',
                                }]}>
                                    {showOnMap && <Check size={11} color="#0a1228" strokeWidth={3.5} />}
                                </View>
                            ) : (
                                <View style={styles.mapOptCheck}>
                                    <Crown size={12} color="#fbbf24" fill="#fbbf24" />
                                </View>
                            )}
                            <Globe size={14} color={showOnMap ? colors.accent : '#64748b'} />
                            <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={[styles.mapOptLabel, { color: showOnMap ? colors.primaryText : '#94a3b8' }]}>
                                        {t('duaWall.showOnMap')}
                                    </Text>
                                    {!isPremium && (
                                        <View style={styles.mapOptPremiumBadge}>
                                            <Text style={styles.mapOptPremiumBadgeText}>{t('duaWall.premiumFeature')}</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.mapOptHint}>
                                    {t('duaWall.showOnMapHint')}
                                </Text>
                            </View>
                        </TouchableOpacity>

                        {/* Writing surface — name field lives inside the SAME
                            bordered card as the dua text, separated by a thin
                            divider, so the whole compose form reads as one
                            surface instead of stacked floating boxes. */}
                        <View style={[styles.writeSurface, { borderColor: colors.accent + '22' }]}>
                            <KnownNameField
                                name={composeName}
                                onChangeName={setComposeName}
                                knownName={composeProfileName}
                                editing={editingComposeName}
                                onStartEditing={() => setEditingComposeName(true)}
                                accent={colors.accent}
                                prefixKey="duaWall.postingAs"
                                placeholder={t('duaWall.namePlaceholder')}
                                maxLength={DuaWall.MAX_NAME_LENGTH}
                                inputStyle={styles.composeNameInput}
                                rowStyle={styles.composeNameRow}
                            />
                            <TouchableOpacity
                                onPress={() => { haptic.light(); setShowComposeCountryPicker(true); }}
                                style={styles.composeCountryRow}
                                activeOpacity={0.7}
                            >
                                {composeCountryCode ? (
                                    <>
                                        <Text style={styles.composeCountryFlag}>{flagEmoji(composeCountryCode)}</Text>
                                        <Text style={[styles.composeCountryText, { color: colors.primaryText, flex: 1 }]}>
                                            {countryName(composeCountryCode)}
                                        </Text>
                                    </>
                                ) : (
                                    <Text style={[styles.composeCountryText, { color: '#64748b', flex: 1 }]}>
                                        {t('duaWall.addCountry')}
                                    </Text>
                                )}
                                <ChevronRight size={14} color="#475569" />
                            </TouchableOpacity>
                            <View style={[styles.writeSurfaceDivider, { backgroundColor: colors.accent + '18' }]} />
                            <TextInput
                                value={composeText}
                                onChangeText={setComposeText}
                                multiline
                                placeholder="Ya Allah…"
                                placeholderTextColor="#3d4f68"
                                style={[styles.composeInput, { color: colors.primaryText }]}
                                maxLength={DuaWall.MAX_LENGTH + 20}
                                autoFocus
                                textAlignVertical="top"
                            />
                        </View>

                        {/* Status row — character count + privacy note.
                            Tapping it (or anywhere outside the TextInput's
                            internal scroll) dismisses the keyboard. */}
                        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                            {/* Inline: clear the floating tab bar, which floats
                                over the bottom of the tab's content area. */}
                            <View style={[styles.composeStatus, inline && { marginBottom: 92 }]}>
                                <View style={styles.composeMeta}>
                                    <View style={[styles.composeDot, { backgroundColor: colors.accent }]} />
                                    <Text
                                        style={[styles.composeMetaText, { color: colors.secondaryText }]}
                                        numberOfLines={1}
                                        ellipsizeMode="tail"
                                    >
                                        {(composeName.trim() || 'Anonymous')} · {isCurrentUserAdmin() ? 'Unlimited' : isPremium ? '3 per day' : '1 per day'}
                                    </Text>
                                </View>
                                <Text style={[styles.composeCount, { color: countColor }]}>
                                    {composeText.length} / {DuaWall.MAX_LENGTH}
                                </Text>
                            </View>
                        </TouchableWithoutFeedback>
                    </KeyboardAvoidingView>
                    </View>
                )}

                {/* ══ Paywall overlay — same plain-View pattern as compose (see
                    note above): a Modal here would silently fail to present.
                    Modal mode only — inline uses the global paywall route. ══ */}
                {!inline && paywallOverlay && (
                    <View style={styles.composeOverlay}>
                        <Paywall
                            onClose={() => setPaywallOverlay(null)}
                            source={paywallOverlay.source}
                            featureId={paywallOverlay.featureId}
                        />
                    </View>
                )}

                {/* ══ Duas History — "Mine" + "Answered" tabs. Same plain-View
                    overlay pattern as compose/paywall (no nested Modal). ══ */}
                {showDuasHistory && (
                    <View style={styles.composeOverlay}>
                        <DuasHistoryScreen
                            onClose={() => setShowDuasHistory(false)}
                            accent={colors.accent}
                            onRequestPaywall={inline ? undefined : () => setPaywallOverlay({ source: 'comment_free_limit', featureId: 'dua_replies' })}
                        />
                    </View>
                )}

                {/* ══ Country picker — nested inside the compose overlay (only
                    reachable from there), same plain-View pattern. ══ */}
                {showCompose && (
                    <CountryPickerOverlay
                        visible={showComposeCountryPicker}
                        onClose={() => setShowComposeCountryPicker(false)}
                        countryCode={composeCountryCode}
                        onSelect={code => { setComposeCountryCode(code); setShowComposeCountryPicker(false); }}
                    />
                )}
            </View>
    );

    if (inline) return content;

    return (
        // onRequestClose (Android back button / iOS sheet swipe-down):
        // close the paywall/compose overlays first, then the wall itself.
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => {
                if (paywallOverlay) setPaywallOverlay(null);
                else if (showComposeCountryPicker) setShowComposeCountryPicker(false);
                else if (showCompose) setShowCompose(false);
                else if (showDuasHistory) setShowDuasHistory(false);
                else onClose();
            }}
            onDismiss={onClose}
        >
            {content}
        </Modal>
    );
}

// ── Dua card with stagger entry + heart spring animation ──
// Memoised so tapping Ameen/Praying on one card doesn't re-render the whole
// list. The comparator ignores callback identity (the parent passes fresh inline
// callbacks each render) and only re-renders when something visible changes.
const DuaCard = React.memo(function DuaCard({
    dua, index, userTapped, userPraying, accent, onAmeen, onPraying, onReport, isSeed, onRequestPaywall, autoExpandReplies,
    isOwn, onDelete, deleting,
}: {
    dua: PublicDua;
    index: number;
    userTapped: boolean;
    userPraying: boolean;
    accent: string;
    onAmeen: () => void;
    onPraying: () => void;
    onReport: () => void;
    isSeed?: boolean;
    onRequestPaywall?: () => void;
    autoExpandReplies?: boolean;
    /** This device published this dua — shows a delete action instead of
     * report (you can't meaningfully report your own post). */
    isOwn?: boolean;
    onDelete?: () => void;
    deleting?: boolean;
}) {
    const heartScale = useSharedValue(1);
    const heartStyle = useAnimatedStyle(() => ({
        transform: [{ scale: heartScale.value }],
    }));

    const tap = () => {
        // Animate the satisfying pop only when adding an Ameen, not when undoing
        if (!userTapped) {
            heartScale.value = withSequence(
                withSpring(1.4, { damping: 6, stiffness: 200 }),
                withSpring(1.0, { damping: 8 }),
            );
        }
        onAmeen(); // toggles (add or undo) — handled in the parent
    };

    return (
        // Plain View, not an Animated.View with an `entering` stagger: entering
        // animations on virtualized FlatList rows can get stuck at opacity:0 on
        // first mount (the cards never appear until a scroll/re-render) — the
        // same bug that hid the Stories list. Render at full opacity instead.
        <View
            style={[styles.card, { borderColor: userTapped ? accent + '33' : 'rgba(255,255,255,0.06)' }]}
        >
            {/* Soft accent line at top */}
            <View style={[styles.cardAccent, { backgroundColor: accent + (userTapped ? '88' : '33') }]} />

            {/* "Universal" badge for curated seed duas — makes it transparent
                that these are starter content, not real community posts. */}
            {isSeed && (
                <View style={[styles.seedBadge, { borderColor: accent + '44' }]}>
                    <Text style={[styles.seedBadgeText, { color: accent }]}>✦ UNIVERSAL DUA</Text>
                </View>
            )}

            {/* Answered — visible to everyone, not just the author. Turns the
                wall into a living record of answered prayers, not only
                requests. */}
            {!isSeed && dua.answered && (
                <View style={styles.answeredCardBadge}>
                    <Sparkles size={11} color="#fbbf24" fill="#fbbf24" />
                    <Text style={styles.answeredCardBadgeText}>{t('duaWall.answered')}</Text>
                </View>
            )}

            <Text style={styles.duaText}>{dua.text}</Text>

            <View style={styles.cardFooter}>
                <View style={styles.footerTop}>
                    <Text style={styles.timeText} numberOfLines={1} ellipsizeMode="tail">
                        {isSeed
                            ? 'A community staple'
                            : `${formatDuaAuthor(dua)} · ${formatDistanceToNowStrict(dua.createdAt)} ago`}
                    </Text>
                    {isOwn ? (
                        <TouchableOpacity
                            onPress={onDelete}
                            disabled={deleting}
                            style={styles.flagBtn}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityLabel={t('btn.delete')}
                            accessibilityRole="button"
                        >
                            {deleting
                                ? <ActivityIndicator size="small" color="#475569" />
                                : <Trash2 size={12} color="#475569" />}
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            onPress={onReport}
                            style={styles.flagBtn}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityLabel="Report dua"
                            accessibilityRole="button"
                        >
                            <Flag size={12} color="#475569" />
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.cardActions}>
                    {/* "Praying for you" — a personal-commitment reaction
                        complementary to Ameen. Ameen affirms the dua;
                        Praying signals "I'll personally pray for this."  */}
                    <TouchableOpacity
                        onPress={onPraying}
                        activeOpacity={0.85}
                        style={[
                            styles.ameenBtn,
                            userPraying
                                ? { backgroundColor: accent + '22', borderColor: accent + '55' }
                                : { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' },
                        ]}
                        accessibilityLabel={userPraying ? 'Already praying for this' : "I'm praying for you"}
                        accessibilityRole="button"
                        accessibilityState={{ selected: userPraying }}
                    >
                        <Sparkles size={13} color={userPraying ? accent : '#94a3b8'} strokeWidth={2} />
                        <Text style={[styles.ameenText, { color: userPraying ? accent : '#94a3b8' }]}>
                            {userPraying ? t('duaWall.praying') : t('duaWall.prayFor')}
                        </Text>
                        {(dua.prayCount ?? 0) > 0 && (
                            <View style={[styles.ameenCount, { backgroundColor: userPraying ? accent + '33' : 'rgba(255,255,255,0.06)' }]}>
                                <Text style={[styles.ameenCountText, { color: userPraying ? accent : '#94a3b8' }]}>
                                    {dua.prayCount}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={tap}
                        activeOpacity={0.85}
                        style={[
                            styles.ameenBtn,
                            userTapped
                                // Red glow once liked — classic "heart filled" affordance.
                                ? { backgroundColor: '#ef444422', borderColor: '#ef444455' }
                                : { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' },
                        ]}
                        accessibilityLabel={userTapped ? "Already said Ameen" : "Say Ameen"}
                        accessibilityRole="button"
                        accessibilityState={{ selected: userTapped }}
                    >
                        <Animated.View style={heartStyle}>
                            <Heart
                                size={13}
                                color={userTapped ? '#ef4444' : '#94a3b8'}
                                fill={userTapped ? '#ef4444' : 'transparent'}
                                strokeWidth={2}
                            />
                        </Animated.View>
                        <Text style={[
                            styles.ameenText,
                            { color: userTapped ? '#ef4444' : '#94a3b8' },
                        ]}>
                            {t('duaWall.ameen')}
                        </Text>
                        {dua.ameenCount > 0 && (
                            <View style={[styles.ameenCount, { backgroundColor: userTapped ? '#ef444433' : 'rgba(255,255,255,0.06)' }]}>
                                <Text style={[styles.ameenCountText, { color: userTapped ? '#ef4444' : '#94a3b8' }]}>
                                    {dua.ameenCount}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Replies — live threads only; seed duas aren't real posts */}
                {!isSeed && (
                    <CommentThread
                        parentType="dua"
                        parentId={dua.id}
                        replyCount={dua.replyCount ?? 0}
                        accent={accent}
                        onRequestPaywall={onRequestPaywall}
                        initialExpanded={autoExpandReplies}
                    />
                )}
            </View>
        </View>
    );
}, (prev, next) =>
    // Skip re-render unless something visible to THIS card changed. Callback
    // identity is intentionally ignored (parent re-creates them each render).
    prev.userTapped === next.userTapped &&
    prev.userPraying === next.userPraying &&
    prev.autoExpandReplies === next.autoExpandReplies &&
    prev.isSeed === next.isSeed &&
    prev.accent === next.accent &&
    prev.dua.id === next.dua.id &&
    prev.dua.ameenCount === next.dua.ameenCount &&
    prev.dua.prayCount === next.dua.prayCount &&
    prev.dua.replyCount === next.dua.replyCount &&
    prev.dua.text === next.dua.text
);

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#040714' },

    // ── Stars ──
    star: { position: 'absolute', backgroundColor: '#fff' },

    // ── Header (single, compact) ──
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 18,
        gap: 12,
    },
    iconBtn: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center', justifyContent: 'center',
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitleRow: {
        flexDirection: 'row', alignItems: 'center', gap: 7,
    },
    headerTitle: {
        fontSize: 19, fontWeight: '800',
        letterSpacing: -0.3,
    },
    headerSub: {
        fontSize: 11, fontWeight: '600',
        marginTop: 3,
    },
    publishBtn: {
        width: 38, height: 38, borderRadius: 19,
        alignItems: 'center', justifyContent: 'center',
        shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
        elevation: 6,
    },

    // ── List ──
    list: { paddingHorizontal: 18, paddingBottom: 80 },
    loadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        marginBottom: 6,
    },
    loadingText: { fontSize: 12, fontWeight: '600' },

    // ── Top Dua of the Day (admin-pinned) ──
    topPickWrap: { marginBottom: 8 },
    topPickBadgeRow: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        marginBottom: 8, marginLeft: 2,
    },
    topPickBadgeText: {
        fontSize: 11, fontWeight: '800', letterSpacing: 0.5,
        color: '#facc15', textTransform: 'uppercase',
    },

    // ── Card ──
    card: {
        backgroundColor: 'rgba(255,255,255,0.025)',
        borderWidth: 1,
        borderRadius: 18,
        paddingHorizontal: 18,
        paddingTop: 18,
        paddingBottom: 14,
        marginBottom: 12,
        overflow: 'hidden',
        position: 'relative',
    },
    cardAccent: {
        position: 'absolute', top: 0, left: 0, right: 0,
        height: 2,
    },
    seedBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8, paddingVertical: 3,
        borderRadius: 8, borderWidth: 1,
        marginBottom: 10,
    },
    seedBadgeText: {
        fontSize: 9, fontWeight: '900', letterSpacing: 1,
    },
    answeredCardBadge: {
        flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 4,
        paddingHorizontal: 8, paddingVertical: 3,
        borderRadius: 8, marginBottom: 10,
        backgroundColor: 'rgba(251,191,36,0.15)',
    },
    answeredCardBadgeText: {
        fontSize: 9, fontWeight: '900', letterSpacing: 0.5, color: '#fbbf24',
    },
    duaText: {
        color: '#e2e8f0',
        fontSize: 15,
        lineHeight: 24,
        fontWeight: '400',
        marginBottom: 14,
    },
    cardFooter: {
        flexDirection: 'column',
        gap: 12,
    },
    footerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    timeText: {
        color: '#475569',
        fontSize: 11,
        fontWeight: '600',
        // A long display name pushed this past the card edge before flex/
        // truncation were added — now it shrinks and ellipsizes instead.
        flex: 1,
        marginRight: 8,
    },
    // Full-width row; the two reaction buttons flex equally so they always
    // fit inside the card and never overflow the edge.
    cardActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    flagBtn: {
        width: 28, height: 28, borderRadius: 14,
        alignItems: 'center', justifyContent: 'center',
    },
    ameenBtn: {
        flex: 1,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        paddingVertical: 9,
        borderRadius: 16, borderWidth: 1,
    },
    ameenText: { fontSize: 12, fontWeight: '700' },
    ameenCount: {
        marginLeft: 2,
        paddingHorizontal: 7, paddingVertical: 2,
        borderRadius: 8, minWidth: 22, alignItems: 'center',
    },
    ameenCountText: { fontSize: 11, fontWeight: '800' },

    // ── Empty state ──
    empty: {
        alignItems: 'center',
        paddingHorizontal: 32,
        paddingTop: 40,
    },
    emptyOrb: {
        width: 80, height: 80, borderRadius: 40,
        borderWidth: 1,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 20,
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    emptyTitle: {
        fontSize: 20, fontWeight: '800',
        marginBottom: 10,
        letterSpacing: -0.3,
    },
    emptyBody: {
        fontSize: 14, lineHeight: 20,
        textAlign: 'center',
        marginBottom: 24,
    },
    emptyCTA: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 18, paddingVertical: 11, borderRadius: 22,
    },
    emptyCTAText: { color: '#0a1228', fontSize: 14, fontWeight: '800' },

    // ── Compose overlay ──
    composeOverlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 10,
        backgroundColor: '#08091e',
    },
    composeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    composeCancel: { fontSize: 14, fontWeight: '600' },
    composeBrandText: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
    composePublishBtn: {
        paddingHorizontal: 16, paddingVertical: 8,
        borderRadius: 16,
    },
    composePublishText: { fontSize: 13, fontWeight: '800' },

    bismillahWrap: {
        alignItems: 'center',
        paddingVertical: 18,
    },
    bismillah: {
        fontSize: 22,
        fontFamily: 'AmiriQuran',
        lineHeight: 40,
        textAlign: 'center',
    },
    bismillahDivider: {
        width: 100, height: 1,
        marginTop: 10,
    },

    writeSurface: {
        flex: 1,
        marginHorizontal: 16,
        marginBottom: 8,
        borderRadius: 18,
        borderWidth: 1,
        backgroundColor: 'rgba(10,14,40,0.55)',
        padding: 4,
    },
    composeInput: {
        flex: 1,
        fontSize: 16, lineHeight: 26,
        padding: 18,
    },

    composeNameInput: {
        fontSize: 13, fontWeight: '600',
        paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10,
    },
    composeNameRow: {
        paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10,
    },
    composeCountryRow: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 14, paddingBottom: 10,
    },
    composeCountryFlag: { fontSize: 14 },
    composeCountryText: { fontSize: 13, fontWeight: '600' },
    writeSurfaceDivider: {
        height: StyleSheet.hairlineWidth, marginHorizontal: 10,
    },
    wallIntroWrap: { paddingHorizontal: 20, marginBottom: 10, alignItems: 'flex-end' },
    wallIntroCard: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 8,
        maxWidth: 240, borderRadius: 12, borderWidth: 1,
        paddingHorizontal: 12, paddingVertical: 9,
    },
    wallIntroText: { flex: 1, fontSize: 11.5, fontWeight: '600', lineHeight: 16 },
    mapNudge: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        marginHorizontal: 20, marginBottom: 8,
        paddingHorizontal: 12, paddingVertical: 9,
        borderRadius: 12, borderWidth: 1,
    },
    mapNudgeText: { flex: 1, fontSize: 11.5, fontWeight: '600', lineHeight: 16 },
    mapOptRow: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        marginHorizontal: 20, marginTop: 12,
        paddingHorizontal: 14, paddingVertical: 11,
        borderRadius: 14, borderWidth: 1,
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    mapOptCheck: {
        width: 20, height: 20, borderRadius: 7, borderWidth: 1.5,
        alignItems: 'center', justifyContent: 'center',
    },
    mapOptLabel: { fontSize: 13, fontWeight: '700' },
    mapOptPremiumBadge: {
        paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5,
        backgroundColor: 'rgba(251,191,36,0.15)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.35)',
    },
    mapOptPremiumBadgeText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5, color: '#fbbf24' },
    mapOptHint: { fontSize: 10.5, color: '#64748b', marginTop: 2, lineHeight: 14 },
    composeStatus: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 22, paddingVertical: 14,
    },
    composeMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 },
    composeDot: { width: 6, height: 6, borderRadius: 3 },
    // A long entered name pushed "0/280" off the card before flexShrink was added.
    composeMetaText: { fontSize: 11, fontWeight: '600', flexShrink: 1 },
    composeCount: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
