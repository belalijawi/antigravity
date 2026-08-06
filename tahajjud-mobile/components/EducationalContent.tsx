import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, DeviceEventEmitter } from 'react-native';
import { Moon, Droplets, Heart, BookOpen, Hand, Star, ChevronDown, ChevronUp, Lightbulb, CheckCircle, Clock } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { tc } from '../data/contentTranslations';

const STEPS = [
    {
        number: 1,
        icon: Clock,
        title: 'Wake Up in the Last Third',
        description: "The most blessed time for Tahajjud is the last third of the night — roughly 1–2 hours before Fajr. Use the app's Night Calculator to find your exact window each night.",
        tip: 'Set an alarm tonight. Even once is a beginning.',
    },
    {
        number: 2,
        icon: Droplets,
        title: 'Make Wudu',
        description: 'Begin with purification. Perform a fresh wudu before your prayer. This physical act of cleansing mirrors the spiritual renewal happening in your heart.',
        tip: "If you're already in a state of wudu, you may begin immediately.",
    },
    {
        number: 3,
        icon: Heart,
        title: 'Set Your Intention (Niyyah)',
        description: "Make a silent intention in your heart to pray Tahajjud for the sake of Allah alone. The Niyyah does not need to be spoken aloud — Allah knows what is in your heart.",
        tip: '"Actions are by intentions." — Sahih Bukhari 1',
    },
    {
        number: 4,
        icon: BookOpen,
        title: "Pray 2 Rak'ahs at a Time",
        description: "Tahajjud is prayed in sets of 2 rak'ahs. You may pray a minimum of 2 and up to 12. The Prophet ﷺ would often pray 8 rak'ahs of the night prayer followed by Witr.",
        tip: "Start with just 2 rak'ahs. Quality over quantity — full focus over many distracted ones.",
    },
    {
        number: 5,
        icon: Star,
        title: 'Recite Slowly and Deeply',
        description: 'After Al-Fatiha, the Prophet ﷺ would recite long surahs at night — such as Al-Baqarah, Aal-Imraan, and An-Nisa. If you are a beginner, any surah recited with presence of heart is beautiful.',
        tip: 'Slow your recitation down. Let every word land.',
    },
    {
        number: 6,
        icon: Hand,
        title: "Make Du'a After Prayer",
        description: "The last third of the night is the most powerful time for du'a. After your prayer, raise your hands and speak to Allah directly. Ask for everything — your dunya and your akhira.",
        tip: '"Our Lord descends to the lowest heaven and says: Who is calling on Me that I may answer?" — Bukhari 1145 · Muslim 758',
    },
];

const FAQS = [
    {
        q: 'Do I have to pray every single night?',
        a: "No — Tahajjud is a voluntary (nafl) prayer. Even praying it occasionally brings great reward. The Prophet ﷺ said: 'The most beloved deeds to Allah are those done consistently, even if small.' (Bukhari 6465 · Muslim 2818)",
    },
    {
        q: 'What if I sleep through my alarm?',
        a: "Do not be disheartened. The Prophet ﷺ said: 'When any of you is asleep, Shaytan ties three knots at the back of his neck.' Waking for Allah breaks those knots. Try again tomorrow. (Bukhari 1142 · Muslim 776)",
    },
    {
        q: 'Can I pray Tahajjud before sleeping?',
        a: 'No — Tahajjud must be prayed after sleeping and waking up. If you have not slept, it becomes Qiyam al-Layl (voluntary night prayer), which is also highly rewarded.',
    },
    {
        q: 'Do I need to pray Witr after Tahajjud?',
        a: "Yes — if you haven't already prayed Witr after Isha, end your night prayer with Witr. The Prophet ﷺ said: 'Make Witr the last of your night prayer.' — Sahih Bukhari",
    },
    {
        q: 'How long should each prayer session be?',
        a: "There is no fixed minimum. The Prophet ﷺ sometimes stood so long his feet would swell. But even 5 sincere minutes before Fajr holds immense value with Allah.",
    },
    {
        q: "What du'as should I make?",
        a: "Speak to Allah in your own language — He understands every tongue. You may also use the du'as in the app's Duas tab, including specific Tahajjud supplications from the Sunnah.",
    },
];

interface StepProps {
    step: typeof STEPS[0];
    index: number;
    colors: any;
}

