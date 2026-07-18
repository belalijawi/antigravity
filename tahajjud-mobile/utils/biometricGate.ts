/**
 * Shared biometric gate for accessing private content (Tahajjud letters,
 * journal entries, etc.).
 *
 * Behaviour:
 *   - If the user hasn't enabled "Biometric Lock" in Settings → always allows.
 *   - If they have → prompts FaceID/TouchID before granting access.
 *   - Authentications are cached for 5 minutes — so opening multiple
 *     private screens in a row doesn't repeatedly prompt.
 *   - App going to background for >5 min invalidates the cache.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { AppState } from 'react-native';

const LOCK_KEY = 'biometric-lock-enabled';
const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

let lastAuthAt: number = 0;
let lastBackgroundedAt: number | null = null;

// Track when the app goes to background; on foreground, invalidate if it
// was hidden for too long.
AppState.addEventListener('change', (state) => {
    if (state === 'active') {
        if (lastBackgroundedAt != null && Date.now() - lastBackgroundedAt > SESSION_TIMEOUT_MS) {
            lastAuthAt = 0; // force re-auth
        }
        lastBackgroundedAt = null;
    } else if (state === 'background' || state === 'inactive') {
        if (lastBackgroundedAt == null) lastBackgroundedAt = Date.now();
    }
});

export interface BiometricGateOptions {
    /** Shown above the FaceID/TouchID prompt. Defaults to "Unlock private content". */
    prompt?: string;
    /** Bypass cache and always prompt for this call. */
    force?: boolean;
}

/**
 * Returns true if access is granted (either biometric lock is disabled, the
 * cache is still warm, or the user just authenticated successfully). Returns
 * false if the user cancelled or auth failed.
 */
export async function requireBiometric(opts: BiometricGateOptions = {}): Promise<boolean> {
    try {
        const enabled = (await AsyncStorage.getItem(LOCK_KEY)) === 'true';
        if (!enabled) return true;

        // Cache hit — user authenticated recently
        if (!opts.force && Date.now() - lastAuthAt < SESSION_TIMEOUT_MS) return true;

        // Defensive: confirm hardware + enrollment still work
        const [hasHardware, isEnrolled] = await Promise.all([
            LocalAuthentication.hasHardwareAsync(),
            LocalAuthentication.isEnrolledAsync(),
        ]);
        if (!hasHardware || !isEnrolled) {
            // Treat as unlocked if biometrics no longer available — better
            // than locking the user out of their own data.
            return true;
        }

        const result = await LocalAuthentication.authenticateAsync({
            promptMessage: opts.prompt ?? 'Unlock private content',
            cancelLabel: 'Cancel',
            disableDeviceFallback: false,
        });
        if (result.success) {
            lastAuthAt = Date.now();
            return true;
        }
        return false;
    } catch {
        // On any error, prefer "deny" so private content stays private
        return false;
    }
}

