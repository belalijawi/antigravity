import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RevenueCatService, { ENTITLEMENT_ID } from '../services/revenueCat';
import Purchases, { CustomerInfo } from 'react-native-purchases';
import { enforceReciterAccess } from '../utils/reciters';
import { setSuperProperties } from '../utils/analytics';
import type { FeatureId } from '../utils/featureDiscovery';

// Keyed by the expirationDate of the lapse we last surveyed, so a NEW
// cancellation after a future resubscribe still triggers the survey again —
// but the same lapse isn't re-asked every launch while it's pending.
const SURVEYED_KEY = 'cancellation-survey-surveyed-expiration-v1';

// Same dedup pattern as SURVEYED_KEY, but for the trial win-back popup —
// keyed by expirationDate so a fresh trial-cancel cycle pops it again, but
// re-opening the app during the same pending lapse doesn't show it twice.
const WINBACK_POPUP_SHOWN_KEY = 'trial-winback-popup-shown-expiration-v1';

// Android IAPs are now configured (RevenueCat Google key set in
// services/revenueCat.ts). Premium on Android is gated by a real subscription,
// same as iOS. Leave this false for production.
const ANDROID_FORCE_PREMIUM = false;
const IS_ANDROID_TEST_UNLOCK = Platform.OS === 'android' && ANDROID_FORCE_PREMIUM;

interface PurchasesContextType {
    isPremium: boolean;
    isLoading: boolean;
    /** True while the user is in a free trial that will NOT auto-renew —
     *  they've pre-cancelled and will silently lapse unless re-engaged. */
    trialLapsing: boolean;
    /** ISO date the current trial/subscription expires (null when unknown). */
    trialEndsAt: string | null;
    /** True whenever the user has a cancelled subscription — a trial or a
     *  paid one, either still lapsing (pre-expiration) or already fully
     *  expired — making them eligible for the win-back discount on ANY
     *  paywall open, not just the in-app banner or the follow-up
     *  notification tap. Apple/Google apply no eligibility restriction of
     *  their own on this specific offer, so the app is the only gate; this
     *  flag is that gate. Clears the instant they resubscribe. */
    trialWinbackEligible: boolean;
    /** The real win-back discount percentage off the monthly plan, computed
     *  from this user's own local-currency prices (both the regular price
     *  and the discounted price come from the store for their region) — not
     *  a hardcoded 40, since store price-tier rounding can shift the actual
     *  percentage slightly per country. Null while unavailable (offer not
     *  loaded yet, no network, etc.); callers should fall back to a generic
     *  number or generic copy. */
    trialWinbackPercentOff: number | null;
    /** True for engaged-but-never-subscribed users who qualify for the
     *  discounted-post-trial offer — see utils/neverConvertedOffer.ts for
     *  the full rule. Already accounts for the measurement holdout group:
     *  false for them regardless of underlying eligibility. */
    neverConvertedOfferEligible: boolean;
    paywallVisible: boolean;
    paywallSource: string;
    /** The specific feature that triggered this paywall, if any — lets the
     *  paywall highlight what the user actually tapped instead of showing
     *  only the generic feature list. */
    paywallFeatureId?: FeatureId;
    openPaywall: (source?: string, featureId?: FeatureId) => void;
    closePaywall: () => void;
    checkPremiumStatus: () => Promise<void>;
    /** True when a subscription (trial or paid) has just been cancelled and
     *  hasn't been surveyed yet — show the "what happened" reason picker. */
    showCancellationSurvey: boolean;
    dismissCancellationSurvey: () => void;
    /** True right after a free trial is cancelled — fires once per lapse,
     *  regardless of how many trial days remain, prompting the 40% win-back
     *  discount immediately rather than waiting until the trial nears
     *  expiration. Queued behind showCancellationSurvey so the two popups
     *  never show at once. */
    showTrialWinbackPopup: boolean;
    dismissTrialWinbackPopup: () => void;
}

const PurchasesContext = createContext<PurchasesContextType | undefined>(undefined);

