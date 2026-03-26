import React, { createContext, useContext, useEffect, useState } from 'react';
import RevenueCatService, { ENTITLEMENT_ID } from '../services/revenueCat';
import Purchases from 'react-native-purchases';

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
    const [isPremium, setIsPremium] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [paywallVisible, setPaywallVisible] = useState<boolean>(false);

    const openPaywall = () => setPaywallVisible(true);
    const closePaywall = () => setPaywallVisible(false);

    const checkPremiumStatus = async () => {
        setIsLoading(true);
        const hasPremium = await RevenueCatService.checkPremiumStatus();
        setIsPremium(hasPremium);
        setIsLoading(false);
    };

    useEffect(() => {
        const init = async () => {
            await RevenueCatService.initialize();
            await checkPremiumStatus();

            Purchases.addCustomerInfoUpdateListener((info) => {
                const hasPremium = typeof info.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
                setIsPremium(hasPremium);
            });
        };

        init();

        return () => {
            Purchases.removeCustomerInfoUpdateListener(() => { });
        };
    }, []);

    return (
        <PurchasesContext.Provider value={{ isPremium, isLoading, paywallVisible, openPaywall, closePaywall, checkPremiumStatus }}>
            {children}
        </PurchasesContext.Provider>
    );
};
