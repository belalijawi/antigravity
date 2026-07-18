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
let onboardedAtLaunch: boolean | null = null;

/**
 * Record whether the "onboarded" flag was already set at cold start, BEFORE
 * onboarding can complete. app_first_open must classify existing_user from
 * this snapshot: analytics initializes on a delay, and for brand-new users
 * onboarding sets the flag first — reading storage at init time would
 * misclassify every new download as an existing user.
 */
export function noteOnboardedAtLaunch(onboarded: boolean): void {
    if (onboardedAtLaunch === null) onboardedAtLaunch = onboarded;
}

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
        // Fire-and-forget — never delays init for callers.
        trackFirstOpenOnce();
    } catch (e) {
        // Never block the app on analytics. Most common failure: dev client
        // missing expo-localization native module (rebuild needed).
        console.log('[analytics] init skipped:', e);
        client = null;
        initialized = true;
    }
}

/**
 * One-time "new download" event. PostHog's automatic "Application Installed"
 * lifecycle event also fires for EXISTING users the first time they update
 * into an analytics-enabled build, so it over-counts installs. This event
 * carries `existing_user` so a PostHog insight can chart genuine new
 * downloads: trend on `app_first_open` where existing_user = false.
 */
async function trackFirstOpenOnce(): Promise<void> {
    try {
        // Lazy require, same reasoning as PostHog itself above.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const KEY = 'analytics_first_open_at';
        if (await AsyncStorage.getItem(KEY)) return;
        // A genuine new download had no "onboarded" flag at cold start; an
        // existing user updating into this build launched with it already set.
        // Falls back to reading storage only if the launch snapshot was never
        // taken (it is set from checkOnboarding before this can run).
        const onboarded = onboardedAtLaunch
            ?? ((await AsyncStorage.getItem('onboarded')) === 'true');
        // Carry platform explicitly: this fires before super properties are
        // registered, so a brand-new device would otherwise send it without
        // any dimensions to slice iOS vs Android downloads by.
        const { Platform } = require('react-native');
        track('app_first_open', { existing_user: onboarded, platform: Platform.OS });
        await AsyncStorage.setItem(KEY, String(Date.now()));
    } catch { /* never block or crash over analytics */ }
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

/**
 * Register "super properties" — sent automatically with EVERY future event
 * (persisted on-device by PostHog). Use this for low-cardinality dimensions
 * you want to slice ALL analytics by, e.g. app version, platform, premium
 * status, locale. Re-call whenever one of these changes (e.g. on
 * subscribe/unsubscribe) to keep it current.
 */
export function setSuperProperties(properties: Record<string, any>): void {
    if (!client) return;
    try {
        client.register(sanitize(properties));
    } catch { /* ignore */ }
}

