import React, { useEffect, useState, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, TextInput,
    ActivityIndicator, Alert, DeviceEventEmitter,
} from 'react-native';
import { MessageCircle, Flag, Send, Heart, ChevronDown, ChevronUp, Crown, Trash2 } from 'lucide-react-native';
import { formatDistanceToNowStrict } from 'date-fns';
import { Comments, Comment, CommentParentType } from '../utils/comments';
import { Translate } from '../utils/translate';
import { CommunityProfileStore } from '../utils/communityProfile';
import { usePurchases } from '../context/PurchasesContext';
import { isCurrentUserAdmin } from '../utils/admins';
import { flagEmoji } from '../utils/countries';
import { getBlocked, blockAuthor, blockedSnapshot, BLOCKED_CHANGED } from '../utils/blockedUsers';
import { useTheme } from '../context/ThemeContext';
import { haptic } from '../utils/haptic';
import { t } from '../utils/i18n';

/**
 * Expandable reply thread under a dua (or, later, a testimony).
 *
 * Collapsed: a single "💬 N replies" / "Reply" row.
 * Expanded: the thread (live) + composer with optional first-name field.
 *
 * Premium gate: free users get Comments.FREE_REPLIES_PER_DAY replies per
 * day; when exhausted the composer's Post button routes to the paywall with
 * feature-specific copy (featureId 'dua_replies'). The gate is checked when
 * the user OPENS the composer, not after they've written — with one
 * deliberate exception: if they're already mid-compose when the day's
 * allowance runs out elsewhere, their in-flight reply still posts. Never
 * interrupt someone mid-kindness with a sales screen.
 */

interface Props {
    parentType: CommentParentType;
    parentId: string;
    replyCount: number;        // denormalised count from the parent doc
    accent: string;
    /**
     * When this thread lives inside an already-presented native modal (the
     * Dua Wall pageSheet), the global root-level Paywall <Modal> silently
     * fails to present — iOS allows one modal per presenter, and this app
     * has documented scars from nested modals too (see DuaWall's compose
     * overlay). The host modal passes this callback to show the paywall as
     * an overlay View inside itself instead.
     */
    onRequestPaywall?: () => void;
    /** Start with the thread open (deep-link from a reply notification). */
    initialExpanded?: boolean;
    /**
     * Answered Duas screen override: nothing about the generic "Reply" label,
     * empty state, or placeholder tells a viewer THIS is where you'd write
     * how a dua was answered — so that screen passes copy that says so
     * explicitly. Every other usage (Wall, My Duas, map) omits these and
     * keeps the generic reply-thread copy.
     */
    zeroStateLabel?: string;
    emptyStateText?: string;
    placeholderText?: string;
}

