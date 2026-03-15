import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Book, Lightbulb } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTheme } from '../context/ThemeContext';

export function EducationalContent() {
    const { colors } = useTheme();

    return (
        <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.container}
            showsVerticalScrollIndicator={false}
        >
            <View style={styles.card}>
                <LinearGradient
                    colors={['rgba(248, 250, 252, 0.1)', 'rgba(203, 213, 225, 0.1)', 'rgba(15, 23, 42, 0.05)']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                />
                <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />

                <View style={styles.header}>
                    <View style={styles.iconContainer}>
                        <Lightbulb size={20} color={colors.primaryText} strokeWidth={2.5} />
                    </View>
                    <Text style={[styles.title, { color: colors.accent }]}>The Honor of the Believer</Text>
                </View>

                <View style={styles.contentBody}>
                    <Text style={[styles.text, { color: colors.secondaryText }]}>
                        Tahajjud is a voluntary night prayer performed after Isha and before Fajr. It is one of the most beloved acts of worship to Allah.
                    </Text>

                    <Text style={[styles.quoteText, { color: colors.primaryText, borderLeftColor: colors.primaryText }]}>
                        "The best prayer after the obligatory prayers is the night prayer."
                    </Text>

                    <Text style={[styles.sectionTitle, { color: colors.accent }]}>Spiritual Guide</Text>
                    <View style={styles.guideItem}>
                        <View style={styles.guideDot} />
                        <Text style={[styles.bulletText, { color: colors.secondaryText }]}>Make intention (Niyyah)</Text>
                    </View>
                    <View style={styles.guideItem}>
                        <View style={styles.guideDot} />
                        <Text style={[styles.bulletText, { color: colors.secondaryText }]}>Pray 2 rak'ahs at a time</Text>
                    </View>
                    <View style={styles.guideItem}>
                        <View style={styles.guideDot} />
                        <Text style={[styles.bulletText, { color: colors.secondaryText }]}>Best time: The last third of the night</Text>
                    </View>
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        paddingHorizontal: 16,
        paddingTop: 40,
        paddingBottom: 120, // Increased to clear hotbar
    },
    card: {
        borderRadius: 32,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
        backgroundColor: 'transparent',
    },
    header: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        gap: 12,
    },
    iconContainer: {
        width: 44,
        height: 44,
        backgroundColor: 'rgba(248, 250, 252, 0.1)',
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(248, 250, 252, 0.2)',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        letterSpacing: -0.5,
        textAlign: 'center',
    },
    contentBody: {
        gap: 16,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        marginTop: 8,
        textTransform: 'uppercase',
        letterSpacing: 2,
        textAlign: 'center',
    },
    text: {
        lineHeight: 24,
        fontSize: 15,
    },
    quoteText: {
        lineHeight: 24,
        fontSize: 15,
        fontStyle: 'italic',
        paddingLeft: 16,
        borderLeftWidth: 2,
    },
    guideItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    guideDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#475569',
    },
    bulletText: {
        fontSize: 14,
        fontWeight: '500',
    },
});
