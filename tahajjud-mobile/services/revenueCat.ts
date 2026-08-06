import Purchases, { LOG_LEVEL, PurchasesOffering, CustomerInfo, PurchasesPackage, PurchasesWinBackOffer, PurchasesStoreProductDiscount, SubscriptionOption } from 'react-native-purchases';
import { Platform } from 'react-native';

const API_KEYS = {
    apple: 'appl_nyGORtabGsjtnLjpdnujergeIfI',
    google: 'goog_ILbOScqJKJZrSfvjRiMGVjPyosj',
};

// The name of the Entitlement you create in RevenueCat (e.g., 'Premium', 'Pro')
export const ENTITLEMENT_ID = 'Tahajjud+ Premium';

// App Store Connect Promotional Offer identifiers, one per subscription
// product — each product's offers live entirely on that product, so the
// monthly and annual discounts each need their own separately-configured
// offer in ASC. Unlike Win-Back Offers, Apple has no automatic eligibility
// check tied to paid history for either — usable by anyone with a
// subscription record (including a cancelled free trial that was never
// charged). Because of that, the app itself must be the one deciding when to
// look this up; see PurchasesContext.updateTrialState / Paywall.tsx
// (source === 'trial_winback').
const TRIAL_WINBACK_OFFER_IDS = [
    'monthly_promo_trialcancel_40off_2mo', // 40% off, 2 months
    'annual_promo_trialcancel_40off_1yr',  // 40% off, first year
];

// Google Play Console offer IDs for the same win-back promotion, one per
// base plan — "monthly" and "annual" each need their own offer configured
// in Play Console (eligibility "Developer determined"). Play does no
// automatic eligibility check for that eligibility type either — every
// configured offer just appears in product.subscriptionOptions regardless
// of who's asking — so exactly like iOS, the app itself decides when to
// look this up and offer it.
const TRIAL_WINBACK_OFFER_IDS_ANDROID = [
    'trial-winback-40off-2mo',  // base plan "monthly", 40% off, 2 months
    'trial-winback-40off-1yr',  // base plan "annual", 40% off, first year
];

// Engaged-but-never-subscribed offer (see utils/neverConvertedOffer.ts for
// the targeting rule) — the two platforms need genuinely DIFFERENT
// mechanisms here, not a shared one:
//
// iOS: Apple allows only ONE introductory offer per subscription group per
// user, so "free trial → then a discounted price" can't be configured as a
// single offer on a NEW subscriber's product — confirmed against current
// RevenueCat/Apple docs, not assumed. The only way to give this segment a
// real discount is a genuinely SEPARATE product with NO trial phase — the
// discount itself, shown upfront, is the entire offer. (This is also the
// better choice on its own merits: this segment already knows the app from
// a week+ of free use, so a trial doesn't address their actual hesitation
// the way a visible price cut does.)
//
// Android: Play Billing DOES support a two-phase offer (free trial, THEN a
// discounted recurring price, then the base plan price) as ONE offer on the
// EXISTING product — no new product needed, same as the win-back IDs below.
// Play's own checkout UI won't display both phases attractively on its own
// (no strikethrough/comparison), so Paywall.tsx builds that display itself
// from the raw pricingPhases data, same as it already does for win-back.
//
// PLACEHOLDER IDENTIFIERS on both — swap for the real ones once created in
// App Store Connect + Play Console. Until then, both lookups below simply
// find nothing and the standard package is shown instead.
export const NEVER_CONVERTED_OFFER_PRODUCT_IDS_IOS = [
    'monthly_never_converted_promo', // discounted price, no trial
    'annual_never_converted_promo',  // discounted price, no trial
];
const NEVER_CONVERTED_OFFER_IDS_ANDROID = [
    'never-converted-trial-then-40off-2mo', // base plan "monthly": 7-day trial, then 40% off 2mo
    'never-converted-trial-then-40off-1yr', // base plan "annual": 7-day trial, then 40% off 1yr
];

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
        return pkg.product.discounts?.find((d) => TRIAL_WINBACK_OFFER_IDS.includes(d.identifier)) ?? null;
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
     * The trial-cancel win-back offer for `pkg` on Google Play, if any of the
     * known base-plan/offer combos is present in this product's
     * subscriptionOptions. This is the actual purchasable option (unlike
     * iOS's discount-then-fetch-signed-offer split, Android offers don't
     * need a separate signing step). Android only.
     */
    static getTrialWinbackSubscriptionOption(pkg: PurchasesPackage): SubscriptionOption | null {
        if (Platform.OS !== 'android') return null;
        return pkg.product.subscriptionOptions?.find((o) =>
            TRIAL_WINBACK_OFFER_IDS_ANDROID.some((id) => o.id.endsWith(`:${id}`))
        ) ?? null;
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
     * iOS: the engaged-but-never-subscribed offer package, if configured —
     * see NEVER_CONVERTED_OFFER_PRODUCT_IDS_IOS's comment for why this is a
     * whole separate (trial-less, discount-only) product rather than a
     * discount/offer object on the standard one. Just a normal package once
     * found: no signing step — purchase it with the regular purchasePackage()
     * below, same as any other package. iOS only; Android uses the
     * subscription-option path below instead.
     */
    static getNeverConvertedPackage(offering: PurchasesOffering | null, isAnnual: boolean): PurchasesPackage | null {
        if (Platform.OS !== 'ios' || !offering) return null;
        const targetId = isAnnual ? NEVER_CONVERTED_OFFER_PRODUCT_IDS_IOS[1] : NEVER_CONVERTED_OFFER_PRODUCT_IDS_IOS[0];
        return offering.availablePackages.find((p) => p.product.identifier === targetId) ?? null;
    }

    /**
     * Android: the engaged-but-never-subscribed offer for `pkg`, if the
     * known trial-then-discount offer is present in this product's
     * subscriptionOptions — see NEVER_CONVERTED_OFFER_IDS_ANDROID's comment.
     * Unlike iOS this attaches to the EXISTING product as a second offer, so
     * there's no separate "package" to swap in — purchase this option
     * directly with purchaseWithSubscriptionOption() above. Android only.
     */
    static getNeverConvertedSubscriptionOption(pkg: PurchasesPackage): SubscriptionOption | null {
        if (Platform.OS !== 'android') return null;
        return pkg.product.subscriptionOptions?.find((o) =>
            NEVER_CONVERTED_OFFER_IDS_ANDROID.some((id) => o.id.endsWith(`:${id}`))
        ) ?? null;
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
