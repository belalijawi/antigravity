import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert, Modal, KeyboardAvoidingView, Platform, ScrollView as RNScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Heart, Volume2, Square, Plus, X, Trash2, Mail, PenTool, Sprout, Lock } from 'lucide-react-native';
import { duaDatabase, categories, Dua } from '../data/duas';
import { getBookmarkedDuas, toggleBookmark } from '../utils/bookmarks';
import { getPersonalDuas, savePersonalDua, deletePersonalDua, PersonalDua } from '../utils/personalDuas';
import { checkAchievements } from '../utils/achievements';
import * as Speech from 'expo-speech';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';
import { fetchCloudData } from '../utils/syncService';
import { getFirebaseAuth } from '../utils/firebase';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { usePurchases } from '../context/PurchasesContext';
import { tabletContentStyle } from '../utils/layout';

interface DuaCardProps {
    dua: Dua;
    isBookmarked?: boolean;
    onToggleBookmark?: (duaId: string) => void;
    isPlaying?: boolean;
    onPlay?: () => void;
    onDelete?: () => void;
}

// Memoized DuaCard to prevent unnecessary re-renders
const DuaCard = React.memo(({ dua, isBookmarked, onToggleBookmark, isPlaying, onPlay, onDelete }: DuaCardProps) => {
    const { colors } = useTheme();
    return (
        <Animated.View
            entering={FadeInDown.duration(600)}
            style={styles.duaCard}
        >
            <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFill} />
            <LinearGradient
                colors={['rgba(255, 255, 255, 0.05)', 'transparent']}
                style={StyleSheet.absoluteFill}
            />

            <View style={styles.duaCardContent}>
                <View style={styles.duaCardHeader}>
                    <View style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeText}>{dua.category}</Text>
                    </View>
                    <View style={styles.cardActions}>
                        {onPlay && (
                            <TouchableOpacity
                                onPress={onPlay}
                                style={styles.actionButton}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                {isPlaying ? (
                                    <Square size={18} color="#f8fafc" fill="#f8fafc" />
                                ) : (
                                    <Volume2 size={20} color="#94a3b8" />
                                )}
                            </TouchableOpacity>
                        )}
                        {onToggleBookmark && (
                            <TouchableOpacity
                                onPress={() => onToggleBookmark(dua.id)}
                                style={styles.actionButton}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Heart
                                    size={20}
                                    color={isBookmarked ? '#f8fafc' : '#94a3b8'}
                                    fill={isBookmarked ? '#f8fafc' : 'none'}
                                />
                            </TouchableOpacity>
                        )}
                        {onDelete && (
                            <TouchableOpacity
                                onPress={onDelete}
                                style={styles.actionButton}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Trash2 size={18} color="#ef4444" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                <Text style={styles.duaTitle}>{dua.title}</Text>

                {dua.category === 'Personal' && dua.translation ? (
                    <View style={styles.letterContentContainer}>
                        <Text style={styles.letterText}>{dua.translation}</Text>
                    </View>
                ) : (
                    <>
                        {dua.arabic ? (
                            <View style={styles.arabicContainer}>
                                <Text style={styles.arabicText}>{dua.arabic}</Text>
                            </View>
                        ) : null}

                        {dua.transliteration ? (
                            <View style={styles.transliterationContainer}>
                                <Text style={[styles.transliterationLabel, { color: '#94a3b8' }]}>Transliteration</Text>
                                <Text style={[styles.transliterationText, { color: '#cbd5e1' }]}>{dua.transliteration}</Text>
                            </View>
                        ) : null}

                        {dua.translation ? (
                            <View style={styles.translationContainer}>
                                <Text style={[styles.translationLabel, { color: colors.accent }]}>Translation</Text>
                                <Text style={[styles.translationText, { color: '#f8fafc' }]}>{dua.translation}</Text>
                            </View>
                        ) : null}
                    </>
                )}

                <View style={styles.cardFooter}>
                    <View style={styles.footerLine} />
                    <Text style={styles.sourceText}>{dua.source}</Text>
                </View>
            </View>
        </Animated.View>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.isBookmarked === nextProps.isBookmarked &&
        prevProps.isPlaying === nextProps.isPlaying &&
        prevProps.dua.id === nextProps.dua.id
    );
});