function StepCard({ step, index, colors }: StepProps) {
    const Icon = step.icon;
    return (
        <Animated.View entering={FadeInDown.delay(index * 70).duration(450)} style={styles.stepCard}>
            <LinearGradient
                colors={['rgba(248, 250, 252, 0.07)', 'rgba(248, 250, 252, 0.02)']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />
            <View style={styles.stepHeader}>
                <View style={styles.stepNumberBadge}>
                    <Text style={styles.stepNumber}>{step.number}</Text>
                </View>
                <View style={styles.stepIconContainer}>
                    <Icon size={16} color={colors.primaryText} strokeWidth={2} />
                </View>
                <Text style={[styles.stepTitle, { color: colors.primaryText }]}>{tc(`edu.step${step.number}.title`, step.title)}</Text>
            </View>
            <Text style={[styles.stepDescription, { color: colors.secondaryText }]} selectable>{tc(`edu.step${step.number}.description`, step.description)}</Text>
            <View style={[styles.tipRow, { borderTopColor: 'rgba(255,255,255,0.06)' }]}>
                <Lightbulb size={13} color={colors.accent} strokeWidth={2.5} style={{ alignSelf: 'center', marginBottom: 6 }} />
                <Text style={[styles.tipText, { color: colors.accent, textAlign: 'center' }]} selectable>{tc(`edu.step${step.number}.tip`, step.tip)}</Text>
            </View>
        </Animated.View>
    );
}

interface FAQProps {
    item: typeof FAQS[0];
    index: number;
    colors: any;
}

function FAQItem({ item, index, colors }: FAQProps) {
    const [open, setOpen] = useState(false);
    return (
        <Animated.View entering={FadeInDown.delay(index * 60).duration(400)}>
            <TouchableOpacity
                style={[styles.faqItem, { borderColor: 'rgba(255,255,255,0.08)' }]}
                onPress={() => setOpen(v => !v)}
                activeOpacity={0.8}
            >
                <View style={styles.faqHeader}>
                    <Text style={[styles.faqQuestion, { color: colors.primaryText }]}>{tc(`edu.faq${index + 1}.q`, item.q)}</Text>
                    {open
                        ? <ChevronUp size={15} color={colors.secondaryText} />
                        : <ChevronDown size={15} color={colors.secondaryText} />
                    }
                </View>
                {open && (
                    <Text style={[styles.faqAnswer, { color: colors.secondaryText }]} selectable>{tc(`edu.faq${index + 1}.a`, item.a)}</Text>
                )}
            </TouchableOpacity>
        </Animated.View>
    );
}

export function EducationalContent() {
    const { colors } = useTheme();
    const scrollRef = useRef<ScrollView>(null);

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('scrollToTop', (tab: string) => {
            if (tab === 'Guide') scrollRef.current?.scrollTo({ y: 0, animated: true });
        });
        return () => sub.remove();
    }, []);

    return (
        <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={styles.container}
            showsVerticalScrollIndicator={false}
        >
            {/* Hero */}
            <Animated.View entering={FadeInUp.duration(550)} style={styles.hero}>
                <Moon size={38} color={colors.primaryText} strokeWidth={1.5} />
                <Text style={[styles.heroTitle, { color: colors.primaryText }]}>{tc('edu.hero.title', 'How to Pray Tahajjud')}</Text>
                <Text style={[styles.heroSubtitle, { color: colors.secondaryText }]} selectable>
                    {tc('edu.hero.subtitle', "A complete step-by-step guide for beginners and those returning to the night prayer.")}
                </Text>
            </Animated.View>

            {/* Steps */}
            <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: colors.accent }]}>{tc('edu.section1.label', 'THE 6 STEPS')}</Text>
                {STEPS.map((step, i) => (
                    <StepCard key={step.number} step={step} index={i} colors={colors} />
                ))}
            </View>

            {/* Witr Reminder */}
            <Animated.View entering={FadeInDown.delay(420).duration(450)} style={styles.witrCard}>
                <CheckCircle size={20} color={colors.accent} strokeWidth={2} />
                <View style={{ flex: 1 }}>
                    <Text style={[styles.witrTitle, { color: colors.primaryText }]}>{tc('edu.witr.title', "Don't Forget Witr")}</Text>
                    <Text style={[styles.witrDesc, { color: colors.secondaryText }]} selectable>
                        {tc('edu.witr.description', "Always end your night prayer with Witr — at least 1 rak'ah.\n\"Pray Witr before Fajr enters.\" — Sahih Muslim")}
                    </Text>
                </View>
            </Animated.View>

            {/* FAQ */}
            <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: colors.accent }]}>{tc('edu.section2.label', 'COMMON QUESTIONS')}</Text>
                {FAQS.map((item, i) => (
                    <FAQItem key={i} item={item} index={i} colors={colors} />
                ))}
            </View>

            {/* Closing */}
            <Animated.View entering={FadeInDown.delay(500).duration(450)} style={styles.closing}>
                <Text style={[styles.closingText, { color: colors.secondaryText }]} selectable>
                    {tc('edu.closing.text', "\"Start with two rak'ahs. Be sincere. Show up.\nAllah sees your effort.\"")}
                </Text>
            </Animated.View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingTop: 24,
        paddingBottom: 120,
        gap: 24,
    },
    hero: {
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        gap: 10,
    },
    heroTitle: {
        fontSize: 26,
        fontWeight: '800',
        textAlign: 'center',
        letterSpacing: -0.5,
        marginTop: 4,
    },
    heroSubtitle: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 22,
    },
    section: {
        gap: 10,
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 2,
        marginBottom: 4,
        paddingLeft: 4,
    },
    stepCard: {
        borderRadius: 20,
        padding: 18,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
        gap: 10,
    },
    stepHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    stepNumberBadge: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepNumber: {
        fontSize: 12,
        fontWeight: '800',
        color: '#f8fafc',
    },
    stepIconContainer: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.06)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepTitle: {
        flex: 1,
        fontSize: 15,
        fontWeight: '700',
    },
    stepDescription: {
        fontSize: 14,
        lineHeight: 22,
    },
    tipRow: {
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0,
        marginTop: 2,
        paddingTop: 10,
        borderTopWidth: 1,
    },
    tipText: {
        flex: 1,
        fontSize: 12,
        fontStyle: 'italic',
        lineHeight: 18,
    },
    witrCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        borderRadius: 16,
        padding: 16,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    witrTitle: {
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 5,
    },
    witrDesc: {
        fontSize: 13,
        lineHeight: 21,
    },
    faqItem: {
        borderRadius: 14,
        padding: 16,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1,
        gap: 8,
    },
    faqHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    faqQuestion: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        lineHeight: 20,
    },
    faqAnswer: {
        fontSize: 13,
        lineHeight: 21,
    },
    closing: {
        paddingHorizontal: 8,
        paddingBottom: 8,
        alignItems: 'center',
    },
    closingText: {
        fontSize: 14,
        fontStyle: 'italic',
        textAlign: 'center',
        lineHeight: 24,
    },
});
