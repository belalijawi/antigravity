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
import { X, Check, Star, Moon, CalendarDays, WifiOff, Brain, Users, MapPin } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import RevenueCatService, { ENTITLEMENT_ID } from '../services/revenueCat';
import { usePurchases } from '../context/PurchasesContext';
import { useTheme } from '../context/ThemeContext';
import { PurchasesPackage } from 'react-native-purchases';
import { APP_URLS } from '../utils/urls';
import { track } from '../utils/analytics';

interface PaywallProps {
    onClose: () => void;
}

const Paywall: React.FC<PaywallProps> = ({ onClose }) => {
    const [packages, setPackages] = useState<PurchasesPackage[]>([]);
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState(false);
    const { isPremium, checkPremiumStatus } = usePurchases();
    const { colors } = useTheme();

    useEffect(() => {
        loadOfferings();
        track('paywall_viewed');
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
        } else {
            console.log('[Paywall] No offering returned from RevenueCat');
        }
        setLoading(false);
    };

    const handlePurchase = async (pkg: PurchasesPackage) => {
        setPurchasing(true);
        track('purchase_started', { package: pkg.identifier });
        try {
            const customerInfo = await RevenueCatService.purchasePackage(pkg);
            if (customerInfo) {
                track('purchase_completed', { package: pkg.identifier });
                await checkPremiumStatus();
                onClose();
                Alert.alert('Welcome to Tahajjud+', 'Your premium features are now active. JazakAllah Khair for your support!');
            } else {
                // null = user cancelled — no alert needed, just dismiss spinner
                track('purchase_cancelled', { package: pkg.identifier });
            }
        } catch {
            Alert.alert('Purchase failed', 'Something went wrong. Please check your connection and try again.');
        } finally {
            setPurchasing(false);
        }
    };

    const handleRestore = async () => {
        setPurchasing(true);
        try {
            const customerInfo = await RevenueCatService.restorePurchases();
            if (customerInfo) {
                await checkPremiumStatus();
                if (typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== 'undefined') {
                    Alert.alert('Restored', 'Your premium access has been restored.');
                    onClose();
                } else {
                    Alert.alert('No subscription found', 'We could not find any active subscriptions for this Apple ID.');
                }
            } else {
                Alert.alert('Restore failed', 'Something went wrong. Please check your connection and try again.');
            }
        } catch {
            Alert.alert('Restore failed', 'Something went wrong. Please check your connection and try again.');
        } finally {
            setPurchasing(false);
        }
    };

    const features = [
        {
            icon: <Moon size={20} color={colors.accent} />,
            title: 'Night Journal',
            desc: 'Reflect after every Tahajjud — log your mood, rakats, and duas. Build a record of your nights with Allah.',
        },
        {
            icon: <CalendarDays size={20} color={colors.accent} />,
            title: 'Full Prayer History',
            desc: 'Month and year views of every prayer logged. Watch your consistency build over weeks and months.',
        },
        {
            icon: <Users size={20} color={colors.accent} />,
            title: 'Accountability Circle',
            desc: 'Up to 5 partners. See who prayed tonight, send wake-up calls, hold each other to the last third.',
        },
        {
            icon: <WifiOff size={20} color={colors.accent} />,
            title: 'Offline Quran + All Reciters',
            desc: 'Download full surahs, unlock all 7 reciters, build custom playlists — no signal needed.',
        },
        {
            icon: <Brain size={20} color={colors.accent} />,
            title: 'Hifz Mode',
            desc: 'Structured memorization with progressive locking and spaced repetition. Serious hifdh, simplified.',
        },
        {
            icon: <MapPin size={20} color={colors.accent} />,
            title: 'Mosque Timetable',
            desc: 'Photograph your mosque\'s monthly timetable and the app reads all the times automatically — exact prayer times, no calculations.',
        },
        {
            icon: <Star size={20} color={colors.accent} />,
            title: 'Prayer Analytics',
            desc: 'See your consistency per prayer, strongest and weakest salah, best day of the week, and 30-day trends.',
        },
        {
            icon: <Star size={20} color={colors.accent} />,
            title: 'Dhikr Stats & Custom Dhikr',
            desc: 'Track your all-time dhikr count, daily streak, 7-day chart, and add your own custom dhikr with personal targets.',
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
                    <Text style={styles.heroTitle}>You're building something real.</Text>
                    <Text style={styles.heroSubtitle}>Unlock the tools to go deeper — journal your nights, track your full history, and pray with your circle.</Text>
                    <Text style={[styles.heroTrial, { color: colors.accent }]}>7 days free · cancel anytime</Text>
                </View>

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
                    <Text style={styles.andMore}>+ premium themes, stacked reminders & more</Text>
                </View>

                <View style={styles.pricingSection}>
                    {packages.map((pkg) => {
                        const isAnnual = pkg.packageType === 'ANNUAL' || pkg.identifier === '$rc_annual';
                        const isLifetime = pkg.packageType === 'LIFETIME' || pkg.identifier === '$rc_lifetime';
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
                        const trialLabel = isFreeTrial && intro?.periodNumberOfUnits && intro?.periodUnit
                            ? `${intro.periodNumberOfUnits} ${String(intro.periodUnit).toLowerCase()}${intro.periodNumberOfUnits > 1 ? 's' : ''} free`
                            : 'Free trial';

                        const badge = isFreeTrial
                            ? { text: `🎁 ${trialLabel.toUpperCase()}` }
                            : isLifetime
                                ? { text: '♾️ FOREVER' }
                                : isAnnual
                                    ? { text: '⭐ BEST VALUE' }
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
                                        (isAnnual || isFreeTrial || isLifetime) && styles.packageCardHighlighted,
                                    ]}
                                    onPress={() => handlePurchase(pkg)}
                                    disabled={purchasing}
                                >
                                    <View style={styles.packageInfo}>
                                        <Text style={styles.packageTitle}>{pkg.product.title.split(' (')[0]}</Text>
                                        {isFreeTrial ? (
                                            <Text style={[styles.packageDesc, { color: colors.accent }]}>
                                                {trialLabel}, then {pkg.product.priceString}
                                                {isAnnual ? '/year' : '/month'}
                                            </Text>
                                        ) : isLifetime ? (
                                            <Text style={[styles.packageDesc, { color: colors.accent }]}>
                                                One-time payment · No renewal
                                            </Text>
                                        ) : isAnnual && monthlyEquivalent ? (
                                            <Text style={[styles.packageDesc, { color: colors.accent }]}>
                                                Only {monthlyEquivalent}/month — save vs monthly
                                            </Text>
                                        ) : (
                                            <Text style={styles.packageDesc}>{pkg.product.description}</Text>
                                        )}
                                    </View>
                                    <View style={[styles.priceBadge, { backgroundColor: colors.accent }]}>
                                        <Text style={styles.priceText}>
                                            {isFreeTrial ? 'Try Free' : pkg.product.priceString}
                                        </Text>
                                        {!isFreeTrial && isAnnual && <Text style={styles.priceSubText}>/ year</Text>}
                                    </View>
                                </TouchableOpacity>
                            </View>
                        );
                    })}

                    {packages.length === 0 && (
                        <View style={styles.emptyPackages}>
                            <Text style={styles.emptyText}>No premium packages available at the moment. Please check back later.</Text>
                        </View>
                    )}

                    <TouchableOpacity onPress={handleRestore} style={styles.restoreButton} disabled={purchasing}>
                        <Text style={styles.restoreText}>Already a member? Restore Purchases</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        Your 7-day free trial converts to a paid subscription unless canceled at least 24 hours before it ends. Manage or cancel anytime in your iPhone's Settings → Apple ID → Subscriptions. By subscribing you agree to our{' '}
                        <Text
                            style={[styles.footerText, { color: colors.accent, textDecorationLine: 'underline' }]}
                            onPress={() => Linking.openURL(APP_URLS.terms)}
                            accessibilityRole="link"
                        >
                            Terms of Use
                        </Text>
                        {' '}and{' '}
                        <Text
                            style={[styles.footerText, { color: colors.accent, textDecorationLine: 'underline' }]}
                            onPress={() => Linking.openURL(APP_URLS.privacy)}
                            accessibilityRole="link"
                        >
                            Privacy Policy
                        </Text>
                        .
                    </Text>
                </View>
            </ScrollView>

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
    featuresList: {
        marginBottom: 12,
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