const FREE_DUA_LIMIT = 3;

export function DuasTab() {
    const { colors } = useTheme();
    const { isPremium } = usePurchases();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
    const [playingDuaId, setPlayingDuaId] = useState<string | null>(null);
    const [voiceIdentifier, setVoiceIdentifier] = useState<string | null>(null);

    // Personal Dua State
    const [activeTab, setActiveTab] = useState<'library' | 'personal'>('library');
    const [isLocked, setIsLocked] = useState(false);
    const [personalDuas, setPersonalDuas] = useState<PersonalDua[]>([]);
    const [isModalVisible, setIsModalVisible] = useState(false);

    // Form State
    const [newDuaTitle, setNewDuaTitle] = useState('');
    const [newDuaArabic, setNewDuaArabic] = useState('');
    const [newDuaTranslation, setNewDuaTranslation] = useState('');
    const [newDuaTransliteration, setNewDuaTransliteration] = useState('');
    const [newDuaNotes, setNewDuaNotes] = useState('');

    // Load data on mount
    useEffect(() => {
        loadBookmarks();
        loadVoice();
        loadPersonalDuasData();
        checkLockStatus();
        return () => {
            Speech.stop();
        };
    }, []);

    const checkLockStatus = async () => {
        const locked = await AsyncStorage.getItem('biometric-lock-enabled');
        setIsLocked(locked === 'true');
    };

    const handleTabChange = async (tab: 'library' | 'personal') => {
        if (tab === 'personal') {
            const locked = await AsyncStorage.getItem('biometric-lock-enabled');
            if (locked === 'true') {
                const { success } = await LocalAuthentication.authenticateAsync({
                    promptMessage: 'Access your private letters',
                    cancelLabel: 'Cancel',
                });

                if (!success) return; // Stay on library
            }
        }
        setActiveTab(tab);
    };

    const loadPersonalDuasData = async () => {
        // 1. Load local data first for speed
        const localDuas = await getPersonalDuas();
        setPersonalDuas(localDuas);

        // 2. If authenticated via Firebase, try to fetch fresh data from cloud
        const auth = getFirebaseAuth();
        const firebaseUser = auth?.currentUser;
        if (firebaseUser) {
            const cloudDuas = await fetchCloudData(firebaseUser.uid);
            if (cloudDuas.length > 0) {
                setPersonalDuas(cloudDuas);
                await AsyncStorage.setItem('personal-duas', JSON.stringify(cloudDuas));
            }
        }
    };

    const handleSaveDua = async () => {
        if (!newDuaTranslation.trim()) {
            Alert.alert('Empty Letter', 'Please write something in your letter to Allah.');
            return;
        }

        // Free limit check
        if (!isPremium && personalDuas.length >= FREE_DUA_LIMIT) {
            Alert.alert(
                'Upgrade to Tahajjud+',
                `Free users can save up to ${FREE_DUA_LIMIT} personal duas. Upgrade to save unlimited letters to Allah.`,
                [{ text: 'Not now', style: 'cancel' }, { text: 'Upgrade', style: 'default', onPress: () => setIsModalVisible(false) }]
            );
            return;
        }

        const date = new Date();
        const formattedDate = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const newDua: PersonalDua = {
            id: Date.now().toString(),
            title: newDuaTitle.trim() || `Letter · ${formattedDate}`,
            arabic: newDuaArabic,
            transliteration: newDuaTransliteration,
            translation: newDuaTranslation,
            notes: newDuaNotes,
            createdAt: Date.now(),
        };

        await savePersonalDua(newDua);
        const updatedDuas = [newDua, ...personalDuas];
        setPersonalDuas(updatedDuas);
        setIsModalVisible(false);
        resetForm();

        // Check for achievements
        const newlyUnlocked = await checkAchievements('dua', updatedDuas.length);
        if (newlyUnlocked) {
            Alert.alert(
                "Achievement Unlocked! 🏅",
                `Congratulations! You earned the "${newlyUnlocked.title}" badge for your Tahajjud Letters.\n\n${newlyUnlocked.description}`,
                [{ text: "MashAllah!" }]
            );
        }
    };

    const handleDeleteDua = async (id: string) => {
        Alert.alert(
            "Delete Dua",
            "Are you sure you want to delete this dua?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        await deletePersonalDua(id);
                        setPersonalDuas(prev => prev.filter(d => d.id !== id));
                    }
                }
            ]
        );
    };

    const resetForm = () => {
        setNewDuaTitle('');
        setNewDuaArabic('');
        setNewDuaTranslation('');
        setNewDuaTransliteration('');
        setNewDuaNotes('');
    };

    const loadVoice = async () => {
        try {
            const voices = await Speech.getAvailableVoicesAsync();

            // Log all Arabic voices to help debugging (if we could see logs)
            const arabicVoices = voices.filter(v => v.language.includes('ar'));
            console.log('[Audio] Available Arabic voices:', arabicVoices.map(v => v.name));

            // Priority list for better quality voices
            // "Maged" is a high-quality male voice on iOS
            // "Tarik" is another male voice
            const preferredNames = ['Maged', 'Tarik', 'Majed'];

            let selectedVoice = null;

            // 1. Try to find a preferred voice
            for (const name of preferredNames) {
                selectedVoice = arabicVoices.find(v => v.name.includes(name));
                if (selectedVoice) break;
            }

            // 2. If not found, pick any Arabic voice
            if (!selectedVoice) {
                selectedVoice = arabicVoices[0];
            }

            if (selectedVoice) {
                console.log('[Audio] Selected voice:', selectedVoice.name);
                setVoiceIdentifier(selectedVoice.identifier);
            }
        } catch (e) {
            console.log('Error loading voices', e);
        }
    };

    const loadBookmarks = async () => {
        const bookmarks = await getBookmarkedDuas();
        setBookmarkedIds(bookmarks);
    };

    const handleToggleBookmark = useCallback(async (duaId: string) => {
        await toggleBookmark(duaId);
        // Optimistic update
        setBookmarkedIds(prev =>
            prev.includes(duaId)
                ? prev.filter(id => id !== duaId)
                : [...prev, duaId]
        );
    }, []);

    const handlePlayDua = useCallback(async (dua: Dua) => {
        try {
            // If tapping the same card that is already playing, stop it.
            if (playingDuaId === dua.id) {
                Speech.stop();
                setPlayingDuaId(null);
                return;
            }

            // If switching to a new card, stop previous immediately
            Speech.stop();
            setPlayingDuaId(dua.id);

            // Small delay to ensure the engine is ready
            setTimeout(() => {
                const options: Speech.SpeechOptions = {
                    rate: 0.85, // Slower for more solemn recitation
                    pitch: 1.0, // Natural pitch
                    onDone: () => setPlayingDuaId(null),
                    onStopped: () => setPlayingDuaId(null),
                    onError: (e) => {
                        console.log('Speech error:', e);
                        setPlayingDuaId(null);
                    }
                };

                // Only set voice/language if we are sure we have an Arabic voice
                if (voiceIdentifier) {
                    options.voice = voiceIdentifier;
                    options.language = 'ar';
                } else {
                    // Fallback to system default (likely English on Simulator)
                    console.log('[Audio] Using system default voice');
                }

                Speech.speak(dua.arabic, options);
            }, 100);

        } catch (error) {
            console.error('Playback failed', error);
            setPlayingDuaId(null);
            Alert.alert('Error', 'Unable to play audio.');
        }
    }, [playingDuaId, voiceIdentifier]);

    const filteredDuas = useMemo(() => {
        return duaDatabase.filter(dua => {
            // Filter by bookmarked
            if (selectedCategory === 'Bookmarked') {
                if (!bookmarkedIds.includes(dua.id)) return false;
            } else if (selectedCategory !== 'All') {
                if (dua.category !== selectedCategory) return false;
            }

            // Filter by search
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                return (
                    dua.title.toLowerCase().includes(query) ||
                    dua.category.toLowerCase().includes(query) ||
                    dua.translation.toLowerCase().includes(query)
                );
            }

            return true;
        });
    }, [selectedCategory, searchQuery, bookmarkedIds]);

    // Add Bookmarked to categories
    const allCategories = useMemo(() => ['All', 'Bookmarked', ...categories.slice(1)], []);

    const renderDuaItem = useCallback(({ item }: { item: Dua }) => (
        <DuaCard
            dua={item}
            isBookmarked={bookmarkedIds.includes(item.id)}
            onToggleBookmark={handleToggleBookmark}
            isPlaying={playingDuaId === item.id}
            onPlay={() => handlePlayDua(item)}
        />
    ), [bookmarkedIds, playingDuaId, handleToggleBookmark, handlePlayDua]);

    const renderPersonalDuaItem = useCallback(({ item }: { item: PersonalDua }) => {
        const adaptedDua: Dua = {
            id: item.id,
            title: item.title,
            arabic: item.arabic || '',
            translation: item.translation || '',
            transliteration: item.transliteration || '',
            source: 'My Journal',
            category: 'Personal'
        };

        return (
            <DuaCard
                dua={adaptedDua}
                onDelete={() => handleDeleteDua(item.id)}
            />
        );
    }, [handleDeleteDua]);

    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
                {selectedCategory === 'Bookmarked'
                    ? 'No bookmarked duas yet. Tap the heart icon to save your favorites!'
                    : 'No duas found'}
            </Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <View style={[styles.container, tabletContentStyle()]}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={[styles.headerTitle, { color: colors.accent }]}>Duas</Text>
                    <View style={styles.tabsContainer}>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'library' && styles.activeTab]}
                            onPress={() => handleTabChange('library')}
                        >
                            <Text style={[styles.tabText, activeTab === 'library' && styles.activeTabText]}>Library</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'personal' && styles.activeTab]}
                            onPress={() => handleTabChange('personal')}
                        >
                            <Text style={[styles.tabText, activeTab === 'personal' && styles.activeTabText]}>Letters</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {activeTab === 'library' ? (
                    <FlatList
                        style={{ flex: 1 }}
                        data={filteredDuas}
                        renderItem={renderDuaItem}
                        keyExtractor={item => item.id}
                        contentContainerStyle={[styles.duasContent, { flexGrow: 1 }]}
                        ListHeaderComponent={
                            <View>
                                {/* Search Bar */}
                                <View style={styles.searchContainer}>
                                    <Search size={20} color="#94a3b8" style={styles.searchIcon} />
                                    <TextInput
                                        style={styles.searchInput}
                                        placeholder="Search duas..."
                                        placeholderTextColor="#94a3b8"
                                        value={searchQuery}
                                        onChangeText={setSearchQuery}
                                    />
                                </View>

                                {/* Category Pills */}
                                <View style={styles.categoriesContainer}>
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={styles.categoriesContent}
                                    >
                                        {allCategories.map(category => (
                                            <TouchableOpacity
                                                key={category}
                                                onPress={() => setSelectedCategory(category)}
                                                style={[
                                                    styles.categoryPill,
                                                    selectedCategory === category && styles.categoryPillActive
                                                ]}
                                            >
                                                <Text style={[
                                                    styles.categoryText,
                                                    selectedCategory === category && styles.categoryTextActive
                                                ]}>
                                                    {category}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            </View>
                        }
                        ListEmptyComponent={renderEmptyState}
                        initialNumToRender={5}
                        maxToRenderPerBatch={10}
                        windowSize={5}
                        showsVerticalScrollIndicator={false}
                    />
                ) : (
                    <View style={{ flex: 1 }}>
                        <FlatList
                            style={{ flex: 1 }}
                            data={personalDuas}
                            renderItem={renderPersonalDuaItem}
                            keyExtractor={item => item.id}
                            contentContainerStyle={[styles.duasContent, { flexGrow: 1 }]}
                            ListEmptyComponent={() => (
                                <View style={styles.emptyState}>
                                    <Text style={styles.emptyText}>Your heart's journey is a private conversation.</Text>
                                    <Text style={styles.emptySubtext}>Tap the ✉️ icon to write your first letter to Allah.</Text>
                                </View>
                            )}
                            showsVerticalScrollIndicator={false}
                        />
                        <TouchableOpacity
                            style={[styles.fab, { backgroundColor: colors.accent, shadowColor: colors.shadow }]}
                            onPress={() => setIsModalVisible(true)}
                        >
                            <Mail color="#020617" size={24} />
                            {!isPremium && (
                                <View style={styles.fabBadge}>
                                    <Text style={styles.fabBadgeText}>
                                        {personalDuas.length}/{FREE_DUA_LIMIT}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {/* Add Dua Modal */}
                <Modal
                    visible={isModalVisible}
                    animationType="slide"
                    transparent={true}
                    onRequestClose={() => setIsModalVisible(false)}
                >
                    <KeyboardAvoidingView
                        behavior={Platform.OS === "ios" ? "padding" : "height"}
                        style={styles.modalContainer}
                    >
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <View>
                                    <Text style={styles.modalTitle}>Tahajjud Letter</Text>
                                    <Text style={styles.modalSubtitle}>Write freely to your Lord...</Text>
                                </View>
                                <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                                    <X color="#94a3b8" size={24} />
                                </TouchableOpacity>
                            </View>

                            <RNScrollView
                                style={styles.formScrollView}
                                showsVerticalScrollIndicator={false}
                            >
                                <View style={styles.letterWritingArea}>
                                    <TextInput
                                        style={[styles.input, styles.letterTitleInput]}
                                        placeholder="Optional Title (e.g. For my parents)"
                                        placeholderTextColor="#64748b"
                                        value={newDuaTitle}
                                        onChangeText={setNewDuaTitle}
                                    />

                                    <View style={styles.divider} />

                                    <TextInput
                                        style={[styles.input, styles.letterTextArea]}
                                        placeholder="What is on your heart tonight? Pour it all out here... Allah is listening."
                                        placeholderTextColor="#475569"
                                        value={newDuaTranslation}
                                        onChangeText={setNewDuaTranslation}
                                        multiline
                                        autoFocus
                                    />
                                </View>

                                {/* Hidden Advanced Options Toggle */}
                                <TouchableOpacity
                                    style={styles.advancedToggle}
                                    onPress={() => Alert.alert("Tip", "You can just write in English/your language. Allah understands all hearts.")}
                                >
                                    <Text style={styles.advancedToggleText}>Need to add Arabic or Notes?</Text>
                                </TouchableOpacity>
                            </RNScrollView>

                            <TouchableOpacity
                                style={[styles.saveButton, { backgroundColor: colors.accent, shadowColor: colors.shadow }]}
                                onPress={handleSaveDua}
                            >
                                <Text style={styles.saveButtonText}>Entrust to Allah ✨</Text>
                            </TouchableOpacity>
                        </View>
                    </KeyboardAvoidingView>
                </Modal>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    container: {
        flex: 1,
    },
    header: {
        paddingTop: 32,
        paddingHorizontal: 24,
        paddingBottom: 20,
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: '900',
        letterSpacing: -1,
    },
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 16,
        padding: 4,
        marginTop: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 12,
    },
    activeTab: {
        backgroundColor: '#f8fafc',
    },
    tabText: {
        color: '#94a3b8',
        fontWeight: '700',
        fontSize: 14,
    },
    activeTabText: {
        color: '#020617',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 20,
        marginBottom: 20,
        paddingHorizontal: 20,
        height: 56,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
    },
    searchIcon: {
        marginRight: 12,
    },
    searchInput: {
        flex: 1,
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
    categoriesContainer: {
        height: 44,
        marginBottom: 24,
    },
    categoriesContent: {
        paddingHorizontal: 20,
        gap: 10,
    },
    categoryPill: {
        height: 40,
        paddingHorizontal: 18,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    categoryPillActive: {
        backgroundColor: 'rgba(248, 250, 252, 0.1)',
        borderColor: '#f8fafc',
    },
    categoryText: {
        color: '#64748b',
        fontSize: 13,
        fontWeight: '700',
    },
    categoryTextActive: {
        color: '#f8fafc',
    },
    duasContent: {
        paddingHorizontal: 20,
        paddingBottom: 180,
    },
    emptyState: {
        paddingVertical: 80,
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyText: {
        color: '#f8fafc',
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
    },
    emptySubtext: {
        color: '#64748b',
        fontSize: 14,
        marginTop: 12,
        textAlign: 'center',
        lineHeight: 20,
    },
    duaCard: {
        borderRadius: 24,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
    },
    duaCardContent: {
        padding: 24,
    },
    duaCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    categoryBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    categoryBadgeText: {
        color: '#cbd5e1',
        fontSize: 11,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    cardActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    actionButton: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    duaTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#f8fafc',
        marginBottom: 20,
        lineHeight: 30,
    },
    arabicContainer: {
        backgroundColor: 'rgba(248, 250, 252, 0.03)',
        padding: 24,
        borderRadius: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(248, 250, 252, 0.08)',
    },
    arabicText: {
        fontSize: 26,
        color: '#ffffff',
        textAlign: 'right',
        lineHeight: 48,
        fontFamily: Platform.OS === 'ios' ? 'Amiri' : 'System',
    },
    transliterationContainer: {
        marginBottom: 16,
    },
    transliterationLabel: {
        fontSize: 11,
        color: '#94a3b8', // Stardust Grey
        marginBottom: 6,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    transliterationText: {
        fontSize: 15,
        color: '#cbd5e1', // Lighter Grey for readability
        fontStyle: 'italic',
        lineHeight: 24,
        fontWeight: '700',
    },
    translationContainer: {
        marginBottom: 20,
    },
    translationLabel: {
        fontSize: 11,
        marginBottom: 6,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    translationText: {
        fontSize: 16,
        color: '#f8fafc', // Moonlight White
        lineHeight: 28,
        fontWeight: '600',
    },
    cardFooter: {
        marginTop: 12,
    },
    footerLine: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        marginBottom: 16,
    },
    sourceText: {
        fontSize: 11,
        color: '#94a3b8',
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    input: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        padding: 16,
        color: '#ffffff',
        fontSize: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    letterContentContainer: {
        paddingVertical: 12,
    },
    letterText: {
        color: '#f8fafc',
        fontSize: 18,
        lineHeight: 30,
        fontWeight: '400',
    },
    fab: {
        position: 'absolute',
        bottom: 140,
        right: 24,
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        overflow: 'visible', // Ensure shadow is seen
    },
    fabBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#0f172a',
        borderRadius: 10,
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        minWidth: 28,
        alignItems: 'center',
    },
    fabBadgeText: {
        color: '#94a3b8',
        fontSize: 9,
        fontWeight: '800',
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(2, 6, 23, 0.85)',
    },
    modalContent: {
        backgroundColor: '#0f172a',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 32,
        maxHeight: '90%',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 32,
    },
    modalTitle: {
        fontSize: 28,
        fontWeight: '900',
        color: '#ffffff',
        letterSpacing: -0.5,
    },
    modalSubtitle: {
        color: '#64748b',
        fontSize: 15,
        marginTop: 4,
        fontWeight: '500',
    },
    formScrollView: {
        marginBottom: 24,
    },
    letterWritingArea: {
        paddingBottom: 40,
    },
    letterTitleInput: {
        fontSize: 24,
        fontWeight: '800',
        color: '#ffffff',
        marginBottom: 16,
        padding: 0,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        marginBottom: 24,
    },
    letterTextArea: {
        fontSize: 18,
        color: '#f8fafc',
        lineHeight: 28,
        minHeight: 300,
        textAlignVertical: 'top',
        padding: 0,
    },
    saveButton: {
        paddingVertical: 18,
        borderRadius: 20,
        alignItems: 'center',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    saveButtonText: {
        color: '#020617',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 0.2,
    },
    advancedToggle: {
        marginTop: 24,
        alignItems: 'center',
    },
    advancedToggleText: {
        color: '#475569',
        fontSize: 13,
        fontWeight: '600',
        textDecorationLine: 'underline',
    }
});
