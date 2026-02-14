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
                colors={['rgba(251, 191, 36, 0.15)', 'rgba(79, 70, 229, 0.05)', 'transparent']}
                style={StyleSheet.absoluteFill}
            />
            <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />

            <View style={[styles.iconContainer, { backgroundColor: 'rgba(248, 250, 252, 0.1)' }]}>
                <Quote size={20} color="#f8fafc" strokeWidth={2.5} />
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
        color: '#f1f5f9',
        lineHeight: 24,
        fontStyle: 'italic',
        marginBottom: 10,
        fontWeight: '500',
    },
    source: {
        fontSize: 13,
        color: '#94a3b8',
        textAlign: 'right',
    },
});
