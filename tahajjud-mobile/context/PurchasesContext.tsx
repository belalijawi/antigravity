import React, { createContext, useContext, useEffect, useState } from 'react';
import RevenueCatService from '../services/revenueCat';
import Purchases from 'react-native-purchases';

interface PurchasesContextType {
    isPremium: boolean;
    isLoading: boolean;
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

    const checkPremiumStatus = async () => {
        setIsLoading(true);
        const hasPremium = await RevenueCatService.checkPremiumStatus();
        setIsPremium(hasPremium);
        setIsLoading(false);
    };

    useEffect(() => {
        const init = async () => {
            // Initialize the SDK
            await RevenueCatService.initialize();

            // Check initial status
            await checkPremiumStatus();

            // Add listener for automatic updates if purchase status changes in the background
            Purchases.addCustomerInfoUpdateListener((info) => {
                const hasPremium = typeof info.entitlements.active[RevenueCatService.ENTITLEMENT_ID] !== 'undefined';
                setIsPremium(hasPremium);
            });
        };

        init();

        return () => {
            Purchases.removeCustomerInfoUpdateListener(() => { });
        };
    }, []);

    return (
        <PurchasesContext.Provider value={{ isPremium, isLoading, checkPremiumStatus }}>
            {children}
        </PurchasesContext.Provider>
    );
};
