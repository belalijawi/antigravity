import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Book, Lightbulb } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

export function EducationalContent() {
    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <LinearGradient
                    colors={['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.01)']}
                    style={StyleSheet.absoluteFill}
                />
                <BlurView intensity={5} tint="dark" style={StyleSheet.absoluteFill} />

                <View style={styles.header}>
                    <View style={styles.iconContainer}>
                        <Lightbulb size={20} color="#facc15" />
                    </View>
                    <Text style={styles.title}>The Honor of the Believer</Text>
                </View>

                <View style={styles.contentBody}>
                    <Text style={styles.text}>
                        Tahajjud is a voluntary night prayer performed after Isha and before Fajr. It is one of the most beloved acts of worship to Allah.
                    </Text>

                    <Text style={styles.quoteText}>
                        "The best prayer after the obligatory prayers is the night prayer."
                    </Text>

                    <Text style={styles.sectionTitle}>Spiritual Guide</Text>
                    <View style={styles.guideItem}>
                        <View style={styles.guideDot} />
                        <Text style={styles.bulletText}>Make intention (Niyyah)</Text>
                    </View>
                    <View style={styles.guideItem}>
                        <View style={styles.guideDot} />
                        <Text style={styles.bulletText}>Pray 2 rak'ahs at a time</Text>
                    </View>
                    <View style={styles.guideItem}>
                        <View style={styles.guideDot} />
                        <Text style={styles.bulletText}>Best time: The last third of the night</Text>
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        paddingHorizontal: 16,
        paddingVertical: 40,
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
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginBottom: 24,
    },
    iconContainer: {
        width: 44,
        height: 44,
        backgroundColor: 'rgba(250, 204, 21, 0.1)',
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(250, 204, 21, 0.2)',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#ffffff',
        letterSpacing: -0.5,
    },
    contentBody: {
        gap: 16,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#f8fafc',
        marginTop: 8,
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    text: {
        color: '#94a3b8',
        lineHeight: 24,
        fontSize: 15,
    },
    quoteText: {
        color: '#f8fafc',
        lineHeight: 24,
        fontSize: 15,
        fontStyle: 'italic',
        paddingLeft: 16,
        borderLeftWidth: 2,
        borderLeftColor: '#facc15',
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
        color: '#94a3b8',
        fontSize: 14,
        fontWeight: '500',
    },
});
