import { I18nManager, NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Read the device locale straight from React Native's native bridge — no
// expo-localization needed. This avoids any "Cannot find native module
// 'ExpoLocalization'" crashes when the dev client binary is out of sync.
function getDeviceLanguageCode(): string {
    try {
        let raw: string | undefined;
        if (Platform.OS === 'ios') {
            const sm = NativeModules.SettingsManager?.settings;
            raw = sm?.AppleLocale
                ?? (Array.isArray(sm?.AppleLanguages) ? sm.AppleLanguages[0] : undefined);
        } else {
            raw = NativeModules.I18nManager?.localeIdentifier;
        }
        if (!raw) return 'en';
        return String(raw).split(/[-_]/)[0].toLowerCase();
    } catch {
        return 'en';
    }
}

/**
 * RTL bootstrap.
 *
 * If the device locale starts with "ar" (Arabic) or "ur" / "fa" / "he"
 * (other RTL languages), force the app into RTL mode so the UI mirrors:
 *   - flexDirection 'row' becomes right-to-left
 *   - chevrons and arrows mirror automatically
 *   - margin/padding 'left' and 'right' swap (when configured below)
 *
 * RN requires app reload for `forceRTL` to take effect. We track a
 * persistent flag so we only call it once per locale change.
 */

const RTL_LOCALES = ['ar', 'ur', 'fa', 'he'];
const STORAGE_KEY = 'rtl-applied-locale-v1';

export async function applyRtlIfNeeded(): Promise<void> {
    try {
        const locale = getDeviceLanguageCode();
        const shouldBeRTL = RTL_LOCALES.includes(locale);

        const previously = await AsyncStorage.getItem(STORAGE_KEY);
        if (previously === locale) return; // already applied

        // Allow RTL globally
        I18nManager.allowRTL(shouldBeRTL);
        // Auto-mirror left/right padding/margin in RTL
        I18nManager.swapLeftAndRightInRTL(true);

        if (I18nManager.isRTL !== shouldBeRTL) {
            I18nManager.forceRTL(shouldBeRTL);
            await AsyncStorage.setItem(STORAGE_KEY, locale);
            // The app needs a reload for the change to fully apply.
            // We DON'T auto-reload here — that would surprise the user.
            // Just persist so we know we tried.
        } else {
            await AsyncStorage.setItem(STORAGE_KEY, locale);
        }
    } catch {
        // RTL bootstrap is best-effort; never crash the app
    }
}

/** True if the app is currently rendering right-to-left. */
export function isRTL(): boolean {
    return I18nManager.isRTL;
}
