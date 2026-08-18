/**
 * "Engaged but never converted" win-back-style offer.
 *
 * Targets free users who have used the app for real (not a one-time
 * dabbler) but have never trialed or subscribed — distinct from
 * trialWinbackEligible in PurchasesContext, which is for people who HAD a
 * trial/subscription and cancelled it.
 *
 * Eligibility (see checkNeverConvertedEligibility, the single source of
 * truth) requires ALL of:
 *   - 7+ days since install
 *   - 4+ distinct active days during the first week — proves a real habit,
 *     not just installed-and-forgot. Distinct DAYS, not raw open count:
 *     someone backgrounding/foregrounding repeatedly in one sitting
 *     shouldn't count the same as returning on a different day.
 *   - hasn't looked at the paywall in the last 2 days, UNLESS 30+ days
 *     have passed since install. Reasoning for both numbers, from this
 *     app's own PostHog data: 70%+ of everyone who ever converts does so
 *     within the first HOUR of first use, and 99.1% convert within 30
 *     days — so by day 30, waiting for "maybe they'll convert on their
 *     own soon" is no longer a real risk, and the 2-day recency check
 *     stops mattering.
 * Callers (PurchasesContext) are responsible for additionally checking
 * !isPremium && !trialWinbackEligible — this module only tracks the local
 * engagement/recency signals, not subscription state.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases from 'react-native-purchases';
import { differenceInCalendarDays } from 'date-fns';
import { localDateStr } from './localDate';

// Shared with utils/analytics.ts's trackFirstOpenOnce — reusing it here
// avoids tracking a second, redundant "first seen" timestamp.
const FIRST_OPEN_KEY = 'analytics_first_open_at';
const WEEK1_ACTIVE_DAYS_KEY = 'never-converted-week1-active-days';
const LAST_PAYWALL_VIEWED_KEY = 'never-converted-last-paywall-viewed-at';
const HOLDOUT_KEY = 'never-converted-holdout';

const MIN_DAYS_SINCE_INSTALL = 7;
const MIN_WEEK1_ACTIVE_DAYS = 4;
const PAYWALL_RECENCY_DAYS = 2;
const HARD_OVERRIDE_DAYS = 30;
// Held out from ever seeing the offer, so its real conversion lift can be
// measured against a control group instead of assumed.
const HOLDOUT_RATE = 0.2;

/** Local-only signal — cheap, offline-safe, fine for bookkeeping (recordAppOpen). */
async function getLocalDaysSinceInstall(): Promise<number | null> {
    const raw = await AsyncStorage.getItem(FIRST_OPEN_KEY);
    if (!raw) return null;
    const firstOpen = Number(raw);
    if (!Number.isFinite(firstOpen)) return null;
    return differenceInCalendarDays(new Date(), new Date(firstOpen));
}

/**
 * The signal actually used to GATE eligibility — cross-checked against
 * RevenueCat's server-tracked `firstSeen`, not just local storage.
 *
 * `android:allowBackup="true"` (AndroidManifest.xml) means Android's Auto
 * Backup silently saves and restores this app's local storage across an
 * uninstall/reinstall. A user who genuinely used the app long enough to earn
 * this offer, then uninstalled and reinstalled, gets their old
 * FIRST_OPEN_KEY and active-days history back immediately — making a
 * install that the STORE considers brand new look like a long-time user to
 * this check alone, and the offer isn't guarded by any Apple/Google
 * eligibility rule (see NEVER_CONVERTED_OFFER_IDS_ANDROID's comment in
 * services/revenueCat.ts) — this local check is the only gate there is.
 *
 * RevenueCat's `firstSeen` is tracked server-side against the subscriber
 * record, not restorable this way, so it's the authoritative signal for
 * "is this really a fresh install." Taking the SMALLER (more recent) of the
 * two values means either signal alone can correctly deny eligibility, but
 * both have to agree it's been long enough to grant it.
 */
