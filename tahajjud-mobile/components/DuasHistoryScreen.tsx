import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, FlatList, ScrollView,
    ActivityIndicator, DeviceEventEmitter, TextInput, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, Trash2, Crown } from 'lucide-react-native';
import { formatDistanceToNowStrict } from 'date-fns';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { useTheme } from '../context/ThemeContext';
import { usePurchases } from '../context/PurchasesContext';
import { t } from '../utils/i18n';
import { haptic } from '../utils/haptic';
import { DuaWall, PublicDua, formatDuaAuthor } from '../utils/duaWall';
import { Comments } from '../utils/comments';
import { CommunityProfileStore } from '../utils/communityProfile';
import { CommentThread } from './CommentThread';

const PAGE_SIZE = 20;

type Tab = 'mine' | 'answered';

interface Props {
    onClose: () => void;
    accent: string;
    /** See CommentThread — forwarded down for the Answered tab's reply
     * composer, since this screen is itself an overlay inside an
     * already-presented modal (the root Paywall modal can't present). */
    onRequestPaywall?: () => void;
    initialTab?: Tab;
}

/**
 * One combined "Duas" screen with two tabs, replacing what used to be two
 * separate header icons (My Duas / Answered Duas) — icon-only buttons that
 * gave no hint what each opened. A single entry point with text-labeled tabs
 * is self-explanatory the moment it opens.
 *
 * - "Mine": this device's own dua history, with the mark-answered action.
 * - "Answered": every answered dua from anyone, most recent first, each with
 *   its reply thread so users can share how it was answered.
 */
