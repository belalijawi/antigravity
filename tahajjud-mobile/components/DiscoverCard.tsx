/**
 * DiscoverCard — permanent horizontal carousel that cycles through all app
 * features. Auto-advances every 4 s; pauses for 8 s after a user swipe so
 * it never fights the gesture. Tapping a locked feature opens the paywall.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    FlatList, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { GlassBg as BlurView } from './GlassBg';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, Lock } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { usePurchases } from '../context/PurchasesContext';
import { haptic } from '../utils/haptic';
import { FEATURES, FeatureMeta, FeatureId } from '../utils/featureDiscovery';
import { t } from '../utils/i18n';

const FEATURE_LIST: FeatureMeta[] = Object.values(FEATURES);

interface Props {
    onNavigate: (id: FeatureId) => void;
}

// Memoized so the 4s auto-advance timer (which re-renders DiscoverCard on
// every tick) doesn't also re-render every card row — FEATURE_LIST's data
// reference never changes, so this actually lets FlatList skip re-invoking
// renderItem for rows whose own props are unchanged.
const DiscoverRow = React.memo(function DiscoverRow({
    item, cardWidth, colors, isPremium, onPress,
}: {
    item: FeatureMeta;
    cardWidth: number;
    colors: any;
    isPremium: boolean;
    onPress: (feature: FeatureMeta) => void;
}) {
    const locked = item.premium && !isPremium;
    // A premium feature whose default copy describes the post-upgrade state
    // (e.g. "Unlimited Replies") would otherwise read as a claim about what
    // a free user already has — see FeatureMeta.freeLabel's own comment.
    const labelKey = locked && item.freeLabel ? `discover.${item.id}.label_free` : `discover.${item.id}.label`;
    const blurbKey = locked && item.freeBlurb ? `discover.${item.id}.blurb_free` : `discover.${item.id}.blurb`;
    return (
        <TouchableOpacity
            style={[styles.page, { width: cardWidth }]}
            onPress={() => onPress(item)}
            activeOpacity={0.85}
        >
            <View style={styles.inner}>
                <View style={[styles.iconWrap, { backgroundColor: colors.accent + '1a' }]}>
                    <Sparkles size={20} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                    <View style={styles.titleRow}>
                        <Text style={[styles.label, { color: colors.accent }]}>{t('discover.label')}</Text>
                        {locked && <Lock size={10} color="#f59e0b" />}
                    </View>
                    <Text style={[styles.title, { color: colors.primaryText }]} numberOfLines={1}>{t(labelKey)}</Text>
                    <Text style={[styles.blurb, { color: colors.secondaryText }]} numberOfLines={2}>
                        {t(blurbKey)}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );
});

export function DiscoverCard({ onNavigate }: Props) {
    const { colors, cardBg, blurIntensity } = useTheme();
    const { isPremium, openPaywall } = usePurchases();
    const [activeIndex, setActiveIndex] = useState(0);
    const [cardWidth, setCardWidth] = useState(0);
    const scrollRef = useRef<FlatList<FeatureMeta>>(null);
    const userInteractionUntilRef = useRef(0);

    // Auto-advance every 4 s; back off 8 s after a manual swipe
    useEffect(() => {
        if (cardWidth === 0) return;
        const t = setInterval(() => {
            if (Date.now() < userInteractionUntilRef.current) return;
            setActiveIndex(prev => {
                const next = (prev + 1) % FEATURE_LIST.length;
                try {
                    scrollRef.current?.scrollToOffset({ offset: next * cardWidth, animated: true });
                    // A JS-driven animated scrollToOffset isn't guaranteed to
                    // finish cleanly or fire onMomentumScrollEnd the way a real
                    // swipe does (worse on Android) — a dropped frame can leave
                    // the list stopped mid-transition, straddling two cards.
                    // Self-heal with a non-animated snap to the exact target
                    // shortly after the animation should have settled; a no-op
                    // if it already landed correctly. Skipped if the user has
                    // since grabbed the list themselves.
                    setTimeout(() => {
                        if (Date.now() < userInteractionUntilRef.current) return;
                        try {
                            scrollRef.current?.scrollToOffset({ offset: next * cardWidth, animated: false });
                        } catch {}
                    }, 400);
                } catch {}
                return next;
            });
        }, 4000);
        return () => clearInterval(t);
    }, [cardWidth]);

    const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (cardWidth === 0) return;
        const x = e.nativeEvent.contentOffset.x;
        const i = Math.round(x / cardWidth);
        if (i !== activeIndex && i >= 0 && i < FEATURE_LIST.length) {
            setActiveIndex(i);
        }
        userInteractionUntilRef.current = Date.now() + 8000;
    };

    const handlePress = useCallback((feature: FeatureMeta) => {
        haptic.light();
        if (feature.premium && !isPremium) {
            openPaywall('feature_gate:discover', feature.id);
        } else {
            onNavigate(feature.id);
        }
    }, [isPremium, openPaywall, onNavigate]);

    return (
        <View
            style={[styles.wrapper, { borderColor: colors.accent + '33' }]}
            onLayout={e => setCardWidth(e.nativeEvent.layout.width)}
        >
            <BlurView intensity={Math.round(20 * blurIntensity)} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />
            <LinearGradient
                colors={[colors.accent + '14', 'transparent']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            />

            {cardWidth > 0 && (
                <FlatList
                    ref={scrollRef}
                    data={FEATURE_LIST}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={handleScroll}
                    decelerationRate="fast"
                    keyExtractor={item => item.id}
                    style={{ width: cardWidth }}
                    getItemLayout={(_, index) => ({
                        length: cardWidth, offset: cardWidth * index, index,
                    })}
                    renderItem={({ item }) => (
                        <DiscoverRow item={item} cardWidth={cardWidth} colors={colors} isPremium={isPremium} onPress={handlePress} />
                    )}
                />
            )}

            <View style={styles.dots}>
                {FEATURE_LIST.map((_, i) => (
                    <View
                        key={i}
                        style={[
                            styles.dot,
                            i === activeIndex
                                ? { backgroundColor: colors.accent, width: 14 }
                                : { backgroundColor: 'rgba(255,255,255,0.2)', width: 6 },
                        ]}
                    />
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        borderRadius: 18,
        overflow: 'hidden',
        borderWidth: 1,
        marginBottom: 16,
    },
    page: {
        // width set dynamically to cardWidth
    },
    inner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 16,
        paddingRight: 16,
    },
    iconWrap: {
        width: 44, height: 44, borderRadius: 14,
        alignItems: 'center', justifyContent: 'center',
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
    label: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
    title: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
    blurb: { fontSize: 12, lineHeight: 16 },
    dots: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 4,
        paddingBottom: 10,
    },
    dot: {
        height: 6,
        borderRadius: 3,
    },
});
