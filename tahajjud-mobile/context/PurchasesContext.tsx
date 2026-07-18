import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RevenueCatService, { ENTITLEMENT_ID } from '../services/revenueCat';
import Purchases, { CustomerInfo } from 'react-native-purchases';
import { enforceReciterAccess } from '../utils/reciters';
import { setSuperProperties } from '../utils/analytics';

// Keyed by the expirationDate of the lapse we last surveyed, so a NEW
// cancellation after a future resubscribe still triggers the survey again —
// but the same lapse isn't re-asked every launch while it's pending.
const SURVEYED_KEY = 'cancellation-survey-surveyed-expiration-v1';

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
    paywallVisible: boolean;
    paywallSource: string;
    openPaywall: (source?: string) => void;
    closePaywall: () => void;
    checkPremiumStatus: () => Promise<void>;
    /** True when a subscription (trial or paid) has just been cancelled and
     *  hasn't been surveyed yet — show the "what happened" reason picker. */
    showCancellationSurvey: boolean;
    dismissCancellationSurvey: () => void;
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
    const [showCancellationSurvey, setShowCancellationSurvey] = useState<boolean>(false);

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
        setTrialLapsing(!!ent && ent.periodType === 'TRIAL' && ent.willRenew === false);
        setTrialEndsAt(ent?.expirationDate ?? null);

        const cancelled = !!ent && ent.willRenew === false && !!ent.expirationDate;
        if (!cancelled) return;
        try {
            const surveyed = await AsyncStorage.getItem(SURVEYED_KEY);
            if (surveyed === ent.expirationDate) return;
            await AsyncStorage.setItem(SURVEYED_KEY, ent.expirationDate);
            setShowCancellationSurvey(true);
        } catch { /* ignore — survey is a nice-to-have, never block on it */ }
    };

    const dismissCancellationSurvey = () => setShowCancellationSurvey(false);
    const [paywallVisible, setPaywallVisible] = useState<boolean>(false);
    const [paywallSource, setPaywallSource] = useState<string>('unknown');

    // openPaywall(source) — `source` tags WHERE the paywall was triggered from
    // (e.g. 'settings', 'streak_milestone', 'scheduled_5day', 'feature_gate:hifz')
    // so PostHog can answer "which entry points actually convert?"
    const openPaywall = (source: string = 'unknown') => {
        setPaywallSource(source);
        setPaywallVisible(true);
    };
    const closePaywall = () => setPaywallVisible(false);

    // Keep `is_premium` current as a super property so every event
    // (not just purchase events) can be segmented by subscription status.
    useEffect(() => {
        if (!isLoading) {
            setSuperProperties({ is_premium: isPremium });
        }
    }, [isPremium, isLoading]);

    const checkPremiumStatus = async () => {
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
    };

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

        init();

        return () => {
            Purchases.removeCustomerInfoUpdateListener(onCustomerInfoUpdate);
        };
    }, []);

    return (
        <PurchasesContext.Provider value={{ isPremium, isLoading, trialLapsing, trialEndsAt, paywallVisible, paywallSource, openPaywall, closePaywall, checkPremiumStatus, showCancellationSurvey, dismissCancellationSurvey }}>
            {children}
        </PurchasesContext.Provider>
    );
};
