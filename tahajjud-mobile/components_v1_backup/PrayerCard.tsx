import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

interface PrayerCardProps {
    name: string;
    time: string;
    isActive?: boolean;
}

export function PrayerCard({ name, time, isActive = false }: PrayerCardProps) {
    return (
        <View style={[
            styles.card,
            isActive ? styles.cardActive : styles.cardInactive
        ]}>
            {isActive && (
                <LinearGradient
                    colors={['rgba(248, 250, 252, 0.15)', 'rgba(248, 250, 252, 0.05)']}
                    style={StyleSheet.absoluteFill}
                />
            )}
            {!isActive && (
                <BlurView intensity={5} tint="dark" style={StyleSheet.absoluteFill} />
            )}

            <View style={styles.content}>
                <Text style={[
                    styles.name,
                    isActive ? styles.nameActive : styles.nameInactive
                ]}>
                    {name}
                </Text>
                <Text style={styles.time}>{time}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        borderRadius: 20,
        borderWidth: 1,
        marginBottom: 12,
        width: '48%',
        overflow: 'hidden',
    },
    cardActive: {
        backgroundColor: 'rgba(248, 250, 252, 0.1)',
        borderColor: 'rgba(248, 250, 252, 0.3)',
    },
    cardInactive: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    content: {
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    name: {
        fontSize: 12,
        fontWeight: '500',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
    },
    nameActive: {
        color: '#f8fafc',
    },
    nameInactive: {
        color: '#94a3b8',
    },
    time: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#ffffff',
    },
});
