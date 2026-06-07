import React, { useEffect, useState, useRef } from 'react';
import {
    Modal, View, Text, TouchableOpacity, StyleSheet, FlatList,
    TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard,
    Animated as RNAnimated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { X, Heart, Flag, PenLine, Moon, Sparkles } from 'lucide-react-native';
import { SEED_DUAS, isSeedDua } from '../utils/duaWallSeeds';
import Animated, { FadeInDown, FadeIn, ZoomIn, useSharedValue, useAnimatedStyle, withSequence, withSpring } from 'react-native-reanimated';
import { formatDistanceToNowStrict } from 'date-fns';
import { useTheme } from '../context/ThemeContext';
import { DuaWall, PublicDua } from '../utils/duaWall';
import { haptic } from '../utils/haptic';
import { getFirebaseAuth } from '../utils/firebase';

interface Props { visible: boolean; onClose: () => void; }

// Decorative star field — sprinkled across the entire screen for a night-sky feel.
// Stars are absolute-positioned inside the root View, so they stay fixed while
// the list scrolls (parallax effect). Positions distributed top-to-bottom.
const STARS = [
    // Top band (around the header)
    { left: '6%',  top: 30,   size: 2,   opacity: 0.5 },
    { left: '18%', top: 90,   size: 1.5, opacity: 0.35 },
    { left: '32%', top: 50,   size: 2,   opacity: 0.4 },
    { left: '52%', top: 100,  size: 1,   opacity: 0.55 },
    { left: '70%', top: 70,   size: 2,   opacity: 0.35 },
    { left: '85%', top: 40,   size: 1.5, opacity: 0.45 },
    { left: '92%', top: 110,  size: 1,   opacity: 0.4 },
    // Upper-mid
    { left: '11%', top: 180,  size: 1,   opacity: 0.3 },
    { left: '40%', top: 200,  size: 1,   opacity: 0.35 },
    { left: '60%', top: 160,  size: 1.5, opacity: 0.4 },
    { left: '80%', top: 230,  size: 1,   opacity: 0.3 },
    { left: '25%', top: 260,  size: 2,   opacity: 0.3 },
    // Mid screen
    { left: '8%',  top: 340,  size: 1.5, opacity: 0.35 },
    { left: '45%', top: 320,  size: 1,   opacity: 0.4 },
    { left: '72%', top: 360,  size: 2,   opacity: 0.3 },
    { left: '90%', top: 300,  size: 1,   opacity: 0.4 },
    { left: '16%', top: 420,  size: 1,   opacity: 0.32 },
    { left: '55%', top: 440,  size: 1.5, opacity: 0.35 },
    { left: '82%', top: 460,  size: 1,   opacity: 0.3 },
    // Lower-mid
    { left: '5%',  top: 540,  size: 1.5, opacity: 0.4 },
    { left: '38%', top: 520,  size: 1,   opacity: 0.35 },
    { left: '65%', top: 580,  size: 2,   opacity: 0.3 },
    { left: '88%', top: 560,  size: 1,   opacity: 0.35 },
    { left: '22%', top: 640,  size: 1,   opacity: 0.32 },
    { left: '50%', top: 660,  size: 1.5, opacity: 0.4 },
    { left: '78%', top: 700,  size: 1,   opacity: 0.3 },
    // Bottom band
    { left: '12%', top: 780,  size: 1.5, opacity: 0.35 },
    { left: '42%', top: 810,  size: 1,   opacity: 0.3 },
    { left: '68%', top: 770,  size: 2,   opacity: 0.32 },
    { left: '90%', top: 840,  size: 1,   opacity: 0.35 },
    { left: '28%', top: 900,  size: 1,   opacity: 0.3 },
    { left: '58%', top: 920,  size: 1.5, opacity: 0.4 },
    { left: '85%', top: 960,  size: 1,   opacity: 0.32 },
];

export function DuaWallModal({ visible, onClose }: Props) {
    const { colors } = useTheme();
    const [duas, setDuas] = useState<PublicDua[]>([]);
    const [showCompose, setShowCompose] = useState(false);
    const [composeText, setComposeText] = useState('');
    const [publishing, setPublishing] = useState(false);
    const [ameened, setAmeened] = useState<Set<string>>(new Set());
    const [praying, setPraying] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!visible) return;
        const unsub = DuaWall.subscribeWall(50, setDuas);
        return () => unsub();
    }, [visible]);

    // Merge live duas with the curated seed list so the wall never feels
    // empty for new users. Live duas show first (chronological); seed
    // duas fill the rest. Each seed dua carries an isSeed flag so the UI
    // can show a "Universal" badge instead of pretending it's user-posted.
    const displayDuas = React.useMemo(() => {
        const merged: (PublicDua | (PublicDua & { isSeed?: true }))[] = [...duas];
        // Add seed duas only after live ones, deduping by id
        const liveIds = new Set(duas.map(d => d.id));
        for (const seed of SEED_DUAS) {
            if (!liveIds.has(seed.id)) merged.push(seed);
        }
        return merged;
    }, [duas]);

    // Activity indicator: how recently was the live feed updated?
    const lastLiveAt = duas[0]?.createdAt;
    const minutesAgo = lastLiveAt
        ? Math.max(0, Math.floor((Date.now() - lastLiveAt.getTime()) / 60000))
        : null;
    const activityLabel = duas.length === 0
        ? 'Quiet tonight · universal duas below'
        : minutesAgo == null
            ? `${duas.length} tonight`
            : minutesAgo < 1
                ? `${duas.length} tonight · just now`
                : minutesAgo < 60
                    ? `${duas.length} tonight · last ${minutesAgo}m ago`
                    : `${duas.length} tonight`;

    const handleAmeen = async (id: string) => {
        haptic.light();
        const wasAmeened = ameened.has(id);
        // Optimistic toggle
        setAmeened(prev => {
            const next = new Set(prev);
            if (wasAmeened) next.delete(id); else next.add(id);
            return next;
        });
        if (!wasAmeened) {
            import('../utils/analytics').then(m => m.track('dua_ameen')).catch(() => {});
        }
        // Seed duas don't write to Firestore; the local toggle is the whole thing.
        if (id.startsWith('seed-')) return;
        const ok = wasAmeened ? await DuaWall.unameen(id) : await DuaWall.ameen(id);
        if (!ok) {
            // Rollback on backend failure
            setAmeened(prev => {
                const next = new Set(prev);
                if (wasAmeened) next.add(id); else next.delete(id);
                return next;
            });
        }
    };

    const handlePraying = async (id: string) => {
        haptic.light();
        const wasPraying = praying.has(id);
        // Optimistic toggle
        setPraying(prev => {
            const next = new Set(prev);
            if (wasPraying) next.delete(id); else next.add(id);
            return next;
        });
        if (id.startsWith('seed-')) return;
        const ok = wasPraying ? await DuaWall.unpray(id) : await DuaWall.prayingFor(id);
        if (!ok) {
            // Rollback on backend failure
            setPraying(prev => {
                const next = new Set(prev);
                if (wasPraying) next.add(id); else next.delete(id);
                return next;
            });
        }
    };

    const handleReport = (id: string) => {
        Alert.alert(
            'Report this dua?',
            'Thank you for keeping the wall safe. We\'ll review this submission within 24 hours.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Report',
                    style: 'destructive',
                    onPress: async () => {
                        await DuaWall.report(id);
                        haptic.success();
                        Alert.alert('Reported', 'JazakAllah Khair.');
                    },
                },
            ],
        );
    };

    const handlePublish = async () => {
        if (publishing) return;
        const user = getFirebaseAuth()?.currentUser;
        if (!user) {
            Alert.alert('Sign in required', 'Please sign in to publish anonymously to the wall.');
            return;
        }
        setPublishing(true);
        const result = await DuaWall.publish(composeText);
        setPublishing(false);
        if (!result.ok) {
            const messages: Record<string, string> = {
                'too-short': `Please write at least ${DuaWall.MIN_WORDS} words.`,
                'too-long': `Please keep your dua under ${DuaWall.MAX_LENGTH} characters.`,
                'rate-limited': "You've already published today. The wall renews tomorrow.",
                'profanity': "Please rephrase — your dua contains words our filter flagged.",
                'not-signed-in': 'Please sign in to publish.',
                'firestore-error': 'Could not publish. Try again.',
            };
            Alert.alert('Could not publish', messages[result.error ?? 'firestore-error'] ?? 'Try again.');
            return;
        }
        haptic.success();
        setComposeText('');
        setShowCompose(false);
        import('../utils/featureDiscovery').then(m => m.markFeatureUsed('dua_wall')).catch(() => {});
        import('../utils/analytics').then(m => m.track('dua_posted')).catch(() => {});
        Alert.alert('Published 🌙', 'May Allah accept your dua.');
    };

    // Character count color shifts as user approaches limit
    const remaining = DuaWall.MAX_LENGTH - composeText.length;
    const countColor = remaining < 20 ? '#ef4444' : remaining < 50 ? '#f59e0b' : colors.secondaryText;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={styles.root}>
                <LinearGradient colors={['#08091e', '#0a1228', '#040714']} style={StyleSheet.absoluteFill} />

                {/* Stars in the background — only behind hero, not the list */}
                {STARS.map((s, i) => (
                    <View key={i} pointerEvents="none" style={[
                        styles.star,
                        { left: s.left as any, top: s.top, width: s.size, height: s.size,
                          borderRadius: s.size / 2, opacity: s.opacity },
                    ]} />
                ))}

                {/* ── Single header: close + title block + share ── */}
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={onClose}
                        style={styles.iconBtn}
                        hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                        accessibilityLabel="Close"
                        accessibilityRole="button"
                    >
                        <X size={20} color="#94a3b8" />
                    </TouchableOpacity>

                    <View style={styles.headerCenter}>
                        <Text style={[styles.headerTitle, { color: colors.primaryText }]}>Dua Wall</Text>
                        <Text style={[styles.headerSub, { color: colors.secondaryText }]}>
                            {activityLabel}
                        </Text>
                    </View>

                    <TouchableOpacity
                        onPress={() => { haptic.light(); setShowCompose(true); }}
                        style={[styles.publishBtn, { backgroundColor: colors.accent, shadowColor: colors.accent }]}
                        accessibilityLabel="Publish a dua"
                        accessibilityRole="button"
                    >
                        <PenLine size={14} color="#0a1228" strokeWidth={2.5} />
                    </TouchableOpacity>
                </View>

                {/* ── Duas list ── */}
                <FlatList
                    data={displayDuas}
                    keyExtractor={d => d.id}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    initialNumToRender={6}
                    maxToRenderPerBatch={6}
                    windowSize={7}
                    removeClippedSubviews={Platform.OS === 'android'}
                    ListEmptyComponent={
                        <Animated.View entering={FadeIn.delay(200).duration(500)} style={styles.empty}>
                            <View style={[styles.emptyOrb, { borderColor: colors.accent + '33' }]}>
                                <Sparkles size={28} color={colors.accent + '88'} strokeWidth={1.5} />
                            </View>
                            <Text style={[styles.emptyTitle, { color: colors.primaryText }]}>No duas yet</Text>
                            <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>
                                Be the first to share one.{'\n'}
                                Others will say Ameen.
                            </Text>
                            <TouchableOpacity
                                onPress={() => setShowCompose(true)}
                                style={[styles.emptyCTA, { backgroundColor: colors.accent }]}
                            >
                                <PenLine size={14} color="#0a1228" strokeWidth={2.5} />
                                <Text style={styles.emptyCTAText}>Share yours</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    }
                    renderItem={({ item, index }) => (
                        <DuaCard
                            dua={item}
                            index={index}
                            userTapped={ameened.has(item.id)}
                            userPraying={praying.has(item.id)}
                            accent={colors.accent}
                            onAmeen={() => handleAmeen(item.id)}
                            onPraying={() => handlePraying(item.id)}
                            onReport={() => handleReport(item.id)}
                            isSeed={isSeedDua(item)}
                        />
                    )}
                />

                {/* ══ Compose Modal ══ */}
                <Modal
                    visible={showCompose}
                    animationType="slide"
                    presentationStyle="formSheet"
                    onRequestClose={() => setShowCompose(false)}
                >
                    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                        <LinearGradient colors={['#08091e', '#040714']} style={StyleSheet.absoluteFill} />

                        {/* Compose header */}
                        <View style={styles.composeHeader}>
                            <TouchableOpacity onPress={() => setShowCompose(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                                <Text style={[styles.composeCancel, { color: colors.secondaryText }]}>Cancel</Text>
                            </TouchableOpacity>

                            <Text style={[styles.composeBrandText, { color: colors.primaryText }]}>Your dua</Text>

                            <TouchableOpacity
                                onPress={handlePublish}
                                disabled={publishing || composeText.trim().length < 5}
                                style={[
                                    styles.composePublishBtn,
                                    {
                                        backgroundColor: composeText.trim().length >= 5 ? colors.accent : 'rgba(255,255,255,0.08)',
                                        opacity: publishing ? 0.6 : 1,
                                    },
                                ]}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                {publishing
                                    ? <ActivityIndicator size="small" color="#0a1228" />
                                    : <Text style={[styles.composePublishText, { color: composeText.trim().length >= 5 ? '#0a1228' : '#475569' }]}>Publish</Text>
                                }
                            </TouchableOpacity>
                        </View>

                        {/* Bismillah header */}
                        <View style={styles.bismillahWrap}>
                            <Text style={[styles.bismillah, { color: colors.accent + 'cc' }]}>بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيم</Text>
                            <View style={[styles.bismillahDivider, { backgroundColor: colors.accent + '22' }]} />
                        </View>

                        {/* Writing surface */}
                        <View style={[styles.writeSurface, { borderColor: colors.accent + '22' }]}>
                            <TextInput
                                value={composeText}
                                onChangeText={setComposeText}
                                multiline
                                placeholder="Ya Allah…"
                                placeholderTextColor="#3d4f68"
                                style={[styles.composeInput, { color: colors.primaryText }]}
                                maxLength={DuaWall.MAX_LENGTH + 20}
                                autoFocus
                                textAlignVertical="top"
                            />
                        </View>

                        {/* Status row — character count + privacy note.
                            Tapping it (or anywhere outside the TextInput's
                            internal scroll) dismisses the keyboard. */}
                        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                            <View style={styles.composeStatus}>
                                <View style={styles.composeMeta}>
                                    <View style={[styles.composeDot, { backgroundColor: colors.accent }]} />
                                    <Text style={[styles.composeMetaText, { color: colors.secondaryText }]}>
                                        Anonymous · 1 per day
                                    </Text>
                                </View>
                                <Text style={[styles.composeCount, { color: countColor }]}>
                                    {composeText.length} / {DuaWall.MAX_LENGTH}
                                </Text>
                            </View>
                        </TouchableWithoutFeedback>
                    </KeyboardAvoidingView>
                </Modal>
            </View>
        </Modal>
    );
}

