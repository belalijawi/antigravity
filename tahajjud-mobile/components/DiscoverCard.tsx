/**
 * DiscoverCard — a dismissible card on the Home screen that surfaces ONE
 * feature the user hasn't tried yet. Rotates through unused features over time
 * (throttled so it's never naggy). Tapping a premium feature opens the paywall
 * for free users — turning discovery into conversion.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { GlassBg as BlurView } from './GlassBg';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, ChevronRight, X, Lock } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { usePurchases } from '../context/PurchasesContext';
import { haptic } from '../utils/haptic';
import {
    FeatureMeta, FeatureId, getNextDiscoverFeature,
} from '../utils/featureDiscovery';

interface Props {
    /** Called when the user taps the card for a feature they can access. */
    onNavigate: (id: FeatureId) => void;
}

export function DiscoverCard({ onNavigate }: Props) {
    const { colors, cardBg, blurIntensity } = useTheme();
    const { isPremium, openPaywall } = usePurchases();
    const [feature, setFeature] = useState<FeatureMeta | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            // Rotate to a NEW unused feature each time the card mounts
            const next = await getNextDiscoverFeature();
            if (!cancelled) setFeature(next);
        })();
        return () => { cancelled = true; };
    }, []);

    if (!feature) return null;

    const locked = feature.premium && !isPremium;

    const handlePress = () => {
        haptic.light();
        if (locked) {
            openPaywall();
        } else {
            onNavigate(feature.id);
        }
        setFeature(null); // dismiss after acting
    };

    const handleDismiss = () => {
        haptic.light();
        setFeature(null);
    };

    return (
        <View style={[styles.card, { borderColor: colors.accent + '33' }]}>
            <BlurView intensity={Math.round(20 * blurIntensity)} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />
            <LinearGradient
                colors={[colors.accent + '14', 'transparent']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            />

            <TouchableOpacity style={styles.dismiss} onPress={handleDismiss} hitSlop={10}>
                <X size={15} color={colors.secondaryText} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.inner} onPress={handlePress} activeOpacity={0.85}>
                <View style={[styles.iconWrap, { backgroundColor: colors.accent + '1a' }]}>
                    <Sparkles size={20} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                    <View style={styles.titleRow}>
                        <Text style={[styles.label, { color: colors.accent }]}>DISCOVER</Text>
                        {locked && <Lock size={10} color="#f59e0b" />}
                    </View>
                    <Text style={[styles.title, { color: colors.primaryText }]}>{feature.label}</Text>
                    <Text style={[styles.blurb, { color: colors.secondaryText }]} numberOfLines={2}>
                        {feature.blurb}
                    </Text>
                </View>
                <ChevronRight size={18} color={colors.secondaryText} />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 18, overflow: 'hidden', borderWidth: 1, marginBottom: 16,
    },
    dismiss: { position: 'absolute', top: 10, right: 10, zIndex: 3, padding: 2 },
    inner: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, paddingRight: 32 },
    iconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
    label: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
    title: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
    blurb: { fontSize: 12, lineHeight: 16 },
});
