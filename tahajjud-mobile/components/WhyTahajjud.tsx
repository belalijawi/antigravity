import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heart, Sparkles, Moon, BookOpen, Trophy, Sunrise } from 'lucide-react-native';

import { useTheme } from '../context/ThemeContext';

interface BenefitCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    colors: any;
}

function BenefitCard({ icon, title, description, colors }: BenefitCardProps) {
    return (
        <View style={styles.card}>
            <View style={styles.iconContainer}>
                {icon}
            </View>
            <View style={styles.cardContent}>
                <Text style={[styles.cardTitle, { color: colors.primaryText }]}>{title}</Text>
                <Text style={[styles.cardDescription, { color: colors.secondaryText }]}>{description}</Text>
            </View>
        </View>
    );
}

export function WhyTahajjud() {
    const { colors } = useTheme();

    return (
        <View style={styles.safeArea}>
            <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
                {/* Header */}
                <View style={styles.header}>
                    <Moon size={48} color={colors.primaryText} strokeWidth={1.5} />
                    <Text style={[styles.headerTitle, { color: colors.accent }]}>Discover the Beauty and Purpose of Tahajjud</Text>
                    <Text style={[styles.headerSubtitle, { color: colors.secondaryText }]}>
                        The night prayer that transforms hearts and elevates souls
                    </Text>
                </View>

                {/* Spiritual Benefits */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.accent }]}>Spiritual Benefits</Text>

                    <BenefitCard
                        colors={colors}
                        icon={<Heart size={24} color={colors.primaryText} />}
                        title="Closeness to Allah"
                        description="Tahajjud is a time when Allah descends to the lowest heaven, asking 'Is there anyone calling upon Me that I may answer him?'"
                    />

                    <BenefitCard
                        colors={colors}
                        icon={<Sparkles size={24} color={colors.primaryText} />}
                        title="Forgiveness of Sins"
                        description="The Prophet (ﷺ) said: 'Whoever prays at night, even if it is the length of milking a sheep, it will be recorded for him as a night prayer.'"
                    />

                    <BenefitCard
                        colors={colors}
                        icon={<Trophy size={24} color={colors.primaryText} />}
                        title="Elevated Status"
                        description="Allah says: 'They used to sleep but little of the night, and in the hours before dawn they would ask forgiveness.' (Quran 51:17-18)"
                    />
                </View>

                {/* Physical & Mental Benefits */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.accent }]}>Physical & Mental Benefits</Text>

                    <BenefitCard
                        colors={colors}
                        icon={<Sunrise size={24} color={colors.primaryText} />}
                        title="Peace of Mind"
                        description="Night prayer brings tranquility to the heart and clarity to the mind, reducing stress and anxiety."
                    />

                    <BenefitCard
                        colors={colors}
                        icon={<BookOpen size={24} color={colors.primaryText} />}
                        title="Improved Focus"
                        description="The silence of the night allows for deeper concentration in prayer and reflection on the Quran."
                    />
                </View>

                {/* Quranic References */}
                <View style={styles.quoteSection}>
                    <Text style={[styles.quoteTitle, { color: colors.accent }]}>What Allah Says</Text>

                    <View style={styles.quoteCard}>
                        <Text style={[styles.quoteText, { color: colors.primaryText }]}>
                            "And from [part of] the night, pray with it as additional [worship] for you; it is expected that your Lord will resurrect you to a praised station."
                        </Text>
                        <Text style={[styles.quoteSource, { color: colors.secondaryText }]}>— Quran 17:79</Text>
                    </View>

                    <View style={styles.quoteCard}>
                        <Text style={[styles.quoteText, { color: colors.primaryText }]}>
                            "Indeed, the hours of the night are more effective for concurrence [of heart and tongue] and more suitable for words."
                        </Text>
                        <Text style={[styles.quoteSource, { color: colors.secondaryText }]}>— Quran 73:6</Text>
                    </View>
                </View>

                {/* Prophetic Traditions */}
                <View style={styles.quoteSection}>
                    <Text style={[styles.quoteTitle, { color: colors.accent }]}>Prophetic Guidance</Text>

                    <View style={styles.quoteCard}>
                        <Text style={[styles.quoteText, { color: colors.primaryText }]}>
                            "The best prayer after the obligatory prayers is the night prayer."
                        </Text>
                        <Text style={[styles.quoteSource, { color: colors.secondaryText }]}>— Sahih Muslim</Text>
                    </View>

                    <View style={styles.quoteCard}>
                        <Text style={[styles.quoteText, { color: colors.primaryText }]}>
                            "You should pray at night, even if it is only one rak'ah."
                        </Text>
                        <Text style={[styles.quoteSource, { color: colors.secondaryText }]}>— Sunan Ibn Majah</Text>
                    </View>
                </View>

                {/* Personal Growth */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.accent }]}>Personal Growth</Text>

                    <View style={styles.listCard}>
                        <Text style={[styles.listItem, { color: colors.primaryText }]}>• Builds discipline and consistency</Text>
                        <Text style={[styles.listItem, { color: colors.primaryText }]}>• Strengthens willpower and determination</Text>
                        <Text style={[styles.listItem, { color: colors.primaryText }]}>• Creates a habit of gratitude</Text>
                        <Text style={[styles.listItem, { color: colors.primaryText }]}>• Develops patience and perseverance</Text>
                        <Text style={[styles.listItem, { color: colors.primaryText }]}>• Enhances self-awareness and reflection</Text>
                    </View>
                </View>

                {/* Final Message */}
                <View style={styles.finalMessage}>
                    <Text style={[styles.finalText, { color: colors.primaryText }]}>
                        Start small, stay consistent, and watch your life transform through the blessing of Tahajjud.
                    </Text>
                </View>
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
    },
    header: {
        alignItems: 'center',
        paddingVertical: 40,
        paddingHorizontal: 24,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#facc15', // Fallback
        textAlign: 'center',
        marginTop: 16,
        marginBottom: 12,
    },
    headerSubtitle: {
        fontSize: 16,
        color: '#cbd5e1', // Fallback
        textAlign: 'center',
        lineHeight: 24,
        fontWeight: '600',
    },
    section: {
        paddingHorizontal: 16,
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#facc15', // Fallback
        marginBottom: 16,
        paddingLeft: 8,
    },
    card: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
    },
    iconContainer: {
        width: 48,
        height: 48,
        backgroundColor: 'rgba(248, 250, 252, 0.1)',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    cardContent: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#f8fafc', // Fallback
        marginBottom: 6,
    },
    cardDescription: {
        fontSize: 14,
        color: '#cbd5e1', // Fallback
        lineHeight: 22,
        fontWeight: '500',
    },
    quoteSection: {
        paddingHorizontal: 16,
        marginBottom: 32,
    },
    quoteTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#facc15', // Fallback
        marginBottom: 16,
        paddingLeft: 8,
    },
    quoteCard: {
        backgroundColor: 'rgba(248, 250, 252, 0.04)',
        borderLeftWidth: 4,
        borderLeftColor: '#f8fafc',
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#ffffff',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    quoteText: {
        fontSize: 16,
        color: '#f8fafc', // Fallback
        lineHeight: 26,
        fontStyle: 'italic',
        marginBottom: 12,
    },
    quoteSource: {
        fontSize: 13,
        color: '#cbd5e1', // Fallback
        textAlign: 'right',
        fontWeight: '700',
    },
    listCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 16,
        padding: 20,
    },
    listItem: {
        fontSize: 15,
        color: '#f8fafc', // Fallback
        lineHeight: 28,
        marginBottom: 4,
    },
    finalMessage: {
        paddingHorizontal: 24,
        paddingVertical: 32,
        alignItems: 'center',
    },
    finalText: {
        fontSize: 17,
        color: '#f8fafc', // Fallback
        textAlign: 'center',
        lineHeight: 28,
        fontWeight: '500',
    },
});
