/**
 * GlobalTahajjudMap — full-screen modal showing anonymous city-level dots
 * of Muslims praying Tahajjud around the world right now.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
    Modal, View, Text, StyleSheet, TouchableOpacity,
    Platform, Animated,
} from 'react-native';
import MapView, { Circle, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import { GlassBg as BlurView } from './GlassBg';
import { X, Moon, Plus, Minus, Globe } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { subscribeTahajjudMap, MapDot } from '../utils/tahajjudMap';

interface Props {
    visible: boolean;
    onClose: () => void;
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

export function GlobalTahajjudMap({ visible, onClose }: Props) {
    const { colors } = useTheme();
    const [dots, setDots] = useState<MapDot[]>([]);
    const [total, setTotal] = useState(0);
    const [mapReady, setMapReady] = useState(false);
    const [region, setRegion] = useState<Region>({
        latitude: 25, longitude: 20, latitudeDelta: 120, longitudeDelta: 120,
    });
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const mapFade  = useRef(new Animated.Value(0)).current;
    const mapRef   = useRef<MapView>(null);

    const zoom = (direction: 'in' | 'out') => {
        const factor = direction === 'in' ? 0.4 : 2.5;
        const next: Region = {
            ...region,
            latitudeDelta:  Math.min(Math.max(region.latitudeDelta  * factor, 0.5), 150),
            longitudeDelta: Math.min(Math.max(region.longitudeDelta * factor, 0.5), 150),
        };
        setRegion(next);
        mapRef.current?.animateToRegion(next, 300);
    };

    useEffect(() => {
        if (!visible) return;
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();

        setMapReady(false);
        mapFade.setValue(0);
        const unsub = subscribeTahajjudMap((d, t) => { setDots(d); setTotal(t); });
        return () => {
            unsub();
            fadeAnim.stopAnimation();
            mapFade.stopAnimation();
        };
    }, [visible]);

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
                    {dots.map(dot => (
                        <React.Fragment key={dot.id}>
                            {/* Outer glow */}
                            <Circle
                                center={{ latitude: dot.lat, longitude: dot.lng }}
                                radius={180000}
                                fillColor={colors.accent + '15'}
                                strokeColor="transparent"
                            />
                            {/* Inner dot */}
                            <Circle
                                center={{ latitude: dot.lat, longitude: dot.lng }}
                                radius={60000}
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
                        <Text style={styles.loadingText}>Loading map…</Text>
                    </View>
                )}

                {/* Header */}
                <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
                    <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={styles.headerContent}>
                        <View>
                            <View style={styles.liveRow}>
                                <View style={[styles.liveDot, { backgroundColor: total > 0 ? '#22c55e' : '#475569' }]} />
                                <Text style={styles.liveLabel}>{total > 0 ? 'LIVE' : 'QUIET'}</Text>
                            </View>
                            <Text style={[styles.count, { color: colors.accent }]}>
                                {total.toLocaleString()}
                            </Text>
                            <Text style={styles.countSub}>
                                Muslim{total !== 1 ? 's' : ''} praying Tahajjud right now
                            </Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
                            <X size={20} color="#94a3b8" />
                        </TouchableOpacity>
                    </View>
                </Animated.View>

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
                            const world = { latitude: 25, longitude: 20, latitudeDelta: 120, longitudeDelta: 120 };
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
                        City-level only · Anonymous · Last 90 minutes
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
});
