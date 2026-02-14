import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, SafeAreaView, Text, TouchableOpacity, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Settings } from 'lucide-react-native';
import { NightCalculator } from './NightCalculator';
import { EducationalContent } from './EducationalContent';
import { Tracker } from './Tracker';
import { HadithCard } from './HadithCard';
import { DuaNetwork } from './DuaNetwork';
import { SettingsScreen } from './SettingsScreen';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';

export function HomeTab() {
    const [userName, setUserName] = useState<string | null>(null);
    const [isSettingsVisible, setIsSettingsVisible] = useState(false);

    useEffect(() => {
        loadUserName();
    }, []);

    const loadUserName = async () => {
        try {
            const name = await AsyncStorage.getItem('user-name');
            if (name) setUserName(name);
        } catch (e) {
            console.error('Failed to load user name', e);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
                <View style={styles.header}>
                    <View style={styles.greetingSection}>
                        <Text style={styles.greetingText}>Assalamu Alaikum,</Text>
                        <Text style={styles.nameText}>{userName || 'Servant of Allah'}</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => setIsSettingsVisible(true)}
                        style={styles.settingsButton}
                    >
                        <Settings color="#94a3b8" size={24} />
                    </TouchableOpacity>
                </View>

                <Animated.View entering={FadeInDown.delay(200).duration(800)}>
                    <NightCalculator />
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(400).duration(800)}>
                    <DuaNetwork />
                </Animated.View>

                {/* Hadith References */}
                <Animated.View entering={FadeInDown.delay(600).duration(800)} style={styles.hadithSection}>
                    <HadithCard
                        text="The Lord descends every night to the lowest heaven when one-third of the night remains and says: 'Who will call upon Me, that I may answer Him? Who will ask of Me, that I may give him? Who will seek My forgiveness, that I may forgive him?'"
                        source="Sahih Bukhari 1145"
                    />

                    <HadithCard
                        text="The best prayer after the obligatory prayers is the night prayer."
                        source="Sahih Muslim 758"
                    />
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(800).duration(800)}>
                    <EducationalContent />
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(1000).duration(800)}>
                    <Tracker />
                </Animated.View>
            </ScrollView>

            <Modal
                visible={isSettingsVisible}
                animationType="slide"
                presentationStyle="fullScreen"
                onRequestClose={() => setIsSettingsVisible(false)}
            >
                <SettingsScreen onClose={() => setIsSettingsVisible(false)} />
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#020617',
    },
    container: {
        flex: 1,
        backgroundColor: '#020617',
    },
    contentContainer: {
        flexGrow: 1,
        paddingBottom: 40,
    },
    hadithSection: {
        paddingHorizontal: 16,
        paddingVertical: 24,
    },
    greetingSection: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingTop: 40,
        paddingBottom: 20,
    },
    settingsButton: {
        padding: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
    },
    greetingText: {
        fontSize: 16,
        color: '#94a3b8',
        fontWeight: '500',
    },
    nameText: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#ffffff',
        marginTop: 4,
    },
});
