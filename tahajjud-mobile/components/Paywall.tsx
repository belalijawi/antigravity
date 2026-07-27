import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
    ActivityIndicator,
    Platform,
    Alert,
    Linking,
} from 'react-native';
import { X, Check, Star, Moon, CalendarDays, WifiOff, Brain, Users, MapPin, BellRing, BarChart3, Repeat, PenLine, Globe, Trophy } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import RevenueCatService, { ENTITLEMENT_ID } from '../services/revenueCat';
import { usePurchases } from '../context/PurchasesContext';
import { useTheme } from '../context/ThemeContext';
import { PurchasesPackage, PurchasesWinBackOffer, PurchasesStoreProductDiscount, SubscriptionOption } from 'react-native-purchases';
import { APP_URLS } from '../utils/urls';
import { track } from '../utils/analytics';
import { t } from '../utils/i18n';
import type { FeatureId } from '../utils/featureDiscovery';

interface PaywallProps {
    onClose: () => void;
    /** Where this paywall presentation was triggered from, e.g. 'settings',
     *  'streak_milestone', 'scheduled_5day', 'onboarding', 'feature_gate:hifz'.
     *  Lets PostHog answer "which entry points actually convert?" */
    source?: string;
    /** The specific premium feature that was tapped to get here, if any —
     *  shown as a highlighted callout above the generic feature list so the
     *  paywall isn't a cold, undifferentiated wall regardless of what the
     *  user was actually curious about. */
    featureId?: FeatureId;
}

// Icon per premium feature — reuses the same icons the generic list below
// already uses where they line up, so the highlighted card doesn't clash.
const FEATURE_ICONS: Record<FeatureId, React.ReactElement> = {
    mosque_timetable: <MapPin size={22} color="#fff" />,
    accountability_partner: <Users size={22} color="#fff" />,
    hifz_mode: <Brain size={22} color="#fff" />,
    tasbeeh_stats: <Repeat size={22} color="#fff" />,
    prayer_analytics: <BarChart3 size={22} color="#fff" />,
    night_journal: <PenLine size={22} color="#fff" />,
    dua_wall: <Star size={22} color="#fff" />,
    global_map: <MapPin size={22} color="#fff" />,
    qibla: <MapPin size={22} color="#fff" />,
    challenges: <Star size={22} color="#fff" />,
    testimonies: <Star size={22} color="#fff" />,
    widget: <Star size={22} color="#fff" />,
    dua_replies: <PenLine size={22} color="#fff" />,
    dua_map_pin: <Globe size={22} color="#fff" />,
    country_leaderboard: <Trophy size={22} color="#fff" />,
    leaderboard: <Trophy size={22} color="#fff" />,
};

