import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert, Modal, KeyboardAvoidingView, Platform, ScrollView as RNScrollView, ActivityIndicator, DeviceEventEmitter } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Heart, Volume2, Square, Plus, X, Trash2, Mail, PenTool, Sprout, Lock, Moon, BookHeart, PenLine, Pin } from 'lucide-react-native';
import { TahajjudJournalHistory } from './TahajjudJournalHistory';
import { TahajjudJournalModal } from './TahajjudJournalModal';
import { DuaWallModal } from './DuaWall';
import { TahajjudJournal, STATE_OPTIONS, JournalEntry } from '../utils/tahajjudJournal';
import { duaDatabase, categories, Dua } from '../data/duas';
import { fuzzyMatch, normalize, matchScore } from '../utils/fuzzy';
import { relatedTerms } from '../utils/synonyms';
import { requireBiometric } from '../utils/biometricGate';
import { getBookmarkedDuas, toggleBookmark } from '../utils/bookmarks';
import { setWidgetDua, WIDGET_DUA_ID_KEY } from '../utils/widgetBridge';
import { haptic } from '../utils/haptic';
import { getPersonalDuas, savePersonalDua, deletePersonalDua, subscribePersonalDuas, PersonalDua } from '../utils/personalDuas';
import { checkAchievements } from '../utils/achievements';
import * as Speech from 'expo-speech';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';
import { fetchCloudData, syncLocalToCloud } from '../utils/syncService';
import { getFirebaseAuth } from '../utils/firebase';
import { GlassBg as BlurView } from './GlassBg';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { usePurchases } from '../context/PurchasesContext';
import { tabletContentStyle } from '../utils/layout';
import { t, getLocale } from '../utils/i18n';

interface DuaCardProps {
    dua: Dua;
    isBookmarked?: boolean;
    onToggleBookmark?: (duaId: string) => void;
    isOnWidget?: boolean;
    onPinToWidget?: (dua: Dua) => void;
    isPlaying?: boolean;
    activeArabicWord?: number;
    onPlay?: () => void;
    onDelete?: () => void;
}