async function getDaysSinceInstall(): Promise<number | null> {
    const localDays = await getLocalDaysSinceInstall();
    if (localDays === null) return null;

    try {
        const info = await Purchases.getCustomerInfo();
        if (info?.firstSeen) {
            const rcDays = differenceInCalendarDays(new Date(), new Date(info.firstSeen));
            if (Number.isFinite(rcDays)) return Math.min(localDays, rcDays);
        }
    } catch {
        // RevenueCat unreachable (offline, SDK not yet configured) — fall
        // back to the local signal alone rather than blocking eligibility
        // over a transient network issue.
    }
    return localDays;
}

/**
 * Call once per cold start. Records today's date if it falls within the
 * first 7 days since install. No-ops once that window has closed — the
 * week-1 engagement figure is fixed at that point and never revisited.
 */
export async function recordAppOpen(): Promise<void> {
    try {
        // Local-only here is fine — this just decides whether to keep
        // recording bookkeeping days, and checkNeverConvertedEligibility's
        // RevenueCat cross-check is what actually guards the real decision.
        const daysSinceInstall = await getLocalDaysSinceInstall();
        // Also no-ops on a brand-new device where analytics hasn't stamped
        // FIRST_OPEN_KEY yet — it will on a later cold start.
        if (daysSinceInstall === null || daysSinceInstall > MIN_DAYS_SINCE_INSTALL) return;
        const raw = await AsyncStorage.getItem(WEEK1_ACTIVE_DAYS_KEY);
        const days: string[] = raw ? JSON.parse(raw) : [];
        const today = localDateStr(new Date());
        if (!days.includes(today)) {
            days.push(today);
            await AsyncStorage.setItem(WEEK1_ACTIVE_DAYS_KEY, JSON.stringify(days));
        }
    } catch { /* never block app startup over this */ }
}

/** Call whenever the paywall is shown, regardless of source/reason. */
export async function recordPaywallViewed(): Promise<void> {
    try {
        await AsyncStorage.setItem(LAST_PAYWALL_VIEWED_KEY, String(Date.now()));
    } catch { /* ignore */ }
}

export async function checkNeverConvertedEligibility(): Promise<boolean> {
    try {
        const daysSinceInstall = await getDaysSinceInstall();
        if (daysSinceInstall === null || daysSinceInstall < MIN_DAYS_SINCE_INSTALL) return false;

        const rawDays = await AsyncStorage.getItem(WEEK1_ACTIVE_DAYS_KEY);
        const week1Days: string[] = rawDays ? JSON.parse(rawDays) : [];
        if (week1Days.length < MIN_WEEK1_ACTIVE_DAYS) return false;

        if (daysSinceInstall >= HARD_OVERRIDE_DAYS) return true;

        const lastViewedRaw = await AsyncStorage.getItem(LAST_PAYWALL_VIEWED_KEY);
        if (!lastViewedRaw) return true; // never viewed the paywall — eligible
        const lastViewed = Number(lastViewedRaw);
        if (!Number.isFinite(lastViewed)) return true;
        return differenceInCalendarDays(new Date(), new Date(lastViewed)) >= PAYWALL_RECENCY_DAYS;
    } catch {
        return false;
    }
}

/**
 * Randomly assigns (once, persisted forever after) whether this user is
 * held out from ever seeing the offer, regardless of eligibility — the
 * control group for measuring real incremental conversion lift.
 */
export async function isInNeverConvertedHoldout(): Promise<boolean> {
    try {
        const existing = await AsyncStorage.getItem(HOLDOUT_KEY);
        if (existing != null) return existing === 'true';
        const inHoldout = Math.random() < HOLDOUT_RATE;
        await AsyncStorage.setItem(HOLDOUT_KEY, String(inHoldout));
        return inHoldout;
    } catch {
        // Fail open — better to show the offer than silently lose the
        // whole feature to a storage error.
        return false;
    }
}
