import { NativeModules, Platform } from 'react-native';

const { LiveActivityBridge } = NativeModules;

/**
 * Live Activity wrapper.
 *
 * iOS 16.1+ only. Renders a Tahajjud countdown on the Lock Screen and
 * Dynamic Island, started typically when notifications fire and ended when
 * the user logs Tahajjud or Fajr arrives.
 *
 * On Android or older iOS, all functions silently no-op.
 */

export const LiveActivity = {
    isAvailable(): boolean {
        return Platform.OS === 'ios' && !!LiveActivityBridge;
    },

    /** Start a new activity. Resolves with the activity id, or null if unavailable. */
    async start(lastThirdStart: Date, fajr: Date): Promise<string | null> {
        if (!this.isAvailable()) return null;
        try {
            const id: string = await LiveActivityBridge.startActivity(
                Math.floor(lastThirdStart.getTime() / 1000),
                Math.floor(fajr.getTime() / 1000),
            );
            return id;
        } catch (e) {
            console.log('[LiveActivity] start failed:', e);
            return null;
        }
    },

    /** End all active Tahajjud activities. Safe to call when none exist. */
    async endAll(): Promise<void> {
        if (!this.isAvailable()) return;
        try {
            await LiveActivityBridge.endAllActivities();
        } catch (e) {
            console.log('[LiveActivity] endAll failed:', e);
        }
    },
};