export function DuasHistoryScreen({ onClose, accent, onRequestPaywall, initialTab = 'mine' }: Props) {
    const { colors } = useTheme();
    const [tab, setTab] = useState<Tab>(initialTab);
    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    // This device's own dua ids — lets the Answered tab tell "this is a card
    // you posted" (show the story prompt) from "this is someone else's" (show
    // a plain reply thread), so the ask "how was this answered" only ever
    // lands on the person who'd actually know the answer.
    const [ownDuaIds, setOwnDuaIds] = useState<Set<string>>(new Set());
    useEffect(() => {
        DuaWall.getOwnDuaIds().then(ids => setOwnDuaIds(new Set(ids)));
    }, []);

    // ── "Mine" tab ──
    const [myDuas, setMyDuas] = useState<PublicDua[]>([]);
    const [myDuasLoading, setMyDuasLoading] = useState(true);
    const [markingAnswered, setMarkingAnswered] = useState<Set<string>>(new Set());
    const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        let cancelled = false;
        setMyDuasLoading(true);
        (async () => {
            const ids = await DuaWall.getOwnDuaIds();
            const duas = await DuaWall.getMany(ids);
            if (!cancelled) {
                setMyDuas(duas);
                setMyDuasLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('duaAnswered', ({ duaId }: { duaId: string }) => {
            setMyDuas(prev => prev.map(d => d.id === duaId ? { ...d, answered: true } : d));
        });
        return () => sub.remove();
    }, []);

    // Prompt to share how it was answered. Nobody but the author is ever
    // asked this (see the Answered tab below, which uses a plain unprompted
    // CommentThread for everyone else) — a stranger can't know how someone
    // else's prayer was answered. Opens automatically right after marking a
    // dua answered, AND stays available afterwards as a small link on any
    // already-answered dua — marking answered doesn't require writing a
    // story on the spot, and a dua answered in an earlier session (before
    // this existed, or simply skipped at the time) still needs a way back in.
    const { isPremium, openPaywall } = usePurchases();
    const [storyPromptId, setStoryPromptId] = useState<string | null>(null);
    const [storyText, setStoryText] = useState('');
    const [storyName, setStoryName] = useState('');
    const [postingStory, setPostingStory] = useState(false);
    // Known name from CommunityProfileStore — same "don't ask again" fix as
    // CommentThread's reply composer. Renders as static "Sharing as X" text
    // instead of an editable box when a name is already known; only a fresh
    // identity (never named anywhere in the app) sees an actual input.
    const [storyProfileName, setStoryProfileName] = useState<string | null>(null);
    const [editingStoryName, setEditingStoryName] = useState(false);

    const openStoryPrompt = (duaId: string) => {
        haptic.light();
        setStoryPromptId(duaId);
        setStoryText('');
        setEditingStoryName(false);
        CommunityProfileStore.get().then(profile => {
            if (!mountedRef.current || !profile?.nickname) return;
            setStoryProfileName(profile.nickname);
            setStoryName(profile.nickname);
        });
    };

    const handleMarkAnswered = async (duaId: string) => {
        if (markingAnswered.has(duaId)) return;
        haptic.success();
        setMarkingAnswered(prev => new Set(prev).add(duaId));
        const ok = await DuaWall.markAnswered(duaId);
        if (ok) {
            setMyDuas(prev => prev.map(d => d.id === duaId ? { ...d, answered: true } : d));
            openStoryPrompt(duaId);
        }
        setMarkingAnswered(prev => {
            const next = new Set(prev);
            next.delete(duaId);
            return next;
        });
    };

    const handleDelete = (duaId: string) => {
        if (deletingIds.has(duaId)) return;
        Alert.alert(
            t('duaWall.deleteConfirmTitle'),
            t('duaWall.deleteConfirmBody'),
            [
                { text: t('btn.cancel'), style: 'cancel' },
                {
                    text: t('btn.delete'),
                    style: 'destructive',
                    onPress: async () => {
                        haptic.light();
                        setDeletingIds(prev => new Set(prev).add(duaId));
                        const ok = await DuaWall.deleteMine(duaId);
                        if (!mountedRef.current) return;
                        if (ok) {
                            setMyDuas(prev => prev.filter(d => d.id !== duaId));
                            if (storyPromptId === duaId) setStoryPromptId(null);
                        }
                        setDeletingIds(prev => {
                            const next = new Set(prev);
                            next.delete(duaId);
                            return next;
                        });
                    },
                },
            ],
        );
    };

    const handlePostStory = async (duaId: string) => {
        if (postingStory) return;
        const trimmed = storyText.trim();
        if (trimmed.length === 0) { setStoryPromptId(null); return; }
        setPostingStory(true);
        const result = await Comments.post('dua', duaId, trimmed, storyName, isPremium);
        if (!mountedRef.current) return;
        setPostingStory(false);

        if (!result.ok) {
            if (result.error === 'free-limit') {
                if (onRequestPaywall) onRequestPaywall();
                else openPaywall('comment_free_limit', 'dua_replies');
                return;
            }
            const messages: Record<string, string> = {
                'too-short': 'Please write something first.',
                'too-long': `Please keep it under ${Comments.MAX_LENGTH} characters.`,
                'profanity': 'Please rephrase — your text contains words our filter flagged.',
                'not-signed-in': 'Please sign in to share.',
                'cooldown': t('comments.cooldown'),
                'firestore-error': 'Could not post. Try again.',
            };
            Alert.alert('Could not post', messages[result.error ?? 'firestore-error'] ?? 'Try again.');
            return;
        }

        haptic.success();
        if (storyName.trim()) CommunityProfileStore.set(storyName).catch(() => {});
        setStoryPromptId(null);
        setStoryText('');
    };

    // ── "Answered" tab (everyone's) ──
    const [answeredItems, setAnsweredItems] = useState<PublicDua[]>([]);
    const [answeredLoading, setAnsweredLoading] = useState(true);
    const [answeredLoadingMore, setAnsweredLoadingMore] = useState(false);
    const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setAnsweredLoading(true);
            const { items, nextCursor } = await DuaWall.getAnsweredDuas(PAGE_SIZE);
            if (cancelled) return;
            setAnsweredItems(items);
            setCursor(nextCursor);
            setHasMore(items.length === PAGE_SIZE);
            setAnsweredLoading(false);
        })();
        return () => { cancelled = true; };
    }, []);

    const loadMoreAnswered = useCallback(async () => {
        if (answeredLoadingMore || !hasMore || !cursor) return;
        setAnsweredLoadingMore(true);
        const { items, nextCursor } = await DuaWall.getAnsweredDuas(PAGE_SIZE, cursor);
        if (!mountedRef.current) return;
        setAnsweredItems(prev => [...prev, ...items]);
        setCursor(nextCursor);
        setHasMore(items.length === PAGE_SIZE);
        setAnsweredLoadingMore(false);
    }, [cursor, hasMore, answeredLoadingMore]);

    return (
        <View style={styles.root}>
            <LinearGradient colors={['#08091e', '#040714']} style={StyleSheet.absoluteFill} />

            <View style={styles.header}>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                    <Text style={[styles.headerAction, { color: colors.secondaryText }]}>{t('duaWall.close')}</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.primaryText }]}>{t('duaWall.duasHistoryTitle')}</Text>
                <View style={{ width: 50 }} />
            </View>

            {/* Segmented tab control — text labels, no guessing required */}
            <View style={styles.tabRow}>
                <TouchableOpacity
                    onPress={() => { haptic.light(); setTab('mine'); }}
                    style={[styles.tabBtn, tab === 'mine' && { borderBottomColor: accent }]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: tab === 'mine' }}
                >
                    <Text style={[styles.tabText, { color: tab === 'mine' ? accent : '#64748b' }]}>
                        {t('duaWall.myDuas')}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => { haptic.light(); setTab('answered'); }}
                    style={[styles.tabBtn, tab === 'answered' && { borderBottomColor: accent }]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: tab === 'answered' }}
                >
                    <Text style={[styles.tabText, { color: tab === 'answered' ? accent : '#64748b' }]}>
                        {t('duaWall.answeredDuas')}
                    </Text>
                </TouchableOpacity>
            </View>

            {tab === 'mine' ? (
                myDuasLoading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="small" color={colors.accent} />
                    </View>
                ) : myDuas.length === 0 ? (
                    <View style={styles.center}>
                        <Text style={styles.emptyText}>{t('duaWall.myDuasEmpty')}</Text>
                    </View>
                ) : (
                    <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
                        {myDuas.map(dua => (
                            <View key={dua.id} style={[styles.card, { borderColor: colors.accent + '22' }]}>
                                <Text style={styles.duaText} numberOfLines={4}>{dua.text}</Text>
                                <View style={styles.myDuaFooter}>
                                    <Text style={styles.meta}>
                                        {formatDistanceToNowStrict(dua.createdAt)} {t('duaWall.ago')} · 🤲 {dua.ameenCount}
                                    </Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <TouchableOpacity
                                        onPress={() => handleDelete(dua.id)}
                                        disabled={deletingIds.has(dua.id)}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        accessibilityLabel={t('btn.delete')}
                                        accessibilityRole="button"
                                    >
                                        {deletingIds.has(dua.id)
                                            ? <ActivityIndicator size="small" color="#64748b" />
                                            : <Trash2 size={14} color="#64748b" />}
                                    </TouchableOpacity>
                                    {dua.answered ? (
                                        <View style={styles.answeredBadge}>
                                            <Sparkles size={10} color="#fbbf24" fill="#fbbf24" />
                                            <Text style={styles.answeredBadgeText}>{t('duaWall.answered')}</Text>
                                        </View>
                                    ) : (
                                        <TouchableOpacity
                                            onPress={() => handleMarkAnswered(dua.id)}
                                            disabled={markingAnswered.has(dua.id)}
                                            style={[styles.markAnsweredBtn, { borderColor: colors.accent + '55' }]}
                                            accessibilityRole="button"
                                            accessibilityLabel={t('duaWall.markAnswered')}
                                        >
                                            {markingAnswered.has(dua.id)
                                                ? <ActivityIndicator size="small" color={colors.accent} />
                                                : <>
                                                    <Sparkles size={11} color={colors.accent} />
                                                    <Text style={[styles.markAnsweredText, { color: colors.accent }]}>
                                                        {t('duaWall.markAnswered')}
                                                    </Text>
                                                </>}
                                        </TouchableOpacity>
                                    )}
                                    </View>
                                </View>
                                {storyPromptId === dua.id && (
                                    <View style={[styles.storyPrompt, { borderColor: accent + '33' }]}>
                                        <Text style={[styles.storyPromptTitle, { color: accent }]}>
                                            {t('duaWall.answeredHowCta')}
                                        </Text>
                                        <Text style={[styles.storyIntro, { color: colors.secondaryText }]}>
                                            {t('duaWall.storyIntro')}
                                        </Text>

                                        <Text style={styles.storyFieldLabel}>{t('duaWall.storyFieldLabel')}</Text>
                                        <TextInput
                                            value={storyText}
                                            onChangeText={setStoryText}
                                            placeholder={t('duaWall.answeredHowPlaceholder')}
                                            placeholderTextColor="#3d4f68"
                                            style={[styles.storyInput, { color: colors.primaryText }]}
                                            maxLength={Comments.MAX_LENGTH}
                                            multiline
                                            textAlignVertical="top"
                                            autoFocus
                                        />
                                        <Text style={[styles.storyCounter, { color: colors.secondaryText }]}>
                                            {storyText.length} / {Comments.MAX_LENGTH}
                                        </Text>

                                        {storyProfileName && !editingStoryName ? (
                                            <View style={styles.storyNamePrefilledRow}>
                                                <Text style={[styles.storyNamePrefilledText, { color: colors.secondaryText }]} numberOfLines={1}>
                                                    {t('comments.replyingAs', { name: storyName || storyProfileName })}
                                                </Text>
                                                <TouchableOpacity
                                                    onPress={() => setEditingStoryName(true)}
                                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                    accessibilityRole="button"
                                                >
                                                    <Text style={[styles.storyNameChangeLink, { color: accent }]}>{t('comments.notYou')}</Text>
                                                </TouchableOpacity>
                                            </View>
                                        ) : (
                                            <>
                                                <Text style={styles.storyFieldLabel}>{t('duaWall.storyNameLabel')}</Text>
                                                <TextInput
                                                    value={storyName}
                                                    onChangeText={setStoryName}
                                                    placeholder={t('duaWall.storyNamePlaceholder')}
                                                    placeholderTextColor="#3d4f68"
                                                    style={[styles.storyNameInput, { color: colors.primaryText }]}
                                                    maxLength={Comments.MAX_NAME_LENGTH}
                                                    autoFocus={editingStoryName}
                                                />
                                            </>
                                        )}

                                        <View style={styles.storyActions}>
                                            <TouchableOpacity
                                                onPress={() => setStoryPromptId(null)}
                                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                            >
                                                <Text style={styles.storySkip}>{t('duaWall.skip')}</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => handlePostStory(dua.id)}
                                                disabled={postingStory || storyText.trim().length === 0}
                                                style={[styles.storyPostBtn, { backgroundColor: accent, opacity: storyText.trim().length === 0 ? 0.5 : 1 }]}
                                            >
                                                {postingStory
                                                    ? <ActivityIndicator size="small" color="#0a1228" />
                                                    : <Text style={styles.storyPostText}>{t('comments.post')}</Text>}
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}
                            </View>
                        ))}
                    </ScrollView>
                )
            ) : (
                answeredLoading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="small" color={accent} />
                    </View>
                ) : answeredItems.length === 0 ? (
                    <View style={styles.center}>
                        <View style={[styles.emptyOrb, { borderColor: accent + '33' }]}>
                            <Sparkles size={26} color={accent + '88'} strokeWidth={1.5} />
                        </View>
                        <Text style={styles.emptyText}>{t('duaWall.answeredDuasEmpty')}</Text>
                    </View>
                ) : (
                    <FlatList
                        data={answeredItems}
                        keyExtractor={d => d.id}
                        contentContainerStyle={styles.list}
                        showsVerticalScrollIndicator={false}
                        onEndReachedThreshold={0.4}
                        onEndReached={loadMoreAnswered}
                        ListFooterComponent={answeredLoadingMore
                            ? <ActivityIndicator size="small" color={accent} style={styles.footerSpinner} />
                            : null}
                        renderItem={({ item }) => (
                            <View style={[styles.card, { borderColor: accent + '22' }]}>
                                <View style={styles.badgeRow}>
                                    <Sparkles size={11} color="#fbbf24" fill="#fbbf24" />
                                    <Text style={styles.badgeText}>
                                        {item.answeredAt
                                            ? t('duaWall.answeredAgo', { time: formatDistanceToNowStrict(item.answeredAt) })
                                            : t('duaWall.answered')}
                                    </Text>
                                </View>
                                <Text style={styles.duaText}>{item.text}</Text>
                                <View style={styles.metaRow}>
                                    <Text style={styles.meta}>{formatDuaAuthor(item)}</Text>
                                    {/* Quiet supporter mark, same as CommentThread's */}
                                    {item.authorPremium && (
                                        <Crown size={10} color="#fbbf24" fill="#fbbf24" strokeWidth={2} accessibilityLabel="Premium supporter" />
                                    )}
                                </View>
                                {/* The "share how it was answered" copy only
                                    makes sense to whoever this dua actually
                                    happened to — a stranger reading someone
                                    else's card gets the plain, generic reply
                                    thread instead (see ownDuaIds above). */}
                                <CommentThread
                                    parentType="dua"
                                    parentId={item.id}
                                    replyCount={item.replyCount ?? 0}
                                    accent={accent}
                                    onRequestPaywall={onRequestPaywall}
                                    {...(ownDuaIds.has(item.id) ? {
                                        zeroStateLabel: t('duaWall.answeredHowCta'),
                                        placeholderText: t('duaWall.answeredHowPlaceholder'),
                                    } : {})}
                                />
                            </View>
                        )}
                    />
                )
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 10,
    },
    headerAction: { fontSize: 14, fontWeight: '600', width: 50 },
    headerTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
    tabRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.08)',
        marginBottom: 4,
    },
    tabBtn: {
        paddingVertical: 10,
        paddingHorizontal: 4,
        marginRight: 24,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabText: { fontSize: 13, fontWeight: '700' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },
    emptyOrb: {
        width: 60, height: 60, borderRadius: 30, borderWidth: 1.5,
        alignItems: 'center', justifyContent: 'center',
    },
    emptyText: { color: '#64748b', fontSize: 13, textAlign: 'center', lineHeight: 19 },
    list: { padding: 16, gap: 14, paddingBottom: 40 },
    footerSpinner: { marginVertical: 16 },
    card: {
        borderWidth: 1,
        borderRadius: 16,
        padding: 14,
        backgroundColor: 'rgba(255,255,255,0.03)',
        gap: 8,
    },
    badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    badgeText: { color: '#fbbf24', fontSize: 11, fontWeight: '700' },
    duaText: { color: '#e2e8f0', fontSize: 14, lineHeight: 20 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    meta: { color: '#64748b', fontSize: 11, fontWeight: '600' },
    myDuaFooter: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    answeredBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: 'rgba(251,191,36,0.12)',
        paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    },
    answeredBadgeText: { color: '#fbbf24', fontSize: 10, fontWeight: '700' },
    markAnsweredBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        borderWidth: 1, borderRadius: 8,
        paddingHorizontal: 9, paddingVertical: 5,
    },
    markAnsweredText: { fontSize: 11, fontWeight: '700' },
    storyPrompt: {
        borderWidth: 1, borderRadius: 12,
        padding: 12, gap: 4,
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    storyPromptTitle: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
    storyIntro: { fontSize: 12, lineHeight: 17, marginBottom: 10 },
    storyFieldLabel: {
        color: '#64748b', fontSize: 10, fontWeight: '800', letterSpacing: 1,
        marginBottom: 6, marginTop: 4,
    },
    storyInput: {
        fontSize: 13, lineHeight: 18,
        minHeight: 60, maxHeight: 110,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
        paddingHorizontal: 10, paddingVertical: 8,
    },
    storyCounter: { fontSize: 10, marginTop: 4, textAlign: 'right' },
    storyNameInput: {
        fontSize: 13,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
        paddingHorizontal: 10, paddingVertical: 8,
    },
    storyNamePrefilledRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: 6,
    },
    storyNamePrefilledText: { fontSize: 12, flex: 1, flexShrink: 1 },
    storyNameChangeLink: { fontSize: 11, fontWeight: '600' },
    storyActions: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 14,
        marginTop: 12,
    },
    storySkip: { color: '#64748b', fontSize: 12, fontWeight: '600' },
    storyPostBtn: {
        paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10,
    },
    storyPostText: { color: '#0a1228', fontSize: 12, fontWeight: '700' },
});
