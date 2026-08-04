import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
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
    const [showCancellationSurvey, setShowCancellationSurvey] = useState<boolean>(false);
    const [trialWinbackPopupPending, setTrialWinbackPopupPending] = useState<boolean>(false);

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
        setTrialWinbackEligible(isLapsingTrial || hadCancelledSub);

        // Trial win-back nudge: only relevant while a cancelled trial is
        // still pending its real expiration — reschedule against it every
        // time (self-corrects if the date shifts or they re-enable
        // auto-renew), cancel otherwise so a converted/renewing user never
        // sees a "come back" push while they're already paying.
        try {
            const { scheduleTrialWinbackNudge, cancelTrialWinbackNudge } = await import('../utils/trialWinback');
            if (isLapsingTrial && ent.expirationDate) {
                await scheduleTrialWinbackNudge(new Date(ent.expirationDate));
            } else {
                await cancelTrialWinbackNudge();
            }
        } catch { /* never block on a notification-scheduling failure */ }

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
        isPremium, isLoading, trialLapsing, trialEndsAt, trialWinbackEligible, paywallVisible, paywallSource, paywallFeatureId,
        openPaywall, closePaywall, checkPremiumStatus, showCancellationSurvey, dismissCancellationSurvey,
        showTrialWinbackPopup, dismissTrialWinbackPopup,
    }), [isPremium, isLoading, trialLapsing, trialEndsAt, trialWinbackEligible, paywallVisible, paywallSource, paywallFeatureId,
        openPaywall, closePaywall, checkPremiumStatus, showCancellationSurvey, dismissCancellationSurvey,
        showTrialWinbackPopup, dismissTrialWinbackPopup]);

    return (
        <PurchasesContext.Provider value={value}>
            {children}
        </PurchasesContext.Provider>
    );
};
