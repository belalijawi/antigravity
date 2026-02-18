import { Dimensions, Platform } from 'react-native';

const { width, height } = Dimensions.get('window');

/** True when running on an iPad or large Android tablet */
export const isTablet = Platform.OS === 'ios'
    ? (width >= 768 || height >= 768)
    : width >= 600;

/**
 * Max content width for tablet layouts.
 * Content is capped at this width and centred horizontally.
 */
export const TABLET_MAX_WIDTH = 680;

/**
 * Returns a style object that centres content and caps its width on tablets.
 * Use as the style of your inner content wrapper.
 *
 * @example
 * <View style={[styles.inner, tabletContentStyle()]}>...</View>
 */
export function tabletContentStyle() {
    if (!isTablet) return {};
    return {
        maxWidth: TABLET_MAX_WIDTH,
        alignSelf: 'center' as const,
        width: '100%' as const,
    };
}
