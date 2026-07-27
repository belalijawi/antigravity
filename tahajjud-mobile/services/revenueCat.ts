import Purchases, { LOG_LEVEL, PurchasesOffering, CustomerInfo, PurchasesPackage, PurchasesWinBackOffer, PurchasesStoreProductDiscount, SubscriptionOption } from 'react-native-purchases';
import { Platform } from 'react-native';

const API_KEYS = {
    apple: 'appl_nyGORtabGsjtnLjpdnujergeIfI',
    google: 'goog_ILbOScqJKJZrSfvjRiMGVjPyosj',
};

// The name of the Entitlement you create in RevenueCat (e.g., 'Premium', 'Pro')
export const ENTITLEMENT_ID = 'Tahajjud+ Premium';

// App Store Connect Promotional Offer identifier for the monthly plan, 40%
// off for 2 months. Unlike Win-Back Offers, Apple has no automatic eligibility
// check tied to paid history — it's usable by anyone with a subscription
// record (including a cancelled free trial that was never charged). Because
// of that, the app itself must be the one deciding when to look this up; see
// PurchasesContext.updateTrialState / Paywall.tsx (source === 'trial_winback').
const TRIAL_WINBACK_OFFER_ID = 'monthly_promo_trialcancel_40off_2mo';

// Google Play Console offer ID for the same win-back promotion (base plan
// "monthly", offer "trial-winback-40off-2mo", eligibility "Developer
// determined"). Play does no automatic eligibility check for that
// eligibility type either — every configured offer just appears in
// product.subscriptionOptions regardless of who's asking — so exactly like
// iOS, the app itself decides when to look this up and offer it.
const TRIAL_WINBACK_OFFER_ID_ANDROID = 'trial-winback-40off-2mo';

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
     * The trial-cancel win-back discount for `pkg`, if App Store Connect has
     * one configured on the product — this is just the local, unsigned
     * discount metadata (price/cycles) for display; it does NOT mean this
     * user is eligible. iOS only.
     */
    static getTrialWinbackDiscount(pkg: PurchasesPackage): PurchasesStoreProductDiscount | null {
        if (Platform.OS !== 'ios') return null;
        return pkg.product.discounts?.find((d) => d.identifier === TRIAL_WINBACK_OFFER_ID) ?? null;
    }

    /**
     * Purchase `pkg` with the trial win-back promotional offer applied.
     * Fetches a freshly-signed offer right before purchasing (per RevenueCat
     * guidance — the signature is short-lived) rather than reusing one from
     * an earlier lookup. Returns null both on user cancellation and on
     * ineligibility (Apple simply won't sign an offer for this account).
     */
    static async purchaseWithTrialWinbackOffer(pkg: PurchasesPackage, discount: PurchasesStoreProductDiscount): Promise<CustomerInfo | null> {
        try {
            const offer = await Purchases.getPromotionalOffer(pkg.product, discount);
            if (!offer) return null;
            const { customerInfo } = await Purchases.purchaseDiscountedPackage(pkg, offer);
            return customerInfo;
        } catch (e: any) {
            if (!e.userCancelled) {
                console.error('Error making trial win-back purchase:', e);
            }
            return null;
        }
    }

    /**
     * The trial-cancel win-back offer for `pkg` on Google Play, if the
     * "monthly:trial-winback-40off-2mo" base-plan/offer combo is present in
     * this product's subscriptionOptions. This is the actual purchasable
     * option (unlike iOS's discount-then-fetch-signed-offer split, Android
     * offers don't need a separate signing step). Android only.
     */
    static getTrialWinbackSubscriptionOption(pkg: PurchasesPackage): SubscriptionOption | null {
        if (Platform.OS !== 'android') return null;
        return pkg.product.subscriptionOptions?.find((o) => o.id.endsWith(`:${TRIAL_WINBACK_OFFER_ID_ANDROID}`)) ?? null;
    }

    /** Purchase a specific Google Play SubscriptionOption (e.g. the trial win-back offer). */
    static async purchaseWithSubscriptionOption(option: SubscriptionOption): Promise<CustomerInfo | null> {
        try {
            const { customerInfo } = await Purchases.purchaseSubscriptionOption(option);
            return customerInfo;
        } catch (e: any) {
            if (!e.userCancelled) {
                console.error('Error making Android trial win-back purchase:', e);
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
