import React, { useRef, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, DeviceEventEmitter } from 'react-native';
import { Heart, Sparkles, Moon, BookOpen, Trophy, Sunrise, Shield, Zap } from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { tc } from '../data/contentTranslations';

interface BenefitCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    colors: any;
    index: number;
}

function BenefitCard({ icon, title, description, colors, index }: BenefitCardProps) {
    return (
        <Animated.View entering={FadeInDown.delay(index * 80).duration(450)} style={styles.card}>
            <LinearGradient
                colors={['rgba(248,250,252,0.06)', 'rgba(248,250,252,0.01)']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />
            <View style={styles.iconContainer}>{icon}</View>
            <View style={styles.cardContent}>
                <Text style={[styles.cardTitle, { color: colors.primaryText }]}>{title}</Text>
                <Text style={[styles.cardDescription, { color: colors.secondaryText }]}>{description}</Text>
            </View>
        </Animated.View>
    );
}

interface QuoteCardProps {
    text: string;
    source: string;
    colors: any;
    index: number;
}

function QuoteCard({ text, source, colors, index }: QuoteCardProps) {
    return (
        <Animated.View entering={FadeInDown.delay(index * 80).duration(450)} style={[styles.quoteCard, { borderLeftColor: colors.accent }]}>
            <Text style={[styles.quoteText, { color: colors.primaryText }]}>"{text}"</Text>
            <Text style={[styles.quoteSource, { color: colors.secondaryText }]}>— {source}</Text>
        </Animated.View>
    );
}

export function WhyTahajjud() {
    const { colors } = useTheme();
    const scrollRef = useRef<ScrollView>(null);

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('scrollToTop', (tab: string) => {
            if (tab === 'Guide') scrollRef.current?.scrollTo({ y: 0, animated: true });
        });
        return () => sub.remove();
    }, []);

    return (
        <View style={styles.safeArea}>
            <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>

                {/* Header */}
                <Animated.View entering={FadeInUp.duration(550)} style={styles.header}>
                    <Moon size={48} color={colors.primaryText} strokeWidth={1.5} />
                    <Text style={[styles.headerTitle, { color: colors.accent }]}>
                        {tc('why.header.title', 'Discover the Beauty of Tahajjud')}
                    </Text>
                    <Text style={[styles.headerSubtitle, { color: colors.secondaryText }]}>
                        {tc('why.header.subtitle', 'The night prayer that transforms hearts and elevates souls')}
                    </Text>
                </Animated.View>

                {/* What Allah Says */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.accent }]}>{tc('why.section.whatAllahSays', 'What Allah Says')}</Text>
                    <QuoteCard
                        index={0}
                        colors={colors}
                        text={tc('why.quote1.text', "And from [part of] the night, pray with it as additional worship for you; it is expected that your Lord will resurrect you to a praised station.")}
                        source="Quran 17:79"
                    />
                    <QuoteCard
                        index={1}
                        colors={colors}
                        text={tc('why.quote2.text', "Indeed, the hours of the night are more effective for concurrence of heart and tongue and more suitable for words.")}
                        source="Quran 73:6"
                    />
                    <QuoteCard
                        index={2}
                        colors={colors}
                        text={tc('why.quote3.text', "They used to sleep but little of the night, and in the hours before dawn they would ask forgiveness.")}
                        source="Quran 51:17–18"
                    />
                    <QuoteCard
                        index={3}
                        colors={colors}
                        text={tc('why.quote4.text', "And those who spend [part of] the night to their Lord prostrating and standing [in prayer].")}
                        source="Quran 25:64"
                    />
                </View>

                {/* Spiritual Benefits */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.accent }]}>{tc('why.section.spiritualBenefits', 'Spiritual Benefits')}</Text>
                    <BenefitCard
                        index={0}
                        colors={colors}
                        icon={<Heart size={22} color={colors.primaryText} strokeWidth={2} />}
                        title={tc('why.benefit1.title', 'Closeness to Allah')}
                        description={tc('why.benefit1.description', "Allah descends to the lowest heaven in the last third of the night, asking: 'Is there anyone calling upon Me that I may answer him?' This is your direct line.")}
                    />
                    <BenefitCard
                        index={1}
                        colors={colors}
                        icon={<Sparkles size={22} color={colors.primaryText} strokeWidth={2} />}
                        title={tc('why.benefit2.title', 'Forgiveness of Sins')}
                        description={tc('why.benefit2.description', "The Prophet ﷺ said: 'At night there is an hour in which no Muslim asks Allah for good in this world or the next except that He gives it to him.' — Sahih Muslim")}
                    />
                    <BenefitCard
                        index={2}
                        colors={colors}
                        icon={<Trophy size={22} color={colors.primaryText} strokeWidth={2} />}
                        title={tc('why.benefit3.title', 'Elevated Status')}
                        description={tc('why.benefit3.description', "The people of Tahajjud are among the most honoured in Allah's sight. They choose sleep deprivation for His sake — and He raises them in ranks.")}
                    />
                    <BenefitCard
                        index={3}
                        colors={colors}
                        icon={<Shield size={22} color={colors.primaryText} strokeWidth={2} />}
                        title={tc('why.benefit4.title', 'Protection from Evil')}
                        description={tc('why.benefit4.description', "The night prayer is a shield. When you wake for Allah, Shaytan's grip weakens. The Prophet ﷺ said those who pray at night have their knots of Shaytan undone.")}
                    />
                </View>

                {/* Physical & Mental Benefits */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.accent }]}>{tc('why.section.mindBody', 'Mind & Body')}</Text>
                    <BenefitCard
                        index={0}
                        colors={colors}
                        icon={<Sunrise size={22} color={colors.primaryText} strokeWidth={2} />}
                        title={tc('why.benefit5.title', 'Deep Inner Peace')}
                        description={tc('why.benefit5.description', "The silence of the night removes all distractions. There is nothing between you and Allah — no notifications, no noise. Just you, the prayer mat, and the Most High.")}
                    />
                    <BenefitCard
                        index={1}
                        colors={colors}
                        icon={<BookOpen size={22} color={colors.primaryText} strokeWidth={2} />}
                        title={tc('why.benefit6.title', 'Clarity and Focus')}
                        description={tc('why.benefit6.description', "People who pray Tahajjud regularly report sharper thinking, better emotional regulation, and a profound sense of purpose throughout the day.")}
                    />
                    <BenefitCard
                        index={2}
                        colors={colors}
                        icon={<Zap size={22} color={colors.primaryText} strokeWidth={2} />}
                        title={tc('why.benefit7.title', 'Spiritual Momentum')}
                        description={tc('why.benefit7.description', "When you start your day having already worshipped Allah in secret, everything else feels aligned. It sets a tone of gratitude and tawakkul for the hours ahead.")}
                    />
                </View>

                {/* Prophetic Traditions */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.accent }]}>{tc('why.section.propheticGuidance', 'Prophetic Guidance')}</Text>
                    <QuoteCard
                        index={0}
                        colors={colors}
                        text={tc('why.quote5.text', "The best prayer after the obligatory prayers is the night prayer.")}
                        source="Sahih Muslim 1163"
                    />
                    <QuoteCard
                        index={1}
                        colors={colors}
                        text={tc('why.quote6.text', "The closest a servant is to his Lord is in the last part of the night. If you are able to be of those who remember Allah in that hour, then do so.")}
                        source="Tirmidhi 3579 · Hasan Sahih"
                    />
                    <QuoteCard
                        index={2}
                        colors={colors}
                        text={tc('why.quote7.text', "Hold fast to night prayer, for it was the way of the righteous before you, it brings you closer to your Lord, expiates sins, and prevents wrongdoing.")}
                        source="Tirmidhi · Authenticated"
                    />
                    <QuoteCard
                        index={3}
                        colors={colors}
                        text={tc('why.quote8.text', "The most beloved prayer to Allah is that of Dawud (AS) — he would sleep half the night, stand a third of it, then sleep a sixth.")}
                        source="Sahih Bukhari 1131"
                    />
                </View>

                {/* Personal Growth */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.accent }]}>{tc('why.section.personalGrowth', 'Personal Growth')}</Text>
                    <Animated.View entering={FadeInDown.delay(100).duration(450)} style={styles.listCard}>
                        {[
                            tc('why.list.item1', 'Builds unbreakable discipline and consistency'),
                            tc('why.list.item2', 'Strengthens willpower by choosing worship over comfort'),
                            tc('why.list.item3', 'Creates a foundation of daily gratitude'),
                            tc('why.list.item4', 'Develops patience and trust in Allah\'s plan'),
                            tc('why.list.item5', 'Sharpens self-awareness through nightly reflection'),
                            tc('why.list.item6', 'Transforms your relationship with sleep and time'),
                        ].map((item, i) => (
                            <View key={i} style={styles.listRow}>
                                <View style={[styles.listDot, { backgroundColor: colors.accent }]} />
                                <Text style={[styles.listItem, { color: colors.primaryText }]}>{item}</Text>
                            </View>
                        ))}
                    </Animated.View>
                </View>

                {/* Final Message */}
                <Animated.View entering={FadeInDown.delay(200).duration(450)} style={styles.finalMessage}>
                    <Text style={[styles.finalText, { color: colors.secondaryText }]}>
                        {tc('why.final.text', "\"The world is asleep, and you are awake for Allah.\nThat act alone is a conversation with the Divine.\"")}
                    </Text>
                    <Text style={[styles.finalCta, { color: colors.accent }]}>
                        {tc('why.final.cta', 'Start small. Stay consistent. Watch your life change.')}
                    </Text>
                </Animated.View>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    contentContainer: {
        paddingBottom: 180,
        gap: 32,
    },
    header: {
        alignItems: 'center',
        paddingTop: 32,
        paddingBottom: 8,
        paddingHorizontal: 24,
        gap: 12,
    },
    headerTitle: {
        fontSize: 26,
        fontWeight: '800',
        textAlign: 'center',
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 24,
        fontWeight: '500',
    },
    section: {
        paddingHorizontal: 16,
        gap: 10,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '800',
        marginBottom: 4,
        paddingLeft: 4,
        letterSpacing: -0.3,
    },
    card: {
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 18,
        padding: 16,
        overflow: 'hidden',
    },
    iconContainer: {
        width: 44,
        height: 44,
        backgroundColor: 'rgba(248, 250, 252, 0.08)',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
        flexShrink: 0,
    },
    cardContent: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 5,
    },
    cardDescription: {
        fontSize: 13,
        lineHeight: 21,
    },
    quoteCard: {
        backgroundColor: 'rgba(248, 250, 252, 0.04)',
        borderLeftWidth: 3,
        borderRadius: 12,
        padding: 18,
    },
    quoteText: {
        fontSize: 15,
        lineHeight: 26,
        fontStyle: 'italic',
        marginBottom: 10,
    },
    quoteSource: {
        fontSize: 12,
        textAlign: 'right',
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    listCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 18,
        padding: 20,
        gap: 12,
    },
    listRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    listDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginTop: 7,
        flexShrink: 0,
    },
    listItem: {
        flex: 1,
        fontSize: 14,
        lineHeight: 22,
    },
    finalMessage: {
        paddingHorizontal: 24,
        paddingBottom: 8,
        alignItems: 'center',
        gap: 12,
    },
    finalText: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 26,
        fontStyle: 'italic',
    },
    finalCta: {
        fontSize: 14,
        fontWeight: '700',
        textAlign: 'center',
    },
});
