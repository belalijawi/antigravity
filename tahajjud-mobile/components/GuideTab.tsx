import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WhyTahajjud } from './WhyTahajjud';
import { TestimoniesTab } from './TestimoniesTab';
import { EducationalContent } from './EducationalContent';
import { useTheme } from '../context/ThemeContext';
import { tabletContentStyle } from '../utils/layout';

export function GuideTab() {
    const { colors } = useTheme();
    const [activeSection, setActiveSection] = useState<'info' | 'testimonies' | 'guide'>('info');

    return (
        <SafeAreaView style={styles.container}>
            <View style={[{ flex: 1 }, tabletContentStyle()]}>
                <View style={styles.header}>
                    <View style={styles.pillContainer}>
                        <TouchableOpacity
                            style={[styles.pill, activeSection === 'info' && { backgroundColor: '#f8fafc' }]}
                            onPress={() => setActiveSection('info')}
                        >
                            <Text style={[styles.pillText, activeSection === 'info' && { color: '#020617' }]}>Wisdom</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.pill, activeSection === 'guide' && { backgroundColor: '#f8fafc' }]}
                            onPress={() => setActiveSection('guide')}
                        >
                            <Text style={[styles.pillText, activeSection === 'guide' && { color: '#020617' }]}>Guide</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.pill, activeSection === 'testimonies' && { backgroundColor: '#f8fafc' }]}
                            onPress={() => setActiveSection('testimonies')}
                        >
                            <Text style={[styles.pillText, activeSection === 'testimonies' && { color: '#020617' }]}>Stories</Text>
                        </TouchableOpacity>
                    </View>
                </View>
                <View style={{ flex: 1 }}>
                    {activeSection === 'info' ? <WhyTahajjud /> : activeSection === 'guide' ? <EducationalContent /> : <TestimoniesTab />}
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 8,
    },
    pillContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        padding: 4,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    pill: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 8,
    },
    pillText: {
        color: '#94a3b8',
        fontSize: 12,
        fontWeight: '800',
    }
});
