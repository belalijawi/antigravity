import { t } from './i18n';

// Firebase auth error codes that mean "the network dropped mid-request" —
// worth mapping to a friendly message instead of showing Firebase's raw
// string ("Firebase: A network error has occurred. (auth/network-request-failed).")
// which is common on cellular during OAuth's multi-step redirect flow.
const NETWORK_ERROR_CODES = new Set([
    'auth/network-request-failed',
    'auth/timeout',
]);

/**
 * Returns a user-friendly message for a sign-in failure. Network drops get a
 * consistent "check your connection" message instead of a raw SDK error
 * string; anything else falls back to error.message, then the caller's
 * provided fallback.
 */
export function friendlyAuthErrorMessage(error: any, fallback: string): string {
    if (error?.code && NETWORK_ERROR_CODES.has(error.code)) {
        return t('auth.networkErrorBody');
    }
    return error?.message || fallback;
}
