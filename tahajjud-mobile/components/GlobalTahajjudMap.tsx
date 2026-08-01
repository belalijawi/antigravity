/**
 * GlobalTahajjudMap — full-screen modal showing anonymous city-level dots
 * of Muslims who prayed Tahajjud around the world in the last 24 hours.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
    Modal, View, Text, StyleSheet, TouchableOpacity,
    Platform, Animated, Linking, DeviceEventEmitter, Alert, ActivityIndicator,
} from 'react-native';
import MapView, { Circle, Marker, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatDistanceToNowStrict } from 'date-fns';
import { GlassBg as BlurView } from './GlassBg';
import { X, Moon, Plus, Minus, Globe, MapPin, Heart, MessageCircle, Flag, Sparkles, Crown } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { subscribeTahajjudMap, subscribeMapDuas, MapDot, MapDua, MAP_DOT_LIMIT } from '../utils/tahajjudMap';
import { DuaWall } from '../utils/duaWall';
import { haptic } from '../utils/haptic';
import { t } from '../utils/i18n';
import { getBlocked, blockedSnapshot, BLOCKED_CHANGED } from '../utils/blockedUsers';
// Pure dot/pin selection + grid geometry. Lives in its own react-native-free
// module so it can be executed and asserted on directly against real
// production data — this is the logic that decides whether a pin survives a
// zoom, and it has no business being untestable. See utils/mapGeometry.ts.
import {
    spreadStacked, aggregateToGrid, gridSizeForZoom, dotRadiusForZoom,
    getViewportBounds, boundsFilter, sampleEvenly, selectVisibleDuas, glowRadiusForZoom,
    AGGREGATE_ZOOM_THRESHOLD, WORLD_VIEW_DOT_CAP, DUA_PIN_CULL_THRESHOLD,
} from '../utils/mapGeometry';

// Same key DuaWall uses for "duas I've said Ameen to" — an Ameen from the
// map pin card shows as already-tapped on the wall, and vice versa.
const AMEEN_KEY = 'dua_wall_ameened';

interface Props {
    visible: boolean;
    onClose: () => void;
    /** Live headcount from the map's own subscription — lets the Home card
     *  sync to the exact number shown here, so the two never disagree. */
    onLiveTotal?: (total: number) => void;
    /** The Home card's server-side aggregation count. Once the dots query
     *  hits MAP_DOT_LIMIT it truncates, so this becomes the more accurate
     *  headline number. */
    serverTotal?: number;
}

