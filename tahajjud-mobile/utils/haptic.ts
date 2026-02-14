import * as Haptics from 'expo-haptics';

/**
 * Haptic Feedback Utility
 * Provides consistent haptic feedback across the app
 */

export const haptic = {
    /**
     * Light tap - for subtle interactions
     * Use for: hovering, highlighting, minor selections
     */
    light: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },

    /**
     * Medium tap - for standard interactions
     * Use for: button presses, tab switches, toggles
     */
    medium: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },

    /**
     * Heavy tap - for important interactions
     * Use for: confirmations, deletions, major actions
     */
    heavy: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    },

    /**
     * Success feedback - for positive outcomes
     * Use for: prayer completions, successful saves, achievements
     */
    success: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },

    /**
     * Warning feedback - for cautions
     * Use for: approaching limits, reversible errors
     */
    warning: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    },

    /**
     * Error feedback - for errors
     * Use for: failed actions, validation errors
     */
    error: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },

    /**
     * Selection feedback - for picking items
     * Use for: scrolling through pickers, selecting from lists
     */
    selection: () => {
        Haptics.selectionAsync();
    },
};
