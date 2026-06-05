import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, BookOpen, Mic, Clock, ScrollText, ShieldCheck } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { APP_URLS } from '../utils/urls';

interface Props { onClose: () => void; }

export function SourcesMethodology({ onClose }: Props) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();

    const Section = ({ icon: Icon, title, children }: any) => (
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <View style={[styles.iconWrap, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '40' }]}>
                    <Icon size={16} color={colors.accent} />
                </View>
                <Text style={[styles.sectionTitle, { color: colors.primaryText }]}>{title}</Text>
            </View>
            <View style={styles.sectionBody}>{children}</View>
        </View>
    );

    const Item = ({ name, detail, link }: { name: string; detail: string; link?: string }) => (
        <TouchableOpacity
            disabled={!link}
            onPress={() => link && Linking.openURL(link)}
            style={[styles.itemRow, { borderColor: 'rgba(255,255,255,0.06)' }]}
            activeOpacity={link ? 0.7 : 1}
        >
            <Text style={[styles.itemName, { color: colors.primaryText }]}>{name}</Text>
            <Text style={[styles.itemDetail, { color: colors.secondaryText }]}>{detail}</Text>
            {link && <Text style={[styles.itemLink, { color: colors.accent }]}>{link.replace(/^https?:\/\//, '')}</Text>}
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 12 }]}>
                <View>
                    <Text style={[styles.title, { color: colors.accent }]}>Sources & Methodology</Text>
                    <Text style={[styles.subtitle, { color: colors.secondaryText }]}>Authenticity and attribution</Text>
                </View>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                    <X size={20} color={colors.secondaryText} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={[styles.intro, { color: colors.secondaryText }]}>
                    Every piece of religious content in this app comes from a documented, verifiable source.
                    The list below shows what we use and where it comes from — so you can verify it yourself.
                </Text>

                <Section icon={BookOpen} title="Quran Text">
                    <Item
                        name="Madinah Mushaf (Hafs ʿan ʿĀṣim)"
                        detail="The standard Mushaf text used by ~95% of the Muslim world. Source: Tanzil Project — verified character-by-character against the King Fahd Complex printed Mushaf."
                        link="https://tanzil.net"
                    />
                </Section>

                <Section icon={ScrollText} title="Quran Translations">
                    <Item name="English — Saheeh International" detail="Widely-used contemporary English translation. Default for free users." />
                    <Item name="English — The Clear Quran" detail="Dr. Mustafa Khattab. Premium." />
                    <Item name="Other languages (24 editions)" detail="Sourced from alquran.cloud — translations by recognized scholars including Hamidullah (French), Korkut (Bosnian), Sodik Muhammad Yusuf (Uzbek), KFGQPC (Thai), Al-Barwani (Swahili), and others." link="https://alquran.cloud" />
                </Section>

                <Section icon={Mic} title="Quran Audio Recitations">
                    <Item
                        name="Mishary Rashid Alafasy · Abdurrahman As-Sudais · Maher Al-Mueaqly · Saood Ash-Shuraym · Abdul Basit Abdul Samad · Muhammad Siddiq Al-Minshawi · Mahmoud Khalil Al-Husary"
                        detail="Studio recitations licensed via the Islamic Network CDN. All seven reciters use the Hafs ʿan ʿĀṣim qira'ah."
                        link="https://everyayah.com"
                    />
                </Section>

                <Section icon={Clock} title="Prayer Time Calculations">
                    <Item
                        name="Multiple methods supported"
                        detail="ISNA (default), Muslim World League, Egyptian General Authority, Umm al-Qura (Makkah), Karachi University, Tehran, and others. Each follows its institution's published Fajr/Isha angle convention."
                    />
                    <Item
                        name="Last third of the night"
                        detail="Computed as one third of the duration between Maghrib and Fajr — the canonical window for Tahajjud (Bukhari 1145, Muslim 758)."
                    />
                </Section>

                <Section icon={BookOpen} title="Hadith Citations">
                    <Item
                        name="Cited from the canonical six (Kutub al-Sittah)"
                        detail="Bukhari, Muslim, Abu Dawud, Tirmidhi, Nasa'i, Ibn Majah. Each hadith shown in the app cites its collection and number for verification."
                    />
                </Section>

                <Section icon={ShieldCheck} title="Privacy & Data">
                    <Item
                        name="Your reflections stay yours"
                        detail="Journal entries and personal duas are stored locally on your device. Sync to Firestore is opt-in via Firebase sign-in. We never read or analyze the content of your entries."
                    />
                    <Item
                        name="No analytics on spiritual content"
                        detail="We never log which ayahs you read, what you write in your journal, or how often you pray. See the full Privacy Policy for details."
                    />
                </Section>

                <Text style={[styles.footer, { color: colors.secondaryText + '80' }]}>
                    Found an error or missing attribution? Email{' '}
                    <Text style={{ color: colors.accent }} onPress={() => Linking.openURL(APP_URLS.email)}>
                        tahajjud.letters@gmail.com
                    </Text>
                    . We take corrections seriously.
                </Text>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#020617' },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
        paddingHorizontal: 20, paddingBottom: 16,
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    title: { fontSize: 22, fontWeight: '800', marginBottom: 2 },
    subtitle: { fontSize: 12, fontWeight: '600' },
    content: { padding: 20, paddingBottom: 60 },
    intro: { fontSize: 14, lineHeight: 22, marginBottom: 24 },
    section: { marginBottom: 28 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    iconWrap: {
        width: 28, height: 28, borderRadius: 14, borderWidth: 1,
        alignItems: 'center', justifyContent: 'center',
    },
    sectionTitle: { fontSize: 16, fontWeight: '800' },
    sectionBody: { gap: 10 },
    itemRow: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1, borderRadius: 14,
        padding: 14, gap: 4,
    },
    itemName: { fontSize: 14, fontWeight: '700' },
    itemDetail: { fontSize: 13, lineHeight: 19 },
    itemLink: { fontSize: 12, fontWeight: '600', marginTop: 4 },
    footer: { fontSize: 12, lineHeight: 18, marginTop: 16, textAlign: 'center' },
});
