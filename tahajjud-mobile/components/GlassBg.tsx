import React from 'react';
import { View, StyleSheet } from 'react-native';

/**
 * Drop-in replacement for expo-blur's <BlurView>.
 *
 * Why: every card painted a live GPU blur and then covered it with cardBg
 * (rgba(3,5,15,0.93) — 93% opaque), so the blur was effectively invisible while
 * still costing full GPU compositing. With 30+ on the Home screen this tanked
 * performance and made tab switches laggy.
 *
 * This renders a plain View instead — visually ~identical (the opaque cardBg is
 * what you actually see) but with none of the blur cost. `intensity` and `tint`
 * are accepted and ignored so it's a 1-line import-alias swap. If a usage had no
 * background of its own (e.g. a modal backdrop), we apply a dark translucent
 * fallback so it still reads as a frosted layer.
 */
export function GlassBg({ intensity, tint, style, children, ...rest }: any) {
    const flat = StyleSheet.flatten(style) || {};
    const hasBg = flat.backgroundColor != null;
    return (
        <View style={[style, !hasBg && { backgroundColor: 'rgba(8,12,28,0.82)' }]} {...rest}>
            {children}
        </View>
    );
}