export function CommentThread({ parentType, parentId, replyCount, accent, onRequestPaywall, initialExpanded, zeroStateLabel, emptyStateText, placeholderText }: Props) {
    const { colors } = useTheme();
    const { isPremium, openPaywall } = usePurchases();
    // Whether the viewer authored the parent dua/story — declared here
    // (ahead of hasUnlimitedReplies below, which reads it) rather than
    // further down with the other state, since a dependency evaluated during
    // render needs the const it references already declared earlier in
    // source order, not just by the time an effect runs.
    const [viewerIsParentAuthor, setViewerIsParentAuthor] = useState(false);
    // Admin gets the same "no daily limit" treatment as premium — purely
    // client-side, same trust model as the premium gate itself (nothing
    // server-side distinguishes admin replies from anyone else's). Replying
    // in your OWN dua/story's thread is the same idea — Comments.post()
    // exempts it server-side too (see its own comment), this just keeps the
    // gate UI from showing at all for that case.
    const hasUnlimitedReplies = isPremium || isCurrentUserAdmin() || viewerIsParentAuthor;
    const [expanded, setExpanded] = useState(false);
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState('');
    const [name, setName] = useState('');
    // Known name from CommunityProfileStore (set on the Wall, Leaderboard, or
    // Partner circle). When present, the name field renders as static
    // "Replying as X" text instead of an editable box — an editable box that
    // happens to already be filled in still reads as "you're being asked for
    // your name again," which is the actual confusion, not a blank field.
    const [profileName, setProfileName] = useState<string | null>(null);
    // Same shared country as the Wall/Leaderboard/Story submission — replies
    // previously never carried it at all, so a reply only ever showed a bare
    // name even when every other surface showed a flag next to it. No picker
    // here (keeps the reply box lightweight); just silently carries through
    // whatever's already on file, same as the name prefill above.
    const [profileCountry, setProfileCountry] = useState<string | null>(null);
    const [editingName, setEditingName] = useState(false);
    const [posting, setPosting] = useState(false);
    // Replies this user chose to hide locally (anonymous "block").
    const [locallyHidden, setLocallyHidden] = useState<Set<string>>(new Set());
    // Blocked authors — required by App Store Review 1.2, and stronger than
    // the per-reply local hide above: this removes everything they write.
    const [blocked, setBlocked] = useState<Set<string>>(blockedSnapshot());
    useEffect(() => {
        getBlocked().then(setBlocked);
        const sub = DeviceEventEmitter.addListener(BLOCKED_CHANGED, () => { getBlocked().then(s => setBlocked(new Set(s))); });
        return () => sub.remove();
    }, []);
    // Replies THIS device has liked (general-purpose, everyone can do this —
    // separate from authorLiked's parent-author-only "appreciated" heart).
    const [likedLocally, setLikedLocally] = useState<Set<string>>(new Set());
    // Per-reply translate state. Replies render inline via .map() below (not
    // as their own component instances), so this can't use the useTranslatable
    // hook (calling hooks per-item inside a loop breaks the Rules of Hooks) —
    // same per-id-dictionary shape as locallyHidden/likedLocally above instead.
    const [commentTranslations, setCommentTranslations] = useState<Record<string, string>>({});
    const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set());
    const [showingTranslationIds, setShowingTranslationIds] = useState<Set<string>>(new Set());
    const likeToggleInFlightRef = useRef<Set<string>>(new Set());
    // viewerIsParentAuthor is declared earlier, alongside hasUnlimitedReplies.
    const likeInFlightRef = useRef<Set<string>>(new Set());
    // Snapshot of gate state taken when the composer opened — see header note.
    // State (not a ref) so the "1 free reply today" hint renders when the
    // async allowance check lands.
    const [gateCleared, setGateCleared] = useState(false);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    // Deep-link: open the thread immediately, including the free-gate
    // pre-check that handleExpand would normally run.
    useEffect(() => {
        if (!initialExpanded) return;
        setExpanded(true);
        if (hasUnlimitedReplies) {
            setGateCleared(true);
        } else {
            Comments.freeRepliesLeftToday().then(left => {
                if (mountedRef.current) setGateCleared(left > 0);
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialExpanded]);

    useEffect(() => {
        if (!expanded) return;
        setLoading(true);
        Comments.getLocallyHidden().then(set => {
            if (mountedRef.current) setLocallyHidden(set);
        });
        Comments.getLikedLocally().then(set => {
            if (mountedRef.current) setLikedLocally(set);
        });
        // Prefill from the shared community name (set on the Leaderboard, a
        // dua post, or the Partner circle) — same name people already
        // recognize you by elsewhere. Only if the field is still blank, so
        // reopening the thread doesn't clobber something already typed.
        CommunityProfileStore.get().then(profile => {
            if (!mountedRef.current || !profile?.nickname) return;
            setProfileName(profile.nickname);
            setName(prev => prev || profile.nickname);
            if (profile.country) setProfileCountry(profile.country);
        });
        Comments.isParentAuthor(parentType, parentId).then(is => {
            if (mountedRef.current) setViewerIsParentAuthor(is);
        });
        const unsub = Comments.subscribe(parentType, parentId, (list, fromCache) => {
            if (!mountedRef.current) return;
            setComments(list);
            if (!fromCache) setLoading(false);
        });
        return unsub;
    }, [expanded, parentType, parentId]);

    const visibleComments = comments.filter(c => !locallyHidden.has(c.id) && (!c.authorId || !blocked.has(c.authorId)));

    const shownCount = Math.max(replyCount, comments.length);
    const countLabel = shownCount === 0
        ? (zeroStateLabel ?? t('comments.reply'))
        : shownCount === 1
            ? t('comments.oneReply')
            : t('comments.replies', { count: shownCount });

    const handleExpand = async () => {
        haptic.light();
        if (expanded) { setExpanded(false); return; }
        setExpanded(true);
        // Pre-check the free gate so the composer can show "1 free reply today"
        // or route to the paywall on Post.
        if (hasUnlimitedReplies) {
            setGateCleared(true);
        } else {
            const left = await Comments.freeRepliesLeftToday();
            if (mountedRef.current) setGateCleared(left > 0);
        }
    };

    // Free user with today's allowance spent — the send button becomes a
    // paywall trigger (tappable even with an empty input).
    const gateBlocked = !hasUnlimitedReplies && !gateCleared;

    const handlePost = async () => {
        if (posting) return;
        haptic.light();

        // The paywall moment: free user, allowance exhausted BEFORE they began
        // composing. (If gateCleared is true they started with allowance —
        // let the post go through even if the local counter has since ticked.)
        if (gateBlocked) {
            import('../utils/analytics').then(m => m.track('comment_paywall_shown', {
                parent_type: parentType,
            })).catch(() => {});
            if (onRequestPaywall) onRequestPaywall();
            else openPaywall('comment_free_limit', 'dua_replies');
            return;
        }

        const trimmed = text.trim();
        if (trimmed.length === 0) return;

        setPosting(true);
        const result = await Comments.post(parentType, parentId, trimmed, name, hasUnlimitedReplies, profileCountry);
        if (!mountedRef.current) return;
        setPosting(false);

        if (!result.ok) {
            if (result.error === 'free-limit') {
                import('../utils/analytics').then(m => m.track('comment_paywall_shown', {
                    parent_type: parentType,
                })).catch(() => {});
                if (onRequestPaywall) onRequestPaywall();
                else openPaywall('comment_free_limit', 'dua_replies');
                return;
            }
            const messages: Record<string, string> = {
                'too-short': 'Please write something first.',
                'too-long': `Please keep your reply under ${Comments.MAX_LENGTH} characters.`,
                'profanity': 'Please rephrase — your reply contains words our filter flagged.',
                'not-signed-in': 'Please sign in to reply.',
                'cooldown': t('comments.cooldown'),
                'firestore-error': 'Could not post. Try again.',
            };
            Alert.alert('Could not post', messages[result.error ?? 'firestore-error'] ?? 'Try again.');
            return;
        }

        haptic.success();
        // Propagate whatever name they used to the Leaderboard, Dua Wall, and
        // Partner circle — whichever surface you name yourself on first flows
        // to the others. Skipped if they replied anonymously (blank name).
        if (name.trim()) CommunityProfileStore.set(name).catch(() => {});
        setText('');
        // The just-used free reply is spent; next post attempt hits the gate.
        if (!hasUnlimitedReplies) {
            const left = await Comments.freeRepliesLeftToday();
            if (mountedRef.current) setGateCleared(left > 0);
        }
        import('../utils/analytics').then(m => m.track('comment_posted', {
            parent_type: parentType,
            has_name: name.trim().length > 0,
        })).catch(() => {});
    };

    // Parent author hearts a reply. Optimistic-free: the onSnapshot listener
    // reflects the write within a beat; the in-flight guard stops double-taps.
    const handleAuthorLike = async (c: Comment) => {
        if (!viewerIsParentAuthor || likeInFlightRef.current.has(c.id)) return;
        haptic.light();
        likeInFlightRef.current.add(c.id);
        try {
            await Comments.setAuthorLiked(c.id, !c.authorLiked);
        } finally {
            likeInFlightRef.current.delete(c.id);
        }
    };

    // Anyone (except the reply's own writer) can like a reply. Optimistic
    // local toggle — the onSnapshot listener reflects the real likeCount
    // within a beat regardless, and the in-flight guard stops double-taps.
    const handleLike = async (c: Comment) => {
        if (c.isMine || likeToggleInFlightRef.current.has(c.id)) return;
        haptic.light();
        likeToggleInFlightRef.current.add(c.id);
        const alreadyLiked = likedLocally.has(c.id);
        setLikedLocally(prev => {
            const next = new Set(prev);
            if (alreadyLiked) next.delete(c.id); else next.add(c.id);
            return next;
        });
        try {
            const ok = alreadyLiked ? await Comments.unlike(c.id) : await Comments.like(c.id);
            if (!ok && mountedRef.current) {
                // Revert the optimistic toggle on failure.
                setLikedLocally(prev => {
                    const next = new Set(prev);
                    if (alreadyLiked) next.add(c.id); else next.delete(c.id);
                    return next;
                });
            }
        } finally {
            likeToggleInFlightRef.current.delete(c.id);
        }
    };

    // Toggle a reply between its original text and a cached/fetched
    // translation into the app's current display language. Uses the comment
    // already carries (c.translations, from the live subscribe() listener)
    // before ever calling the network — see Translate.translate.
    const handleToggleTranslate = async (c: Comment) => {
        haptic.light();
        if (showingTranslationIds.has(c.id)) {
            setShowingTranslationIds(prev => { const next = new Set(prev); next.delete(c.id); return next; });
            return;
        }
        if (commentTranslations[c.id]) {
            setShowingTranslationIds(prev => new Set(prev).add(c.id));
            return;
        }
        if (translatingIds.has(c.id)) return;
        setTranslatingIds(prev => new Set(prev).add(c.id));
        const res = await Translate.translate(c.text, c.id, 'comment', c.translations);
        if (!mountedRef.current) return;
        setTranslatingIds(prev => { const next = new Set(prev); next.delete(c.id); return next; });
        if (res.ok) {
            setCommentTranslations(prev => ({ ...prev, [c.id]: res.text }));
            setShowingTranslationIds(prev => new Set(prev).add(c.id));
        } else {
            Alert.alert(t('translate.failedTitle'), t('translate.failedBody'));
        }
    };

    const handleCommentActions = (commentId: string) => {
        const target = comments.find(c => c.id === commentId);
        // Blocking/hiding/reporting your OWN reply makes no sense — swap in
        // a plain delete confirmation instead of the moderation menu below.
        if (target?.isMine) {
            Alert.alert(
                t('comments.deleteConfirmTitle'),
                t('comments.deleteConfirmBody'),
                [
                    { text: t('btn.cancel'), style: 'cancel' },
                    {
                        text: t('btn.delete'),
                        style: 'destructive',
                        onPress: async () => {
                            haptic.light();
                            // No manual removal from `comments` needed on success —
                            // the live subscribe() listener above will drop it.
                            const ok = await Comments.deleteMine(commentId);
                            if (ok) haptic.success();
                            else Alert.alert(t('comments.deleteFailedTitle'), t('comments.deleteFailedBody'));
                        },
                    },
                ],
            );
            return;
        }
        Alert.alert(
            t('comments.actionsTitle'),
            undefined,
            [
                { text: t('btn.cancel'), style: 'cancel' },
                {
                    // Blocks the PERSON, not just this reply — App Store
                    // Review 1.2 requires this for user-generated content.
                    text: t('moderation.blockUser'),
                    style: 'destructive',
                    onPress: async () => {
                        const author = comments.find(c => c.id === commentId)?.authorId;
                        if (!author) return;
                        await blockAuthor(author);
                        haptic.success();
                        Alert.alert(t('moderation.blockedTitle'), t('moderation.blockedBody'));
                    },
                },
                {
                    // Hides just this one reply, for people who want the
                    // lighter option rather than blocking the author outright.
                    text: t('comments.hideForMe'),
                    onPress: async () => {
                        await Comments.hideLocally(commentId);
                        if (!mountedRef.current) return;
                        setLocallyHidden(prev => new Set(prev).add(commentId));
                        haptic.light();
                    },
                },
                {
                    text: t('comments.report'),
                    style: 'destructive',
                    onPress: () => Alert.alert(
                        t('comments.reportTitle'),
                        t('comments.reportBody'),
                        [
                            { text: t('btn.cancel'), style: 'cancel' },
                            {
                                text: t('comments.report'),
                                style: 'destructive',
                                onPress: async () => {
                                    await Comments.report(commentId);
                                    haptic.success();
                                    Alert.alert('Reported', 'JazakAllah Khair.');
                                },
                            },
                        ],
                    ),
                },
            ],
        );
    };

    return (
        <View style={styles.wrap}>
            {/* Toggle row — chevron makes the open/close affordance explicit */}
            <TouchableOpacity
                onPress={handleExpand}
                style={styles.toggleRow}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={expanded ? t('comments.hideReplies') : countLabel}
                accessibilityState={{ expanded }}
            >
                <MessageCircle size={13} color={expanded ? accent : '#94a3b8'} strokeWidth={2} />
                <Text style={[styles.toggleText, { color: expanded ? accent : '#94a3b8' }]}>
                    {expanded ? t('comments.hideReplies') : countLabel}
                </Text>
                {expanded
                    ? <ChevronUp size={13} color={accent} strokeWidth={2.5} />
                    : <ChevronDown size={13} color="#94a3b8" strokeWidth={2.5} />}
            </TouchableOpacity>

            {expanded && (
                <View style={styles.thread}>
                    {loading && visibleComments.length === 0 ? (
                        <View style={styles.loadingRow}>
                            <ActivityIndicator size="small" color={accent} />
                        </View>
                    ) : visibleComments.length === 0 ? (
                        <Text style={[styles.emptyText, { color: colors.secondaryText }]}>
                            {emptyStateText ?? t('comments.empty')}
                        </Text>
                    ) : (
                        visibleComments.map(c => (
                            <View key={c.id} style={styles.commentRow}>
                                <View style={styles.commentHeader}>
                                    <Text style={[styles.commentName, { color: accent }]}>
                                        {c.country ? `${flagEmoji(c.country)} ` : ''}{c.displayName}
                                    </Text>
                                    {/* Quiet supporter mark — premium at post time */}
                                    {c.authorPremium && (
                                        <Crown
                                            size={10}
                                            color="#fbbf24"
                                            fill="#fbbf24"
                                            strokeWidth={2}
                                            accessibilityLabel="Premium supporter"
                                        />
                                    )}
                                    {c.isAuthor && (
                                        <View style={[styles.authorBadge, { borderColor: accent + '55', backgroundColor: accent + '15' }]}>
                                            <Text style={[styles.authorBadgeText, { color: accent }]}>
                                                {t('comments.authorBadge')}
                                            </Text>
                                        </View>
                                    )}
                                    <Text style={styles.commentTime}>
                                        {formatDistanceToNowStrict(c.createdAt)} ago
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => handleCommentActions(c.id)}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        accessibilityLabel={c.isMine ? 'Delete this reply' : 'Reply options: hide or report'}
                                        accessibilityRole="button"
                                        style={styles.commentFlag}
                                    >
                                        {c.isMine
                                            ? <Trash2 size={11} color="#475569" />
                                            : <Flag size={11} color="#475569" />}
                                    </TouchableOpacity>
                                </View>
                                <Text style={styles.commentText} selectable>
                                    {showingTranslationIds.has(c.id) ? commentTranslations[c.id] : c.text}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => handleToggleTranslate(c)}
                                    disabled={translatingIds.has(c.id)}
                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                    accessibilityRole="button"
                                    style={styles.translateLink}
                                >
                                    <Text style={[styles.translateLinkText, { color: accent }]}>
                                        {translatingIds.has(c.id)
                                            ? t('translate.translating')
                                            : showingTranslationIds.has(c.id)
                                                ? t('translate.seeOriginal')
                                                : t('translate.button')}
                                    </Text>
                                </TouchableOpacity>
                                <View style={styles.actionsRow}>
                                    {/* General like — anyone but the reply's own
                                        writer. Separate from the author-only
                                        "appreciated" heart below: this one has a
                                        count and works for every reader. */}
                                    {!c.isMine && (
                                        <TouchableOpacity
                                            onPress={() => handleLike(c)}
                                            style={styles.likeRow}
                                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                            accessibilityRole="button"
                                            accessibilityLabel={likedLocally.has(c.id) ? 'Remove your like' : 'Like this reply'}
                                            accessibilityState={{ selected: likedLocally.has(c.id) }}
                                        >
                                            <Heart
                                                size={12}
                                                color={likedLocally.has(c.id) ? '#ef4444' : '#64748b'}
                                                fill={likedLocally.has(c.id) ? '#ef4444' : 'transparent'}
                                                strokeWidth={2}
                                            />
                                            {c.likeCount > 0 && (
                                                <Text style={[styles.likeText, { color: likedLocally.has(c.id) ? '#ef4444' : '#64748b' }]}>
                                                    {c.likeCount}
                                                </Text>
                                            )}
                                        </TouchableOpacity>
                                    )}
                                    {/* Author heart: toggle for the parent's author (on
                                        others' replies); read-only glow for everyone else
                                        once liked. */}
                                    {(viewerIsParentAuthor && !c.isAuthor) ? (
                                        <TouchableOpacity
                                            onPress={() => handleAuthorLike(c)}
                                            style={styles.likeRow}
                                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                            accessibilityRole="button"
                                            accessibilityLabel={c.authorLiked ? 'Remove your heart' : 'Heart this reply'}
                                            accessibilityState={{ selected: !!c.authorLiked }}
                                        >
                                            <Heart
                                                size={12}
                                                color={c.authorLiked ? '#fbbf24' : '#64748b'}
                                                fill={c.authorLiked ? '#fbbf24' : 'transparent'}
                                                strokeWidth={2}
                                            />
                                            <Text style={[styles.likeText, { color: c.authorLiked ? '#fbbf24' : '#64748b' }]}>
                                                {c.authorLiked ? t('comments.appreciated') : t('comments.appreciate')}
                                            </Text>
                                        </TouchableOpacity>
                                    ) : c.authorLiked ? (
                                        <View style={styles.likeRow} accessibilityLabel="The author appreciated this reply">
                                            <Heart size={12} color="#fbbf24" fill="#fbbf24" strokeWidth={2} />
                                            <Text style={[styles.likeText, { color: '#fbbf24' }]}>
                                                {t('comments.byAuthor')}
                                            </Text>
                                        </View>
                                    ) : null}
                                </View>
                            </View>
                        ))
                    )}

                    {/* Composer */}
                    <View style={[styles.composer, { borderColor: accent + '22' }]}>
                        {profileName && !editingName ? (
                            <View style={styles.namePrefilledRow}>
                                <Text style={[styles.namePrefilledText, { color: colors.secondaryText }]} numberOfLines={1}>
                                    {t('comments.replyingAs', {
                                        name: profileCountry
                                            ? `${flagEmoji(profileCountry)} ${name || profileName}`
                                            : (name || profileName),
                                    })}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => setEditingName(true)}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    accessibilityRole="button"
                                >
                                    <Text style={[styles.nameChangeLink, { color: accent }]}>{t('comments.notYou')}</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TextInput
                                value={name}
                                onChangeText={setName}
                                placeholder={t('comments.namePlaceholder')}
                                placeholderTextColor="#3d4f68"
                                style={[styles.nameInput, { color: colors.primaryText }]}
                                maxLength={Comments.MAX_NAME_LENGTH}
                                autoFocus={editingName}
                            />
                        )}
                        <View style={styles.composeRow}>
                            <TextInput
                                value={text}
                                onChangeText={setText}
                                placeholder={!hasUnlimitedReplies && !gateCleared
                                    ? t('comments.limitPlaceholder')
                                    : (placeholderText ?? t('comments.placeholder'))}
                                placeholderTextColor="#3d4f68"
                                style={[styles.textInput, { color: colors.primaryText }]}
                                maxLength={Comments.MAX_LENGTH}
                                multiline
                            />
                            <TouchableOpacity
                                onPress={handlePost}
                                // Gate-blocked: stays tappable (even empty) so the
                                // tap routes to the paywall instead of dead-ending.
                                disabled={posting || (text.trim().length === 0 && !gateBlocked)}
                                style={[
                                    styles.sendBtn,
                                    { backgroundColor: (text.trim().length > 0 || gateBlocked) ? accent : 'rgba(255,255,255,0.08)' },
                                ]}
                                accessibilityLabel={gateBlocked ? t('comments.limitHint') : t('comments.post')}
                                accessibilityRole="button"
                            >
                                {posting
                                    ? <ActivityIndicator size="small" color="#0a1228" />
                                    : <Send size={14} color={(text.trim().length > 0 || gateBlocked) ? '#0a1228' : '#475569'} strokeWidth={2.5} />}
                            </TouchableOpacity>
                        </View>
                        {!hasUnlimitedReplies && gateCleared && (
                            <Text style={[styles.freeHint, { color: colors.secondaryText }]}>
                                {t('comments.freeLeft')}
                            </Text>
                        )}
                        {!hasUnlimitedReplies && !gateCleared && (
                            <TouchableOpacity
                                onPress={() => {
                                    haptic.light();
                                    import('../utils/analytics').then(m => m.track('comment_paywall_shown', {
                                        parent_type: parentType,
                                    })).catch(() => {});
                                    if (onRequestPaywall) onRequestPaywall();
                                    else openPaywall('comment_free_limit', 'dua_replies');
                                }}
                                accessibilityRole="button"
                                accessibilityLabel={t('comments.limitHint')}
                            >
                                <Text style={[styles.freeHint, { color: accent }]}>
                                    {t('comments.limitHint')}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { marginTop: 2 },
    toggleRow: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingVertical: 6,
    },
    toggleText: { fontSize: 12, fontWeight: '700' },

    thread: { marginTop: 4, gap: 10 },
    loadingRow: { paddingVertical: 10, alignItems: 'center' },
    emptyText: { fontSize: 12, fontStyle: 'italic', paddingVertical: 4 },

    commentRow: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 12,
        paddingHorizontal: 12, paddingVertical: 10,
    },
    commentHeader: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        marginBottom: 4,
    },
    commentName: { fontSize: 11, fontWeight: '800' },
    authorBadge: {
        paddingHorizontal: 5, paddingVertical: 1,
        borderRadius: 6, borderWidth: 1,
    },
    authorBadgeText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
    commentTime: { fontSize: 10, color: '#475569', fontWeight: '600', flex: 1 },
    commentFlag: { padding: 2 },
    commentText: { color: '#cbd5e1', fontSize: 13, lineHeight: 19 },
    translateLink: { alignSelf: 'flex-start', marginTop: 4 },
    translateLinkText: { fontSize: 10, fontWeight: '700' },
    actionsRow: {
        flexDirection: 'row', alignItems: 'center', gap: 14,
        marginTop: 6,
    },
    likeRow: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
    },
    likeText: { fontSize: 10, fontWeight: '700' },

    composer: {
        borderWidth: 1, borderRadius: 14,
        backgroundColor: 'rgba(10,14,40,0.45)',
        paddingHorizontal: 10, paddingTop: 6, paddingBottom: 8,
    },
    nameInput: {
        fontSize: 12, paddingVertical: 6, paddingHorizontal: 4,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    namePrefilledRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: 6, paddingHorizontal: 4,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    namePrefilledText: { fontSize: 12, flex: 1, flexShrink: 1 },
    nameChangeLink: { fontSize: 11, fontWeight: '600' },
    composeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
    textInput: {
        flex: 1, fontSize: 13, lineHeight: 19,
        paddingVertical: 8, paddingHorizontal: 4,
        maxHeight: 90,
    },
    sendBtn: {
        width: 32, height: 32, borderRadius: 16,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 4,
    },
    freeHint: { fontSize: 10, fontWeight: '600', marginTop: 4, marginLeft: 4 },
});
