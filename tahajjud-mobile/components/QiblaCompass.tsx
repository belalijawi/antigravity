import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Platform, Animated, ActivityIndicator, Linking } from 'react-native';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassBg as BlurView } from './GlassBg';
import { Smartphone } from 'lucide-react-native';
import { calculateQibla, getCompassDirection } from '../utils/qiblaCalculator';
import { useTheme } from '../context/ThemeContext';
import { haptic } from '../utils/haptic';
import { t } from '../utils/i18n';

export function QiblaCompass() {
    const { colors } = useTheme();
    const [qiblaDirection, setQiblaDirection] = useState<number | null>(null);
    const [distance, setDistance] = useState<number | null>(null);
    const [magnetometerHeading, setMagnetometerHeading] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [locationDenied, setLocationDenied] = useState(false);
    const [cityName, setCityName] = useState<string | null>(null);
    const [isLocked, setIsLocked] = useState(false);
    const [guidance, setGuidance] = useState(t('qibla.pointForward'));
    const [coords, setCoords] = useState<{ lat: number, lon: number } | null>(null);
    const rotationAnim = useRef(new Animated.Value(0)).current;
    const roseAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const offTargetCountRef = useRef(0);
    const lastHeadingRef = useRef<number | null>(null);
    const lastTargetRotationRef = useRef<number>(0);
    const lastRoseRotationRef = useRef<number>(0);
    const headingSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
    const [accuracy, setAccuracy] = useState<number | null>(null);
    // Compass-health guard: some Android phones have a weak/absent magnetometer,
    // in which case watchHeadingAsync never fires and the needle silently points
    // the wrong way. If no heading update arrives within a few seconds, surface
    // an honest warning instead of a confidently-wrong arrow.
    const [compassUnavailable, setCompassUnavailable] = useState(false);
    const headingReceivedRef = useRef(false);
    const compassCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Local magnetic declination (degrees, +E/−W) at the user's location.
    // On Android we add this to the raw magnetic heading ourselves to get TRUE
    // north — the Qibla bearing is true-north, and Android's built-in
    // trueHeading sometimes omits this correction, pointing users off by the
    // local declination (can be 15–20° in parts of the US/Africa).
    const declinationRef = useRef(0);

    useEffect(() => {
        setupQibla();

        return () => {
            if (headingSubscriptionRef.current) {
                headingSubscriptionRef.current.remove();
            }
            if (compassCheckTimerRef.current) {
                clearTimeout(compassCheckTimerRef.current);
            }
        };
    }, []);

    // Animate rotation for both rose and needle
    useEffect(() => {
        if (qiblaDirection !== null) {
            // Needle target (relative to phone)
            const needleTarget = qiblaDirection - magnetometerHeading;
            let needleDiff = ((needleTarget - lastTargetRotationRef.current + 180) % 360 + 360) % 360 - 180;
            let finalNeedleTarget = lastTargetRotationRef.current + needleDiff;
            lastTargetRotationRef.current = finalNeedleTarget;

            Animated.spring(rotationAnim, {
                toValue: finalNeedleTarget,
                useNativeDriver: true,
                tension: 50,
                friction: 8,
            }).start();

            // Rose target (relative to phone) — accumulate via shortest-path
            // delta so crossing the 0/360° boundary doesn't trigger a full
            // backflip (the "quick 360" bug).
            const roseTarget = -magnetometerHeading;
            const roseDiff = ((roseTarget - lastRoseRotationRef.current + 180) % 360 + 360) % 360 - 180;
            const finalRoseTarget = lastRoseRotationRef.current + roseDiff;
            lastRoseRotationRef.current = finalRoseTarget;
            Animated.spring(roseAnim, {
                toValue: finalRoseTarget,
                useNativeDriver: true,
                tension: 50,
                friction: 8,
            }).start();

            // Lock Logic
            const diff = ((needleTarget + 180) % 360 + 360) % 360 - 180;
            const absDiff = Math.abs(diff);
            // Hysteresis: lock at ≤ 5° (tight aim), unlock at > 8° (slightly
            // looser so the label doesn't flicker if the phone wobbles by 1°
            // while the user is holding it on target).
            const isAligned = absDiff <= 5;
            const stillLocked = absDiff <= 8;

            const showOffTargetGuidance = () => {
                if (diff > 0) {
                    setGuidance(absDiff > 25 ? t('qibla.rotateRight') : t('qibla.slightlyRight'));
                } else {
                    setGuidance(absDiff > 25 ? t('qibla.rotateLeft') : t('qibla.slightlyLeft'));
                }
            };

            if (isLocked) {
                if (stillLocked) {
                    setGuidance(t('qibla.facingKaaba'));
                } else {
                    // User moved away while locked — unlock immediately and
                    // start guiding them back. No grace period: the previous
                    // implementation kept saying "Facing Kaaba" indefinitely.
                    setIsLocked(false);
                    offTargetCountRef.current = 0;
                    if (lockTimerRef.current) {
                        clearTimeout(lockTimerRef.current);
                        lockTimerRef.current = null;
                    }
                    showOffTargetGuidance();
                }
            } else if (isAligned) {
                offTargetCountRef.current = 0; // Reset jitter counter
                setGuidance(t('qibla.holdSteady'));
                if (!lockTimerRef.current) {
                    haptic.light();
                    lockTimerRef.current = setTimeout(() => {
                        setIsLocked(true);
                        haptic.success();
                        Animated.sequence([
                            Animated.timing(pulseAnim, { toValue: 1.5, duration: 200, useNativeDriver: true }),
                            Animated.spring(pulseAnim, { toValue: 1, friction: 4, useNativeDriver: true })
                        ]).start();
                    }, 2000);
                }
            } else {
                // Not aligned, but check if it's just a momentary jitter
                // before we abandon the "Hold Steady" countdown.
                offTargetCountRef.current += 1;
                if (offTargetCountRef.current > 5) { // ~500ms grace period
                    if (lockTimerRef.current) {
                        clearTimeout(lockTimerRef.current);
                        lockTimerRef.current = null;
                    }
                    showOffTargetGuidance();
                }
            }
        }
    }, [magnetometerHeading, qiblaDirection, isLocked]);

    const setupQibla = async () => {
        try {
            setLoading(true);
            setError(null);
            setLocationDenied(false);

            // Request location permission
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setLocationDenied(true);
                setLoading(false);
                return;
            }

            // ── Fast-path: use the OS's last-known position if available ──
            // The Qibla bearing only changes by ~1° per 100 km, so we don't
            // need a fresh GPS fix — a stale-by-a-few-minutes position is
            // perfectly fine. This usually returns in <100ms and lets us
            // unblock the UI immediately.
            let coords: { latitude: number; longitude: number } | null = null;
            try {
                const last = await Location.getLastKnownPositionAsync({
                    maxAge: 10 * 60 * 1000,        // accept up to 10 min old
                    requiredAccuracy: 5000,         // 5 km is more than enough for Qibla
                });
                if (last) coords = last.coords;
            } catch { /* ignore — fall through to fresh fix */ }

            // ── Fallback: get a fresh position at Balanced accuracy ──
            // Balanced = WiFi / cell-tower based (~10–100m). Way faster than
            // High (which forces a GPS satellite fix and can take 10–30s
            // indoors on a cold start). 100m accuracy is irrelevant for Qibla.
            // getCurrentPositionAsync itself has no built-in timeout though —
            // on a weak/absent fix it can hang indefinitely, leaving "Finding
            // Qibla..." spinning forever. Race it against a hard cap instead.
            if (!coords) {
                const location = await Promise.race([
                    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
                    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('location-timeout')), 6000)),
                ]);
                coords = location.coords;
            }

            // Calculate Qibla direction — instant once we have coords
            const { bearing, distance: dist } = calculateQibla(coords.latitude, coords.longitude);

            // Compute the local magnetic declination so we can derive true north
            // ourselves on Android (see declinationRef). Pure-JS, no native call.
            try {
                const geomagnetism = require('geomagnetism') as {
                    model: (date?: Date) => { point: (c: [number, number]) => { decl: number } };
                };
                declinationRef.current = geomagnetism.model().point([coords.latitude, coords.longitude]).decl;
            } catch { declinationRef.current = 0; }

            setCoords({ lat: coords.latitude, lon: coords.longitude });
            setQiblaDirection(bearing);
            setDistance(dist);

            // Reverse-geocode for the city label in the background — don't
            // block compass setup waiting for it.
            Location.reverseGeocodeAsync({ latitude: coords.latitude, longitude: coords.longitude })
                .then(reverse => {
                    if (reverse[0]) {
                        setCityName(`${reverse[0].city || reverse[0].region}, ${reverse[0].country}`);
                    }
                })
                .catch(() => { /* city label is decorative */ });

            // Subscribe to True North heading
            headingSubscriptionRef.current = await Location.watchHeadingAsync((data) => {
                // The sensor is alive — cancel any "compass not responding" state.
                if (!headingReceivedRef.current) {
                    headingReceivedRef.current = true;
                    setCompassUnavailable(false);
                }
                setAccuracy(data.accuracy);
                // iOS: CoreLocation's trueHeading is already true-north and reliable.
                // Android: derive true north from the RAW magnetic heading plus the
                // declination we computed — avoids double-correction and Android's
                // unreliable built-in trueHeading.
                let newHeading: number;
                if (Platform.OS === 'android') {
                    const mag = data.magHeading !== -1 ? data.magHeading : data.trueHeading;
                    newHeading = ((mag + declinationRef.current) % 360 + 360) % 360;
                } else {
                    newHeading = data.trueHeading !== -1 ? data.trueHeading : data.magHeading;
                }

                // Low-pass filter (Exponential Moving Average)
                // Smoothens jitter significantly
                let filteredHeading = newHeading;
                if (lastHeadingRef.current !== null) {
                    const alpha = 0.1; // Increased smoothing (was 0.15)

                    // Handle 360/0 degree crossing for smoothing
                    let diff = newHeading - lastHeadingRef.current;
                    if (diff > 180) diff -= 360;
                    if (diff < -180) diff += 360;

                    filteredHeading = lastHeadingRef.current + alpha * diff;
                    filteredHeading = (filteredHeading + 360) % 360;
                }

                lastHeadingRef.current = filteredHeading;
                setMagnetometerHeading(filteredHeading);
            });

            // Watchdog: if no heading has arrived in 4s, the device likely has no
            // working compass. Show a warning rather than a silently-wrong needle.
            compassCheckTimerRef.current = setTimeout(() => {
                if (!headingReceivedRef.current) setCompassUnavailable(true);
            }, 4000);

            setLoading(false);
        } catch (err) {
            console.error('Qibla setup error:', err);
            setError('Unable to get location');
            setLoading(false);
        }
    };

    const rotation = rotationAnim.interpolate({
        inputRange: [-7200, 7200],
        outputRange: ['-7200deg', '7200deg'],
    });

    if (loading) {
        return (
            <View style={styles.container}>
                <LinearGradient
                    colors={['rgba(79, 70, 229, 0.15)', 'rgba(139, 92, 246, 0.1)']}
                    style={[StyleSheet.absoluteFill, { borderRadius: 32 }]}
                />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={[styles.loadingText, { color: colors.secondaryText }]}>{t('qibla.findingQibla')}</Text>
                </View>
            </View>
        );
    }

    // Location permission denied — show actionable warning
    if (locationDenied) {
        return (
            <View style={styles.container}>
                <LinearGradient
                    colors={['rgba(251, 191, 36, 0.12)', 'rgba(245, 158, 11, 0.06)']}
                    style={[StyleSheet.absoluteFill, { borderRadius: 32 }]}
                />
                <BlurView intensity={20} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 32 }]} />
                <View style={styles.permissionContainer}>
                    <Text style={styles.permissionIcon}>📍</Text>
                    <Text style={styles.permissionTitle}>{t('qibla.locationRequiredTitle')}</Text>
                    <Text style={styles.permissionBody}>
                        {t('qibla.locationRequiredBody')}
                    </Text>
                    <Text
                        style={styles.permissionButton}
                        onPress={() => Linking.openSettings()}
                    >
                        {t('qibla.openSettings')}
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['rgba(79, 70, 229, 0.15)', 'rgba(139, 92, 246, 0.1)', 'rgba(16, 185, 129, 0.08)']}
                style={[StyleSheet.absoluteFill, { borderRadius: 32 }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />
            <BlurView intensity={20} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 32 }]} />

            <View style={styles.content}>
                {/* Compass */}
                <View style={styles.compassContainer}>
                    {/* Guidance Text Overlay */}
                    <View style={styles.guidanceOverlay}>
                        <Text style={[styles.guidanceText, { color: isLocked ? '#10b981' : colors.primaryText }]}>
                            {guidance}
                        </Text>
                    </View>

                    {/* Fixed Forward Target */}
                    <View style={styles.topMarkerContainer}>
                        <View style={[styles.targetMarker, { borderBottomColor: isLocked ? '#10b981' : colors.accent }]} />
                        <Text style={[styles.targetLabel, { color: colors.secondaryText }]}>{t('qibla.forwardLabel')}</Text>
                    </View>

                    {/* Flat Position Reminder */}
                    <View style={styles.flatReminder}>
                        <Smartphone size={10} color={colors.secondaryText} opacity={0.5} />
                        <Text style={[styles.flatText, { color: colors.secondaryText }]}>{t('qibla.holdPhoneFlat')}</Text>
                    </View>

                    {/* Rotating Compass Rose */}
                    <Animated.View style={[
                        styles.compassRose,
                        {
                            transform: [{
                                rotate: roseAnim.interpolate({
                                    inputRange: [-7200, 7200],
                                    outputRange: ['-7200deg', '7200deg']
                                })
                            }]
                        }
                    ]}>
                        {/* Cardinal directions */}
                        <Text style={[styles.cardinal, styles.cardinalN, { color: colors.primaryText, fontWeight: '900' }]}>N</Text>
                        <Text style={[styles.cardinal, styles.cardinalE, { color: colors.secondaryText }]}>E</Text>
                        <Text style={[styles.cardinal, styles.cardinalS, { color: colors.secondaryText }]}>S</Text>
                        <Text style={[styles.cardinal, styles.cardinalW, { color: colors.secondaryText }]}>W</Text>

                        {/* Compass circle */}
                        <View style={[styles.compassCircle, { borderColor: colors.primaryText }]} />

                        {/* Kaaba Point on the Dial */}
                        <View style={[styles.kaabaPointContainer, { transform: [{ rotate: `${qiblaDirection}deg` }] }]}>
                            <View style={styles.kaabaIndicator} />
                        </View>
                    </Animated.View>

                    {/* Center Point */}
                    <View style={styles.centerTarget}>
                        {/* No expanding rings, just the center dot in the next session */}
                    </View>

                    {/* Animated Needle */}
                    <Animated.View style={[
                        styles.needleContainer,
                        {
                            transform: [
                                { rotate: rotation },
                                { scale: isLocked ? pulseAnim : 1 }
                            ],
                            zIndex: 5
                        }
                    ]}>
                        <View style={styles.needle}>
                            <View style={[
                                styles.needleNorth,
                                {
                                    backgroundColor: isLocked ? '#10b981' : colors.accent,
                                    shadowColor: isLocked ? '#10b981' : 'transparent',
                                    shadowOffset: { width: 0, height: 0 },
                                    shadowOpacity: isLocked ? 0.8 : 0,
                                    shadowRadius: 10,
                                    elevation: isLocked ? 10 : 0,
                                }
                            ]} />
                            <View style={[styles.needleSouth, { backgroundColor: colors.secondaryText }]} />
                        </View>
                    </Animated.View>

                    {/* Center Dot */}
                    <View style={[
                        styles.centerDot,
                        {
                            backgroundColor: isLocked ? '#10b981' : colors.accent,
                            zIndex: 10,
                            position: 'absolute',
                            shadowColor: isLocked ? '#10b981' : 'transparent',
                            shadowOpacity: 1,
                            shadowRadius: 10,
                        }
                    ]} />
                </View>

                {/* Info */}
                <View style={styles.infoContainer}>
                    <View style={styles.infoItem}>
                        <Text style={[styles.infoLabel, { color: colors.secondaryText }]}>{t('qibla.fromLabel')}</Text>
                        <Text style={[styles.infoValue, { color: colors.primaryText, fontSize: 13 }]} numberOfLines={1}>
                            {cityName || t('qibla.detecting')}
                        </Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoItem}>
                        <Text style={[styles.infoLabel, { color: colors.secondaryText }]}>{t('qibla.directionLabel')}</Text>
                        <Text style={[styles.infoValue, { color: colors.primaryText }]}>
                            {qiblaDirection}°{' '}
                            <Text style={{ color: colors.accent }}>
                                {qiblaDirection !== null ? getCompassDirection(qiblaDirection) : ''}
                            </Text>
                        </Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.infoItem}>
                        <Text style={[styles.infoLabel, { color: colors.secondaryText }]}>{t('qibla.distanceLabel')}</Text>
                        <Text style={[styles.infoValue, { color: colors.primaryText }]}>
                            {distance !== null ? distance.toLocaleString() : '—'}
                        </Text>
                        {distance !== null && (
                            <Text style={[styles.infoUnit, { color: colors.secondaryText }]}>km</Text>
                        )}
                    </View>
                </View>

                {/* Compass not responding — likely no/weak magnetometer */}
                {compassUnavailable && (
                    <View style={styles.warningBadge}>
                        <Text style={styles.warningText}>
                            {t('qibla.compassWarning', {
                                dir: qiblaDirection !== null ? `${qiblaDirection}° (${getCompassDirection(qiblaDirection)})` : t('qibla.directionBelow'),
                            })}
                        </Text>
                    </View>
                )}

                {/* Accuracy Status (Only if critical) */}
                {!compassUnavailable && accuracy !== null && accuracy < 2 && (
                    <View style={styles.statusBadge}>
                        <View style={[styles.statusDot, { backgroundColor: '#ef4444' }]} />
                        <Text style={[styles.statusText, { color: colors.secondaryText }]}>
                            {t('qibla.lowAccuracy')}
                        </Text>
                    </View>
                )}

            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: 32,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
        minHeight: 240,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    loadingText: {
        fontSize: 14,
        fontWeight: '600',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    errorText: {
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
    },
    content: {
        gap: 20,
    },
    header: {
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
    },
    iconWrapper: {
        width: 40,
        height: 40,
        backgroundColor: 'rgba(248, 250, 252, 0.1)',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(248, 250, 252, 0.2)',
    },
    title: {
        fontSize: 16,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    compassContainer: {
        height: 220,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        marginTop: 30,
    },
    guidanceOverlay: {
        position: 'absolute',
        top: -45,
        width: '100%',
        alignItems: 'center',
    },
    guidanceText: {
        fontSize: 14,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    topMarkerContainer: {
        position: 'absolute',
        top: 0,
        alignItems: 'center',
        zIndex: 20,
    },
    targetMarker: {
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 12,
        borderRightWidth: 12,
        borderBottomWidth: 18,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
    },
    targetLabel: {
        fontSize: 8,
        fontWeight: '900',
        marginTop: 18,
        letterSpacing: 1,
    },
    flatReminder: {
        position: 'absolute',
        bottom: -20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        zIndex: 30,
    },
    flatText: {
        fontSize: 10,
        fontWeight: '600',
        opacity: 0.5,
    },
    compassRose: {
        width: 140,
        height: 140,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    compassCircle: {
        position: 'absolute',
        width: 140,
        height: 140,
        borderRadius: 70,
        borderWidth: 2,
        opacity: 0.2,
    },
    cardinal: {
        position: 'absolute',
        fontSize: 14,
        fontWeight: '900',
    },
    cardinalN: { top: -20 },
    cardinalE: { right: -20 },
    cardinalS: { bottom: -20 },
    cardinalW: { left: -20 },
    kaabaPointContainer: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        justifyContent: 'flex-start',
        alignItems: 'center',
    },
    kaabaIndicator: {
        width: 12,
        height: 12,
        backgroundColor: '#10b981',
        borderRadius: 6,
        marginTop: -6,
        borderWidth: 2,
        borderColor: 'white',
        shadowColor: '#10b981',
        shadowOpacity: 1,
        shadowRadius: 5,
    },
    needleContainer: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 10,
    },
    warningBadge: {
        marginTop: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: 'rgba(251, 191, 36, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.3)',
    },
    warningText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#fbbf24',
        textAlign: 'center',
        lineHeight: 18,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    needle: {
        width: 4,
        height: 80,
        alignItems: 'center',
    },
    needleNorth: {
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderBottomWidth: 40,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
    },
    needleSouth: {
        width: 4,
        height: 40,
        borderRadius: 2,
        opacity: 0.4,
    },
    centerTarget: {
        position: 'absolute',
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    progressRing: {
        position: 'absolute',
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 2,
    },
    centerDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    infoContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingTop: 12,
    },
    infoItem: {
        flex: 1,
        alignItems: 'center',
        gap: 2,
    },
    infoUnit: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    infoLabel: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
        opacity: 0.6,
    },
    infoValue: {
        fontSize: 15,
        fontWeight: '900',
    },
    divider: {
        width: 1,
        height: 30,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    debugCoords: {
        marginTop: 10,
        alignItems: 'center',
    },
    debugText: {
        fontSize: 10,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        opacity: 0.5,
    },
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        gap: 12,
    },
    permissionIcon: {
        fontSize: 40,
        marginBottom: 4,
    },
    permissionTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: '#fbbf24',
        textTransform: 'uppercase',
        letterSpacing: 1,
        textAlign: 'center',
    },
    permissionBody: {
        fontSize: 13,
        color: '#94a3b8',
        fontWeight: '500',
        textAlign: 'center',
        lineHeight: 20,
        maxWidth: 260,
    },
    permissionButton: {
        marginTop: 8,
        fontSize: 13,
        fontWeight: '900',
        color: '#fbbf24',
        textTransform: 'uppercase',
        letterSpacing: 1,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: 'rgba(251, 191, 36, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.3)',
        overflow: 'hidden',
    },
});
