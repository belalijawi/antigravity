import Purchases, { LOG_LEVEL, PurchasesOffering, CustomerInfo } from 'react-native-purchases';
import { Platform } from 'react-native';

const API_KEYS = {
    apple: 'appl_nyGORtabGsjtnLjpdnujergeIfI',
    google: '',
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

            Purchases.setLogLevel(LOG_LEVEL.DEBUG); // Helpful during development
            console.log('RevenueCat initialized successfully.');
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
