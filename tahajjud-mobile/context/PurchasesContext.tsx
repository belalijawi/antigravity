import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import RevenueCatService, { ENTITLEMENT_ID } from '../services/revenueCat';
import Purchases, { CustomerInfo } from 'react-native-purchases';
import { enforceReciterAccess } from '../utils/reciters';

// ⚠️ TEMPORARY: Android premium-unlock-for-testing toggle ────────────────────
// While Android IAPs are not yet configured (Play Console subscriptions +
// RevenueCat Google API key are still being set up), every premium feature
// is unlocked for free on Android so testers can validate the full app.
// REMOVE THIS BEFORE PRODUCTION RELEASE — set to false (or delete the const)
// once `services/revenueCat.ts` has a real `goog_xxx` key and Play Console
// products are live.
const ANDROID_FORCE_PREMIUM = true;
const IS_ANDROID_TEST_UNLOCK = Platform.OS === 'android' && ANDROID_FORCE_PREMIUM;

interface PurchasesContextType {
    isPremium: boolean;
    isLoading: boolean;
    paywallVisible: boolean;
    openPaywall: () => void;
    closePaywall: () => void;
    checkPremiumStatus: () => Promise<void>;
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
    const [paywallVisible, setPaywallVisible] = useState<boolean>(false);

    const openPaywall = () => setPaywallVisible(true);
    const closePaywall = () => setPaywallVisible(false);

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
        <PurchasesContext.Provider value={{ isPremium, isLoading, paywallVisible, openPaywall, closePaywall, checkPremiumStatus }}>
            {children}
        </PurchasesContext.Provider>
    );
};
