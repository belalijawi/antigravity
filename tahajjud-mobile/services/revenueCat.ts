import Purchases, { LOG_LEVEL, PurchasesOffering, CustomerInfo, PurchasesPackage, PurchasesWinBackOffer } from 'react-native-purchases';
import { Platform } from 'react-native';

const API_KEYS = {
    apple: 'appl_nyGORtabGsjtnLjpdnujergeIfI',
    google: 'goog_ILbOScqJKJZrSfvjRiMGVjPyosj',
};

// The name of the Entitlement you create in RevenueCat (e.g., 'Premium', 'Pro')
export const ENTITLEMENT_ID = 'Tahajjud+ Premium';

class RevenueCatService {
    /**
     * Initialize the RevenueCat SDK
     */
    static async initialize() {
        try {
            if (Platform.OS === 'ios' && API_KEYS.apple) {
                Purchases.configure({ apiKey: API_KEYS.apple });
            } else if (Platform.OS === 'android' && API_KEYS.google) {
                Purchases.configure({ apiKey: API_KEYS.google });
            }

            Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);
        } catch (error) {
            console.error('Error initializing RevenueCat:', error);
        }
    }

    /**
     * Fetch currently available Products/Offerings
     */
    static async getOfferings(): Promise<PurchasesOffering | null> {
        try {
            const offerings = await Purchases.getOfferings();
            if (offerings.current !== null && offerings.current.availablePackages.length !== 0) {
                return offerings.current;
            }
            return null;
        } catch (error) {
            console.error('Error fetching offerings:', error);
            return null;
        }
    }

    /**
     * Purchase a specific package
     */
    static async purchasePackage(pkg: any): Promise<CustomerInfo | null> {
        try {
            const { customerInfo } = await Purchases.purchasePackage(pkg);
            return customerInfo;
        } catch (e: any) {
            if (!e.userCancelled) {
                console.error('Error making purchase:', e);
            }
            return null;
        }
    }

    /**
     * Apple's native Win-Back Offers (StoreKit 2) — Apple determines eligibility
     * itself from the subscriber's cancellation history, so there's no signature
     * to generate and no manual RevenueCat-dashboard mapping: whatever offer is
     * configured for this product in App Store Connect just shows up here once
     * the user qualifies. iOS only — Android eligibility is instead configured
     * directly on the Play Console offer (targeting "not currently subscribed"),
     * so a discounted price simply appears on the package itself with no
     * separate lookup needed.
     */
    static async getEligibleWinBackOffer(pkg: PurchasesPackage): Promise<PurchasesWinBackOffer | null> {
        if (Platform.OS !== 'ios') return null;
        try {
            const offers = await Purchases.getEligibleWinBackOffersForPackage(pkg);
            return offers && offers.length > 0 ? offers[0] : null;
        } catch (error) {
            console.error('Error fetching win-back offer:', error);
            return null;
        }
    }

    /** Purchase a package with a win-back offer applied (iOS only). */
    static async purchaseWithWinBackOffer(pkg: PurchasesPackage, offer: PurchasesWinBackOffer): Promise<CustomerInfo | null> {
        try {
            const { customerInfo } = await Purchases.purchasePackageWithWinBackOffer(pkg, offer);
            return customerInfo;
        } catch (e: any) {
            if (!e.userCancelled) {
                console.error('Error making win-back purchase:', e);
            }
            return null;
        }
    }

    /**
     * Restore previous purchases
     */
    static async restorePurchases(): Promise<CustomerInfo | null> {
        try {
            const customerInfo = await Purchases.restorePurchases();
            return customerInfo;
        } catch (error) {
            console.error('Error restoring purchases:', error);
            return null;
        }
    }

    /**
     * Check if the user has an active premium entitlement
     */
    static async checkPremiumStatus(): Promise<boolean> {
        try {
            const customerInfo = await Purchases.getCustomerInfo();
            return typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
        } catch (error) {
            console.error('Error checking premium status:', error);
            return false;
        }
    }
}

export default RevenueCatService;
