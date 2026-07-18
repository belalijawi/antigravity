/**
 * GlobalTahajjudMap — full-screen modal showing anonymous city-level dots
 * of Muslims who prayed Tahajjud around the world in the last 24 hours.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
    Modal, View, Text, StyleSheet, TouchableOpacity,
    Platform, Animated, Linking,
} from 'react-native';
import MapView, { Circle, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { GlassBg as BlurView } from './GlassBg';
import { X, Moon, Plus, Minus, Globe, MapPin } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { subscribeTahajjudMap, MapDot } from '../utils/tahajjudMap';
import { t } from '../utils/i18n';

interface Props {
    visible: boolean;
    onClose: () => void;
    /** Live headcount from the map's own subscription — lets the Home card
     *  sync to the exact number shown here, so the two never disagree. */
    onLiveTotal?: (total: number) => void;
}

// Dark map style matching the app aesthetic
const DARK_MAP_STYLE = [
    { elementType: 'geometry',       stylers: [{ color: '#0a0f1e' }] },
    { elementType: 'labels',         stylers: [{ visibility: 'off' }] },
    { featureType: 'water',          stylers: [{ color: '#060b18' }] },
    { featureType: 'landscape',      stylers: [{ color: '#0d1428' }] },
    { featureType: 'road',           stylers: [{ visibility: 'off' }] },
    { featureType: 'poi',            stylers: [{ visibility: 'off' }] },
    { featureType: 'administrative', elementType: 'geometry',
      stylers: [{ color: '#1e2d4a', weight: 0.5 }] },
    { featureType: 'administrative.country', elementType: 'geometry.stroke',
      stylers: [{ color: '#1e3a5f', weight: 0.8 }] },
];

// Golden angle (radians) — sunflower-spiral spacing packs any number of
// same-cell dots evenly without two ever landing on the same spot.
const GOLDEN_ANGLE = 2.399963;

/**
 * Coordinates are rounded to ~11km cells for privacy, so everyone in the same
 * city shares one exact point and their dots stack invisibly. Spread each
 * cell's dots in a deterministic spiral instead — offsets stay within the
 * ~0.1° (~11km) the stored coordinates are already blurred to, so this adds
 * no location precision. Sorted by doc id so a dot keeps its spot across
 * snapshot updates instead of dancing.
 */
function spreadStackedDots(dots: MapDot[]): MapDot[] {
    const byCell = new Map<string, MapDot[]>();
    for (const d of dots) {
        const key = `${d.lat},${d.lng}`;
        const cell = byCell.get(key);
        if (cell) cell.push(d); else byCell.set(key, [d]);
    }
    const out: MapDot[] = [];
    for (const cell of byCell.values()) {
        cell.sort((a, b) => (a.id < b.id ? -1 : 1));
        cell.forEach((d, i) => {
            if (i === 0) { out.push(d); return; }
            const r = Math.min(0.032 * Math.sqrt(i), 0.1);
            const a = i * GOLDEN_ANGLE;
            out.push({ ...d, lat: d.lat + r * Math.cos(a), lng: d.lng + r * Math.sin(a) });
        });
    }
    return out;
}

export function GlobalTahajjudMap({ visible, onClose, onLiveTotal }: Props) {
    const { colors } = useTheme();
    const [dots, setDots] = useState<MapDot[]>([]);
    const [total, setTotal] = useState(0);
    const [mapReady, setMapReady] = useState(false);
    const [locationStatus, setLocationStatus] = useState<Location.PermissionStatus | null>(null);
    const [showLocationPrompt, setShowLocationPrompt] = useState(true);
    const [region, setRegion] = useState<Region>({
        latitude: 25, longitude: 20, latitudeDelta: 120, longitudeDelta: 120,
    });
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const mapFade  = useRef(new Animated.Value(0)).current;
    const mapRef   = useRef<MapView>(null);

    const spreadDots = React.useMemo(() => spreadStackedDots(dots), [dots]);
    // Circle radius is in meters, so a fixed size that looks right on the
    // world view swallows whole regions once zoomed in. Scale with the
    // visible region so dots stay a few screen-pixels at every zoom level —
    // that's what lets the spread-out same-city dots actually separate.
    const dotRadius  = Math.max(1500, region.latitudeDelta * 500);
    const glowRadius = dotRadius * 3;

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
        Location.getForegroundPermissionsAsync().then(({ status }) => setLocationStatus(status));
        const unsub = subscribeTahajjudMap((d, t) => { setDots(d); setTotal(t); onLiveTotal?.(t); });
        return () => {
            unsub();
            fadeAnim.stopAnimation();
            mapFade.stopAnimation();
        };
    }, [visible]);

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

                {/* Dark background shown while map tiles load — prevents grey flash */}
                <View style={[StyleSheet.absoluteFill, { backgroundColor: '#060b18' }]} />

                {/* Map fades in once ready */}
                <Animated.View style={[StyleSheet.absoluteFill, { opacity: mapFade }]}>
                <MapView
                    ref={mapRef}
                    style={StyleSheet.absoluteFill}
                    provider={Platform.OS === 'android' ? 'google' : PROVIDER_DEFAULT}
                    customMapStyle={DARK_MAP_STYLE}
                    userInterfaceStyle="dark"
                    initialRegion={region}
                    onRegionChangeComplete={setRegion}
                    scrollEnabled
                    zoomEnabled
                    rotateEnabled={false}
                    pitchEnabled={false}
                    showsCompass={false}
                    showsScale={false}
                    showsUserLocation={false}
                    toolbarEnabled={false}
                    mapType="standard"
                    onMapReady={() => {
                        setMapReady(true);
                        Animated.timing(mapFade, { toValue: 1, duration: 500, useNativeDriver: false }).start();
                    }}
                >
                    {spreadDots.map(dot => (
                        <React.Fragment key={dot.id}>
                            {/* Outer glow */}
                            <Circle
                                center={{ latitude: dot.lat, longitude: dot.lng }}
                                radius={glowRadius}
                                fillColor={colors.accent + '15'}
                                strokeColor="transparent"
                            />
                            {/* Inner dot */}
                            <Circle
                                center={{ latitude: dot.lat, longitude: dot.lng }}
                                radius={dotRadius}
                                fillColor={colors.accent + 'cc'}
                                strokeColor={colors.accent}
                                strokeWidth={1}
                            />
                        </React.Fragment>
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
                                {total.toLocaleString()}
                            </Text>
                            <Text style={styles.countSub}>
                                {t('globalMap.prayedCount', { n: total.toLocaleString() })}
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