// ── Dua card with stagger entry + heart spring animation ──
// Memoised so tapping Ameen/Praying on one card doesn't re-render the whole
// list. The comparator ignores callback identity (the parent passes fresh inline
// callbacks each render) and only re-renders when something visible changes.
const DuaCard = React.memo(function DuaCard({
    dua, index, userTapped, userPraying, accent, onAmeen, onPraying, onReport, isSeed,
}: {
    dua: PublicDua;
    index: number;
    userTapped: boolean;
    userPraying: boolean;
    accent: string;
    onAmeen: () => void;
    onPraying: () => void;
    onReport: () => void;
    isSeed?: boolean;
}) {
    const heartScale = useSharedValue(1);
    const heartStyle = useAnimatedStyle(() => ({
        transform: [{ scale: heartScale.value }],
    }));

    const tap = () => {
        // Animate the satisfying pop only when adding an Ameen, not when undoing
        if (!userTapped) {
            heartScale.value = withSequence(
                withSpring(1.4, { damping: 6, stiffness: 200 }),
                withSpring(1.0, { damping: 8 }),
            );
        }
        onAmeen(); // toggles (add or undo) — handled in the parent
    };

    return (
        <Animated.View
            entering={FadeInDown.delay(Math.min(index * 60, 400)).duration(420)}
            style={[styles.card, { borderColor: userTapped ? accent + '33' : 'rgba(255,255,255,0.06)' }]}
        >
            {/* Soft accent line at top */}
            <View style={[styles.cardAccent, { backgroundColor: accent + (userTapped ? '88' : '33') }]} />

            {/* "Universal" badge for curated seed duas — makes it transparent
                that these are starter content, not real community posts. */}
            {isSeed && (
                <View style={[styles.seedBadge, { borderColor: accent + '44' }]}>
                    <Text style={[styles.seedBadgeText, { color: accent }]}>✦ UNIVERSAL DUA</Text>
                </View>
            )}

            <Text style={styles.duaText}>{dua.text}</Text>

            <View style={styles.cardFooter}>
                <View style={styles.footerTop}>
                    <Text style={styles.timeText}>
                        {isSeed ? 'A community staple' : `${formatDistanceToNowStrict(dua.createdAt)} ago`}
                    </Text>
                    <TouchableOpacity
                        onPress={onReport}
                        style={styles.flagBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel="Report dua"
                        accessibilityRole="button"
                    >
                        <Flag size={12} color="#475569" />
                    </TouchableOpacity>
                </View>

                <View style={styles.cardActions}>
                    {/* "Praying for you" — a personal-commitment reaction
                        complementary to Ameen. Ameen affirms the dua;
                        Praying signals "I'll personally pray for this."  */}
                    <TouchableOpacity
                        onPress={onPraying}
                        activeOpacity={0.85}
                        style={[
                            styles.ameenBtn,
                            userPraying
                                ? { backgroundColor: accent + '22', borderColor: accent + '55' }
                                : { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' },
                        ]}
                        accessibilityLabel={userPraying ? 'Already praying for this' : "I'm praying for you"}
                        accessibilityRole="button"
                        accessibilityState={{ selected: userPraying }}
                    >
                        <Sparkles size={13} color={userPraying ? accent : '#94a3b8'} strokeWidth={2} />
                        <Text style={[styles.ameenText, { color: userPraying ? accent : '#94a3b8' }]}>
                            {userPraying ? 'Praying' : 'Pray for'}
                        </Text>
                        {(dua.prayCount ?? 0) > 0 && (
                            <View style={[styles.ameenCount, { backgroundColor: userPraying ? accent + '33' : 'rgba(255,255,255,0.06)' }]}>
                                <Text style={[styles.ameenCountText, { color: userPraying ? accent : '#94a3b8' }]}>
                                    {dua.prayCount}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={tap}
                        activeOpacity={0.85}
                        style={[
                            styles.ameenBtn,
                            userTapped
                                // Red glow once liked — classic "heart filled" affordance.
                                ? { backgroundColor: '#ef444422', borderColor: '#ef444455' }
                                : { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' },
                        ]}
                        accessibilityLabel={userTapped ? "Already said Ameen" : "Say Ameen"}
                        accessibilityRole="button"
                        accessibilityState={{ selected: userTapped }}
                    >
                        <Animated.View style={heartStyle}>
                            <Heart
                                size={13}
                                color={userTapped ? '#ef4444' : '#94a3b8'}
                                fill={userTapped ? '#ef4444' : 'transparent'}
                                strokeWidth={2}
                            />
                        </Animated.View>
                        <Text style={[
                            styles.ameenText,
                            { color: userTapped ? '#ef4444' : '#94a3b8' },
                        ]}>
                            Ameen
                        </Text>
                        {dua.ameenCount > 0 && (
                            <View style={[styles.ameenCount, { backgroundColor: userTapped ? '#ef444433' : 'rgba(255,255,255,0.06)' }]}>
                                <Text style={[styles.ameenCountText, { color: userTapped ? '#ef4444' : '#94a3b8' }]}>
                                    {dua.ameenCount}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </Animated.View>
    );
}, (prev, next) =>
    // Skip re-render unless something visible to THIS card changed. Callback
    // identity is intentionally ignored (parent re-creates them each render).
    prev.userTapped === next.userTapped &&
    prev.userPraying === next.userPraying &&
    prev.isSeed === next.isSeed &&
    prev.accent === next.accent &&
    prev.dua.id === next.dua.id &&
    prev.dua.ameenCount === next.dua.ameenCount &&
    prev.dua.prayCount === next.dua.prayCount &&
    prev.dua.text === next.dua.text
);

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#040714' },

    // ── Stars ──
    star: { position: 'absolute', backgroundColor: '#fff' },

    // ── Header (single, compact) ──
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 18,
        gap: 12,
    },
    iconBtn: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center', justifyContent: 'center',
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitleRow: {
        flexDirection: 'row', alignItems: 'center', gap: 7,
    },
    headerTitle: {
        fontSize: 19, fontWeight: '800',
        letterSpacing: -0.3,
    },
    headerSub: {
        fontSize: 11, fontWeight: '600',
        marginTop: 3,
    },
    publishBtn: {
        width: 38, height: 38, borderRadius: 19,
        alignItems: 'center', justifyContent: 'center',
        shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
        elevation: 6,
    },

    // ── List ──
    list: { paddingHorizontal: 18, paddingBottom: 80 },

    // ── Card ──
    card: {
        backgroundColor: 'rgba(255,255,255,0.025)',
        borderWidth: 1,
        borderRadius: 18,
        paddingHorizontal: 18,
        paddingTop: 18,
        paddingBottom: 14,
        marginBottom: 12,
        overflow: 'hidden',
        position: 'relative',
    },
    cardAccent: {
        position: 'absolute', top: 0, left: 0, right: 0,
        height: 2,
    },
    seedBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8, paddingVertical: 3,
        borderRadius: 8, borderWidth: 1,
        marginBottom: 10,
    },
    seedBadgeText: {
        fontSize: 9, fontWeight: '900', letterSpacing: 1,
    },
    duaText: {
        color: '#e2e8f0',
        fontSize: 15,
        lineHeight: 24,
        fontWeight: '400',
        marginBottom: 14,
    },
    cardFooter: {
        flexDirection: 'column',
        gap: 12,
    },
    footerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    timeText: {
        color: '#475569',
        fontSize: 11,
        fontWeight: '600',
    },
    // Full-width row; the two reaction buttons flex equally so they always
    // fit inside the card and never overflow the edge.
    cardActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    flagBtn: {
        width: 28, height: 28, borderRadius: 14,
        alignItems: 'center', justifyContent: 'center',
    },
    ameenBtn: {
        flex: 1,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        paddingVertical: 9,
        borderRadius: 16, borderWidth: 1,
    },
    ameenText: { fontSize: 12, fontWeight: '700' },
    ameenCount: {
        marginLeft: 2,
        paddingHorizontal: 7, paddingVertical: 2,
        borderRadius: 8, minWidth: 22, alignItems: 'center',
    },
    ameenCountText: { fontSize: 11, fontWeight: '800' },

    // ── Empty state ──
    empty: {
        alignItems: 'center',
        paddingHorizontal: 32,
        paddingTop: 40,
    },
    emptyOrb: {
        width: 80, height: 80, borderRadius: 40,
        borderWidth: 1,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 20,
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    emptyTitle: {
        fontSize: 20, fontWeight: '800',
        marginBottom: 10,
        letterSpacing: -0.3,
    },
    emptyBody: {
        fontSize: 14, lineHeight: 20,
        textAlign: 'center',
        marginBottom: 24,
    },
    emptyCTA: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 18, paddingVertical: 11, borderRadius: 22,
    },
    emptyCTAText: { color: '#0a1228', fontSize: 14, fontWeight: '800' },

    // ── Compose Modal ──
    composeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    composeCancel: { fontSize: 14, fontWeight: '600' },
    composeBrandText: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
    composePublishBtn: {
        paddingHorizontal: 16, paddingVertical: 8,
        borderRadius: 16,
    },
    composePublishText: { fontSize: 13, fontWeight: '800' },

    bismillahWrap: {
        alignItems: 'center',
        paddingVertical: 18,
    },
    bismillah: {
        fontSize: 22,
        fontFamily: 'AmiriQuran',
        lineHeight: 40,
        textAlign: 'center',
    },
    bismillahDivider: {
        width: 100, height: 1,
        marginTop: 10,
    },

    writeSurface: {
        flex: 1,
        marginHorizontal: 16,
        marginBottom: 8,
        borderRadius: 18,
        borderWidth: 1,
        backgroundColor: 'rgba(10,14,40,0.55)',
        padding: 4,
    },
    composeInput: {
        flex: 1,
        fontSize: 16, lineHeight: 26,
        padding: 18,
    },

    composeStatus: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 22, paddingVertical: 14,
    },
    composeMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    composeDot: { width: 6, height: 6, borderRadius: 3 },
    composeMetaText: { fontSize: 11, fontWeight: '600' },
    composeCount: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
