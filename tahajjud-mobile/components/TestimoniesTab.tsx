import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Linking, Share, ScrollView, Alert, RefreshControl, DeviceEventEmitter, Dimensions, NativeSyntheticEvent, NativeScrollEvent, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heart, Send, Share2, BookHeart, Sparkles, PenLine, Star } from 'lucide-react-native';
import { SubmitTestimonyModal } from './SubmitTestimonyModal';
import { CommentThread } from './CommentThread';
import { GlassBg as BlurView } from './GlassBg';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseDb } from '../utils/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useTheme } from '../context/ThemeContext';
import { haptic } from '../utils/haptic';
import { initialTestimonies, Testimony, storyTopics } from '../data/testimonies';
import { TestimonySubmission } from '../utils/testimonySubmission';
import { captureRef } from 'react-native-view-shot';
import { QuoteShareCard } from './QuoteShareCard';
import { checkAchievements } from '../utils/achievements';
import { t } from '../utils/i18n';
import { TopPicksService } from '../utils/topPicks';


const TESTIMONY_LIKED_KEY = 'testimony_liked_ids';

async function getTestimonyLikedIds(): Promise<Set<string>> {
    try {
        const raw = await AsyncStorage.getItem(TESTIMONY_LIKED_KEY);
        return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch { return new Set(); }
}

async function setTestimonyLiked(id: string, liked: boolean): Promise<void> {
    try {
        const set = await getTestimonyLikedIds();
        if (liked) set.add(id); else set.delete(id);
        await AsyncStorage.setItem(TESTIMONY_LIKED_KEY, JSON.stringify([...set]));
    } catch {}
}

// Memoized like DuaWall.tsx's DuaCard — TestimoniesTab's featured-carousel
// auto-rotation timer re-renders the whole tab every 5s (see featuredIndex
// below), which would otherwise re-render every currently-visible card too.
const TestimonyCard = React.memo(function TestimonyCard({ item, onShare, isTopStory }: { item: Testimony, onShare: (item: Testimony) => void, isTopStory?: boolean }) {
    const { colors } = useTheme();
    const [liked, setLiked] = useState(false);
    const [count, setCount] = useState(item.reactions);
    // Latest desired like-state, updated synchronously on every tap so taps are
    // NEVER dropped. The old in-flight `reacting` guard blocked taps during the
    // server round-trip, which is why "unlike then like again" needed multiple
    // clicks. We now toggle instantly and reconcile the server after taps settle.
    const likedRef = useRef(false);
    const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconcilingRef = useRef(false);

    // Real Firestore testimonies have 20-char auto-generated ids; seed
    // testimonies use short ids ('1', 'c2'…) and can't be liked server-side.
    const isServerTestimony = typeof item.id === 'string' && String(item.id).length >= 12;

    // Load liked state from AsyncStorage first (instant), then reconcile with Firestore
    useEffect(() => {
        const id = String(item.id);
        getTestimonyLikedIds().then(set => {
            if (set.has(id)) {
                likedRef.current = true;
                setLiked(true);
                // Seed testimonies (no server-side reaction counts) start with
                // `item.reactions` that DOES NOT include the user's local like.
                // Without this bump, the heart shows filled but count stays at
                // the un-liked value — and an "unlike" tap drives count to -1.
                if (!isServerTestimony) {
                    setCount(c => c + 1);
                }
            }
        });
        if (!isServerTestimony) return;
        TestimonySubmission.hasReacted(id).then(serverLiked => {
            likedRef.current = serverLiked;
            setLiked(serverLiked);
            setTestimonyLiked(id, serverLiked);
        }).catch(() => {});
    }, [item.id]);

    // Clean up any pending server-sync timer when the card unmounts/recycles.
    useEffect(() => () => { if (syncTimerRef.current) clearTimeout(syncTimerRef.current); }, []);

    // The list renders instantly from the AsyncStorage cache, then the fresh
    // Firestore fetch replaces the data — but `count` was initialised from the
    // stale cached value and (without this) never re-synced. A card could show
    // a filled heart with yesterday's count (even 0) for the whole session.
    // Re-sync whenever fresh data lands. Seed likes are local-only, so the
    // user's +1 is re-added; a just-tapped like on a server testimony is
    // reconciled (and the count re-read) by reconcileServer instead.
    const prevReactionsRef = useRef(item.reactions);
    useEffect(() => {
        if (prevReactionsRef.current === item.reactions) return;
        prevReactionsRef.current = item.reactions;
        setCount(Math.max(0, item.reactions + (!isServerTestimony && likedRef.current ? 1 : 0)));
    }, [item.reactions]);

    // Reconcile the server to the user's FINAL choice after taps settle. Runs at
    // most one loop at a time; loops (bounded) so taps landing mid-request still
    // converge. toggleReaction flips server state; we only apply it when it still
    // matches what the user wants, so a late tap is never clobbered.
    const reconcileServer = async (id: string) => {
        if (reconcilingRef.current) return;
        reconcilingRef.current = true;
        try {
            for (let i = 0; i < 4; i++) {
                const desired = likedRef.current;
                const serverLiked = await TestimonySubmission.hasReacted(id);
                if (serverLiked === desired) break;
                const { count: serverCount } = await TestimonySubmission.toggleReaction(id);
                if (serverCount !== null && likedRef.current === desired) {
                    setCount(Math.max(0, serverCount));
                }
            }
        } catch { /* best-effort — local state already saved */ }
        finally { reconcilingRef.current = false; }
    };

    const handleReact = () => {
        const id = String(item.id);
        // Toggle INSTANTLY on every tap — never blocked. likedRef is the source
        // of truth so back-to-back taps don't read a stale closure value.
        const next = !likedRef.current;
        likedRef.current = next;
        setLiked(next);
        // Math.max(0, ...) — defensive clamp so we never display a negative count.
        setCount(c => Math.max(0, next ? c + 1 : c - 1));
        setTestimonyLiked(id, next);
        haptic.light();
        if (!isServerTestimony) return;
        // Debounce the server sync so rapid like/unlike taps collapse into one
        // reconciliation to the final state (no racing toggle requests).
        if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
        syncTimerRef.current = setTimeout(() => reconcileServer(id), 450);
    };

    return (
        // Plain View (not Animated.View with an `entering` animation): Reanimated
        // entering animations on virtualized FlatList items are unreliable — on
        // first mount the row can get stuck at the animation's initial opacity:0
        // frame and never appear until a scroll/re-render. That caused the
        // "Stories tab shows nothing on first open" bug. Render at full opacity.
        <View style={styles.card}>
            <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFill} />
            <LinearGradient
                colors={['rgba(255, 255, 255, 0.05)', 'transparent']}
                style={StyleSheet.absoluteFill}
            />

            <View style={styles.cardContent}>
                {isTopStory && (
                    <View style={styles.topPickBadgeRow}>
                        <Star size={12} color="#facc15" fill="#facc15" />
                        <Text style={styles.topPickBadgeText}>{t('testimoniesTab.topPickBadge')}</Text>
                    </View>
                )}
                <View style={styles.cardHeader}>
                    <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">{item.title}</Text>
                    <TouchableOpacity onPress={() => onShare(item)} style={styles.iconButton}>
                        <Share2 size={18} color="#94a3b8" />
                    </TouchableOpacity>
                </View>

                <Text style={styles.body}>{item.body}</Text>

                <View style={styles.tagsContainer}>
                    {item.tags.map(tag => (
                        <View key={tag} style={styles.tagBadge}>
                            <Text style={styles.tagText}>#{tag}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.footer}>
                    <View style={styles.authorCol}>
                        <Text style={styles.author}>{item.author}</Text>
                        <Text style={styles.location}>{item.location}</Text>
                    </View>

                    <TouchableOpacity
                        style={[styles.reactionButton, liked && styles.reactionButtonActive]}
                        onPress={handleReact}
                    >
                        <Heart
                            size={16}
                            color={liked ? "#ef4444" : "#94a3b8"}
                            fill={liked ? "#ef4444" : "none"}
                        />
                        <Text style={[styles.reactionCount, liked && styles.reactionCountActive]}>
                            {count}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Replies — real community stories only; seeds aren't live posts.
                    This tab isn't a modal, so the global paywall presents fine
                    (no onRequestPaywall override needed). */}
                {isServerTestimony && (
                    <CommentThread
                        parentType="testimony"
                        parentId={String(item.id)}
                        replyCount={item.replyCount ?? 0}
                        accent={colors.accent}
                    />
                )}
            </View>
        </View>
    );
});


function pickFeatured(all: Testimony[]): Testimony[] {
    // Real user posts always lead the featured carousel (newest first);
    // shuffled seed stories only fill whatever slots remain.
    const community = all.filter(t => t.isCommunity)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const seeds = all.filter(t => !t.isCommunity).sort(() => Math.random() - 0.5);
    return [...community, ...seeds].slice(0, 5);
}

export function TestimoniesTab() {
    const { colors } = useTheme();
    const [selectedTopic, setSelectedTopic] = useState('All');
    const [sharingQuote, setSharingQuote] = useState<Testimony | null>(null);
    const [testimonies, setTestimonies] = useState<Testimony[]>(initialTestimonies);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [featured, setFeatured] = useState<Testimony[]>(() => pickFeatured(initialTestimonies));
    const [featuredIndex, setFeaturedIndex] = useState(0);
    const [showSubmit, setShowSubmit] = useState(false);
    // Set when a featured carousel card is tapped — scrolls the main list
    // down to that exact story instead of just opening the share sheet
    // (sharing already has its own dedicated icon on every card).
    const [pendingScrollId, setPendingScrollId] = useState<string | null>(null);
    // Admin-picked "Top Story of the Day" — pinned above the featured carousel.
    // Fetched separately since the pick may not be among what's currently loaded.
    const [topStory, setTopStory] = useState<Testimony | null>(null);
    const viewShotRef = useRef<View>(null);
    const flatListRef = useRef<FlatList>(null);
    const featuredScrollRef = useRef<FlatList<Testimony>>(null);
    // When the user swipes, pause auto-rotation for a bit so it doesn't fight
    // them. Stored as a timestamp until which auto-rotation is paused.
    const userInteractionUntilRef = useRef<number>(0);
    // Each featured "page" is the full screen width so pagingEnabled snaps cleanly.
    const SCREEN_WIDTH = Dimensions.get('window').width;
    const FEATURED_CARD_WIDTH = SCREEN_WIDTH;

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('scrollToTop', (tab: string) => {
            if (tab === 'Guide') flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        });
        return () => sub.remove();
    }, []);

    // Live subscription to the admin-picked Top Story of the Day.
    useEffect(() => {
        const unsub = TopPicksService.subscribe(picks => {
            if (!picks.topStoryId) { setTopStory(null); return; }
            TestimonySubmission.getById(picks.topStoryId).then(story => {
                setTopStory(story ? { ...story, isCommunity: true } : null);
            });
        });
        return unsub;
    }, []);

    // Cycle through featured stories every 5 seconds, but pause auto-rotation
    // for 10 seconds after the user manually swipes — so the app doesn't fight
    // their gesture by snapping back.
    useEffect(() => {
        if (featured.length <= 1) return;
        const t = setInterval(() => {
            if (Date.now() < userInteractionUntilRef.current) return;
            setFeaturedIndex(prev => {
                const next = (prev + 1) % featured.length;
                try {
                    featuredScrollRef.current?.scrollToOffset({
                        offset: next * FEATURED_CARD_WIDTH,
                        animated: true,
                    });
                } catch { /* ignore */ }
                return next;
            });
        }, 5000);
        return () => clearInterval(t);
    }, [featured.length, FEATURED_CARD_WIDTH]);

    const handleFeaturedScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const x = e.nativeEvent.contentOffset.x;
        const i = Math.round(x / FEATURED_CARD_WIDTH);
        if (i !== featuredIndex && i >= 0 && i < featured.length) {
            setFeaturedIndex(i);
        }
        // User swiped — pause auto-rotation for 10 seconds.
        userInteractionUntilRef.current = Date.now() + 10_000;
    };

    useEffect(() => {
        loadTestimonies();
    }, []);

    const mergeWithSeeds = (serverData: Testimony[]): Testimony[] => {
        const serverIds = new Set(serverData.map(t => t.id));
        // The server holds copies of some seed stories under different doc ids
        // (testimony_1..5), so id-matching alone shows those stories twice —
        // match on normalized title as well.
        const serverTitles = new Set(serverData.map(t => t.title.trim().toLowerCase()));
        return [...serverData, ...initialTestimonies.filter(t =>
            !serverIds.has(t.id) && !serverTitles.has(t.title.trim().toLowerCase()))];
    };

    const loadTestimonies = async () => {
        try {
            // Check cache first for instant load, always merged with seeds
            const cached = await AsyncStorage.getItem('cached-testimonies');
            if (cached) {
                const serverData = JSON.parse(cached) as Testimony[];
                setTestimonies(mergeWithSeeds(serverData));
            }

            // Sync with backend
            const db = getFirebaseDb();
            if (db) {
                // Capped so a growing community collection can never make this
                // refresh (and the client-side sort/shuffle after it) slower over
                // time — 200 testimonies is far more than the UI ever shows at
                // once. Sorted client-side below rather than via orderBy here,
                // to avoid needing a composite Firestore index.
                const q = query(
                    collection(db, 'community'),
                    where('type', '==', 'testimony'),
                    limit(200)
                );

                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    const freshData: Testimony[] = [];
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        freshData.push({
                            id: doc.id,
                            title: data.title || '',
                            body: data.body || '',
                            author: data.author || 'Anonymous',
                            location: data.location || '',
                            reactions: data.reactions || 0,
                            replyCount: data.replyCount || 0,
                            tags: data.tags || [],
                            isCommunity: true,
                            // Firestore Timestamp, epoch millis, or absent — normalize to millis
                            createdAt: data.createdAt?.toMillis?.() ?? (typeof data.createdAt === 'number' ? data.createdAt : 0),
                        });
                    });

                    // Sort descending by timestamp in-memory to avoid index requirements
                    freshData.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

                    const merged = mergeWithSeeds(freshData);
                    setTestimonies(merged);
                    setFeatured(pickFeatured(merged));
                    setFeaturedIndex(0);
                    await AsyncStorage.setItem('cached-testimonies', JSON.stringify(freshData));
                }
            }
        } catch (e) {
            console.error("Failed to load testimonies:", e);
        }
    };

    const handleRefresh = async () => {
        haptic.light();
        setIsRefreshing(true);
        await loadTestimonies();
        setIsRefreshing(false);
    };

    // Top Story of the Day is just a normal list item now — pinned to the
    // front instead of a separate section, so it appears first without
    // pushing the topics/carousel out of their usual place.
    const storiesMinusTop = topStory
        ? testimonies.filter(story => story.id !== topStory.id)
        : testimonies;
    const filteredStories = selectedTopic === 'All'
        ? storiesMinusTop
        : storiesMinusTop.filter(t => t.tags.includes(selectedTopic));
    const orderedStories = topStory && (selectedTopic === 'All' || topStory.tags.includes(selectedTopic))
        ? [topStory, ...filteredStories]
        : filteredStories;

    // Scroll to the tapped featured story. No artificial delay needed: the
    // topic-filter reset in handleFeaturedCardPress (if any) is batched into
    // the SAME state update as setPendingScrollId, so by the time this effect
    // runs after commit, orderedStories already reflects it. If the row isn't
    // measured yet (virtualized list), onScrollToIndexFailed below handles
    // that — no need to pre-emptively wait for it here.
    useEffect(() => {
        if (!pendingScrollId) return;
        const idx = orderedStories.findIndex(s => s.id === pendingScrollId);
        if (idx >= 0) {
            try {
                flatListRef.current?.scrollToIndex({ index: idx, viewPosition: 0.1, animated: true });
            } catch { /* scrollToIndex can throw before layout; onScrollToIndexFailed handles it */ }
        }
        setPendingScrollId(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingScrollId, orderedStories.length, selectedTopic]);

    const handleFeaturedCardPress = (item: Testimony) => {
        haptic.light();
        // Guarantee the story is actually present in orderedStories — if a
        // topic filter is active and this story doesn't match it, "Show me
        // this story" should win over the filter, not silently fail to scroll.
        if (selectedTopic !== 'All' && !item.tags.includes(selectedTopic)) {
            setSelectedTopic('All');
        }
        setPendingScrollId(item.id);
    };

    const handleShareStory = async () => {
        haptic.medium();
        try {
            await Share.share({
                message: t('testimoniesTab.shareStoryMsg'),
                title: t('testimoniesTab.shareStoryTitle'),
            });
            const newlyUnlockedList = await checkAchievements('story', 1);
            const newlyUnlocked = newlyUnlockedList[0];
            if (newlyUnlocked) {
                Alert.alert(t('testimoniesTab.achievementUnlockedTitle'), t('testimoniesTab.achievementUnlockedBody', { title: newlyUnlocked.title }));
            }
        } catch (_) {}
    };

    // useCallback so TestimonyCard's React.memo actually holds — otherwise a
    // fresh onShare reference every render (e.g. from the 5s carousel timer)
    // would defeat the memoization entirely.
    const handleShareQuote = useCallback(async (item: Testimony) => {
        haptic.medium();
        setSharingQuote(item);
        setTimeout(async () => {
            try {
                if (viewShotRef.current) {
                    const uri = await captureRef(viewShotRef, { format: "png", quality: 1.0 });
                    await Share.share({ url: uri, message: `"${item.body}"\n\n— ${item.title}` });
                }
            } catch (error) {
                console.error("Snapshot failed", error);
            }
        }, 800);
    }, []);

    return (
        <View style={styles.container}>
            {/* KeyboardAvoidingView so replying inline to a story — via
                CommentThread inside TestimonyCard — doesn't get covered by the
                keyboard: "padding" shrinks the list's own height, and
                automaticallyAdjustKeyboardInsets lets the FlatList scroll the
                focused input above the keyboard automatically. Same fix as
                DuaWall.tsx's list, since both embed CommentThread inline. */}
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={20}>
            <FlatList
                ref={flatListRef}
                style={{ flex: 1 }}
                data={orderedStories}
                renderItem={({ item }) => (
                    <TestimonyCard item={item} onShare={handleShareQuote} isTopStory={!!topStory && item.id === topStory.id} />
                )}
                keyExtractor={item => item.id}
                onScrollToIndexFailed={info => {
                    // Row not rendered yet — jump approximately, then retry.
                    flatListRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
                    setTimeout(() => {
                        try { flatListRef.current?.scrollToIndex({ index: info.index, viewPosition: 0.1, animated: true }); } catch {}
                    }, 250);
                }}
                contentContainerStyle={[styles.listContent, { flexGrow: 1 }]}
                // removeClippedSubviews is disabled on Android: RN's clipped-view
                // detach/reattach races with the render thread and crashes with
                // "NullPointerException: mViewFlags on a null object reference"
                // (confirmed in Play Console crash reports across 1.8.5-1.8.9).
                removeClippedSubviews={false}
                keyboardShouldPersistTaps="handled"
                automaticallyAdjustKeyboardInsets
                initialNumToRender={6}
                maxToRenderPerBatch={4}
                windowSize={5}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={handleRefresh}
                        tintColor={colors.accent}
                        colors={[colors.accent]}
                    />
                }
                ListHeaderComponent={
                    <View>
                        <View style={styles.header}>
                            <Text style={[styles.headerTitle, { color: colors.accent }]}>{t('testimoniesTab.headerTitle')}</Text>
                            <Text style={[styles.headerSubtitle, { color: colors.secondaryText }]}>{t('testimoniesTab.headerSubtitle')}</Text>
                        </View>

                        {/* Featured stories — auto-rotating + swipeable horizontal pager.
                            Negative margin breaks out of the parent FlatList's
                            paddingHorizontal: 20 so the inner pager spans the
                            full screen width — required for pagingEnabled to
                            snap each card cleanly. */}
                        {featured.length > 0 && (
                            <View style={{ marginHorizontal: -20 }}>
                                <FlatList
                                    ref={featuredScrollRef}
                                    data={featured}
                                    keyExtractor={(item) => item.id}
                                    horizontal
                                    pagingEnabled
                                    showsHorizontalScrollIndicator={false}
                                    onMomentumScrollEnd={handleFeaturedScroll}
                                    decelerationRate="fast"
                                    renderItem={({ item }) => (
                                        <View style={{ width: SCREEN_WIDTH, paddingHorizontal: 20 }}>
                                            <TouchableOpacity
                                                activeOpacity={0.85}
                                                style={[styles.featuredCard, { marginHorizontal: 0 }]}
                                                onPress={() => handleFeaturedCardPress(item)}
                                            >
                                                <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                                                <LinearGradient
                                                    colors={[colors.accent + '22', 'transparent']}
                                                    style={StyleSheet.absoluteFill}
                                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                                />
                                                <View style={styles.featuredBadge}>
                                                    <Sparkles size={11} color={colors.accent} />
                                                    <Text style={[styles.featuredBadgeText, { color: colors.accent }]}>{t('testimoniesTab.featured')}</Text>
                                                </View>
                                                <Text style={styles.featuredTitle} numberOfLines={1}>{item.title}</Text>
                                                <Text style={styles.featuredBody} numberOfLines={3}>{item.body}</Text>
                                                <Text style={styles.featuredAuthor}>{item.author} · {item.location}</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                />
                                <View style={[styles.featuredDots, { alignSelf: 'center', marginTop: 8, marginBottom: 16 }]}>
                                    {featured.map((_, i) => (
                                        <View key={i} style={[styles.featuredDot, i === featuredIndex && { backgroundColor: colors.accent, width: 14 }]} />
                                    ))}
                                </View>
                            </View>
                        )}

                        <View style={styles.topicsContainer}>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.topicsContent}
                            >
                                {storyTopics.map(topic => (
                                    <TouchableOpacity
                                        key={topic}
                                        onPress={() => setSelectedTopic(topic)}
                                        style={[
                                            styles.topicPill,
                                            selectedTopic === topic && styles.topicPillActive
                                        ]}
                                    >
                                        {selectedTopic === topic && (
                                            <View style={styles.pillGlow} />
                                        )}
                                        <Text style={[
                                            styles.topicText,
                                            selectedTopic === topic && styles.topicTextActive
                                        ]}>
                                            {topic}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </View>
                }
                showsVerticalScrollIndicator={false}
            />
            </KeyboardAvoidingView>

            <TouchableOpacity
                style={[styles.fab, { shadowColor: colors.shadow }]}
                onPress={() => { haptic.medium(); setShowSubmit(true); }}
                accessibilityLabel="Share your Tahajjud story"
                accessibilityRole="button"
            >
                <LinearGradient
                    colors={colors.accentGradient}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                />
                <PenLine color="#020617" size={20} strokeWidth={2.5} />
                <Text style={styles.fabText}>{t('testimoniesTab.shareYourStory')}</Text>
            </TouchableOpacity>

            <SubmitTestimonyModal visible={showSubmit} onClose={() => setShowSubmit(false)} />

            <View collapsable={false} style={styles.captureBuffer}>
                <QuoteShareCard ref={viewShotRef} testimony={sharingQuote} />
            </View>
        </View >
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
        paddingBottom: 24,
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: '900',
        color: '#facc15', // Fallback
        letterSpacing: -1,
    },
    headerSubtitle: {
        fontSize: 15,
        color: '#cbd5e1',
        fontWeight: '600',
        marginTop: 4,
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 180,
    },
    // ── Top Story of the Day badge — sits inside the card itself now (the
    // card is just a normal first list item, not a separate pinned section).
    topPickBadgeRow: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        marginBottom: 12,
    },
    topPickBadgeText: {
        fontSize: 11, fontWeight: '800', letterSpacing: 0.5,
        color: '#facc15', textTransform: 'uppercase',
    },
    card: {
        borderRadius: 24,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
    },
    cardContent: {
        padding: 24,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        color: '#f8fafc',
        flex: 1,
        lineHeight: 28,
    },
    iconButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    body: {
        fontSize: 16,
        color: '#cbd5e1',
        lineHeight: 26,
        marginBottom: 20,
        fontWeight: '500',
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 24,
    },
    tagBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    tagText: {
        color: '#cbd5e1',
        fontSize: 12,
        fontWeight: '700',
    },
    featuredCard: {
        marginHorizontal: 20,
        marginBottom: 20,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        padding: 20,
        gap: 8,
    },
    featuredBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginBottom: 4,
    },
    featuredBadgeText: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    featuredTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#f8fafc',
    },
    featuredBody: {
        fontSize: 14,
        color: '#94a3b8',
        lineHeight: 22,
    },
    featuredFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
    },
    featuredAuthor: {
        fontSize: 12,
        color: '#475569',
        fontWeight: '700',
    },
    featuredDots: {
        flexDirection: 'row',
        gap: 4,
        alignItems: 'center',
    },
    featuredDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    topicsContainer: {
        height: 44,
        marginBottom: 24,
    },
    topicsContent: {
        paddingHorizontal: 24,
        gap: 10,
    },
    topicPill: {
        height: 40,
        paddingHorizontal: 20,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
    },
    topicPillActive: {
        backgroundColor: 'rgba(248, 250, 252, 0.15)',
        borderColor: '#f8fafc',
    },
    pillGlow: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    topicText: {
        color: '#cbd5e1',
        fontSize: 14,
        fontWeight: '800',
    },
    topicTextActive: {
        color: '#f8fafc',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.06)',
        paddingTop: 20,
    },
    // Author/location are free-text user submissions, not just a short name —
    // without a flex/width constraint here, a long line pushed the reaction
    // button off the edge of the card instead of wrapping.
    authorCol: {
        flex: 1,
        marginRight: 12,
    },
    author: {
        fontSize: 14,
        color: '#f8fafc',
        fontWeight: '700',
    },
    location: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
        fontWeight: '700',
    },
    reactionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
        flexShrink: 0,
    },
    reactionButtonActive: {
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
        borderColor: 'rgba(239, 68, 68, 0.35)',
    },
    reactionCount: {
        marginLeft: 8,
        fontSize: 13,
        color: '#94a3b8',
        fontWeight: '800',
    },
    reactionCountActive: {
        color: '#ef4444',
    },
    fab: {
        position: 'absolute',
        bottom: 140,
        alignSelf: 'center',
        height: 60,
        paddingHorizontal: 28,
        borderRadius: 30,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#facc15',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
    },
    fabText: {
        color: '#0f172a',
        fontWeight: '900',
        fontSize: 16,
        letterSpacing: 0.2,
    },
    captureBuffer: {
        position: 'absolute',
        left: -5000,
        top: 0,
        width: 1080,
        height: 1080,
    }
});