export const usePurchases = () => {
    const context = useContext(PurchasesContext);
    if (!context) {
        throw new Error('usePurchases must be used within a PurchasesProvider');
    }
    return context;
};

export const PurchasesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // TEMPORARY: Start premium=true on Android so testers immediately see all
    // premium features unlocked. iOS still starts false and waits for RevenueCat.
    const [isPremium, setIsPremium] = useState<boolean>(IS_ANDROID_TEST_UNLOCK);
    const [isLoading, setIsLoading] = useState<boolean>(!IS_ANDROID_TEST_UNLOCK);
    const [trialLapsing, setTrialLapsing] = useState<boolean>(false);
    const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
    const [trialWinbackEligible, setTrialWinbackEligible] = useState<boolean>(false);
    const [trialWinbackPercentOff, setTrialWinbackPercentOff] = useState<number | null>(null);
    // Separate from trialWinbackEligible: this is for users who have used
    // the app for real but never trialed/subscribed AT ALL — see
    // utils/neverConvertedOffer.ts for the full eligibility rule. Already
    // false (not just unset) for anyone assigned to the measurement
    // holdout group, so no UI ever hints the offer exists to them.
    const [neverConvertedOfferEligible, setNeverConvertedOfferEligible] = useState<boolean>(false);
    const [showCancellationSurvey, setShowCancellationSurvey] = useState<boolean>(false);
    const [trialWinbackPopupPending, setTrialWinbackPopupPending] = useState<boolean>(false);

    // updateTrialState() runs from both checkPremiumStatus() and the
    // RevenueCat CustomerInfoUpdateListener, which can fire several times in
    // quick succession around a purchase/cancel — so calls to this function
    // can resolve out of order. Without this generation guard, an earlier
    // eligible=true call still awaiting getOfferings() could resolve AFTER a
    // later eligible=false call already cleared the state, "resurrecting" a
    // stale discount percentage right after the user resubscribed.
    const winbackPercentOffGenerationRef = useRef(0);
    const updateTrialWinbackPercentOff = async (eligible: boolean) => {
        const generation = ++winbackPercentOffGenerationRef.current;
        if (!eligible) {
            setTrialWinbackPercentOff(null);
            return;
        }
        try {
            const offerings = await RevenueCatService.getOfferings();
            const monthly = offerings?.availablePackages.find(
                (p) => p.packageType === 'MONTHLY' || p.identifier === '$rc_monthly'
            );
            if (!monthly || monthly.product.price <= 0) return;
            const discount = RevenueCatService.getTrialWinbackDiscount(monthly);
            const option = RevenueCatService.getTrialWinbackSubscriptionOption(monthly);
            const discountedPrice = discount
                ? discount.price
                : option
                    ? (option.pricingPhases[0]?.price.amountMicros ?? 0) / 1_000_000
                    : null;
            // Discard a stale result — a newer call has already superseded
            // this one (e.g. the user resubscribed while this was in flight).
            if (discountedPrice != null && generation === winbackPercentOffGenerationRef.current) {
                setTrialWinbackPercentOff(Math.round((1 - discountedPrice / monthly.product.price) * 100));
            }
        } catch { /* leave previous value — banner falls back to a default */ }
    };

    // Detect the "silent lapse" state: an active trial whose auto-renew is
    // already switched off. RevenueCat data showed a meaningful share of
    // trials in this state days before expiry — a save banner can re-engage.
    //
    // Also detects ANY cancellation (trial or paid, willRenew flips false) to
    // trigger a one-tap "what happened" survey — keyed by expirationDate so a
    // future resubscribe-then-cancel-again cycle surveys again, but the same
    // pending lapse doesn't re-ask on every launch.
    const updateTrialState = async (info: CustomerInfo) => {
        const ent: any = info.entitlements.active[ENTITLEMENT_ID];
        const isLapsingTrial = !!ent && ent.periodType === 'TRIAL' && ent.willRenew === false;
        setTrialLapsing(isLapsingTrial);
        setTrialEndsAt(ent?.expirationDate ?? null);

        // Win-back discount eligibility: ANY cancelled subscription makes the
        // user eligible — a cancelled free trial (never paid) OR a cancelled
        // paid subscription (trial converted, then cancelled later). Both
        // cases cover the pre-expiration lapsing state AND an already-fully-
        // expired/cancelled one. Unlike `.active`, `.all` retains the
        // entitlement's last-known state even after it stops being active,
        // so this is what lets a user who cancelled weeks ago still see the
        // discount on a completely ordinary paywall open — not just via the
        // trial banner (only shown pre-expiration, trial-only) or the one
        // specific follow-up notification (easy to miss/dismiss). It also
        // self-clears the moment they resubscribe: a fresh purchase flips
        // `willRenew` back to true, so this recomputes false on the very
        // next customerInfo update and every discount UI disappears.
        const allEnt: any = info.entitlements.all[ENTITLEMENT_ID];
        const hadCancelledSub = !!allEnt && allEnt.willRenew === false;
        const eligible = isLapsingTrial || hadCancelledSub;
        setTrialWinbackEligible(eligible);
        updateTrialWinbackPercentOff(eligible).catch(() => {});

        // Cancellation win-back nudge: relevant while EITHER a cancelled
        // trial OR a cancelled PAID subscription is still pending its real
        // expiration — matches trialWinbackEligible's own scope above, which
        // already covers both. Previously this push only fired for
        // isLapsingTrial, so someone who subscribed and then cancelled got
        // the in-app banner/paywall discount if they happened to reopen the
        // app, but was never proactively brought back — the one segment
        // that's already proven willing to pay got the weakest win-back
        // treatment. Reschedule against the real expiration every time
        // (self-corrects if the date shifts or they re-enable auto-renew),
        // cancel otherwise so a converted/renewing user never sees a "come
        // back" push while they're already paying.
        const isLapsingPaid = !!ent && ent.periodType !== 'TRIAL' && ent.willRenew === false;
        try {
            const { scheduleTrialWinbackNudge, cancelTrialWinbackNudge } = await import('../utils/trialWinback');
            if ((isLapsingTrial || isLapsingPaid) && ent.expirationDate) {
                await scheduleTrialWinbackNudge(new Date(ent.expirationDate));
            } else {
                await cancelTrialWinbackNudge();
            }
        } catch { /* never block on a notification-scheduling failure */ }

        // Native win-back reminder: only for a PAID cancellation, never a
        // trial-only one — Apple/Google's win-back offer requires real paid
        // history, so a trial-only lapse can never be eligible regardless of
        // how long we wait. See utils/nativeWinbackReminder.ts.
        try {
            const { scheduleNativeWinbackReminder, cancelNativeWinbackReminder } = await import('../utils/nativeWinbackReminder');
            if (isLapsingPaid && ent.expirationDate) {
                await scheduleNativeWinbackReminder(new Date(ent.expirationDate));
            } else {
                await cancelNativeWinbackReminder();
            }
        } catch { /* never block on a notification-scheduling failure */ }

        // Trial-ending reminder ("your trial ends in N days... cancel to
        // avoid a charge") is only accurate while a trial is genuinely still
        // pending conversion. If they've already cancelled (isLapsingTrial)
        // or the entitlement is no longer a TRIAL at all (converted to paid,
        // bought lifetime, or fully expired), that message is now false —
        // cancel it rather than let it fire referencing a stale state.
        if (isLapsingTrial || ent?.periodType !== 'TRIAL') {
            import('../utils/trialReminder').then(m => m.cancelTrialEndingReminder()).catch(() => {});
        }

        // Trial win-back popup: fires the moment a trial is cancelled, no
        // matter how many days are left on it (someone cancelling on day 1 of
        // a 7-day trial should see this immediately, not wait for day 6) —
        // isLapsingTrial has no day-count condition, so this can't lag behind
        // that. Deduped per expirationDate exactly like the survey below, so
        // it shows once per lapse, not on every subsequent app open.
        if (isLapsingTrial && ent.expirationDate) {
            try {
                const shownFor = await AsyncStorage.getItem(WINBACK_POPUP_SHOWN_KEY);
                if (shownFor !== ent.expirationDate) {
                    await AsyncStorage.setItem(WINBACK_POPUP_SHOWN_KEY, ent.expirationDate);
                    setTrialWinbackPopupPending(true);
                }
            } catch { /* ignore — popup is a nice-to-have, never block on it */ }
        } else {
            // Not (or no longer) a lapsing trial — either they resubscribed
            // without ever seeing the popup (e.g. renewed from the OS
            // Settings app directly) or the trial fully expired. Either way
            // a stale "pending" flag has no business resurfacing later, since
            // the persistent banners (gated on trialWinbackEligible) already
            // own the "keep reminding them" job.
            setTrialWinbackPopupPending(false);
        }

        const cancelled = !!ent && ent.willRenew === false && !!ent.expirationDate;
        if (!cancelled) return;
        try {
            const surveyed = await AsyncStorage.getItem(SURVEYED_KEY);
            if (surveyed === ent.expirationDate) return;
            await AsyncStorage.setItem(SURVEYED_KEY, ent.expirationDate);
            setShowCancellationSurvey(true);
        } catch { /* ignore — survey is a nice-to-have, never block on it */ }
    };

    const dismissCancellationSurvey = useCallback(() => setShowCancellationSurvey(false), []);
    const dismissTrialWinbackPopup = useCallback(() => setTrialWinbackPopupPending(false), []);
    // Queued behind the cancellation survey — both can fire off the same
    // cancel event, and showing two modals at once is broken UX. The popup
    // only actually appears once the survey isn't (or was never) showing;
    // dismissing the survey immediately reveals it if it was pending.
    const showTrialWinbackPopup = trialWinbackPopupPending && !showCancellationSurvey;

    // Re-checked whenever premium/trial-winback status changes — both must
    // be settled (not just "not yet loaded") before this can mean anything.
    // Purely local/AsyncStorage-based, so unlike trialWinbackEligible this
    // doesn't need to hang off the RevenueCat customer-info listener.
    const neverConvertedTrackedRef = useRef(false);
    useEffect(() => {
        if (isLoading) return;
        if (isPremium || trialWinbackEligible) {
            setNeverConvertedOfferEligible(false);
            return;
        }
        let cancelled = false;
        (async () => {
            const { checkNeverConvertedEligibility, isInNeverConvertedHoldout } = await import('../utils/neverConvertedOffer');
            const rawEligible = await checkNeverConvertedEligibility();
            if (cancelled) return;
            if (!rawEligible) {
                setNeverConvertedOfferEligible(false);
                return;
            }
            const inHoldout = await isInNeverConvertedHoldout();
            if (cancelled) return;
            setNeverConvertedOfferEligible(!inHoldout);
            // Previously this offer was purely passive (banner/paywall only) —
            // proactively nudge once eligibility is first confirmed, rather
            // than waiting for the user to happen to reopen the app. No-ops
            // after the first call ever, per device — see
            // utils/neverConvertedReminder.ts.
            if (!inHoldout) {
                import('../utils/neverConvertedReminder').then(m => m.scheduleNeverConvertedReminder()).catch(() => {});
            }
            // Fired once per determination (not on every re-render/app open)
            // so PostHog can compare the holdout vs. treatment group's
            // eventual conversion rate — the only way to know if this offer
            // is converting people who wouldn't have paid otherwise, versus
            // just pulling forward purchases that would've happened anyway.
            if (!neverConvertedTrackedRef.current) {
                neverConvertedTrackedRef.current = true;
                import('../utils/analytics').then(m => m.track('never_converted_offer_determined', { in_holdout: inHoldout })).catch(() => {});
            }
        })();
        return () => { cancelled = true; };
    }, [isLoading, isPremium, trialWinbackEligible]);

    const [paywallVisible, setPaywallVisible] = useState<boolean>(false);
    const [paywallSource, setPaywallSource] = useState<string>('unknown');
    const [paywallFeatureId, setPaywallFeatureId] = useState<FeatureId | undefined>(undefined);

    // openPaywall(source, featureId) — `source` tags WHERE the paywall was
    // triggered from (e.g. 'settings', 'streak_milestone', 'scheduled_5day',
    // 'feature_gate:hifz') so PostHog can answer "which entry points actually
    // convert?" `featureId`, when known, lets the paywall highlight the
    // specific feature the user tapped instead of showing only the generic list.
    const openPaywall = useCallback((source: string = 'unknown', featureId?: FeatureId) => {
        setPaywallSource(source);
        setPaywallFeatureId(featureId);
        setPaywallVisible(true);
    }, []);
    const closePaywall = useCallback(() => setPaywallVisible(false), []);

    // Keep `is_premium` current as a super property so every event
    // (not just purchase events) can be segmented by subscription status.
    useEffect(() => {
        if (!isLoading) {
            setSuperProperties({ is_premium: isPremium });
        }
    }, [isPremium, isLoading]);

    const checkPremiumStatus = useCallback(async () => {
        // Android test-unlock: skip all RevenueCat checks, always premium.
        if (IS_ANDROID_TEST_UNLOCK) {
            setIsPremium(true);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const hasPremium = await RevenueCatService.checkPremiumStatus();
            setIsPremium(hasPremium);
            try { await updateTrialState(await Purchases.getCustomerInfo()); } catch { /* ignore */ }
            // Lapse-protection: if user is no longer premium, revert any
            // premium-only reciter selection back to the free default.
            enforceReciterAccess(hasPremium).catch(() => { /* ignore */ });
        } catch {
            // Network error or RevenueCat unavailable — keep previous state
        } finally {
            setIsLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        // Android test-unlock: skip RevenueCat initialization entirely.
        // Avoids the empty-API-key path that would throw, and keeps everything
        // unlocked for the test build.
        if (IS_ANDROID_TEST_UNLOCK) {
            return;
        }

        // Defined outside init() so we hold a stable reference for removal
        const onCustomerInfoUpdate = (info: CustomerInfo) => {
            const hasPremium = typeof info.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
            setIsPremium(hasPremium);
            updateTrialState(info).catch(() => {});
            // Lapse-protection: if user is no longer premium, revert any
            // premium-only reciter selection back to the free default.
            enforceReciterAccess(hasPremium).catch(() => { /* ignore */ });
        };

        const init = async () => {
            await RevenueCatService.initialize();
            await checkPremiumStatus();
            Purchases.addCustomerInfoUpdateListener(onCustomerInfoUpdate);
        };

        init().catch(() => {});

        return () => {
            Purchases.removeCustomerInfoUpdateListener(onCustomerInfoUpdate);
        };
    }, []);

    // Without this, the provider value is a brand-new object every render —
    // consumed by 16 components (Home, NightCalculator, Tracker, QuranTab,
    // DuasTab, HistoryCalendar, etc.) — so every openPaywall()/closePaywall()
    // call re-renders all of them even though most only read `isPremium`.
    const value = useMemo(() => ({
        isPremium, isLoading, trialLapsing, trialEndsAt, trialWinbackEligible, trialWinbackPercentOff, neverConvertedOfferEligible, paywallVisible, paywallSource, paywallFeatureId,
        openPaywall, closePaywall, checkPremiumStatus, showCancellationSurvey, dismissCancellationSurvey,
        showTrialWinbackPopup, dismissTrialWinbackPopup,
    }), [isPremium, isLoading, trialLapsing, trialEndsAt, trialWinbackEligible, trialWinbackPercentOff, neverConvertedOfferEligible, paywallVisible, paywallSource, paywallFeatureId,
        openPaywall, closePaywall, checkPremiumStatus, showCancellationSurvey, dismissCancellationSurvey,
        showTrialWinbackPopup, dismissTrialWinbackPopup]);

    return (
        <PurchasesContext.Provider value={value}>
            {children}
        </PurchasesContext.Provider>
    );
};
