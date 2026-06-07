import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { GlassBg as BlurView } from './GlassBg';

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
            <BlurView
                intensity={isActive ? 40 : 10}
                tint="dark"
                style={StyleSheet.absoluteFill}
            />

            {isActive && (
                <LinearGradient
                    colors={['rgba(248, 250, 252, 0.2)', 'transparent']}
                    style={StyleSheet.absoluteFill}
                />
            )}

            <View style={styles.content}>
                <Text style={[
                    styles.name,
                    isActive ? styles.nameActive : styles.nameInactive
                ]}>
                    {name}
                </Text>
                <Text style={[styles.time, isActive && styles.timeActive]}>{time}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        marginBottom: 12,
        width: '31%', // Three in a row for compact bento look
        overflow: 'hidden',
        alignItems: 'center',
    },
    cardActive: {
        borderColor: 'rgba(248, 250, 252, 0.4)',
    },
    cardInactive: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    content: {
        alignItems: 'center',
        gap: 4,
    },
    name: {
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    nameActive: {
        color: '#f8fafc',
    },
    nameInactive: {
        color: '#94a3b8',
    },
    time: {
        fontSize: 16,
        fontWeight: '800',
        color: '#ffffff',
    },
    timeActive: {
        color: '#f8fafc',
    }
});
