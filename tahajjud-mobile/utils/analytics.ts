/**
 * Privacy-respecting analytics.
 *
 * What we track:
 *   - Anonymous app launches, tab switches, paywall views, subscription events
 *   - Feature usage counts (e.g. "user opened journal modal")
 *
 * What we EXPLICITLY DO NOT track:
 *   - Journal entry content
 *   - Personal dua / letter content
 *   - Specific ayahs read or how long the user spent reading them
 *   - Search queries (since users search the Quran for personal reasons)
 *   - User name, email, location
 *
 * Set EXPO_PUBLIC_POSTHOG_API_KEY in your env to activate.
 * If unset, the analytics layer becomes a no-op — no network calls, nothing logged.
 */

// PostHog is lazy-loaded inside initAnalytics() because it imports
// `expo-localization` at module-load time, which crashes the JS bundle
// if the native module isn't in the dev client binary yet.

const API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

let client: any = null;
let initialized = false;

/** Initialize once at app startup. Safe to call multiple times. */
export async function initAnalytics(): Promise<void> {
    if (initialized || !API_KEY) {
        initialized = true;
        return;
    }
    try {
        // Lazy require — only loads PostHog (and its expo-localization dep)
        // when an analytics key is actually configured.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const PostHogMod = require('posthog-react-native');
        const PostHog = PostHogMod.default ?? PostHogMod;
        client = new PostHog(API_KEY, {
            host: HOST,
            captureAppLifecycleEvents: true,
        });
        initialized = true;
    } catch (e) {
        // Never block the app on analytics. Most common failure: dev client
        // missing expo-localization native module (rebuild needed).
        console.log('[analytics] init skipped:', e);
        client = null;
        initialized = true;
    }
}

/**
 * Block-list of property keys that could contain spiritual content.
 * Any key matching is silently dropped before sending.
 */
const FORBIDDEN_KEYS = new Set([
    'journal', 'journalEntry', 'duaText', 'letterText', 'dua', 'letter',
    'ayahText', 'verseText', 'searchQuery', 'query', 'reflection',
    'name', 'userName', 'email', 'location', 'lat', 'lng', 'address',
]);

function sanitize(props?: Record<string, any>): Record<string, any> | undefined {
    if (!props) return undefined;
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(props)) {
        if (FORBIDDEN_KEYS.has(k)) continue;
        // Block long string values defensively — they likely contain user content
        if (typeof v === 'string' && v.length > 200) continue;
        out[k] = v;
    }
    return out;
}

export function track(event: string, properties?: Record<string, any>): void {
    if (!client) return;
    try {
        client.capture(event, sanitize(properties));
    } catch { /* ignore */ }
}

export function trackScreen(name: string): void {
    if (!client) return;
    try {
        client.screen(name);
    } catch { /* ignore */ }
}

/**
 * Identify the user with a STABLE ANONYMOUS ID — never their email or name.
 * If you sign in via Firebase later, you can call this with the Firebase uid.
 */
export function identifyAnonymous(anonymousId: string): void {
    if (!client) return;
    try {
        client.identify(anonymousId);
    } catch { /* ignore */ }
}
