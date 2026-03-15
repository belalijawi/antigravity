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
} from 'react-native';
import { X, Check, Star, Download, Moon, ShieldCheck, Zap } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import RevenueCatService, { ENTITLEMENT_ID } from '../services/revenueCat';
import { usePurchases } from '../context/PurchasesContext';
import { useTheme } from '../context/ThemeContext';
import { PurchasesPackage } from 'react-native-purchases';

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
    }, []);

    const loadOfferings = async () => {
        setLoading(true);
        const offerings = await RevenueCatService.getOfferings();
        if (offerings) {
            setPackages(offerings.availablePackages);
        }
        setLoading(false);
    };

    const handlePurchase = async (pkg: PurchasesPackage) => {
        setPurchasing(true);
        const customerInfo = await RevenueCatService.purchasePackage(pkg);
        if (customerInfo) {
            // Success!
            await checkPremiumStatus();
            onClose();
            Alert.alert('Welcome to Tahajjud+', 'Your premium features are now active. JazakAllah Khair for your support!');
        }
        setPurchasing(false);
    };

    const handleRestore = async () => {
        setPurchasing(true);
        const customerInfo = await RevenueCatService.restorePurchases();
        if (customerInfo) {
            await checkPremiumStatus();
            if (typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== 'undefined') {
                Alert.alert('Restored', 'Your premium access has been restored.');
                onClose();
            } else {
                Alert.alert('Not Found', 'We could not find any active subscriptions for this account.');
            }
        }
        setPurchasing(false);
    };

    const features = [
        { icon: <Download size={20} color={colors.accent} />, title: 'Offline Quran', desc: 'Download surahs and listen anywhere without internet' },
        { icon: <Moon size={20} color={colors.accent} />, title: 'Premium Themes', desc: 'Exclusive dark & cosmic aesthetics for your app' },
        { icon: <ShieldCheck size={20} color={colors.accent} />, title: 'Ad-Free Experience', desc: 'Maintain your spiritual focus with zero interruptions' },
        { icon: <Zap size={20} color={colors.accent} />, title: 'Support the Mission', desc: 'Help us improve the app and keep it running for everyone' },
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
                    <Text style={styles.heroTitle}>Unlock the Full Experience</Text>
                    <Text style={styles.heroSubtitle}>Elevate your spiritual journey with premium features and support our mission.</Text>
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
                </View>

                <View style={styles.pricingSection}>
                    {packages.map((pkg) => (
                        <TouchableOpacity
                            key={pkg.identifier}
                            style={[styles.packageCard, { borderColor: colors.accent }]}
                            onPress={() => handlePurchase(pkg)}
                            disabled={purchasing}
                        >
                            <View style={styles.packageInfo}>
                                <Text style={styles.packageTitle}>{pkg.product.title.split(' (')[0]}</Text>
                                <Text style={styles.packageDesc}>{pkg.product.description}</Text>
                            </View>
                            <View style={[styles.priceBadge, { backgroundColor: colors.accent }]}>
                                <Text style={styles.priceText}>{pkg.product.priceString}</Text>
                            </View>
                        </TouchableOpacity>
                    ))}

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
                        By subscribing, you agree to our Terms of Use and Privacy Policy. Subscriptions automatically renew unless canceled at least 24 hours before the end of the current period.
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
    },
    featuresList: {
        marginBottom: 40,
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
    packageCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
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
