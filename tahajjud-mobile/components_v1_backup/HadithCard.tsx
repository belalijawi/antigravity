import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BookOpen, Quote } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

interface HadithCardProps {
    text: string;
    source: string;
}

export function HadithCard({ text, source }: HadithCardProps) {
    return (
        <View style={styles.card}>
            <LinearGradient
                colors={['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.01)']}
                style={StyleSheet.absoluteFill}
            />
            <BlurView intensity={5} tint="dark" style={StyleSheet.absoluteFill} />

            <View style={styles.iconContainer}>
                <Quote size={20} color="#94a3b8" />
            </View>
            <View style={styles.content}>
                <Text style={styles.text}>{text}</Text>
                <Text style={styles.source}>— {source}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        borderRadius: 24,
        padding: 20,
        marginBottom: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        backgroundColor: 'transparent',
    },
    iconContainer: {
        width: 44,
        height: 44,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    content: {
        flex: 1,
    },
    text: {
        fontSize: 15,
        color: '#ffffff',
        lineHeight: 24,
        fontStyle: 'italic',
        marginBottom: 8,
    },
    source: {
        fontSize: 13,
        color: '#94a3b8',
        textAlign: 'right',
    },
});
