import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Testimony } from '../data/testimonies';
import { Moon } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

interface QuoteShareCardProps {
    testimony: Testimony | null;
}

export const QuoteShareCard = React.forwardRef<View, QuoteShareCardProps>(({ testimony }, ref) => {
    const { colors } = useTheme();
    return (
        <View ref={ref} style={styles.cardContainer} collapsable={false}>
            {testimony ? (
                <>
                    {/* Background Layer */}
                    <View style={styles.background} />

                    <View style={styles.content}>
                        {/* Logo / Header */}
                        <View style={styles.header}>
                            <Moon size={24} color={colors.primaryText} fill={colors.primaryText} />
                            <Text style={[styles.appName, { color: colors.accent }]}>Tahajjud+</Text>
                        </View>

                        {/* Quote Body */}
                        <Text style={styles.quoteBody}>
                            "{testimony.body}"
                        </Text>

                        {/* Footer */}
                        <View style={styles.divider} />
                        <View style={styles.footer}>
                            <Text style={[styles.title, { color: colors.accent }]}>{testimony.title}</Text>
                            <Text style={styles.author}>{testimony.author}</Text>
                        </View>
                    </View>
                </>
            ) : (
                <View style={{ flex: 1, backgroundColor: '#020617' }} />
            )}
        </View>
    );
});

const styles = StyleSheet.create({
    cardContainer: {
        width: 1080, // High res for sharing
        height: 1080, // Square aspect ratio
        backgroundColor: '#020617',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 80,
    },
    background: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#020617',
    },
    content: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 40,
        borderColor: 'rgba(248, 250, 252, 0.3)', // Platinum border
        borderWidth: 2,
        borderRadius: 40,
        paddingHorizontal: 60,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginBottom: 40,
    },
    appName: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#facc15',
        letterSpacing: 2,
    },
    quoteBody: {
        fontSize: 48,
        color: '#ffffff',
        textAlign: 'center',
        lineHeight: 80,
        fontFamily: 'System',
        fontWeight: '500',
        fontStyle: 'italic',
    },
    divider: {
        width: 100,
        height: 4,
        backgroundColor: '#f8fafc',
        borderRadius: 2,
        marginVertical: 40,
        opacity: 0.5,
    },
    footer: {
        alignItems: 'center',
        marginTop: 20,
    },
    title: {
        fontSize: 36,
        color: '#facc15',
        fontWeight: 'bold',
        marginBottom: 16,
        textAlign: 'center',
    },
    author: {
        fontSize: 28,
        color: '#94a3b8',
        fontWeight: '500',
    }
});
