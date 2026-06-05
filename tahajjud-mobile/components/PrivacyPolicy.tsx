import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    X, Shield, Lock, Eye, Database, MapPin, CreditCard, Cloud, Heart,
    BarChart3, AlertCircle, Mail,
} from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../context/ThemeContext';
import { APP_URLS } from '../utils/urls';

interface Props { onClose: () => void; }

export function PrivacyPolicy({ onClose }: Props) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();

    const Section = ({ icon: Icon, title, children }: any) => (
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <View style={[styles.iconContainer, { backgroundColor: colors.accent + '15' }]}>
                    <Icon size={18} color={colors.accent} />
                </View>
                <Text style={[styles.sectionTitle, { color: colors.primaryText }]}>{title}</Text>
            </View>
            <View>{children}</View>
        </View>
    );

    const P = ({ children }: any) => (
        <Text style={[styles.sectionContent, { color: colors.secondaryText }]}>{children}</Text>
    );

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 12 }]}>
                <View>
                    <Text style={[styles.title, { color: colors.accent }]}>Privacy Policy</Text>
                    <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
                        What we collect and what we don't
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={onClose}
                    style={styles.closeButton}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    accessibilityLabel="Close"
                    accessibilityRole="button"
                >
                    <X color={colors.primaryText} size={24} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                <View style={styles.heroCard}>
                    <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                    <Shield color={colors.accent} size={48} strokeWidth={1} style={styles.heroIcon} />
                    <Text style={[styles.heroText, { color: colors.primaryText }]}>
                        Most of what you do in Tahajjud+ stays on your device. The few things that don't are listed below, explicitly.
                    </Text>
                </View>

                {/* ── On-device only ─────────────────────────── */}
                <Section icon={Lock} title="What stays on your device">
                    <P>
                        These are stored only in local app storage on your phone and are NEVER sent to any server unless you explicitly enable cloud sync:
                    </P>
                    <P>{'\n'}• Prayer log history (which prayers you've completed)</P>
                    <P>• Tahajjud streak and weekly-freeze usage</P>
                    <P>• Achievements / badges you've unlocked</P>
                    <P>• Memorization (Hifz) progress</P>
                    <P>• Dhikr counter sessions</P>
                    <P>• Theme, reciter, language, and other settings</P>
                    <P>• Offline-downloaded Quran audio files</P>
                    <P>• Cached Quran text and translations</P>
                    <P>• Bedtime suggestions and biphasic sleep configuration</P>
                    <P>• Letters to Allah (private writings)</P>
                </Section>

                {/* ── Cloud sync (opt-in) ─────────────────────── */}
                <Section icon={Cloud} title="Cloud sync (only if you sign in)">
                    <P>
                        If you sign in with Apple ID or Google, the following are stored in Google Firestore so they sync across your devices:
                    </P>
                    <P>{'\n'}• Tahajjud journal entries (mood, rakats, written reflections)</P>
                    <P>• Accountability partner code(s) and prayer-logged-tonight status, shared only with the partners you connect with</P>
                    <P>• Your Expo push notification token, so partners can send a wake-up notification</P>
                    <P>{'\n'}
                        Only you can read your private entries. Firestore security rules enforce this — even our developers cannot read what you write. Sign out at any time to stop syncing.
                    </P>
                    <P>{'\n'}
                        Letters to Allah are NOT synced — they remain on your device.
                    </P>
                </Section>

                {/* ── Biometric authentication ───────────────── */}
                <Section icon={Lock} title="Biometric authentication (Face ID / Touch ID)">
                    <P>
                        You can optionally protect your private writings (Letters, Night Journal) with Face ID or Touch ID. iOS handles the biometric match entirely inside the Secure Enclave.
                    </P>
                    <P>{'\n'}
                        We NEVER receive your fingerprint or face data — only a "yes/no" from the operating system telling us whether the match succeeded.
                    </P>
                </Section>

                {/* ── Push notifications ─────────────────────── */}
                <Section icon={AlertCircle} title="Push notifications">
                    <P>• Prayer reminders and Tahajjud wake-ups are scheduled locally on your device. iOS handles them — no server involved.</P>
                    <P>• Accountability partner "Wake" notifications are sent via Expo's push service to your partner's saved token. Only the message text ("[Your name] is calling you to Tahajjud") is transmitted.</P>
                    <P>{'\n'}You can disable any notification in iOS Settings → Tahajjud+ → Notifications.</P>
                </Section>

                {/* ── Community features (intentionally public) ── */}
                <Section icon={Eye} title="Community features (what you choose to publish)">
                    <P>
                        Some features are intentionally public when you opt in:
                    </P>
                    <P>{'\n'}
                        <Text style={styles.bold}>Dua Wall.</Text> If you tap "Publish" on the Dua Wall, your dua text appears anonymously to other users. We store your Firebase user ID server-side to enforce rate limits and respond to reports — but it's NEVER displayed alongside the dua.
                    </P>
                    <P>{'\n'}
                        <Text style={styles.bold}>Testimony submissions.</Text> Stories you submit through "Share Your Story" go to a moderation queue. If approved, they appear in the community feed under whatever author name you entered ("Anonymous", a first name, etc.) — never your account info.
                    </P>
                </Section>

                {/* ── Health data ─────────────────────────────── */}
                <Section icon={Heart} title="Apple Health (sleep data)">
                    <P>
                        If you enable Bedtime Intelligence in Settings, we read your past 14 days of sleep duration from Apple Health to suggest an optimal bedtime for Tahajjud.
                    </P>
                    <P>{'\n'}
                        This data is processed entirely on your device. Your raw sleep timestamps are never transmitted to our servers, to any analytics service, or to anyone. Computation happens in the app and the result (a suggested bedtime) is shown only to you.
                    </P>
                </Section>

                {/* ── Location ────────────────────────────────── */}
                <Section icon={MapPin} title="Location (prayer times only)">
                    <P>
                        We request location access to calculate accurate prayer times and Qibla direction for your area. Your coordinates are processed on your device. We do not transmit your location to our servers.
                    </P>
                    <P>{'\n'}
                        You can disable location at any time in iOS Settings → Tahajjud+ → Location. The app will then ask you to set a manual location.
                    </P>
                </Section>

                {/* ── Crash reporting ─────────────────────────── */}
                <Section icon={AlertCircle} title="Crash reporting (Sentry)">
                    <P>
                        When the app crashes, we send anonymized crash details to Sentry so we can fix the bug. This includes the stack trace, your iOS version, and the screen you were on.
                    </P>
                    <P>{'\n'}
                        We explicitly DO NOT send: the content of your journal entries, letters, dua text, or any spiritual content. Our code filters these out before transmission. We also do not send your name, email, or location.
                    </P>
                </Section>

                {/* ── Analytics ────────────────────────────────── */}
                <Section icon={BarChart3} title="Anonymous usage analytics (PostHog)">
                    <P>
                        We track anonymous events like "app launched", "tab switched", "paywall viewed" so we know which features get used. This helps us improve the app.
                    </P>
                    <P>{'\n'}
                        We explicitly DO NOT track: which verses you read, what you write in your journal, what duas you publish, your name, email, location, or any other content. We use only an anonymous random identifier — never something tied to your identity.
                    </P>
                </Section>

                {/* ── Subscriptions ──────────────────────────── */}
                <Section icon={CreditCard} title="Payments and subscriptions">
                    <P>
                        Premium subscriptions are processed by Apple's App Store. We never see your credit card or Apple ID password. We use RevenueCat as middleware to verify your subscription status — RevenueCat sees anonymized purchase receipts.
                    </P>
                    <P>{'\n'}
                        Manage or cancel subscriptions in iOS Settings → Apple ID → Subscriptions.
                    </P>
                </Section>

                {/* ── Quran content ────────────────────────────── */}
                <Section icon={Database} title="Quran text and audio sources">
                    <P>
                        Quran translations and audio recitations are fetched from:
                    </P>
                    <P>{'\n'}• alquran.cloud (text, Tanzil-verified, 30+ translations)</P>
                    <P>• Islamic Network CDN (audio: Alafasy, Sudais, Maher Al-Mueaqly, Ash-Shuraym, Abdul Basit, Minshawi, Husary)</P>
                    <P>• Quran Data Center / Quran.com (word-by-word timing data)</P>
                    <P>{'\n'}
                        These public APIs receive HTTP requests for surah numbers. They do not receive any of your personal data.
                    </P>
                </Section>

                {/* ── Your rights ─────────────────────────────── */}
                <Section icon={Shield} title="Your rights and how to delete your data">
                    <P>
                        <Text style={styles.bold}>Delete local data:</Text> uninstall the app, or in iOS Settings → Tahajjud+ → "Delete App."
                    </P>
                    <P>{'\n'}
                        <Text style={styles.bold}>Delete cloud data:</Text> Settings → Sync & Cloud → "Delete My Account" deletes all your Firestore data and signs you out permanently.
                    </P>
                    <P>{'\n'}
                        <Text style={styles.bold}>Opt out of analytics or crash reporting:</Text> email us — we'll add your anonymous ID to a deny-list. (We're working on an in-app toggle.)
                    </P>
                    <P>{'\n'}
                        <Text style={styles.bold}>Request a copy of your data:</Text> email us with the email tied to your account. We respond within 30 days.
                    </P>
                </Section>

                {/* ── Contact ────────────────────────────────── */}
                <Section icon={Mail} title="Contact">
                    <P>
                        Questions, requests, or concerns:{'\n'}
                        <Text
                            style={{ color: colors.accent, textDecorationLine: 'underline' }}
                            onPress={() => Linking.openURL(APP_URLS.email)}
                        >
                            tahajjud.letters@gmail.com
                        </Text>
                    </P>
                </Section>

                <View style={styles.footer}>
                    <Text style={[styles.footerText, { color: colors.secondaryText }]}>
                        Last Updated: May 2026{'\n'}
                        We update this policy when we change what we collect. Major changes are announced in-app.{'\n\n'}
                        Full Privacy Policy:{'\n'}
                        <Text
                            style={{ color: colors.accent, textDecorationLine: 'underline' }}
                            onPress={() => Linking.openURL(APP_URLS.privacy)}
                        >
                            tahajjud-2d7bf.web.app/privacy
                        </Text>
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#020617' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 24,
    },
    title: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
    subtitle: { fontSize: 13, fontWeight: '600', marginTop: 2 },
    closeButton: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        justifyContent: 'center', alignItems: 'center',
    },
    scrollContent: { paddingHorizontal: 24, paddingBottom: 60 },
    heroCard: {
        padding: 28, borderRadius: 28, marginBottom: 32,
        overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
    },
    heroIcon: { marginBottom: 16 },
    heroText: { fontSize: 16, textAlign: 'center', lineHeight: 24, fontWeight: '600' },
    section: { marginBottom: 28 },
    sectionHeader: {
        flexDirection: 'row', alignItems: 'center', marginBottom: 12,
    },
    iconContainer: {
        width: 36, height: 36, borderRadius: 12,
        justifyContent: 'center', alignItems: 'center', marginRight: 12,
    },
    sectionTitle: { fontSize: 18, fontWeight: '800', flex: 1 },
    sectionContent: { fontSize: 14, lineHeight: 22, fontWeight: '400' },
    bold: { fontWeight: '700' },
    footer: {
        marginTop: 16, paddingTop: 28,
        borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.05)',
    },
    footerText: { fontSize: 12, lineHeight: 19, textAlign: 'center', fontWeight: '500' },
});