const Paywall: React.FC<PaywallProps> = ({ onClose, source = 'unknown', featureId }) => {
    const [packages, setPackages] = useState<PurchasesPackage[]>([]);
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState(false);
    const [converted, setConverted] = useState(false);
    // Win-back offers, keyed by package identifier — only populated when this
    // paywall was opened from a win-back notification tap (source === 'winback')
    // and the subscriber is actually eligible per App Store Connect / Play Console.
    const [winBackOffers, setWinBackOffers] = useState<Record<string, PurchasesWinBackOffer>>({});
    // Trial-cancel win-back discount (Promotional Offer), keyed by package
    // identifier — only populated when opened from that specific notification
    // (source === 'trial_winback'). Apple applies no automatic eligibility
    // gate here (unlike Win-Back Offers), so this is just the local discount
    // metadata for display; actual eligibility is checked at purchase time.
    const [trialWinbackDiscounts, setTrialWinbackDiscounts] = useState<Record<string, PurchasesStoreProductDiscount>>({});
    // Same offer, Android shape — Google Play's SubscriptionOption instead of
    // a discount-then-sign split. Also only populated for source === 'trial_winback'.
    const [trialWinbackOptions, setTrialWinbackOptions] = useState<Record<string, SubscriptionOption>>({});
    const { isPremium, checkPremiumStatus } = usePurchases();
    const { colors } = useTheme();

    useEffect(() => {
        loadOfferings();
        track('paywall_viewed', { source });
        // Fires only if the paywall unmounts WITHOUT a completed purchase —
        // i.e. the user closed it. Pairs with paywall_viewed for a true
        // view -> dismiss / convert funnel per source.
        return () => {
            if (!converted) {
                track('paywall_dismissed', { source });
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadOfferings = async () => {
        setLoading(true);
        const offerings = await RevenueCatService.getOfferings();
        if (offerings) {
            console.log('[Paywall] availablePackages:', offerings.availablePackages.map(p => ({
                identifier: p.identifier,
                packageType: p.packageType,
                productId: p.product.identifier,
                price: p.product.priceString,
            })));
            setPackages(offerings.availablePackages);

            // Only worth checking win-back eligibility when the user actually
            // arrived via a win-back notification — avoids a needless
            // StoreKit round-trip for every other paywall open.
            if (source === 'winback') {
                const entries = await Promise.all(offerings.availablePackages.map(async (pkg) => {
                    const offer = await RevenueCatService.getEligibleWinBackOffer(pkg);
                    return [pkg.identifier, offer] as const;
                }));
                const found = Object.fromEntries(entries.filter(([, offer]) => !!offer)) as Record<string, PurchasesWinBackOffer>;
                setWinBackOffers(found);
                if (Object.keys(found).length > 0) {
                    track('winback_offer_shown', { packages: Object.keys(found).join(',') });
                }
            }

            // Same idea for the trial-cancel win-back offer, but no round-trip
            // needed on either platform — the offer metadata is already on
            // the local product, we just filter for our offer identifier.
            if (source === 'trial_winback') {
                const discountEntries = offerings.availablePackages
                    .map((pkg) => [pkg.identifier, RevenueCatService.getTrialWinbackDiscount(pkg)] as const)
                    .filter(([, discount]) => !!discount) as [string, PurchasesStoreProductDiscount][];
                setTrialWinbackDiscounts(Object.fromEntries(discountEntries));

                const optionEntries = offerings.availablePackages
                    .map((pkg) => [pkg.identifier, RevenueCatService.getTrialWinbackSubscriptionOption(pkg)] as const)
                    .filter(([, option]) => !!option) as [string, SubscriptionOption][];
                setTrialWinbackOptions(Object.fromEntries(optionEntries));

                const shownPackages = [...discountEntries.map(([id]) => id), ...optionEntries.map(([id]) => id)];
                if (shownPackages.length > 0) {
                    track('trial_winback_offer_shown', { packages: shownPackages.join(',') });
                }
            }
        } else {
            console.log('[Paywall] No offering returned from RevenueCat');
        }
        setLoading(false);
    };

    const handlePurchase = async (pkg: PurchasesPackage) => {
        setPurchasing(true);
        const winBackOffer = winBackOffers[pkg.identifier];
        const trialWinbackDiscount = trialWinbackDiscounts[pkg.identifier];
        const trialWinbackOption = trialWinbackOptions[pkg.identifier];
        const via = winBackOffer ? 'winback_offer' : (trialWinbackDiscount || trialWinbackOption) ? 'trial_winback_offer' : 'standard';
        track('purchase_started', { package: pkg.identifier, source, via });
        try {
            const customerInfo = winBackOffer
                ? await RevenueCatService.purchaseWithWinBackOffer(pkg, winBackOffer)
                : trialWinbackDiscount
                    ? await RevenueCatService.purchaseWithTrialWinbackOffer(pkg, trialWinbackDiscount)
                    : trialWinbackOption
                        ? await RevenueCatService.purchaseWithSubscriptionOption(trialWinbackOption)
                        : await RevenueCatService.purchasePackage(pkg);
            if (customerInfo) {
                const price = winBackOffer
                    ? winBackOffer.price
                    : trialWinbackDiscount
                        ? trialWinbackDiscount.price
                        : trialWinbackOption
                            ? (trialWinbackOption.pricingPhases[0]?.price.amountMicros ?? 0) / 1_000_000
                            : pkg.product.price;
                track('purchase_completed', { package: pkg.identifier, source, price, currency: pkg.product.currencyCode, via });
                setConverted(true);
                // If this was a free-trial purchase, schedule the "trial ends soon"
                // reminder so the paywall's promise is genuinely kept.
                const intro: any = (pkg.product as any).introPrice;
                if (intro && intro.price === 0) {
                    const n = intro.periodNumberOfUnits ?? 1;
                    const unitDays: Record<string, number> = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 };
                    const perUnit = unitDays[intro.periodUnit] ?? 7; // default to a week if unknown
                    const trialDays = n * perUnit;
                    const { scheduleTrialEndingReminder } = await import('../utils/trialReminder');
                    scheduleTrialEndingReminder(trialDays).catch(() => {});
                }
                await checkPremiumStatus();
                onClose();
                Alert.alert(t('paywall.welcomeTitle'), t('paywall.welcomeBody'));
            } else {
                // null = user cancelled — no alert needed, just dismiss spinner
                track('purchase_cancelled', { package: pkg.identifier, source });
            }
        } catch (e: any) {
            track('purchase_failed', { package: pkg.identifier, source, error: String(e?.code ?? e?.message ?? 'unknown') });
            Alert.alert(t('paywall.purchaseFailedTitle'), t('paywall.checkConnectionBody'));
        } finally {
            setPurchasing(false);
        }
    };

    const handleRestore = async () => {
        setPurchasing(true);
        track('restore_started', { source });
        try {
            const customerInfo = await RevenueCatService.restorePurchases();
            if (customerInfo) {
                await checkPremiumStatus();
                if (typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== 'undefined') {
                    track('restore_succeeded', { source });
                    setConverted(true);
                    Alert.alert(t('paywall.restoredTitle'), t('paywall.restoredBody'));
                    onClose();
                } else {
                    track('restore_no_subscription', { source });
                    Alert.alert(t('paywall.noSubscriptionTitle'), t('paywall.noSubscriptionBody', { account: Platform.OS === 'ios' ? 'Apple ID' : t('paywall.googleAccount') }));
                }
            } else {
                track('restore_failed', { source });
                Alert.alert(t('paywall.restoreFailedTitle'), t('paywall.checkConnectionBody'));
            }
        } catch {
            track('restore_failed', { source });
            Alert.alert(t('paywall.restoreFailedTitle'), t('paywall.checkConnectionBody'));
        } finally {
            setPurchasing(false);
        }
    };

    const features = [
        {
            icon: <Moon size={20} color={colors.accent} />,
            title: t('paywall.f1t'),
            desc: t('paywall.f1d'),
        },
        {
            icon: <CalendarDays size={20} color={colors.accent} />,
            title: t('paywall.f2t'),
            desc: t('paywall.f2d'),
        },
        {
            icon: <Users size={20} color={colors.accent} />,
            title: t('paywall.f3t'),
            desc: t('paywall.f3d'),
        },
        {
            icon: <WifiOff size={20} color={colors.accent} />,
            title: t('paywall.f4t'),
            desc: t('paywall.f4d'),
        },
        {
            icon: <Brain size={20} color={colors.accent} />,
            title: t('paywall.f5t'),
            desc: t('paywall.f5d'),
        },
        {
            icon: <MapPin size={20} color={colors.accent} />,
            title: t('paywall.f6t'),
            desc: t('paywall.f6d'),
        },
        {
            icon: <Star size={20} color={colors.accent} />,
            title: t('paywall.f7t'),
            desc: t('paywall.f7d'),
        },
        {
            icon: <Star size={20} color={colors.accent} />,
            title: t('paywall.f8t'),
            desc: t('paywall.f8d'),
        },
        // Both of these are gated as premium (see utils/featureDiscovery.ts)
        // but were missing from this list, so unless you happened to reach the
        // paywall from that exact feature — the only other place they appear
        // is the highlighted card above — you were being charged for two
        // things the paywall never mentioned.
        {
            icon: <Globe size={20} color={colors.accent} />,
            title: t('paywall.f9t'),
            desc: t('paywall.f9d'),
        },
        {
            icon: <PenLine size={20} color={colors.accent} />,
            title: t('paywall.f10t'),
            desc: t('paywall.f10d'),
        },
    ];

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#fff" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <X color="#fff" size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Tahajjud+</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.heroSection}>
                    <Star color={colors.accent} size={48} fill={colors.accent} style={styles.heroIcon} />
                    <Text style={styles.heroTitle}>{t('paywall.heroTitle')}</Text>
                    <Text style={styles.heroSubtitle}>{t('paywall.heroSubtitle')}</Text>
                    <Text style={[styles.heroTrial, { color: colors.accent }]}>{t('paywall.heroTrial')}</Text>
                    {/* During onboarding many users read this screen as "the
                        app is paid" and bounce — say plainly, above the fold,
                        that the core app costs nothing. */}
                    {source === 'onboarding' && (
                        <Text style={styles.freeForeverNote}>{t('paywall.freeForever')}</Text>
                    )}
                </View>

                {/* What the user actually tapped to get here — shown before the
                    generic list so this doesn't read as a cold, undifferentiated
                    wall regardless of which feature they were curious about. */}
                {featureId && (
                    <View style={[styles.featureHighlight, { borderColor: colors.accent + '55', backgroundColor: colors.accent + '14' }]}>
                        <View style={[styles.featureHighlightIcon, { backgroundColor: colors.accent }]}>
                            {FEATURE_ICONS[featureId]}
                        </View>
                        <View style={styles.featureText}>
                            <Text style={styles.featureTitle}>{t(`discover.${featureId}.label`)}</Text>
                            <Text style={styles.featureDesc}>{t(`discover.${featureId}.blurb`)}</Text>
                        </View>
                    </View>
                )}

                <View style={styles.featuresList}>
                    {features.map((f, i) => (
                        <View key={i} style={styles.featureItem}>
                            <View style={styles.featureIcon}>{f.icon}</View>
                            <View style={styles.featureText}>
                                <Text style={styles.featureTitle}>{f.title}</Text>
                                <Text style={styles.featureDesc}>{f.desc}</Text>
                            </View>
                        </View>
                    ))}
                    <Text style={styles.andMore}>{t('paywall.andMore')}</Text>
                </View>

                {/* Trust reassurance — removes the #1 fear of free trials */}
                <View style={[styles.reassureBox, { borderColor: colors.accent + '33', backgroundColor: colors.accent + '0d' }]}>
                    <BellRing size={18} color={colors.accent} />
                    <Text style={styles.reassureText}>
                        {t('paywall.reassure')}
                    </Text>
                </View>

                <View style={styles.pricingSection}>
                    {/* Annual first: with near-zero churn an annual sub locks ~12
                        months of revenue, so it leads and carries the emphasis. */}
                    {[...packages].sort((a, b) => {
                        const rank = (p: typeof a) =>
                            p.packageType === 'ANNUAL' || p.identifier === '$rc_annual' ? 0
                            : p.packageType === 'MONTHLY' || p.identifier === '$rc_monthly' ? 1 : 2;
                        return rank(a) - rank(b);
                    }).map((pkg) => {
                        const isAnnual = pkg.packageType === 'ANNUAL' || pkg.identifier === '$rc_annual';
                        const isLifetime = pkg.packageType === 'LIFETIME' || pkg.identifier === '$rc_lifetime';
                        const weeklyEquivalent = isAnnual && pkg.product.currencyCode
                            ? (() => { try { return new Intl.NumberFormat('en', {
                                style: 'currency',
                                currency: pkg.product.currencyCode,
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }).format(pkg.product.price / 52); } catch { return null; } })()
                            : null;
                        const monthlyEquivalent = isAnnual
                            ? pkg.product.currencyCode
                                ? (() => { try { return new Intl.NumberFormat('en', {
                                    style: 'currency',
                                    currency: pkg.product.currencyCode,
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  }).format(pkg.product.price / 12); } catch { return null; } })()
                                : null
                            : null;

                        const intro: any = (pkg.product as any).introPrice;
                        const isFreeTrial = !isLifetime && !!intro && intro.price === 0;
                        const introDays = intro?.periodNumberOfUnits
                            ? intro.periodNumberOfUnits * ({ DAY: 1, WEEK: 7, MONTH: 30 } as Record<string, number>)[String(intro?.periodUnit)] || 0
                            : 0;
                        const trialLabel = isFreeTrial && introDays > 0
                            ? t('paywall.daysFree', { n: introDays })
                            : t('paywall.freeTrial');

                        const winBackOffer = winBackOffers[pkg.identifier];
                        const trialWinbackDiscount = trialWinbackDiscounts[pkg.identifier];
                        const trialWinbackOption = trialWinbackOptions[pkg.identifier];
                        // Unified view of the trial win-back offer regardless of which
                        // platform shape it came from — everything below reads this.
                        const trialWinback = trialWinbackDiscount
                            ? { priceString: trialWinbackDiscount.priceString, cycles: trialWinbackDiscount.cycles }
                            : trialWinbackOption
                                ? { priceString: trialWinbackOption.pricingPhases[0]?.price.formatted ?? '', cycles: trialWinbackOption.pricingPhases[0]?.billingCycleCount ?? 1 }
                                : null;

                        const badge = winBackOffer
                            ? { text: `🎉 ${t('paywall.winbackBadge').toUpperCase()}` }
                            : trialWinback
                                ? { text: `🎉 ${t('paywall.trialWinbackBadge').toUpperCase()}` }
                                : isAnnual
                                ? { text: isFreeTrial ? t('paywall.bestValueTrial') : t('paywall.bestValue') }
                                : isFreeTrial
                                    ? { text: `🎁 ${trialLabel.toUpperCase()}` }
                                    : isLifetime
                                        ? { text: t('paywall.forever') }
                                        : null;

                        return (
                            <View key={pkg.identifier} style={styles.packageWrapper}>
                                {badge && (
                                    <View style={[styles.bestValueBadge, { backgroundColor: colors.accent }]}>
                                        <Text style={styles.bestValueText}>{badge.text}</Text>
                                    </View>
                                )}
                                <TouchableOpacity
                                    style={[
                                        styles.packageCard,
                                        { borderColor: colors.accent },
                                        // Annual (and lifetime) carry the visual emphasis — the
                                        // monthly trial badge alone was steering 90% to monthly.
                                        (isAnnual || isLifetime) && styles.packageCardHighlighted,
                                    ]}
                                    onPress={() => handlePurchase(pkg)}
                                    disabled={purchasing}
                                >
                                    <View style={styles.packageInfo}>
                                        <Text style={styles.packageTitle}>{(pkg.product.title ?? 'Premium').split(' (')[0]}</Text>
                                        {winBackOffer ? (
                                            <Text style={[styles.packageDesc, { color: colors.accent }]}>
                                                {t('paywall.winbackPriceFor', { price: winBackOffer.priceString, n: winBackOffer.cycles })}
                                            </Text>
                                        ) : trialWinback ? (
                                            <Text style={[styles.packageDesc, { color: colors.accent }]}>
                                                {t('paywall.trialWinbackPriceFor', { price: trialWinback.priceString, n: trialWinback.cycles })}
                                            </Text>
                                        ) : isFreeTrial && isAnnual ? (
                                            <Text style={[styles.packageDesc, { color: colors.accent }]}>
                                                {weeklyEquivalent
                                                    ? t('paywall.trialThenAnnual', { trial: trialLabel, weekly: weeklyEquivalent, yearly: pkg.product.priceString })
                                                    : t('paywall.trialThen', { trial: trialLabel, price: pkg.product.priceString, period: t('paywall.perYear') })}
                                            </Text>
                                        ) : isFreeTrial ? (
                                            <Text style={[styles.packageDesc, { color: colors.accent }]}>
                                                {t('paywall.trialThen', { trial: trialLabel, price: pkg.product.priceString, period: isAnnual ? t('paywall.perYear') : t('paywall.perMonth') })}
                                            </Text>
                                        ) : isLifetime ? (
                                            <Text style={[styles.packageDesc, { color: colors.accent }]}>
                                                {t('paywall.oneTime')}
                                            </Text>
                                        ) : isAnnual && monthlyEquivalent ? (
                                            <Text style={[styles.packageDesc, { color: colors.accent }]}>
                                                {t('paywall.monthlyEquiv', { price: monthlyEquivalent })}
                                            </Text>
                                        ) : (
                                            <Text style={styles.packageDesc}>{pkg.product.description}</Text>
                                        )}
                                    </View>
                                    <View style={[styles.priceBadge, { backgroundColor: colors.accent }]}>
                                        <Text style={styles.priceText}>
                                            {winBackOffer ? winBackOffer.priceString : trialWinback ? trialWinback.priceString : isFreeTrial ? t('paywall.startFree') : pkg.product.priceString}
                                        </Text>
                                        {!winBackOffer && !trialWinback && !isFreeTrial && isAnnual && <Text style={styles.priceSubText}>{t('paywall.perYearBadge')}</Text>}
                                    </View>
                                </TouchableOpacity>
                            </View>
                        );
                    })}

                    {packages.length === 0 && (
                        <View style={styles.emptyPackages}>
                            <Text style={styles.emptyText}>{t('paywall.noPackagesBody')}</Text>
                        </View>
                    )}

                    <TouchableOpacity onPress={handleRestore} style={styles.restoreButton} disabled={purchasing}>
                        <Text style={styles.restoreText}>{t('paywall.restore')}</Text>
                    </TouchableOpacity>

                    {/* Clear, obvious way to continue without subscribing —
                        especially important when the paywall is the last
                        onboarding step. Also App Store compliant. */}
                    <TouchableOpacity onPress={onClose} style={styles.maybeLaterButton} disabled={purchasing}>
                        <Text style={styles.maybeLaterText}>{t('supportModal.maybeLater')}</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        {t('paywall.footerIntro', { manageLocation: Platform.OS === 'ios' ? t('paywall.manageIOS') : t('paywall.manageAndroid') })}
                        <Text
                            style={[styles.footerText, { color: colors.accent, textDecorationLine: 'underline' }]}
                            onPress={() => Linking.openURL(APP_URLS.terms)}
                            accessibilityRole="link"
                        >
                            {t('settings.termsOfUse')}
                        </Text>
                        {' '}{t('paywall.and')}{' '}
                        <Text
                            style={[styles.footerText, { color: colors.accent, textDecorationLine: 'underline' }]}
                            onPress={() => Linking.openURL(APP_URLS.privacy)}
                            accessibilityRole="link"
                        >
                            {t('settings.privacyPolicy')}
                        </Text>
                        .
                    </Text>
                </View>
            </ScrollView>

            {/* Onboarding only: an always-visible free path. The in-scroll
                "maybe later" sits below the fold, so first-time users who
                don't scroll can conclude the app is paid-only and quit. */}
            {source === 'onboarding' && (
                <TouchableOpacity
                    onPress={() => { track('paywall_continue_free', { source }); onClose(); }}
                    style={styles.continueFreeButton}
                    disabled={purchasing}
                >
                    <Text style={styles.continueFreeText}>{t('paywall.continueFree')}</Text>
                </TouchableOpacity>
            )}

            {purchasing && (
                <View style={styles.overlay}>
                    <ActivityIndicator size="large" color={colors.accent} />
                </View>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#020617',
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#020617',
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    closeButton: {
        padding: 8,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
        marginLeft: 16,
    },
    scrollContent: {
        padding: 24,
    },
    heroSection: {
        alignItems: 'center',
        marginBottom: 40,
    },
    heroIcon: {
        marginBottom: 16,
    },
    heroTitle: {
        color: '#fff',
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 12,
    },
    heroSubtitle: {
        color: '#94a3b8',
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 10,
    },
    heroTrial: {
        fontSize: 13,
        fontWeight: '700',
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    freeForeverNote: {
        color: '#94a3b8',
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'center',
        marginTop: 10,
        lineHeight: 18,
    },
    continueFreeButton: {
        alignItems: 'center',
        paddingVertical: 14,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255,255,255,0.12)',
    },
    continueFreeText: {
        color: '#cbd5e1',
        fontSize: 15,
        fontWeight: '700',
    },
    featuresList: {
        marginBottom: 12,
    },
    featureHighlight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
        marginBottom: 20,
    },
    featureHighlightIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    reassureBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderRadius: 14,
        borderWidth: 1,
        paddingVertical: 14,
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    reassureText: {
        flex: 1,
        color: '#cbd5e1',
        fontSize: 13,
        fontWeight: '600',
        lineHeight: 18,
    },
    andMore: {
        color: '#475569',
        fontSize: 13,
        textAlign: 'center',
        marginBottom: 32,
        fontStyle: 'italic',
    },
    featureItem: {
        flexDirection: 'row',
        marginBottom: 24,
    },
    featureIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    featureText: {
        flex: 1,
    },
    featureTitle: {
        color: '#fff',
        fontSize: 17,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    featureDesc: {
        color: '#64748b',
        fontSize: 14,
        lineHeight: 20,
    },
    pricingSection: {
        marginBottom: 32,
    },
    packageWrapper: {
        marginBottom: 16,
    },
    bestValueBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderTopLeftRadius: 10,
        borderTopRightRadius: 10,
        marginLeft: 16,
    },
    bestValueText: {
        color: '#000',
        fontSize: 11,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    packageCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    packageCardHighlighted: {
        backgroundColor: 'rgba(255, 255, 255, 0.07)',
        borderTopLeftRadius: 0,
        borderWidth: 2,
    },
    packageInfo: {
        flex: 1,
    },
    packageTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    packageDesc: {
        color: '#64748b',
        fontSize: 14,
    },
    priceBadge: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 12,
    },
    priceText: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: 16,
        textAlign: 'center',
    },
    priceSubText: {
        color: '#000',
        fontSize: 11,
        textAlign: 'center',
        opacity: 0.7,
    },
    restoreButton: {
        alignItems: 'center',
        marginTop: 16,
    },
    restoreText: {
        color: '#94a3b8',
        fontSize: 14,
        textDecorationLine: 'underline',
    },
    maybeLaterButton: {
        alignItems: 'center',
        marginTop: 18,
        paddingVertical: 10,
    },
    maybeLaterText: {
        color: '#cbd5e1',
        fontSize: 15,
        fontWeight: '700',
    },
    footer: {
        alignItems: 'center',
    },
    footerText: {
        color: '#475569',
        fontSize: 12,
        textAlign: 'center',
        lineHeight: 18,
    },
    emptyPackages: {
        padding: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        marginBottom: 16,
    },
    emptyText: {
        color: '#64748b',
        textAlign: 'center',
        fontSize: 14,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default Paywall;