// Dark map style matching the app aesthetic. Land/water/border colors were
// previously all near-identical dark navy shades with every label, road, and
// POI turned off — on a real screen that rendered as an almost solid-black
// rectangle with dots on it, no visible geography at all. Everything is
// shown now, styled to stay legible against the dark background instead of
// stock Google Maps' light-mode colors (which would be invisible here).
// Android renders real terrain imagery now (see mapType="terrain" below), so
// there's no 'landscape' fill override here anymore — a flat color would
// either be invisible under the actual relief tiles or fight with them.
// This only touches water/roads/labels/admin borders on top of that terrain.
const DARK_MAP_STYLE = [
    { elementType: 'labels.text.fill',   stylers: [{ color: '#94a3b8' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#020617' }] },
    { elementType: 'labels.icon',        stylers: [{ visibility: 'off' }] },
    { featureType: 'water',              stylers: [{ color: '#060b18' }] },
    { featureType: 'road',               stylers: [{ color: '#334155' }] },
    { featureType: 'road', elementType: 'labels.text.fill',
      stylers: [{ color: '#94a3b8' }] },
    { featureType: 'poi',                stylers: [{ color: '#1e293b' }] },
    { featureType: 'poi', elementType: 'labels.text.fill',
      stylers: [{ color: '#94a3b8' }] },
    { featureType: 'administrative', elementType: 'geometry',
      stylers: [{ color: '#2d4a73', weight: 0.6 }] },
    { featureType: 'administrative.country', elementType: 'geometry.stroke',
      stylers: [{ color: '#3d5f8f', weight: 1 }] },
];

// Golden angle (radians) — sunflower-spiral spacing packs any number of
// same-cell dots evenly without two ever landing on the same spot.
const GOLDEN_ANGLE = 2.399963;

// Always-on dots, independent of any live prayer log — rendered through the
// exact same pipeline (spreadStacked → viewport culling → Circle overlays)
// as real dots, so they're visually indistinguishable from live activity.
// Not counted in `total`/displayTotal, only in what's actually drawn.
const PERMANENT_DOTS: MapDot[] = [
    { id: 'permanent-gaza', lat: 31.5, lng: 34.47 },      // Gaza, Palestine
    { id: 'permanent-iceland', lat: 64.15, lng: -21.94 }, // Reykjavik, Iceland
];

// What every rendered prayer dot actually needs, whether it represents ONE
// person (zoomed in) or a WHOLE CITY's worth (zoomed out) — see
// aggregateByCity below. Deliberately carries NO per-dot count: every dot
// draws at the same radius (see the uniform-radius note further down).
interface RenderDot { id: string; lat: number; lng: number; }

/**
 * One dua pin. Its own component purely so that the tracksViewChanges
 * lifecycle belongs to the marker itself.
 *
 * react-native-maps only rasterizes a Marker's custom child view while
 * tracksViewChanges is true, then freezes that snapshot. When this lived in
 * the parent as a shared ref, a pin that got unmounted and remounted (culled
 * by a zoom, reordered, or recycled) came back with the parent still
 * believing it had already been painted — so the new native annotation was
 * told "don't track" before it had ever rasterized, and rendered blank.
 * Owning the flag as component state means a fresh mount always repaints.
 */
const DuaPinMarker = React.memo(function DuaPinMarker({
    dua, isOwn, mapReady, repaintKey, onSelect,
}: {
    dua: MapDua;
    isOwn: boolean;
    /** The MapView has finished initialising. The settle timer must not start
     *  before this — see below. */
    mapReady: boolean;
    /** Changes after every completed map gesture, forcing a repaint — see
     *  onRegionChangeComplete in the parent. */
    repaintKey: number;
    onSelect: (d: MapDua) => void;
}) {
    const [tracks, setTracks] = useState(true);
    useEffect(() => {
        // Do not start settling until the map itself is ready. A pin can mount
        // while the MapView is still initialising, and if the timer expires in
        // that window the marker freezes a snapshot of a view that had no real
        // layout yet — a permanently invisible pin. That is the actual reason
        // pins "disappeared" on a cold open: not the data, not culling, but a
        // blank snapshot frozen too early. Observed directly: with tracking
        // pinned on the pin drew fine; the moment it settled after 800ms it
        // vanished on cold start.
        if (!mapReady) { setTracks(true); return; }
        // Repaint on mount and whenever this pin's visible content changes,
        // then SETTLE to false.
        //
        // Settling matters: while tracksViewChanges is true react-native-maps
        // re-rasterizes the marker's child view every single frame, and doing
        // that throughout a pan/zoom is what makes a pin visibly flicker and
        // blink out mid-gesture. A settled marker is a cached snapshot, which
        // the map just reprojects — rock solid while moving.
        //
        // An earlier attempt kept tracking on permanently to stop pins
        // rendering blank after being unmounted and remounted by viewport
        // culling. That traded a blank pin for a flickering one. The blank
        // case is now prevented at the source instead: pins are no longer
        // culled (see selectVisibleDuas), so the marker is never unmounted
        // during a gesture and its settled snapshot simply persists. This
        // state also lives in the marker itself, so if a remount ever does
        // happen it starts as `true` again and repaints.
        setTracks(true);
        // Long enough for the child view to lay out and rasterize across a
        // couple of frames on a slow device; short enough that pins aren't
        // repainting during normal panning.
        const timer = setTimeout(() => setTracks(false), 1200);
        return () => clearTimeout(timer);
    }, [mapReady, repaintKey, isOwn, dua.answered]);

    return (
        <Marker
            coordinate={{ latitude: dua.lat, longitude: dua.lng }}
            onPress={(e) => {
                // Without this, the tap also reaches the MapView's own
                // onPress (which deselects), so a marker tap would select
                // and instantly re-deselect in the same gesture — looking
                // exactly like the pin doesn't respond to taps at all.
                e.stopPropagation();
                haptic.light();
                onSelect(dua);
            }}
            tracksViewChanges={tracks}
            anchor={{ x: 0.5, y: 0.5 }}
        >
            <View style={[styles.duaPinGlow, isOwn && styles.duaPinGlowOwn]}>
                <View style={[styles.duaPin, isOwn && styles.duaPinOwn]}>
                    <Text style={styles.duaPinEmoji}>{dua.answered ? '✨' : '🤲'}</Text>
                </View>
            </View>
        </Marker>
    );
});

export function GlobalTahajjudMap({ visible, onClose, onLiveTotal, serverTotal }: Props) {
    const { colors } = useTheme();
    const navigation = useNavigation<any>();
    // Android crash fix: this component is always mounted by HomeTab (only
    // `visible` toggles), and RN's <Modal visible={false}> on Android just
    // hides its native Dialog while leaving children — including MapView —
    // fully mounted underneath. MapView never actually unmounts, so
    // react-native-maps' own native cleanup never runs; the GoogleMap
    // renderer keeps holding a Surface/TextureView that Android can tear
    // down out from under it, producing exactly the crashes Play Console
    // flagged: ViewGroup.dispatchGetDisplayList and ReactViewGroup.dispatchDraw
    // NPEs (drawing a child whose native resources are already gone) and
    // Maps' own policy_maps_core_dynamite IllegalStateException. Mounting
    // the map content on mountContent (not visible directly) — delayed
    // past the close animation, so the slide-out still shows the map —
    // makes MapView actually unmount and release its native resources
    // every time the map closes, instead of sitting mounted-but-hidden
    // indefinitely for as long as the Home tab stays open.
    const [mountContent, setMountContent] = useState(visible);
    useEffect(() => {
        if (visible) { setMountContent(true); return; }
        const timer = setTimeout(() => setMountContent(false), 400);
        return () => clearTimeout(timer);
    }, [visible]);
    const [dots, setDots] = useState<MapDot[]>([]);
    const [total, setTotal] = useState(0);
    // Wall duas whose authors opted in to a map pin (last 24h).
    const [mapDuas, setMapDuas] = useState<MapDua[]>([]);
    const [selectedDua, setSelectedDua] = useState<MapDua | null>(null);
    // Duas this user already Ameened — shared storage with the wall.
    const [ameened, setAmeened] = useState<Set<string>>(new Set());
    const ameenBusyRef = useRef<Set<string>>(new Set());
    // Ids of duas THIS device pinned to the map — highlighted distinctly.
    const [ownMapDuaIds, setOwnMapDuaIds] = useState<Set<string>>(new Set());
    // Blocked authors' pins never reach the map (App Store 1.2).
    const [blockedAuthors, setBlockedAuthors] = useState<Set<string>>(blockedSnapshot());
    useEffect(() => {
        getBlocked().then(setBlockedAuthors);
        const sub = DeviceEventEmitter.addListener(BLOCKED_CHANGED, () => { getBlocked().then(s => setBlockedAuthors(new Set(s))); });
        return () => sub.remove();
    }, []);
    // (Marker repaint bookkeeping used to live here as a parent-level ref.
    // It now lives inside DuaPinMarker as component state — see that
    // component's comment for why keeping it here made pins render blank
    // after a zoom culled and remounted them.)
    const reportBusyRef = useRef<Set<string>>(new Set());
    const [markingAnswered, setMarkingAnswered] = useState<Set<string>>(new Set());
    // Under the dot cap, the live dots count is the freshest truth. At the
    // cap it's truncated — fall back to the server-side aggregation count.
    const displayTotal = total >= MAP_DOT_LIMIT
        ? Math.max(total, serverTotal ?? 0)
        : total;
    const [mapReady, setMapReady] = useState(false);
    // Bumped after every completed map gesture to re-arm dua-pin repainting —
    // see onRegionChangeComplete below for why that is necessary.
    const [pinRepaint, setPinRepaint] = useState(0);
    const [locationStatus, setLocationStatus] = useState<Location.PermissionStatus | null>(null);
    const [showLocationPrompt, setShowLocationPrompt] = useState(true);
    const [region, setRegion] = useState<Region>({
        latitude: 25, longitude: 20, latitudeDelta: 120, longitudeDelta: 120,
    });
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const mapFade  = useRef(new Animated.Value(0)).current;
    const mapRef   = useRef<MapView>(null);

    // Individual, spread-apart dots — used once zoomed in past
    // AGGREGATE_ZOOM_THRESHOLD (a single metro area, roughly).
    const spreadDots = React.useMemo(() => spreadStacked(dots), [dots]);
    // One point per zoom-scaled grid cell — used everywhere ELSE
    // (country/continent/world views). See aggregateToGrid/gridSizeForZoom
    // for why the grid has to scale with the viewport rather than sit on the
    // fixed ~11km privacy grid: overlays stay bounded by roughly how many
    // dots fit across the screen, and dots stay visually separate at every
    // zoom instead of merging into one blob across a dense region.
    const gridDeg = gridSizeForZoom(region.latitudeDelta);
    const cityAggregates = React.useMemo(
        () => aggregateToGrid(dots, gridDeg), [dots, gridDeg]);
    // Computed once — PERMANENT_DOTS never changes. Kept OUT of the above
    // (and therefore out of the world-view sampling below) on purpose: the
    // whole point of these dots is to always be there, but WORLD_VIEW_DOT_CAP
    // exists purely to bound rendering cost and samples an arbitrary subset —
    // merging them first would leave Gaza/Iceland showing up only when they
    // happened to land on a sampled index, silently breaking "always-on."
    const spreadPermanent = React.useMemo(() => spreadStacked(PERMANENT_DOTS), []);
    const spreadDuas = React.useMemo(
        () => spreadStacked(mapDuas.filter(d => !d.authorId || !blockedAuthors.has(d.authorId))),
        [mapDuas, blockedAuthors]);
    // Single source of truth with the verification script — see
    // dotRadiusForZoom in utils/mapGeometry.ts for why the multiplier is what
    // keeps neighbouring cities distinct.
    const dotRadius  = dotRadiusForZoom(region.latitudeDelta);
    // Was 3x — at real usage density (several dozen people across a cluster
    // of nearby cities, e.g. northern England), that many overlapping
    // translucent glow circles compounded into one solid-looking blob that
    // swallowed individual cities rather than reading as separate dots.
    // Shrinking just the glow (not the solid dot itself, which stays fully
    // visible/tappable-scale) keeps the soft halo look without it being the
    // thing that erases distinguishability in a dense cluster.
    const glowRadius = glowRadiusForZoom(region.latitudeDelta);

    // Viewport culling — up to MAP_DOT_LIMIT (500) dots means up to 1,000
    // native Circle overlays (glow + dot each) mounted at once with no
    // culling; the native map has to reproject every one of those on every
    // pan/zoom frame regardless of whether it's even on screen, which is
    // what made panning feel laggy. Padding the bounding box keeps dots
    // just off-screen from popping in/out abruptly during a drag.
    // Recomputed only on region CHANGES (onRegionChangeComplete, once per
    // gesture-end), not continuously during the gesture itself.
    //
    // Padding is generous (2x the visible delta, not just 0.75x) specifically
    // to reduce how many dots get dropped in one go when ZOOMING IN — that
    // shrinks the viewport a lot in a single step, and a large simultaneous
    // batch of native Circle removals is exactly what triggers a real,
    // confirmed-open upstream react-native-maps crash under the New
    // Architecture's legacy-interop layer (AIRMap.m insertReactSubview —
    // see the nil/bounds guard patched into node_modules via patch-package).
    // That patch is what actually stops the crash; this just makes the
    // dangerous "big batch" scenario far less frequent in the first place.
    const visibleDots: RenderDot[] = React.useMemo(() => {
        // Dots are deliberately NOT viewport-culled, and this is load-bearing
        // for the dua pins rather than a performance oversight.
        //
        // AIRMap tracks its children by index, and these dot Circles render
        // before the pin Markers. Culling by viewport meant the number of dot
        // children changed on every pan and zoom, which shifted the pins'
        // indices and made the native side tear down and rebuild each pin's
        // annotation — coming back blank, because a rebuilt annotation never
        // re-rasterizes its custom child view. Keeping the dot set constant
        // means the pins' indices never move, so their annotations are never
        // rebuilt: no blank pin, and no need to force-remount the pin to
        // recover from one (which is what caused the pin to visibly blink
        // mid-zoom).
        //
        // The cost is bounded and smaller than what culling used to allow: one
        // dot per active city (a few hundred), versus a previous worst case of
        // WORLD_VIEW_DOT_CAP (800) sampled dots at world view. Constant
        // overlays are also cheaper to pan than a set being continuously added
        // to and removed from — that add/remove churn is exactly what the
        // react-native-maps insert crash patch exists to survive.
        const useAggregate = region.latitudeDelta >= AGGREGATE_ZOOM_THRESHOLD;
        const source: RenderDot[] = useAggregate ? cityAggregates : spreadDots;
        // Safety net only, for a future where the pool is genuinely enormous.
        // At real data volumes this never engages, so the rendered count stays
        // stable across zooms.
        return [...sampleEvenly(source, WORLD_VIEW_DOT_CAP), ...spreadPermanent];
    }, [spreadDots, cityAggregates, spreadPermanent, region.latitudeDelta >= AGGREGATE_ZOOM_THRESHOLD]);

    // Dua pins are NOT viewport-culled until there are genuinely enough of
    // them for culling to buy anything.
    //
    // Culling pins was premature: the real number of pins on the map at any
    // moment is currently in the single digits (they're opt-in, and expire
    // off the map after 24h), and every "the pin vanished when I zoomed in"
    // report traced back to this filter dropping the one pin the user was
    // looking at. Below the threshold every pin is simply rendered — a pin
    // that is off-screen costs nothing anyway, because the native map only
    // actually draws an overlay whose coordinate is inside the real
    // viewport. Culling only switches on if the pool ever gets big enough to
    // matter, and even then the pin you have open (selectedDua) and your own
    // pins are taken from the FULL unfiltered set so they can never be
    // dropped by either the bounds filter or the sampling cap.
    //
    // Order is always spreadDuas' own order. Hoisting priority pins to the
    // front reordered the map's native children on every selection/zoom, and
    // reordering children of react-native-maps' AIRMap can tear down and
    // recreate the native annotation — which is its own source of blank
    // pins. Stable order means a pin's position in the children array only
    // ever changes when a pin is genuinely added or removed.
    const visibleDuas = React.useMemo(
        () => selectVisibleDuas(spreadDuas, region, selectedDua?.id ?? null, ownMapDuaIds),
        [spreadDuas, region, selectedDua, ownMapDuaIds]);

    // Every dot pans/zooms as a native overlay the map engine has to
    // reproject on every frame of a drag gesture — that per-frame cost is
    // real native rendering work no amount of JS memoization avoids (see
    // WORLD_VIEW_DOT_CAP's own comment), and it scales with how many overlays
    // exist, not how often React re-renders. Below GLOW_SKIP_THRESHOLD each
    // dot is a solid circle plus a soft glow halo (2 overlays); once the
    // visible set is large enough that overlay count is plausibly what's
    // making a pan/drag feel laggy, the glow — a purely decorative layer,
    // the solid dot underneath is still there and still exactly where it
    // was — is dropped, HALVING native overlay count in exactly the dense
    // scenario where it matters, without touching WORLD_VIEW_DOT_CAP,
    // AGGREGATE_ZOOM_THRESHOLD, or the bounds filter (the three things
    // that directly control WHICH dots are shown, all fragile history here —
    // see their own comments. This only ever removes a decoration, never a
    // dot: nothing that carries information disappears.
    const GLOW_SKIP_THRESHOLD = 150;
    const showGlow = visibleDots.length <= GLOW_SKIP_THRESHOLD;

    // Memoized so unrelated state changes elsewhere in this component (e.g.
    // handlePinAmeen, handleMarkAnswered) don't force React to rebuild fresh
    // Circle element/prop objects for the whole visible set on every render
    // — only when the inputs that actually affect these dots' appearance
    // change.
    // Flat array, NOT one <React.Fragment> per dot wrapping two <Circle>s —
    // under the New Architecture, react-native-maps' AIRMap mounts through
    // the legacy view-manager interop layer, which doesn't reliably flatten
    // Fragment-wrapped children before handing them to the native side. That
    // mismatch between what Fabric's shadow tree expects and what the legacy
    // bridge receives caused a real crash in production:
    // "-[__NSArrayM insertObject:atIndex:]: object cannot be nil" inside
    // AIRMap's insertReactSubview. A flat array of Circle elements (unique
    // string keys instead of one Fragment key per pair) sidesteps it.
    const dotOverlays = React.useMemo(() => visibleDots.flatMap(dot => ([
        ...(showGlow ? [
            <Circle
                key={`${dot.id}-glow`}
                center={{ latitude: dot.lat, longitude: dot.lng }}
                radius={glowRadius}
                fillColor={colors.accent + '15'}
                strokeColor="transparent"
            />,
        ] : []),
        <Circle
            key={`${dot.id}-dot`}
            center={{ latitude: dot.lat, longitude: dot.lng }}
            radius={dotRadius}
            fillColor={colors.accent + 'cc'}
            strokeColor={colors.accent}
            strokeWidth={1}
        />,
    ])), [visibleDots, dotRadius, glowRadius, colors.accent, showGlow]);

    // Latitude only spans -90..90 (180 total) — a latitudeDelta anywhere
    // near/above that is an invalid MKCoordinateRegion and crashes the native
    // map view on iOS, so 170 is as close to a full pole-to-pole view as it's
    // safe to request. Longitude wraps a full 360, so it can go much wider —
    // capping it at the same 170 as latitude was needlessly cropping the
    // Americas out of the "whole globe" view.
    const MAX_LAT_DELTA = 170;
    const MAX_LNG_DELTA = 340;

    const zoom = (direction: 'in' | 'out') => {
        const factor = direction === 'in' ? 0.4 : 2.5;
        const next: Region = {
            ...region,
            latitudeDelta:  Math.min(Math.max(region.latitudeDelta  * factor, 0.5), MAX_LAT_DELTA),
            longitudeDelta: Math.min(Math.max(region.longitudeDelta * factor, 0.5), MAX_LNG_DELTA),
        };
        setRegion(next);
        mapRef.current?.animateToRegion(next, 300);
    };

    useEffect(() => {
        if (!visible) return;
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();

        setMapReady(false);
        mapFade.setValue(0);
        setShowLocationPrompt(true);
        let mounted = true;
        Location.getForegroundPermissionsAsync()
            .then(({ status }) => { if (mounted) setLocationStatus(status); })
            .catch(() => {});
        const unsub = subscribeTahajjudMap((d, t) => {
            setDots(d); setTotal(t);
            // Only sync the Home card while under the dot cap — at the cap the
            // dots query is truncated and t underreports the true total, which
            // the card's server-side count query has right.
            if (t < MAP_DOT_LIMIT) onLiveTotal?.(t);
        });
        const unsubDuas = subscribeMapDuas(list => { if (mounted) setMapDuas(list); });
        AsyncStorage.getItem(AMEEN_KEY)
            .then(raw => { if (mounted && raw) setAmeened(new Set(JSON.parse(raw) as string[])); })
            .catch(() => {});
        DuaWall.getOwnMapDuaIds().then(ids => {
            if (!mounted) return;
            setOwnMapDuaIds(ids);
        });
        setSelectedDua(null);
        return () => {
            mounted = false;
            unsub();
            unsubDuas();
            fadeAnim.stopAnimation();
            mapFade.stopAnimation();
        };
    }, [visible]);

    // Keep the open pin card's counts live. subscribeMapDuas already reflects
    // Ameens/prayers/answered-status from EITHER surface (both the wall and
    // this map read the same public-duas doc field) — but selectedDua was a
    // one-time snapshot taken at tap time, so without this it wouldn't show
    // a like (or an answered mark) that landed from the wall/"My Duas" (or
    // another device) while the card was open. Also closes the card if the
    // dua gets hidden/removed mid-view.
    //
    // Originally only checked ameenCount, which meant an answered-status
    // change alone (no accompanying Ameen) never propagated to the open
    // card — it silently stayed stuck showing "not answered" until some
    // OTHER change (like a fresh Ameen) also touched ameenCount and
    // incidentally dragged the correct `answered` value along with it.
    useEffect(() => {
        if (!selectedDua) return;
        const fresh = mapDuas.find(d => d.id === selectedDua.id);
        if (!fresh) { setSelectedDua(null); return; }
        if (fresh.ameenCount !== selectedDua.ameenCount || fresh.answered !== selectedDua.answered) {
            setSelectedDua(fresh);
        }
    }, [mapDuas]);

    // Patch mapDuas immediately when ANY screen marks a dua answered —
    // don't wait on the Firestore listener round-trip at all. See the
    // matching listener + full reasoning in DuaWall.tsx/utils/duaWall.ts.
    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('duaAnswered', ({ duaId }: { duaId: string }) => {
            setMapDuas(prev => prev.map(d => d.id === duaId ? { ...d, answered: true } : d));
        });
        return () => sub.remove();
    }, []);

    // Same idea for Ameen: if the user taps Ameen on the Dua Wall and then
    // opens this dua's pin, the heart must already be filled. The shared
    // AsyncStorage key is only read when the map opens, so mirror live changes
    // here too — this keeps the two surfaces in agreement in both directions.
    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('duaAmeenChanged',
            ({ duaId, ameened: isAmeened, source }: { duaId: string; ameened: boolean; source?: string }) => {
                // Ignore our own emit — handlePinAmeen has already applied both
                // the set and the count, and re-applying would double-count.
                if (source === 'map') return;
                setAmeened(prev => {
                    if (prev.has(duaId) === isAmeened) return prev; // already agrees
                    const next = new Set(prev);
                    if (isAmeened) next.add(duaId); else next.delete(duaId);
                    return next;
                });
                // Keep the open pin card's count honest as well.
                setSelectedDua(s => s && s.id === duaId
                    ? { ...s, ameenCount: Math.max(0, s.ameenCount + (isAmeened ? 1 : -1)) }
                    : s);
            });
        return () => sub.remove();
    }, []);

    // Latest desired ameen state per dua while a previous toggle for it is
    // still syncing — see handlePinAmeen below.
    const ameenIntentRef = useRef<Map<string, boolean>>(new Map());

    // Ameen straight from the pin card — toggles on/off, same as the wall's
    // handleAmeen (DuaWall.ameen/unameen are both idempotent, guard self-
    // likes, and the ameen side fires the author's milestone notification).
    // Previously this only ever called `ameen` and disabled re-tapping once
    // set, so there was no way to undo an Ameen from the map — the wall
    // already supported this, the pin card just never wired up the other
    // half.
    //
    // A tap while a PREVIOUS toggle for the same dua is still awaiting its
    // network round-trip used to just be silently dropped (early return,
    // before any state changed at all) — rapid like → unlike → like felt
    // like random taps were doing nothing, effectively needing an extra tap
    // to "catch up." Now every tap updates the optimistic UI immediately
    // regardless, and only the ACTUAL NETWORK CALL waits its turn — once the
    // in-flight one resolves, it checks whether a newer tap arrived meanwhile
    // and converges to THAT instead of stopping, so the server always ends
    // up matching whatever the user's last tap actually was.
    const handlePinAmeen = async (dua: MapDua) => {
        haptic.light();
        const wasAmeened = ameened.has(dua.id);
        const desired = !wasAmeened;
        // Optimistic: local set + count bump/undo; shared key keeps the wall in sync.
        const next = new Set(ameened);
        if (wasAmeened) next.delete(dua.id); else next.add(dua.id);
        setAmeened(next);
        setSelectedDua(s => s && s.id === dua.id
            ? { ...s, ameenCount: s.ameenCount + (wasAmeened ? -1 : 1) } : s);
        AsyncStorage.setItem(AMEEN_KEY, JSON.stringify([...next])).catch(() => {});
        // Tell the Dua Wall (which may already be mounted, and only re-reads
        // the shared AsyncStorage key when it remounts) so the same dua shows
        // as Ameened there immediately — see its listener for the full note.
        DeviceEventEmitter.emit('duaAmeenChanged', { duaId: dua.id, ameened: desired, source: 'map' });

        if (ameenBusyRef.current.has(dua.id)) {
            ameenIntentRef.current.set(dua.id, desired);
            return;
        }
        ameenBusyRef.current.add(dua.id);
        try {
            let target = desired;
            for (;;) {
                if (target) await DuaWall.ameen(dua.id); else await DuaWall.unameen(dua.id);
                const pending = ameenIntentRef.current.get(dua.id);
                ameenIntentRef.current.delete(dua.id);
                if (pending === undefined || pending === target) break;
                target = pending;
            }
        } finally {
            ameenBusyRef.current.delete(dua.id);
        }
    };

    // "Open on the Wall" — leave the map, switch to the Duas tab, and let the
    // wall segment scroll to this dua with its thread expanded (the same
    // duas:openWall path reply notifications use). requestOpenWall queues
    // the request until the tab's listener is actually registered instead of
    // guessing a fixed mount-grace delay (previously always 350ms, even on
    // the common case where the Duas tab was already mounted).
    // Report a pin without leaving the map — same confirm flow and threshold
    // as the wall's own report action (DuaWall.report is shared, so a report
    // from either surface counts toward the same 5-report auto-hide).
    const handlePinReport = (dua: MapDua) => {
        if (reportBusyRef.current.has(dua.id)) return;
        Alert.alert(
            'Report this dua?',
            "Thank you for keeping the map safe. We'll review this submission within 24 hours.",
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Report',
                    style: 'destructive',
                    onPress: async () => {
                        reportBusyRef.current.add(dua.id);
                        try {
                            await DuaWall.report(dua.id);
                            haptic.success();
                            setSelectedDua(null);
                            Alert.alert('Reported', 'JazakAllah Khair.');
                        } finally {
                            reportBusyRef.current.delete(dua.id);
                        }
                    },
                },
            ],
        );
    };

    const handleOpenOnWall = (dua: MapDua) => {
        haptic.light();
        onClose();
        navigation.navigate('Duas');
        require('./DuasTab').requestOpenWall({ focusDuaId: dua.id });
    };

    // Mark answered right from the pin — same DuaWall.markAnswered used by
    // "My Duas" on the wall. The live mapDuas listener (and the sync effect
    // above) will reflect the change; we also patch selectedDua immediately
    // so the badge/emoji update without waiting on a round trip.
    const handleMarkAnswered = async (dua: MapDua) => {
        if (markingAnswered.has(dua.id)) return;
        haptic.success();
        setMarkingAnswered(prev => new Set(prev).add(dua.id));
        const ok = await DuaWall.markAnswered(dua.id);
        if (ok) {
            setSelectedDua(s => s && s.id === dua.id ? { ...s, answered: true } : s);
        }
        setMarkingAnswered(prev => {
            const next = new Set(prev);
            next.delete(dua.id);
            return next;
        });
    };

    // "undetermined" → the OS prompt has never been shown, so requesting it
    // now will surface it. Once a user has said no, iOS/Android won't show
    // that dialog again — the only way back in is the system Settings app.
    const handleEnableLocation = async () => {
        if (locationStatus === 'undetermined') {
            const { status } = await Location.requestForegroundPermissionsAsync();
            setLocationStatus(status);
            if (status === 'granted') setShowLocationPrompt(false);
        } else {
            Linking.openSettings();
        }
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
            <View style={styles.root}>
                {mountContent && <>

                {/* Dark background shown while map tiles load — prevents grey flash */}
                <View style={[StyleSheet.absoluteFill, { backgroundColor: '#060b18' }]} />

                {/* Map fades in once ready */}
                <Animated.View style={[StyleSheet.absoluteFill, { opacity: mapFade }]}>
                <MapView
                    ref={mapRef}
                    style={StyleSheet.absoluteFill}
                    provider={Platform.OS === 'android' ? 'google' : PROVIDER_DEFAULT}
                    // customMapStyle only has any effect on Google Maps — it's
                    // silently ignored on iOS's Apple Maps (PROVIDER_DEFAULT),
                    // which is why the two platforms looked so different: iOS
                    // was showing Apple's own real terrain colouring the whole
                    // time, Android was painting every landmass one flat navy
                    // colour. "terrain" mapType renders Android's actual
                    // elevation/land-cover imagery (green vegetation, tan
                    // desert, etc.) instead, matching the iOS look much more
                    // closely; DARK_MAP_STYLE now only touches roads/labels/
                    // water/admin borders, since flat feature colours don't
                    // paint over real terrain relief anyway.
                    mapType={Platform.OS === 'android' ? 'terrain' : 'standard'}
                    customMapStyle={DARK_MAP_STYLE}
                    userInterfaceStyle="dark"
                    initialRegion={region}
                    onRegionChangeComplete={r => {
                        setRegion(r);
                        // Force every dua pin to repaint once the gesture has
                        // settled. A zoom changes how many dot Circles are
                        // rendered, and AIRMap tracks its children by index —
                        // so that reindexing hands each Marker a fresh native
                        // annotation. If the marker has already settled
                        // tracksViewChanges to false by then, the new
                        // annotation is never rasterized and the pin renders
                        // blank: exactly the "pin disappears when I zoom in
                        // and out" report. Bumping this re-arms tracking for a
                        // moment AFTER the gesture ends (never during it, so
                        // no mid-zoom flicker), which repaints the pin and
                        // then settles again.
                        setPinRepaint(n => n + 1);
                    }}
                    onPress={() => setSelectedDua(null)}
                    scrollEnabled
                    zoomEnabled
                    rotateEnabled={false}
                    pitchEnabled={false}
                    showsCompass={false}
                    showsScale={false}
                    showsUserLocation={false}
                    toolbarEnabled={false}
                    onMapReady={() => {
                        setMapReady(true);
                        Animated.timing(mapFade, { toValue: 1, duration: 500, useNativeDriver: false }).start();
                    }}
                >
                    {dotOverlays}

                    {/* Dua pins render AFTER the dot overlays. This ordering is
                        load-bearing and must not be "optimised": moving the
                        markers before the Circles made every pin render
                        completely blank (data confirmed present — raw=1,
                        vis=1, map ready — yet nothing drawn). react-native-maps
                        under the New Architecture's legacy-interop layer does
                        not reliably attach a Marker's custom child view when
                        the marker is inserted ahead of the overlay children. */}
                    {visibleDuas.map(dua => (
                        <DuaPinMarker
                            // Keyed on the dot count, which now changes RARELY.
                            //
                            // AIRMap tracks children by index and the dot
                            // Circles precede these markers, so any change in
                            // the number of dots rebuilds each pin's native
                            // annotation — and a rebuilt annotation never
                            // re-rasterizes its custom child view, leaving the
                            // pin blank. Re-arming tracksViewChanges does not
                            // recover it; only a fresh mount does. Hence the
                            // key.
                            //
                            // What makes this safe now is that visibleDots no
                            // longer changes with the viewport (see its
                            // comment): the count is constant across pans and
                            // zooms, so this key does NOT change during a
                            // gesture. That was the flaw in the earlier
                            // version — back then the count moved on every
                            // zoom, so the pin remounted constantly and you
                            // saw it blink out for a split second each time.
                            // It now only changes when the dot data first
                            // loads (0 → N, which is precisely the reindex
                            // that blanks the pin on a cold open) or on a rare
                            // aggregate-threshold crossing.
                            key={`dua-${dua.id}-${visibleDots.length}`}
                            dua={dua}
                            isOwn={ownMapDuaIds.has(dua.id)}
                            mapReady={mapReady}
                            repaintKey={pinRepaint}
                            onSelect={setSelectedDua}
                        />
                    ))}
                </MapView>
                </Animated.View>

                {/* Loading indicator while map tiles load */}
                {!mapReady && (
                    <View style={styles.loadingOverlay}>
                        <Moon size={32} color="#1e3a5f" />
                        <Text style={styles.loadingText}>{t('globalMap.loadingMap')}</Text>
                    </View>
                )}

                {/* Header */}
                <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
                    <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={styles.headerContent}>
                        <View>
                            <View style={styles.liveRow}>
                                <View style={[styles.liveDot, { backgroundColor: total > 0 ? '#22c55e' : '#475569' }]} />
                                <Text style={styles.liveLabel}>{total > 0 ? t('globalMap.live') : t('globalMap.quiet')}</Text>
                            </View>
                            <Text style={[styles.count, { color: colors.accent }]}>
                                {displayTotal.toLocaleString()}
                            </Text>
                            <Text style={styles.countSub}>
                                {t('globalMap.prayedCount', { n: displayTotal.toLocaleString() })}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
                            <X size={20} color="#94a3b8" />
                        </TouchableOpacity>
                    </View>
                </Animated.View>

                {/* Location permission prompt — only for users who haven't granted it */}
                {mapReady && showLocationPrompt && locationStatus && locationStatus !== 'granted' && (
                    <Animated.View style={[styles.locationPrompt, { opacity: fadeAnim }]}>
                        <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
                        <View style={styles.locationPromptRow}>
                            <MapPin size={18} color={colors.accent} />
                            <View style={styles.locationPromptText}>
                                <Text style={styles.locationPromptTitle}>{t('globalMap.locationPrompt.title')}</Text>
                                <Text style={styles.locationPromptBody}>{t('globalMap.locationPrompt.body')}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowLocationPrompt(false)} hitSlop={10}>
                                <X size={16} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            style={[styles.locationPromptBtn, { backgroundColor: colors.accent }]}
                            onPress={handleEnableLocation}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.locationPromptBtnText}>{t('globalMap.locationPrompt.enable')}</Text>
                        </TouchableOpacity>
                    </Animated.View>
                )}

                {/* Zoom controls */}
                {mapReady && (
                    <Animated.View style={[styles.zoomControls, { opacity: fadeAnim }]}>
                        <TouchableOpacity style={styles.zoomBtn} onPress={() => zoom('in')} activeOpacity={0.8}>
                            <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
                            <Plus size={18} color="#f1f5f9" />
                        </TouchableOpacity>
                        <View style={styles.zoomDivider} />
                        <TouchableOpacity style={styles.zoomBtn} onPress={() => zoom('out')} activeOpacity={0.8}>
                            <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
                            <Minus size={18} color="#f1f5f9" />
                        </TouchableOpacity>
                        <View style={styles.zoomDivider} />
                        <TouchableOpacity style={styles.zoomBtn} onPress={() => {
                            // Widest safe region in one tap, rather than relying on
                            // repeated zoom-out presses — centered on the prime
                            // meridian (not the app's usual lng 20) so the wide
                            // span is balanced across all continents, not just
                            // cropping extra off the Americas' side.
                            const world: Region = {
                                latitude: 15, longitude: 0,
                                latitudeDelta: MAX_LAT_DELTA, longitudeDelta: MAX_LNG_DELTA,
                            };
                            setRegion(world);
                            mapRef.current?.animateToRegion(world, 400);
                        }} activeOpacity={0.8}>
                            <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
                            <Globe size={15} color="#f1f5f9" />
                        </TouchableOpacity>
                    </Animated.View>
                )}

                {/* Footer */}
                <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
                    <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                    <Moon size={12} color="#475569" />
                    <Text style={styles.footerText}>
                        {t('globalMap.footer')}
                    </Text>
                </Animated.View>

                {/* ── Dua pin card — plain overlay View (this is a Modal; a
                    nested Modal would silently fail — see DuaWall). ── */}
                {selectedDua && (
                    // pointerEvents="box-none" — everywhere outside the card
                    // itself must let touches fall through to the map below,
                    // or panning/zooming stops working the moment a pin is
                    // selected. Tapping the map background (not a marker)
                    // dismisses the card via MapView's own onPress above,
                    // instead of an invisible full-screen touch-catcher that
                    // would otherwise block the map's native pan/pinch
                    // gestures for as long as the card is open.
                    <View style={styles.duaCardWrap} pointerEvents="box-none">
                        <View style={[styles.duaCard, { borderColor: colors.accent + '33' }]}>
                            <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
                            <View style={styles.duaCardHeader}>
                                <View style={{ flex: 1 }}>
                                    <View style={styles.duaCardTitleRow}>
                                        <Text style={[styles.duaCardTitle, { color: colors.accent }]} numberOfLines={1}>
                                            {selectedDua.answered ? '✨' : '🤲'} {selectedDua.displayName || 'Anonymous'}
                                        </Text>
                                        {/* Quiet supporter mark, same as CommentThread's */}
                                        {selectedDua.authorPremium && (
                                            <Crown size={10} color="#fbbf24" fill="#fbbf24" strokeWidth={2} accessibilityLabel="Premium supporter" />
                                        )}
                                        {ownMapDuaIds.has(selectedDua.id) && (
                                            <View style={styles.ownBadge}>
                                                <Text style={styles.ownBadgeText}>{t('globalMap.yourDua')}</Text>
                                            </View>
                                        )}
                                        {selectedDua.answered && (
                                            <View style={styles.answeredPinBadge}>
                                                <Text style={styles.answeredPinBadgeText}>{t('duaWall.answered')}</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={styles.duaCardSubtitle}>
                                        {t('globalMap.duaTitle')}
                                    </Text>
                                </View>
                                <Text style={styles.duaCardTime}>
                                    {formatDistanceToNowStrict(selectedDua.createdAt)} ago
                                </Text>
                                <TouchableOpacity
                                    onPress={() => handlePinReport(selectedDua)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    accessibilityLabel="Report dua"
                                    accessibilityRole="button"
                                    style={{ marginLeft: 4 }}
                                >
                                    <Flag size={14} color="#475569" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setSelectedDua(null)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    accessibilityLabel="Close"
                                    accessibilityRole="button"
                                    style={{ marginLeft: 4 }}
                                >
                                    <X size={16} color="#64748b" />
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.duaCardText} numberOfLines={6}>
                                {selectedDua.text}
                            </Text>
                            <View style={styles.duaCardActions}>
                                <TouchableOpacity
                                    onPress={() => handlePinAmeen(selectedDua)}
                                    style={[styles.duaCardBtn, {
                                        // Same red-vs-gray convention as the Wall's own Ameen
                                        // button (DuaWall.tsx) — this one used the theme accent
                                        // color for BOTH states, just tinted differently, which
                                        // read as barely-distinguishable rather than a clear
                                        // liked/not-liked state.
                                        backgroundColor: ameened.has(selectedDua.id) ? '#ef444422' : 'rgba(255,255,255,0.08)',
                                        borderWidth: ameened.has(selectedDua.id) ? 1 : 0,
                                        borderColor: '#ef444455',
                                    }]}
                                    accessibilityRole="button"
                                    accessibilityLabel={t('duaWall.ameen')}
                                >
                                    <Heart
                                        size={14}
                                        color={ameened.has(selectedDua.id) ? '#ef4444' : '#94a3b8'}
                                        fill={ameened.has(selectedDua.id) ? '#ef4444' : 'transparent'}
                                    />
                                    <Text style={[styles.duaCardBtnText, {
                                        color: ameened.has(selectedDua.id) ? '#ef4444' : '#94a3b8',
                                    }]}>
                                        {t('duaWall.ameen')} · {selectedDua.ameenCount}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => handleOpenOnWall(selectedDua)}
                                    style={[styles.duaCardBtn, styles.duaCardBtnGhost, { borderColor: colors.accent + '44' }]}
                                    accessibilityRole="button"
                                    accessibilityLabel={t('globalMap.openOnWall')}
                                >
                                    <MessageCircle size={14} color={colors.accent} />
                                    <Text style={[styles.duaCardBtnText, { color: colors.accent }]}>
                                        {t('globalMap.openOnWall')}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            {/* Mark Answered — own, not-yet-answered pins only.
                                Same DuaWall.markAnswered used by "My Duas". */}
                            {ownMapDuaIds.has(selectedDua.id) && !selectedDua.answered && (
                                <TouchableOpacity
                                    onPress={() => handleMarkAnswered(selectedDua)}
                                    disabled={markingAnswered.has(selectedDua.id)}
                                    style={styles.markAnsweredPinBtn}
                                    accessibilityRole="button"
                                    accessibilityLabel={t('duaWall.markAnswered')}
                                >
                                    {markingAnswered.has(selectedDua.id)
                                        ? <ActivityIndicator size="small" color="#fbbf24" />
                                        : <>
                                            <Sparkles size={13} color="#fbbf24" />
                                            <Text style={styles.markAnsweredPinText}>{t('duaWall.markAnswered')}</Text>
                                        </>}
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                )}

                </>}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#060b18' },
    header: {
        position: 'absolute', top: 0, left: 0, right: 0,
        overflow: 'hidden',
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
        paddingTop: Platform.OS === 'ios' ? 56 : 16,
        paddingBottom: 16,
    },
    headerContent: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
        paddingHorizontal: 20,
    },
    liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    liveDot: { width: 7, height: 7, borderRadius: 4 },
    liveLabel: { color: '#64748b', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
    count: { fontSize: 42, fontWeight: '900', letterSpacing: -1, lineHeight: 46 },
    countSub: { color: '#64748b', fontSize: 13, fontWeight: '500', marginTop: 2 },
    closeBtn: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center', justifyContent: 'center',
        marginTop: 4,
    },
    footer: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        paddingBottom: Platform.OS === 'ios' ? 36 : 16,
        paddingTop: 12,
        overflow: 'hidden',
        borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
    },
    footerText: { color: '#334155', fontSize: 11, fontWeight: '600' },
    // ── Dua pins + tap card ──
    duaPinGlow: {
        width: 34, height: 34, borderRadius: 17,
        backgroundColor: 'rgba(251,191,36,0.18)',
        alignItems: 'center', justifyContent: 'center',
    },
    duaPin: {
        width: 24, height: 24, borderRadius: 12,
        backgroundColor: '#0f172a',
        borderWidth: 1.5, borderColor: '#fbbf24',
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#fbbf24', shadowOpacity: 0.6, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
        elevation: 4,
    },
    duaPinEmoji: { fontSize: 12 },
    // "This is your dua" — a bright white ring instead of gold. Fixed (not
    // theme-accent-tied) so it reads as a distinct highlight against every
    // user's regular gold pins, regardless of their chosen accent color.
    duaPinGlowOwn: { backgroundColor: 'rgba(255,255,255,0.22)' },
    duaPinOwn: { borderColor: '#ffffff', shadowColor: '#ffffff' },
    duaCardWrap: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-end',
        paddingHorizontal: 16,
        paddingBottom: 96, // clears the footer
    },
    duaCard: {
        borderRadius: 20, borderWidth: 1, overflow: 'hidden',
        padding: 16, backgroundColor: 'rgba(8,12,28,0.88)',
    },
    duaCardHeader: {
        flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10,
    },
    duaCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    duaCardTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 0.2, flexShrink: 1 },
    duaCardSubtitle: { fontSize: 10, color: '#64748b', fontWeight: '600', marginTop: 1 },
    ownBadge: {
        paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
        backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    },
    ownBadgeText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.6, color: '#f8fafc' },
    answeredPinBadge: {
        paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
        backgroundColor: 'rgba(251,191,36,0.15)',
    },
    answeredPinBadgeText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.6, color: '#fbbf24' },
    markAnsweredPinBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        marginTop: 10, paddingVertical: 10, borderRadius: 12,
        borderWidth: 1, borderColor: 'rgba(251,191,36,0.4)',
        backgroundColor: 'rgba(251,191,36,0.1)',
    },
    markAnsweredPinText: { fontSize: 12.5, fontWeight: '800', color: '#fbbf24' },
    duaCardTime: { fontSize: 10, color: '#64748b', fontWeight: '600' },
    duaCardText: { color: '#e2e8f0', fontSize: 14, lineHeight: 21, marginBottom: 14 },
    duaCardActions: { flexDirection: 'row', gap: 10 },
    duaCardBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, flex: 1, paddingVertical: 10, borderRadius: 12,
    },
    duaCardBtnGhost: { backgroundColor: 'transparent', borderWidth: 1 },
    duaCardBtnText: { fontSize: 12.5, fontWeight: '800' },
    zoomControls: {
        position: 'absolute',
        right: 16,
        bottom: 90,
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    zoomBtn: {
        width: 44, height: 44,
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
    },
    zoomDivider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.10)',
        marginHorizontal: 8,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center', justifyContent: 'center', gap: 12,
        backgroundColor: '#060b18',
    },
    loadingText: { color: '#1e3a5f', fontSize: 14, fontWeight: '600' },
    locationPrompt: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 170 : 130,
        left: 16, right: 16,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.10)',
        padding: 14,
    },
    locationPromptRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    locationPromptText: { flex: 1 },
    locationPromptTitle: { color: '#f1f5f9', fontSize: 13, fontWeight: '700' },
    locationPromptBody: { color: '#94a3b8', fontSize: 12, fontWeight: '500', marginTop: 2, lineHeight: 16 },
    locationPromptBtn: {
        marginTop: 12,
        borderRadius: 10,
        paddingVertical: 10,
        alignItems: 'center',
    },
    locationPromptBtnText: { color: '#0a0f1e', fontSize: 13, fontWeight: '800' },
});