// Memoized DuaCard to prevent unnecessary re-renders
const DuaCard = React.memo(({ dua, isBookmarked, onToggleBookmark, isOnWidget, onPinToWidget, isPlaying, activeArabicWord = -1, onPlay, onDelete }: DuaCardProps) => {
    const { colors, cardBg, blurIntensity } = useTheme();

    // Derive translation word index proportionally from arabic word position
    const arabicWords = dua.arabic ? dua.arabic.split(' ') : [];
    const translationWords = dua.translation ? dua.translation.split(' ') : [];
    const activeTranslationWord = activeArabicWord >= 0 && arabicWords.length > 0
        ? Math.min(
            Math.floor((activeArabicWord / arabicWords.length) * translationWords.length),
            translationWords.length - 1
          )
        : -1;
    return (
        // Plain View (no `entering`): entering animations on virtualized FlatList
        // rows can stick at opacity:0 on first mount, hiding the list until a
        // scroll — the same bug fixed in Stories.
        <View
            style={styles.duaCard}
        >
            <BlurView intensity={Math.round(15 * blurIntensity)} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />
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
                        {onPinToWidget && (
                            <TouchableOpacity
                                onPress={() => onPinToWidget(dua)}
                                style={styles.actionButton}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Pin
                                    size={19}
                                    color={isOnWidget ? '#a78bfa' : '#94a3b8'}
                                    fill={isOnWidget ? '#a78bfa' : 'none'}
                                />
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
                                    color={isBookmarked ? '#ef4444' : '#94a3b8'}
                                    fill={isBookmarked ? '#ef4444' : 'none'}
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

                {dua.category === 'Personal' ? (
                    <View style={styles.letterContentContainer}>
                        {dua.translation ? (
                            <Text style={styles.letterText} numberOfLines={4}>{dua.translation}</Text>
                        ) : (
                            <Text style={[styles.letterText, { color: '#475569', fontStyle: 'italic' }]}>{t('duasTab.noContent')}</Text>
                        )}
                    </View>
                ) : (
                    <>
                        {dua.arabic ? (
                            <View style={styles.arabicContainer}>
                                {activeArabicWord >= 0 ? (
                                    <Text style={[styles.arabicText, { textAlign: 'right' }]}>
                                        {arabicWords.map((word, wi) => (
                                            <Text key={wi} style={
                                                wi === activeArabicWord
                                                    ? { color: '#22d3ee', fontWeight: '800' }
                                                    : { color: '#ffffff' }
                                            }>
                                                {word}{wi < arabicWords.length - 1 ? ' ' : ''}
                                            </Text>
                                        ))}
                                    </Text>
                                ) : (
                                    <Text style={styles.arabicText}>{dua.arabic}</Text>
                                )}
                            </View>
                        ) : null}

                        {dua.transliteration ? (
                            <View style={styles.transliterationContainer}>
                                <Text style={[styles.transliterationLabel, { color: '#94a3b8' }]}>{t('hifz.transliterationToggle')}</Text>
                                <Text style={[styles.transliterationText, { color: '#cbd5e1' }]}>{dua.transliteration}</Text>
                            </View>
                        ) : null}

                        {dua.translation ? (
                            <View style={styles.translationContainer}>
                                <Text style={[styles.translationLabel, { color: colors.accent }]}>{t('hifz.translationToggle')}</Text>
                                {activeTranslationWord >= 0 ? (
                                    <Text style={styles.translationText}>
                                        {translationWords.map((word, wi) => (
                                            <Text key={wi} style={
                                                wi === activeTranslationWord
                                                    ? { color: '#67e8f9', fontWeight: '800' }
                                                    : { color: '#f8fafc' }
                                            }>
                                                {word}{wi < translationWords.length - 1 ? ' ' : ''}
                                            </Text>
                                        ))}
                                    </Text>
                                ) : (
                                    <Text style={[styles.translationText, { color: '#f8fafc' }]}>{dua.translation}</Text>
                                )}
                            </View>
                        ) : null}
                    </>
                )}

                <View style={styles.cardFooter}>
                    <View style={styles.footerLine} />
                    <Text style={styles.sourceText}>{dua.source}</Text>
                </View>
            </View>
        </View>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.isBookmarked === nextProps.isBookmarked &&
        prevProps.isOnWidget === nextProps.isOnWidget &&
        prevProps.isPlaying === nextProps.isPlaying &&
        prevProps.activeArabicWord === nextProps.activeArabicWord &&
        prevProps.dua.id === nextProps.dua.id
    );
});


// Letters are unlimited for everyone — premium differentiation lives in the
// richer Night Journal (mood, rakats, history). Keeping write access free
// ensures someone can write at 3am without ever hitting a paywall.

export function DuasTab() {
    const { colors } = useTheme();
    const { isPremium, openPaywall } = usePurchases();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
    const [widgetDuaId, setWidgetDuaId] = useState<string | null>(null);
    const [playingDuaId, setPlayingDuaId] = useState<string | null>(null);
    const [voiceIdentifier, setVoiceIdentifier] = useState<string | null>(null);
    const [activeArabicWord, setActiveArabicWord] = useState(-1);
    const wordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('scrollToTop', (tab: string) => {
            if (tab === 'Duas') flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        });

        const focusDuaById = (id: string) => {
            const target = duaDatabase.find((d) => d.id === id);
            if (target) {
                setSelectedCategory('All');
                setSearchQuery(target.title);
            }
        };

        // Live events for already-mounted tab
        const openDuaSub = DeviceEventEmitter.addListener('open:dua', (p: { id: string }) => {
            if (p?.id) focusDuaById(p.id);
        });
        const openLetterSub = DeviceEventEmitter.addListener('open:letter', () => {
            setActiveTab('personal');
        });

        // Flush pending request that arrived before this screen mounted
        const { consumePendingOpen } = require('../App');
        const pendingDua = consumePendingOpen('dua');
        if (pendingDua) focusDuaById(pendingDua.id);
        const pendingLetter = consumePendingOpen('letter');
        if (pendingLetter) setActiveTab('personal');

        return () => {
            sub.remove();
            openDuaSub.remove();
            openLetterSub.remove();
        };
    }, []);

    const clearWordTimer = useCallback(() => {
        if (wordTimerRef.current) { clearTimeout(wordTimerRef.current); wordTimerRef.current = null; }
        setActiveArabicWord(-1);
    }, []);

    // Personal Dua State
    const [activeTab, setActiveTab] = useState<'library' | 'personal'>('library');
    const [isLocked, setIsLocked] = useState(false);
    const [personalDuas, setPersonalDuas] = useState<PersonalDua[]>([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
    const [showJournalHistory, setShowJournalHistory] = useState(false);
    const [showJournalWrite, setShowJournalWrite] = useState(false);
    const [showDuaWall, setShowDuaWall] = useState(false);

    // Form State
    const [newDuaTitle, setNewDuaTitle] = useState('');
    const [newDuaArabic, setNewDuaArabic] = useState('');
    const [newDuaTranslation, setNewDuaTranslation] = useState('');
    const [newDuaTransliteration, setNewDuaTransliteration] = useState('');
    const [newDuaNotes, setNewDuaNotes] = useState('');

    // Load data on mount
    useEffect(() => {
        loadBookmarks();
        AsyncStorage.getItem(WIDGET_DUA_ID_KEY).then(v => { if (v) setWidgetDuaId(v); }).catch(() => {});
        loadVoice();
        loadPersonalDuasData();
        checkLockStatus();
        // Deep-link from feature discovery → open the Dua Wall directly
        const wallSub = DeviceEventEmitter.addListener('duas:openWall', () => setShowDuaWall(true));
        return () => {
            Speech.stop();
            clearWordTimer();
            wallSub.remove();
        };
    }, []);

    // Live journal updates for premium users so banner count refreshes instantly
    useEffect(() => {
        if (!isPremium) return;
        TahajjudJournal.getAll().then(setJournalEntries).catch(() => {});
        const unsub = TahajjudJournal.subscribe(setJournalEntries);
        return () => unsub();
    }, [isPremium]);

    // Live personal-duas subscription — any save/update/delete from anywhere
    // (including Firestore-driven changes in future) is reflected instantly.
    useEffect(() => {
        const unsub = subscribePersonalDuas(setPersonalDuas);
        return () => unsub();
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
                if (!success) return;
            }
            // Load journal entries for premium users
            if (isPremium) {
                const entries = await TahajjudJournal.getAll();
                setJournalEntries(entries);
            }
        }
        setActiveTab(tab);
    };

    const loadPersonalDuasData = async () => {
        // 1. Load local data first for speed (subscription will keep it in sync)
        await getPersonalDuas(); // triggers migration + subscription will populate state

        // 2. If authenticated via Firebase, try to fetch fresh data from cloud
        const auth = getFirebaseAuth();
        const firebaseUser = auth?.currentUser;
        if (firebaseUser) {
            // Push any local-only duas (written before sign-in, or on a
            // brand-new cloud account) up FIRST — otherwise the "replace
            // local storage with cloud data" step below would silently wipe
            // them out the moment the cloud already has anything else in it.
            await syncLocalToCloud(firebaseUser.uid).catch(() => {});
            const cloudDuas = await fetchCloudData(firebaseUser.uid);
            if (cloudDuas.length > 0) {
                // Persist via the same key + notify path so all subscribers update
                await AsyncStorage.setItem('personal-duas', JSON.stringify(cloudDuas));
                setPersonalDuas(cloudDuas);
            }
        }
    };

    const handleSaveDua = async () => {
        if (!newDuaTranslation.trim()) {
            Alert.alert(t('duasTab.emptyLetterTitle'), t('duasTab.emptyLetterBody'));
            return;
        }

        // Letters are unlimited and free. Paywalling someone at 3am writing
        // their fourth letter to Allah would be the worst possible moment.

        const date = new Date();
        const formattedDate = date.toLocaleDateString(getLocale(), {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const newDua: PersonalDua = {
            id: Date.now().toString(),
            title: newDuaTitle.trim() || t('duasTab.letterFallbackTitle', { date: formattedDate }),
            arabic: newDuaArabic,
            transliteration: newDuaTransliteration,
            translation: newDuaTranslation,
            notes: newDuaNotes,
            createdAt: Date.now(),
        };

        const ok = await savePersonalDua(newDua);
        if (!ok) {
            Alert.alert(t('letterModal.saveFailedTitle'), t('letterModal.saveFailedBody'));
            return;
        }
        // Subscription via subscribePersonalDuas updates state authoritatively
        setIsModalVisible(false);
        resetForm();

        // Check for achievements (subscription has already fired by now)
        const newlyUnlockedList = await checkAchievements('dua', personalDuas.length + 1);
        const newlyUnlocked = newlyUnlockedList[0];
        if (newlyUnlocked) {
            if (!isPremium) {
                Alert.alert(
                    `🏅 ${newlyUnlocked.title}`,
                    `${newlyUnlocked.description}\n\n${t('duasTab.unlockAchievementsBody')}`,
                    [
                        { text: t('tracker.mashallahExclaim'), style: 'cancel' },
                        { text: t('tracker.unlockPremiumBtn'), onPress: openPaywall },
                    ]
                );
            } else {
                Alert.alert(
                    `🏅 ${newlyUnlocked.title}`,
                    `${t('tracker.mashallahExclaim')} ${newlyUnlocked.description}`,
                    [{ text: t('tracker.mashallahExclaim') }]
                );
            }
        }
    };

    const handleDeleteDua = async (id: string) => {
        Alert.alert(
            t('duasTab.deleteDuaTitle'),
            t('duasTab.deleteDuaBody'),
            [
                { text: t('btn.cancel'), style: "cancel" },
                {
                    text: t('btn.delete'),
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
            const arabicVoices = voices.filter(v => v.language.toLowerCase().startsWith('ar'));
            console.log('[Audio] Available Arabic voices:', arabicVoices.map(v => `${v.name} (${v.language})`));

            // Priority list for better quality voices.
            // iOS: "Maged" / "Tarik" / "Majed" are high-quality Apple voices.
            // Android: voice names vary by manufacturer ("ar-xa-x-arz-network",
            // "ar-eg-x-arf-network", "Samsung ar-AE", etc.) — fall through to
            // step 2 which picks any Arabic voice found.
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
            } else {
                console.log('[Audio] No Arabic voice available on this device');
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
        // Mirror toggleBookmark's storage behavior exactly: a tap on an
        // already-liked dua must UNlike it (remove from state) — the old
        // add-only updater left the heart filled forever and let UI and
        // storage drift out of sync.
        setBookmarkedIds(prev =>
            prev.includes(duaId) ? prev.filter(id => id !== duaId) : [...prev, duaId]
        );
        toggleBookmark(duaId);
    }, []);

    const handlePinToWidget = useCallback((dua: Dua) => {
        haptic.light(); // acknowledge the tap immediately, whatever happens next
        const ok = setWidgetDua({ title: dua.title, arabic: dua.arabic, translation: dua.translation });
        if (!ok) {
            // Binary predates the Dua widget (or the bridge failed) — a silent
            // no-op here read as "the button is broken", so say what's needed.
            Alert.alert(t('duaWidget.updateNeededTitle'), t('duaWidget.updateNeededBody'));
            return;
        }
        setWidgetDuaId(dua.id);
        AsyncStorage.setItem(WIDGET_DUA_ID_KEY, dua.id).catch(() => {});
        import('../utils/analytics').then(m => m.track('dua_pinned_to_widget')).catch(() => {});
        haptic.success();
        Alert.alert(t('duaWidget.pinnedTitle'), t('duaWidget.pinnedBody'));
    }, []);

    const handlePlayDua = useCallback(async (dua: Dua) => {
        try {
            if (playingDuaId === dua.id) {
                Speech.stop();
                setPlayingDuaId(null);
                clearWordTimer();
                return;
            }

            Speech.stop();
            clearWordTimer();
            setPlayingDuaId(dua.id);
            import('../utils/analytics').then(m => m.track('dua_played', { dua: dua.id })).catch(() => {});

            const words = dua.arabic ? dua.arabic.split(' ') : [];
            const wordDurations = words.map(w => Math.max(220, (280 + w.length * 30) / 0.85));

            const options: Speech.SpeechOptions = {
                // Always declare Arabic so Android's TTS engine picks a sane voice
                // (or fails fast so we can show a helpful error to the user).
                language: 'ar',
                rate: 0.85,
                pitch: 1.0,
                onStart: () => {
                    // Start word timer only when audio actually begins
                    let current = 0;
                    setActiveArabicWord(0);
                    const scheduleNext = () => {
                        if (current >= words.length - 1) return;
                        wordTimerRef.current = setTimeout(() => {
                            current++;
                            setActiveArabicWord(current);
                            scheduleNext();
                        }, wordDurations[current]);
                    };
                    scheduleNext();
                },
                onDone: () => { setPlayingDuaId(null); clearWordTimer(); },
                onStopped: () => { setPlayingDuaId(null); clearWordTimer(); },
                onError: (e) => {
                    console.log('Speech error:', e);
                    setPlayingDuaId(null);
                    clearWordTimer();
                    // On Android, missing Arabic TTS data is the #1 cause of silent
                    // playback. Surface a helpful message with install steps.
                    if (Platform.OS === 'android') {
                        Alert.alert(
                            t('duasTab.arabicVoiceTitle'),
                            t('duasTab.arabicVoiceBody'),
                            [{ text: t('btn.ok') }]
                        );
                    }
                }
            };

            if (voiceIdentifier) {
                options.voice = voiceIdentifier;
            }

            // On Android specifically, if we have no Arabic voice loaded after
            // initial scan, warn the user immediately rather than waiting for
            // silent playback. iOS bundles Arabic voices so this only fires on
            // Android devices missing the language pack.
            if (Platform.OS === 'android' && !voiceIdentifier) {
                Alert.alert(
                    t('duasTab.arabicVoiceTitle'),
                    t('duasTab.arabicVoiceBody'),
                    [{ text: t('btn.ok') }]
                );
                setPlayingDuaId(null);
                clearWordTimer();
                return;
            }

            Speech.speak(dua.arabic, options);

        } catch (error) {
            console.error('Playback failed', error);
            setPlayingDuaId(null);
            clearWordTimer();
            Alert.alert(t('duasTab.errorTitle'), t('duasTab.errorAudioBody'));
        }
    }, [playingDuaId, voiceIdentifier, clearWordTimer]);

    const filteredDuas = useMemo(() => {
        // Synonym / related-topic expansion is now centralized in utils/synonyms.
        // Map the user's query to every related concept so "money" finds
        // Wealth-category duas, "stress" finds Anxiety duas, "school" finds
        // Knowledge duas, etc.
        const getSearchTerms = (q: string): string[] => relatedTerms(q);

        const results = duaDatabase.filter(dua => {
            // When the user is typing a search query, search across ALL duas
            // regardless of the selected category pill — search takes priority.
            // Only apply the category filter when there's no active search.
            if (!searchQuery) {
                if (selectedCategory === 'Liked') {
                    if (!bookmarkedIds.includes(dua.id)) return false;
                } else if (selectedCategory !== 'All') {
                    if (dua.category !== selectedCategory) return false;
                }
            }

            // Filter by search — fuzzy match across every searchable field,
            // PLUS try each synonym of the query (e.g. "namaz" → "salah").
            // No need for exact wording or correct spelling.
            if (searchQuery) {
                const q = searchQuery.toLowerCase().trim();
                const terms = getSearchTerms(q);
                return terms.some(term =>
                    fuzzyMatch(term, dua.title, dua.category, dua.transliteration, dua.translation)
                );
            }
            return true;
        });

        if (!searchQuery) return results;

        // Sort by relevance using the shared scoring function.
        return results.sort((a, b) => {
            const score = (dua: typeof a) => Math.min(
                matchScore(searchQuery, dua.title),
                matchScore(searchQuery, dua.transliteration) + 1,
                matchScore(searchQuery, dua.translation) + 2,
                matchScore(searchQuery, dua.category) + 3,
            );
            return score(a) - score(b);
        });
    }, [selectedCategory, searchQuery, bookmarkedIds]);

    // Add Bookmarked to categories
    const allCategories = useMemo(() => ['All', 'Liked', ...categories.slice(1)], []);

    const renderDuaItem = useCallback(({ item }: { item: Dua }) => (
        <DuaCard
            dua={item}
            isBookmarked={bookmarkedIds.includes(item.id)}
            onToggleBookmark={handleToggleBookmark}
            isOnWidget={widgetDuaId === item.id}
            onPinToWidget={Platform.OS === 'ios' ? handlePinToWidget : undefined}
            isPlaying={playingDuaId === item.id}
            activeArabicWord={playingDuaId === item.id ? activeArabicWord : -1}
            onPlay={() => handlePlayDua(item)}
        />
    ), [bookmarkedIds, widgetDuaId, playingDuaId, activeArabicWord, handleToggleBookmark, handlePinToWidget, handlePlayDua]);

    const renderPersonalDuaItem = useCallback(({ item }: { item: PersonalDua }) => {
        const date = new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const wordCount = item.translation ? item.translation.trim().split(/\s+/).length : 0;
        return (
            <View style={[styles.letterCard, { borderColor: colors.accent + '25', backgroundColor: colors.accent + '08' }]}>
                <View style={styles.letterCardHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.letterCardTitle, { color: colors.primaryText }]} numberOfLines={1}>{item.title}</Text>
                        <Text style={[styles.letterCardMeta, { color: colors.secondaryText }]}>{date} · {wordCount} words</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteDua(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Trash2 size={16} color="#ef4444" />
                    </TouchableOpacity>
                </View>
                {item.translation ? (
                    <Text style={[styles.letterCardPreview, { color: colors.secondaryText }]} numberOfLines={3}>{item.translation}</Text>
                ) : null}
            </View>
        );
    }, [handleDeleteDua, colors]);

    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
                {selectedCategory === 'Liked'
                    ? t('duasTab.noLikedDuas')
                    : t('duasTab.noDuasFound')}
            </Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <View style={[styles.container, tabletContentStyle()]}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={[styles.headerTitle, { color: colors.accent }]}>{t('duasTab.title')}</Text>
                    <View style={styles.tabsContainer}>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'library' && styles.activeTab]}
                            onPress={() => handleTabChange('library')}
                        >
                            <Text style={[styles.tabText, activeTab === 'library' && styles.activeTabText]}>{t('duasTab.tabLibrary')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'personal' && styles.activeTab]}
                            onPress={() => handleTabChange('personal')}
                        >
                            <Text style={[styles.tabText, activeTab === 'personal' && styles.activeTabText]}>{t('duasTab.tabLetters')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {activeTab === 'library' ? (
                    <FlatList
                        ref={flatListRef}
                        style={{ flex: 1 }}
                        data={filteredDuas}
                        renderItem={renderDuaItem}
                        keyExtractor={item => item.id}
                        contentContainerStyle={[styles.duasContent, { flexGrow: 1 }]}
                        // Frees off-screen rows from memory on long dua list
                        removeClippedSubviews={Platform.OS === 'android'}
                        initialNumToRender={8}
                        maxToRenderPerBatch={6}
                        windowSize={5}
                        // Tap list background to dismiss keyboard.
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="on-drag"
                        ListHeaderComponent={
                            <View>
                                {/* Search Bar */}
                                <View style={styles.searchContainer}>
                                    <Search size={20} color="#94a3b8" style={styles.searchIcon} />
                                    <TextInput
                                        style={styles.searchInput}
                                        placeholder={t('duasTab.searchPlaceholder')}
                                        placeholderTextColor="#94a3b8"
                                        value={searchQuery}
                                        onChangeText={setSearchQuery}
                                        // Cap font scaling so iOS "Larger Text" can't
                                        // push descenders past the fixed row height.
                                        maxFontSizeMultiplier={1.2}
                                    />
                                    {searchQuery.length > 0 && (
                                        <TouchableOpacity
                                            onPress={() => setSearchQuery('')}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                            style={styles.searchClearBtn}
                                        >
                                            <X size={16} color="#64748b" />
                                        </TouchableOpacity>
                                    )}
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
                        showsVerticalScrollIndicator={false}
                    />
                ) : (
                    <View style={{ flex: 1 }}>
                        {/* Night Journal banner */}
                        <View style={styles.journalBanner}>
                            {/* Left: tap to open history */}
                            <TouchableOpacity
                                onPress={async () => {
                                    if (!isPremium) { openPaywall('feature_gate:journal'); return; }
                                    import('../utils/featureDiscovery').then(m => m.markFeatureUsed('night_journal')).catch(() => {});
                                    const ok = await requireBiometric({ prompt: t('duasTab.unlockJournalPrompt') });
                                    if (ok) setShowJournalHistory(true);
                                }}
                                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.journalBannerIcon, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '33' }]}>
                                    <Moon size={16} color={colors.accent} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Text style={styles.journalBannerTitle}>{t('duasTab.nightJournalTitle')}</Text>
                                        {!isPremium && <Lock size={11} color="#f59e0b" />}
                                    </View>
                                    <Text style={styles.journalBannerSub}>
                                        {isPremium
                                            ? (journalEntries.length > 0
                                                ? t('duasTab.nightsLogged', { n: journalEntries.length })
                                                : t('duasTab.reflectAfterTahajjud'))
                                            : t('duasTab.writeToAllahAfterTahajjud')}
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            {/* Right: Write button */}
                            <TouchableOpacity
                                onPress={async () => {
                                    if (!isPremium) { openPaywall('feature_gate:journal'); return; }
                                    const ok = await requireBiometric({ prompt: t('duasTab.unlockJournalPrompt') });
                                    if (ok) setShowJournalWrite(true);
                                }}
                                style={[styles.journalWriteBtn, { backgroundColor: colors.accent, borderColor: colors.accent }]}
                                activeOpacity={0.8}
                            >
                                <PenLine size={13} color="#020617" />
                                <Text style={styles.journalWriteBtnText}>{t('duasTab.writeBtn')}</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Dua Wall — anonymous community wall (TEMP free for testing) */}
                        <TouchableOpacity
                            onPress={() => setShowDuaWall(true)}
                            style={[styles.journalBanner, { borderColor: colors.accent + '33' }]}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.journalBannerIcon, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '33' }]}>
                                <Text style={{ fontSize: 16 }}>🤲</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.journalBannerTitle}>{t('duasTab.duaWallTitle')}</Text>
                                <Text style={styles.journalBannerSub}>
                                    {t('duasTab.duaWallSub')}
                                </Text>
                            </View>
                        </TouchableOpacity>
                        <FlatList
                            style={{ flex: 1 }}
                            data={personalDuas}
                            renderItem={renderPersonalDuaItem}
                            keyExtractor={item => item.id}
                            contentContainerStyle={[styles.duasContent, { flexGrow: 1 }]}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="on-drag"
                            ListEmptyComponent={() => (
                                <View style={styles.emptyState}>
                                    <Text style={styles.emptyText}>{t('duasTab.lettersEmptyTitle')}</Text>
                                    <Text style={styles.emptySubtext}>{t('duasTab.lettersEmptySub')}</Text>
                                </View>
                            )}
                            showsVerticalScrollIndicator={false}
                        />
                        <TouchableOpacity
                            style={[styles.fab, { backgroundColor: colors.accent, shadowColor: colors.shadow }]}
                            onPress={() => setIsModalVisible(true)}
                        >
                            <PenTool color="#020617" size={22} />
                        </TouchableOpacity>
                    </View>
                )}

                <TahajjudJournalHistory
                    visible={showJournalHistory}
                    onClose={() => setShowJournalHistory(false)}
                />
                <DuaWallModal
                    visible={showDuaWall}
                    onClose={() => setShowDuaWall(false)}
                />
                <TahajjudJournalModal
                    visible={showJournalWrite}
                    onClose={async () => {
                        setShowJournalWrite(false);
                        if (isPremium) {
                            const entries = await TahajjudJournal.getAll();
                            setJournalEntries(entries);
                        }
                    }}
                />

                {/* Add Dua Modal */}
                <Modal
                    visible={isModalVisible}
                    animationType="slide"
                    presentationStyle="pageSheet"
                    onRequestClose={() => setIsModalVisible(false)}
                >
                    <KeyboardAvoidingView
                        behavior={Platform.OS === "ios" ? "padding" : "height"}
                        style={styles.letterModal}
                    >
                        {/* Top bar */}
                        <View style={styles.letterModalTopBar}>
                            <TouchableOpacity onPress={() => setIsModalVisible(false)} style={styles.letterModalCancel}>
                                <Text style={styles.letterModalCancelText}>{t('btn.cancel')}</Text>
                            </TouchableOpacity>
                            <View style={styles.letterModalLabelWrap}>
                                <PenTool size={11} color={colors.accent} />
                                <Text style={[styles.letterModalLabel, { color: colors.accent }]}>{t('duasTab.letterToAllahLabel')}</Text>
                            </View>
                            <TouchableOpacity
                                onPress={handleSaveDua}
                                style={[styles.letterModalSendBtn, { backgroundColor: colors.accent }]}
                            >
                                <Text style={styles.letterModalSendText}>{t('duasTab.sendBtn')}</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Paper area */}
                        <RNScrollView
                            style={styles.letterPaperScroll}
                            contentContainerStyle={styles.letterPaperContent}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="on-drag"
                            automaticallyAdjustKeyboardInsets
                        >
                            <Text style={[styles.letterArabicBismillah, { color: colors.accent }]}>بِسْمِ اللَّهِ</Text>

                            <TextInput
                                style={styles.letterTitleField}
                                placeholder={t('duasTab.subjectPlaceholder')}
                                placeholderTextColor="#334155"
                                value={newDuaTitle}
                                onChangeText={setNewDuaTitle}
                                returnKeyType="next"
                            />

                            <View style={styles.letterHRule} />

                            <TextInput
                                style={styles.letterBodyField}
                                placeholder={t('duasTab.bodyPlaceholder')}
                                placeholderTextColor="#334155"
                                value={newDuaTranslation}
                                onChangeText={setNewDuaTranslation}
                                multiline
                                autoFocus
                                textAlignVertical="top"
                            />

                            {newDuaTranslation.trim().length > 0 && (
                                <Text style={[styles.wordCountText, { color: colors.secondaryText, opacity: 0.5 }]}>
                                    {t('duasTab.wordsCount', { n: newDuaTranslation.trim().split(/\s+/).length })}
                                </Text>
                            )}
                        </RNScrollView>
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
        // minHeight (not fixed height) so the row can grow if iOS Larger
        // Text is enabled — prevents descender letters from being clipped.
        minHeight: 56,
        paddingVertical: 8,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
    },
    searchIcon: {
        marginRight: 12,
    },
    searchClearBtn: {
        marginLeft: 8,
        padding: 2,
    },
    searchInput: {
        flex: 1,
        color: '#ffffff',
        fontSize: 16,
        lineHeight: 22, // room under the baseline so descenders aren't clipped
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
    journalBanner: {
        flexDirection: 'row', alignItems: 'center',
        marginHorizontal: 16, marginTop: 12, marginBottom: 4,
        padding: 14, borderRadius: 16, borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(255,255,255,0.03)',
        gap: 10,
    },
    journalBannerIcon: {
        width: 36, height: 36, borderRadius: 18,
        borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    },
    journalBannerTitle: { color: '#f1f5f9', fontSize: 14, fontWeight: '700' },
    journalBannerSub: { color: '#475569', fontSize: 12, marginTop: 1 },
    journalWriteBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 14, paddingVertical: 8,
        borderRadius: 20, borderWidth: 1,
    },
    journalWriteBtnText: { color: '#020617', fontSize: 13, fontWeight: '700' },
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
        // AmiriQuran is bundled via useFonts() in App.tsx, so it's available on
        // both platforms. Falls back to the system Arabic font if loading failed.
        fontFamily: 'AmiriQuran',
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
    letterModal: {
        flex: 1,
        backgroundColor: '#080d1a',
    },
    letterModalTopBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    letterModalCancel: {
        paddingVertical: 6,
        paddingHorizontal: 4,
        minWidth: 60,
    },
    letterModalCancelText: {
        color: '#64748b',
        fontSize: 16,
        fontWeight: '500',
    },
    letterModalLabelWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    letterModalLabel: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1.5,
    },
    letterModalSendBtn: {
        paddingVertical: 7,
        paddingHorizontal: 18,
        borderRadius: 20,
        minWidth: 60,
        alignItems: 'center',
    },
    letterModalSendText: {
        color: '#020617',
        fontSize: 14,
        fontWeight: '800',
    },
    letterPaperScroll: {
        flex: 1,
    },
    letterPaperContent: {
        paddingHorizontal: 28,
        paddingTop: 32,
        paddingBottom: 60,
    },
    letterArabicBismillah: {
        fontSize: 22,
        textAlign: 'center',
        marginBottom: 28,
        fontWeight: '400',
    },
    letterTitleField: {
        fontSize: 22,
        fontWeight: '700',
        color: '#f8fafc',
        padding: 0,
        marginBottom: 12,
    },
    letterHRule: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.06)',
        marginBottom: 20,
    },
    letterBodyField: {
        fontSize: 17,
        color: '#e2e8f0',
        lineHeight: 30,
        minHeight: 300,
        textAlignVertical: 'top',
        padding: 0,
        fontWeight: '400',
    },
    letterCard: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 12,
        gap: 8,
    },
    letterCardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    letterCardTitle: {
        fontSize: 16,
        fontWeight: '800',
    },
    letterCardMeta: {
        fontSize: 11,
        fontWeight: '600',
        marginTop: 2,
        opacity: 0.7,
    },
    letterCardPreview: {
        fontSize: 14,
        lineHeight: 20,
        opacity: 0.8,
    },
    wordCountText: {
        textAlign: 'right',
        fontSize: 11,
        color: '#475569',
        fontWeight: '600',
        marginTop: 4,
        marginBottom: 8,
    },
});
