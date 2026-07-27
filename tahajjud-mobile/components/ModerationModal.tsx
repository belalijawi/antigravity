import React, { useEffect, useRef, useState } from 'react';
import {
    Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
    ActivityIndicator, Alert, DeviceEventEmitter,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
    X, Eye, EyeOff, Trash2, RefreshCw, AlertTriangle, Flag, Star, Check, Megaphone,
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { DuaWall, PublicDua } from '../utils/duaWall';
import { TestimonySubmission, PendingTestimony, LiveTestimony } from '../utils/testimonySubmission';
import { Leaderboard, LeaderboardAdminEntry } from '../utils/leaderboard';
import { Announcements, Announcement } from '../utils/announcements';
import { isCurrentUserAdmin } from '../utils/admins';
import { flagEmoji } from '../utils/countries';
import { haptic } from '../utils/haptic';
import { formatDistanceToNowStrict, format } from 'date-fns';
import { TopPicksService } from '../utils/topPicks';

interface Props { visible: boolean; onClose: () => void; }

type Section = 'duas' | 'stories' | 'leaderboard' | 'announcement';
type StoriesView = 'pending' | 'live';

/**
 * One combined moderation panel — Duas, Tahajjud Stories, and Leaderboard
 * used to be three separate Settings entries and two separate modals. Same
 * admin, same review workflow either way, so one screen with tabs instead
 * of hunting for the right entry point each time.
 */
export function ModerationModal({ visible, onClose }: Props) {
    const { colors } = useTheme();
    const isAdmin = isCurrentUserAdmin();
    const [section, setSection] = useState<Section>('duas');

    // ── Duas ──
    const [duas, setDuas] = useState<PublicDua[]>([]);
    const [duasLoading, setDuasLoading] = useState(true);
    const [duaWorking, setDuaWorking] = useState<string | null>(null);
    const [topDuaId, setTopDuaId] = useState<string | null>(null);
    const [settingTopDua, setSettingTopDua] = useState(false);

    // Request tokens — now that each loader can fire on every tab switch (not
    // just once on mount), two calls to the SAME loader can be in flight at
    // once (switch away and quickly back). Without this, a slower earlier
    // response landing after a newer one would silently overwrite fresh data
    // with stale data. Bump the token before each fetch; only commit if it's
    // still the latest when the response arrives.
    const duasReqRef = useRef(0);
    const storiesReqRef = useRef(0);
    const leaderboardReqRef = useRef(0);
    const announcementReqRef = useRef(0);

    const loadDuas = async () => {
        const reqId = ++duasReqRef.current;
        setDuasLoading(true);
        const [list, picks] = await Promise.all([DuaWall.adminListAll(200), TopPicksService.get()]);
        if (reqId !== duasReqRef.current) return;
        setDuas(list);
        setTopDuaId(picks.topDuaId);
        setDuasLoading(false);
    };

    // ── Stories ──
    const [storiesView, setStoriesView] = useState<StoriesView>('pending');
    const [pending, setPending] = useState<PendingTestimony[]>([]);
    const [live, setLive] = useState<LiveTestimony[]>([]);
    const [storiesLoading, setStoriesLoading] = useState(true);
    const [storyWorking, setStoryWorking] = useState<string | null>(null);
    const [topStoryId, setTopStoryId] = useState<string | null>(null);
    const [settingTopStory, setSettingTopStory] = useState(false);

    const loadStories = async () => {
        const reqId = ++storiesReqRef.current;
        setStoriesLoading(true);
        const [pendingList, liveList, picks] = await Promise.all([
            TestimonySubmission.listPending(),
            TestimonySubmission.listLive(),
            TopPicksService.get(),
        ]);
        if (reqId !== storiesReqRef.current) return;
        setPending(pendingList);
        setLive(liveList);
        setTopStoryId(picks.topStoryId);
        setStoriesLoading(false);
    };

    // ── Leaderboard ──
    const [entries, setEntries] = useState<LeaderboardAdminEntry[]>([]);
    const [entriesLoading, setEntriesLoading] = useState(true);
    const [entryWorking, setEntryWorking] = useState<string | null>(null);

    const loadLeaderboard = async () => {
        const reqId = ++leaderboardReqRef.current;
        setEntriesLoading(true);
        const list = await Leaderboard.adminListAll();
        if (reqId !== leaderboardReqRef.current) return;
        setEntries(list);
        setEntriesLoading(false);
    };

    // ── Announcement ──
    const [currentAnnouncement, setCurrentAnnouncement] = useState<Announcement | null>(null);
    const [announcementLoading, setAnnouncementLoading] = useState(true);
    const [announcementTitle, setAnnouncementTitle] = useState('');
    const [announcementBody, setAnnouncementBody] = useState('');
    const [publishing, setPublishing] = useState(false);
    const [deactivating, setDeactivating] = useState(false);

    const loadAnnouncement = async () => {
        const reqId = ++announcementReqRef.current;
        setAnnouncementLoading(true);
        const current = await Announcements.get();
        if (reqId !== announcementReqRef.current) return;
        setCurrentAnnouncement(current);
        setAnnouncementLoading(false);
    };

    // Which sections have already been loaded THIS time the modal is open —
    // each section fetches once on first visit, not on every switch back to
    // an already-loaded tab (that would trade "slow to open" for "flashes a
    // spinner and re-downloads on every tab switch," which isn't actually
    // better). Cleared below whenever the modal opens fresh, and the refresh
    // button still forces a reload of whichever tab you're looking at.
    const loadedSectionsRef = useRef<Set<Section>>(new Set());
    useEffect(() => {
        if (visible) loadedSectionsRef.current = new Set();
    }, [visible]);

    // Only fetch the tab actually being looked at, not all four at once.
    // Duas (200 full docs) and the leaderboard (up to 500) are genuinely
    // sizeable reads — firing every tab's fetch simultaneously on open meant
    // the default "duas" view's own load was competing for the JS thread
    // with three other tabs' worth of parsing the admin wasn't even looking
    // at yet, which is what made the panel feel slow to appear. Matches
    // refresh()'s existing per-tab-only behavior below — this was really the
    // one place still fetching everything eagerly.
    useEffect(() => {
        if (!visible || !isAdmin || loadedSectionsRef.current.has(section)) return;
        loadedSectionsRef.current.add(section);
        if (section === 'duas') loadDuas();
        else if (section === 'stories') loadStories();
        else if (section === 'leaderboard') loadLeaderboard();
        else loadAnnouncement();
    }, [visible, isAdmin, section]);

    const handlePublishAnnouncement = async () => {
        if (publishing || announcementTitle.trim().length === 0) return;
        setPublishing(true);
        const published = await Announcements.publish(announcementTitle, announcementBody);
        setPublishing(false);
        if (published) {
            haptic.success();
            setAnnouncementTitle('');
            setAnnouncementBody('');
            loadAnnouncement();
            // Show it in THIS session too, including for the admin who just
            // published it — HomeTab's own fetch-on-mount effect wouldn't
            // otherwise re-fire until the app is relaunched.
            DeviceEventEmitter.emit('announcementPublished', published);
        } else {
            Alert.alert('Publish failed', 'Check your admin permissions and try again.');
        }
    };

    const handleDeactivateAnnouncement = async () => {
        if (deactivating) return;
        setDeactivating(true);
        const ok = await Announcements.deactivate();
        setDeactivating(false);
        if (ok) {
            haptic.light();
            setCurrentAnnouncement(prev => prev ? { ...prev, active: false } : prev);
        }
    };

    // Defense in depth: refuse to render for non-admins regardless of how
    // this modal was mounted. Real security is server-side in firestore.rules.
    if (!isAdmin) return null;

    const refresh = () => {
        haptic.light();
        if (section === 'duas') loadDuas();
        else if (section === 'stories') loadStories();
        else if (section === 'leaderboard') loadLeaderboard();
        else loadAnnouncement();
    };

    // ── Dua handlers ──
    const handleToggleTopDua = async (item: PublicDua) => {
        if (settingTopDua) return;
        setSettingTopDua(true);
        const isCurrentlyTop = topDuaId === item.id;
        const ok = await TopPicksService.setTopDua(isCurrentlyTop ? null : item.id);
        setSettingTopDua(false);
        if (ok) {
            haptic.success();
            setTopDuaId(isCurrentlyTop ? null : item.id);
            if (!isCurrentlyTop) {
                const authorId = await DuaWall.adminGetAuthorId(item.id);
                if (authorId) {
                    const { sendMilestonePush } = await import('../utils/communityNotify');
                    sendMilestonePush(
                        authorId,
                        '🌟 Your dua was chosen',
                        'Your dua has been picked as today\'s Top Dua — it\'s now pinned for everyone on the Dua Wall.',
                        'top_dua',
                    ).catch(() => {});
                }
            }
        } else {
            Alert.alert('Action failed', 'Check your admin permissions and try again.');
        }
    };

    const handleHideDua = async (item: PublicDua) => {
        setDuaWorking(item.id);
        const ok = await DuaWall.adminSetHidden(item.id, true);
        setDuaWorking(null);
        if (ok) { haptic.light(); setDuas(prev => prev.map(d => d.id === item.id ? { ...d, hidden: true } : d)); }
    };

    const handleUnhideDua = async (item: PublicDua) => {
        setDuaWorking(item.id);
        const ok = await DuaWall.adminSetHidden(item.id, false);
        setDuaWorking(null);
        if (ok) { haptic.light(); setDuas(prev => prev.map(d => d.id === item.id ? { ...d, hidden: false } : d)); }
    };

    const handleDeleteDua = (item: PublicDua) => {
        Alert.alert('Delete this dua?', 'This permanently removes the post. It cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    setDuaWorking(item.id);
                    const ok = await DuaWall.adminDelete(item.id);
                    setDuaWorking(null);
                    if (ok) {
                        haptic.success();
                        setDuas(prev => prev.filter(d => d.id !== item.id));
                        if (topDuaId === item.id) { TopPicksService.setTopDua(null).catch(() => {}); setTopDuaId(null); }
                    }
                },
            },
        ]);
    };

    // ── Story handlers ──
    const handleToggleTopStory = async (item: LiveTestimony) => {
        if (settingTopStory) return;
        setSettingTopStory(true);
        const isCurrentlyTop = topStoryId === item.id;
        const ok = await TopPicksService.setTopStory(isCurrentlyTop ? null : item.id);
        setSettingTopStory(false);
        if (ok) {
            haptic.success();
            setTopStoryId(isCurrentlyTop ? null : item.id);
            if (!isCurrentlyTop) {
                const authorId = await TestimonySubmission.adminGetAuthorId(item.id);
                if (authorId) {
                    const { sendMilestonePush } = await import('../utils/communityNotify');
                    sendMilestonePush(
                        authorId,
                        '🌟 Your story was chosen',
                        'Your story has been picked as today\'s Top Story — it\'s now pinned for everyone to see.',
                        'top_story',
                    ).catch(() => {});
                }
            }
        } else {
            Alert.alert('Action failed', 'Check your admin permissions and try again.');
        }
    };

    const handleApproveStory = async (item: PendingTestimony) => {
        setStoryWorking(item.id);
        const ok = await TestimonySubmission.approve(item);
        setStoryWorking(null);
        if (ok) { haptic.success(); setPending(prev => prev.filter(p => p.id !== item.id)); }
        else Alert.alert('Approval failed', 'Check your Firestore rules and try again.');
    };

    const handleRejectStory = (item: PendingTestimony) => {
        Alert.alert('Reject submission?', 'This will delete the submission permanently.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Reject', style: 'destructive', onPress: async () => {
                    setStoryWorking(item.id);
                    const ok = await TestimonySubmission.reject(item.id);
                    setStoryWorking(null);
                    if (ok) { haptic.light(); setPending(prev => prev.filter(p => p.id !== item.id)); }
                },
            },
        ]);
    };

    const handleDeleteLiveStory = (item: LiveTestimony) => {
        Alert.alert('Delete this story?', 'This permanently removes the story. It cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    setStoryWorking(item.id);
                    const ok = await TestimonySubmission.deleteLive(item.id);
                    setStoryWorking(null);
                    if (ok) {
                        haptic.success();
                        setLive(prev => prev.filter(l => l.id !== item.id));
                        if (topStoryId === item.id) { TopPicksService.setTopStory(null).catch(() => {}); setTopStoryId(null); }
                    } else {
                        Alert.alert('Delete failed', 'Check your admin permissions and try again.');
                    }
                },
            },
        ]);
    };

    // ── Leaderboard handlers ──
    const handleHideEntry = async (item: LeaderboardAdminEntry) => {
        setEntryWorking(item.uid);
        const ok = await Leaderboard.adminSetHidden(item.uid, true);
        setEntryWorking(null);
        if (ok) { haptic.light(); setEntries(prev => prev.map(e => e.uid === item.uid ? { ...e, hidden: true } : e)); }
    };

    const handleUnhideEntry = async (item: LeaderboardAdminEntry) => {
        setEntryWorking(item.uid);
        const ok = await Leaderboard.adminSetHidden(item.uid, false);
        setEntryWorking(null);
        if (ok) { haptic.light(); setEntries(prev => prev.map(e => e.uid === item.uid ? { ...e, hidden: false } : e)); }
    };

    const handleDeleteEntry = (item: LeaderboardAdminEntry) => {
        Alert.alert('Remove this entry?', 'This deletes their leaderboard entry (opts them out). Their synced counts are lost. It cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    setEntryWorking(item.uid);
                    const ok = await Leaderboard.adminDelete(item.uid);
                    setEntryWorking(null);
                    if (ok) { haptic.success(); setEntries(prev => prev.filter(e => e.uid !== item.uid)); }
                },
            },
        ]);
    };

    const duasFlagged = duas.filter(d => d.reportCount > 0).length;
    const duasHidden = duas.filter(d => d.hidden).length;
    const entriesFlagged = entries.filter(e => e.reportCount > 0).length;
    const entriesHidden = entries.filter(e => e.hidden).length;

    const headerSubtitle = section === 'duas'
        ? `${duas.length} total · ${duasFlagged} flagged · ${duasHidden} hidden`
        : section === 'leaderboard'
            ? `${entries.length} total · ${entriesFlagged} flagged · ${entriesHidden} hidden`
            : section === 'announcement'
                ? (currentAnnouncement?.active ? 'Announcement live' : 'No active announcement')
                : storiesView === 'pending'
                    ? `${pending.length} pending`
                    : `${live.length} live`;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <LinearGradient colors={['#06091e', '#040714']} style={styles.root}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                        <X size={20} color={colors.secondaryText} />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Text style={[styles.title, { color: colors.primaryText }]}>Moderation</Text>
                        <Text style={[styles.subtitle, { color: colors.secondaryText }]}>{headerSubtitle}</Text>
                    </View>
                    <TouchableOpacity onPress={refresh} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                        <RefreshCw size={18} color={colors.accent} />
                    </TouchableOpacity>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabRow} contentContainerStyle={styles.tabRowContent}>
                    {(['duas', 'stories', 'leaderboard', 'announcement'] as Section[]).map(s => (
                        <TouchableOpacity
                            key={s}
                            onPress={() => { haptic.light(); setSection(s); }}
                            style={[styles.tabPill, section === s && { backgroundColor: colors.accent + '22', borderColor: colors.accent + '66' }]}
                        >
                            <Text
                                style={[styles.tabText, { color: section === s ? colors.accent : colors.secondaryText }]}
                                maxFontSizeMultiplier={1.3}
                            >
                                {s === 'duas' ? 'Duas' : s === 'stories' ? 'Stories' : s === 'leaderboard' ? 'Leaderboard' : 'Announcement'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {section === 'stories' && (
                    <View style={styles.subTabRow}>
                        <TouchableOpacity
                            onPress={() => setStoriesView('pending')}
                            style={[styles.subTabPill, storiesView === 'pending' && { borderColor: colors.accent + '66' }]}
                        >
                            <Text style={[styles.subTabText, { color: storiesView === 'pending' ? colors.accent : colors.secondaryText }]}>
                                Pending{pending.length > 0 ? ` (${pending.length})` : ''}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setStoriesView('live')}
                            style={[styles.subTabPill, storiesView === 'live' && { borderColor: colors.accent + '66' }]}
                        >
                            <Text style={[styles.subTabText, { color: storiesView === 'live' ? colors.accent : colors.secondaryText }]}>
                                Live · Set Top
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* ══ Duas ══ */}
                {section === 'duas' && (
                    duasLoading ? (
                        <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
                    ) : duas.length === 0 ? (
                        <View style={styles.center}>
                            <Text style={styles.emptyEmoji}>🌙</Text>
                            <Text style={[styles.emptyTitle, { color: colors.primaryText }]}>No duas to moderate</Text>
                            <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>All clear. New posts will appear here as they arrive.</Text>
                        </View>
                    ) : (
                        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
                            {duas.map(item => (
                                <View
                                    key={item.id}
                                    style={[styles.card, {
                                        borderColor: topDuaId === item.id ? '#facc15aa' : item.reportCount > 0 ? '#ef444466' : item.hidden ? '#94a3b833' : 'rgba(255,255,255,0.07)',
                                        opacity: item.hidden ? 0.6 : 1,
                                    }]}
                                >
                                    <View style={styles.statusRow}>
                                        {topDuaId === item.id && (
                                            <View style={[styles.badge, { backgroundColor: '#facc1522', borderColor: '#facc1566' }]}>
                                                <Star size={10} color="#facc15" fill="#facc15" />
                                                <Text style={[styles.badgeText, { color: '#facc15' }]}>Top Dua Today</Text>
                                            </View>
                                        )}
                                        {item.reportCount > 0 && (
                                            <View style={[styles.badge, { backgroundColor: '#ef444422', borderColor: '#ef444466' }]}>
                                                <Flag size={10} color="#ef4444" />
                                                <Text style={[styles.badgeText, { color: '#ef4444' }]}>{item.reportCount} {item.reportCount === 1 ? 'report' : 'reports'}</Text>
                                            </View>
                                        )}
                                        {item.hidden && (
                                            <View style={[styles.badge, { backgroundColor: '#94a3b822', borderColor: '#94a3b855' }]}>
                                                <EyeOff size={10} color="#94a3b8" />
                                                <Text style={[styles.badgeText, { color: '#94a3b8' }]}>Hidden</Text>
                                            </View>
                                        )}
                                        {item.ameenCount > 0 && (
                                            <View style={[styles.badge, { backgroundColor: colors.accent + '22', borderColor: colors.accent + '44' }]}>
                                                <Text style={[styles.badgeText, { color: colors.accent }]}>{item.ameenCount} {item.ameenCount === 1 ? 'Ameen' : 'Ameens'}</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={[styles.duaText, { color: colors.primaryText }]}>{item.text}</Text>
                                    <Text style={[styles.timestamp, { color: colors.secondaryText }]}>{formatDistanceToNowStrict(item.createdAt)} ago</Text>
                                    <View style={styles.actions}>
                                        <TouchableOpacity
                                            onPress={() => handleToggleTopDua(item)}
                                            disabled={settingTopDua}
                                            style={[styles.btn, topDuaId === item.id ? { borderColor: '#facc15aa', backgroundColor: '#facc1522' } : { borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.04)' }]}
                                        >
                                            <Star size={14} color="#facc15" fill={topDuaId === item.id ? '#facc15' : 'none'} />
                                            <Text style={[styles.btnText, { color: '#facc15' }]}>{topDuaId === item.id ? 'Unset Top' : 'Set as Top'}</Text>
                                        </TouchableOpacity>
                                        {item.hidden ? (
                                            <TouchableOpacity onPress={() => handleUnhideDua(item)} disabled={duaWorking === item.id} style={[styles.btn, { borderColor: colors.accent + '55', backgroundColor: colors.accent + '14' }]}>
                                                <Eye size={14} color={colors.accent} />
                                                <Text style={[styles.btnText, { color: colors.accent }]}>Unhide</Text>
                                            </TouchableOpacity>
                                        ) : (
                                            <TouchableOpacity onPress={() => handleHideDua(item)} disabled={duaWorking === item.id} style={[styles.btn, { borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.04)' }]}>
                                                <EyeOff size={14} color="#cbd5e1" />
                                                <Text style={[styles.btnText, { color: '#cbd5e1' }]}>Hide</Text>
                                            </TouchableOpacity>
                                        )}
                                        <TouchableOpacity onPress={() => handleDeleteDua(item)} disabled={duaWorking === item.id} style={[styles.btn, { borderColor: '#ef444466', backgroundColor: '#ef444414' }]}>
                                            {duaWorking === item.id ? <ActivityIndicator size="small" color="#ef4444" /> : <><Trash2 size={14} color="#ef4444" /><Text style={[styles.btnText, { color: '#ef4444' }]}>Delete</Text></>}
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                            <View style={[styles.infoBox, { borderColor: colors.accent + '22' }]}>
                                <AlertTriangle size={14} color={colors.accent} />
                                <Text style={[styles.infoText, { color: colors.secondaryText }]}>Duas auto-hide after 5 reports. Sorted with most-reported first.</Text>
                            </View>
                        </ScrollView>
                    )
                )}

                {/* ══ Stories ══ */}
                {section === 'stories' && (
                    storiesLoading ? (
                        <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
                    ) : storiesView === 'live' ? (
                        live.length === 0 ? (
                            <View style={styles.center}>
                                <Text style={styles.emptyEmoji}>📖</Text>
                                <Text style={[styles.emptyTitle, { color: colors.primaryText }]}>No live stories yet</Text>
                                <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>Approved stories will appear here so you can pick a Top Story.</Text>
                            </View>
                        ) : (
                            <ScrollView contentContainerStyle={styles.list}>
                                {live.map(item => (
                                    <View key={item.id} style={[styles.card, { borderColor: topStoryId === item.id ? '#facc15aa' : 'rgba(255,255,255,0.07)' }]}>
                                        {topStoryId === item.id && (
                                            <View style={styles.topBadgeRow}>
                                                <View style={[styles.badge, { backgroundColor: '#facc1522', borderColor: '#facc1566' }]}>
                                                    <Star size={10} color="#facc15" fill="#facc15" />
                                                    <Text style={[styles.badgeText, { color: '#facc15' }]}>Top Story Today</Text>
                                                </View>
                                            </View>
                                        )}
                                        <Text style={[styles.itemTitle, { color: colors.primaryText }]}>{item.title}</Text>
                                        <Text style={[styles.itemMeta, { color: colors.secondaryText }]}>
                                            {item.author}{item.location ? ` · ${item.location}` : ''}{' · '}{item.reactions} {item.reactions === 1 ? 'like' : 'likes'}
                                        </Text>
                                        <View style={styles.tagsRow}>
                                            {item.tags.map(t => (
                                                <View key={t} style={[styles.tag, { borderColor: colors.accent + '44' }]}>
                                                    <Text style={[styles.tagText, { color: colors.accent }]}>{t}</Text>
                                                </View>
                                            ))}
                                        </View>
                                        <Text style={[styles.body, { color: colors.primaryText }]}>{item.body}</Text>
                                        <View style={styles.actions}>
                                            <TouchableOpacity onPress={() => handleDeleteLiveStory(item)} disabled={storyWorking === item.id} style={[styles.btn, { borderColor: 'rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.08)' }]}>
                                                {storyWorking === item.id ? <ActivityIndicator size="small" color="#ef4444" /> : <><Trash2 size={14} color="#ef4444" /><Text style={[styles.btnText, { color: '#ef4444' }]}>Delete</Text></>}
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => handleToggleTopStory(item)}
                                                disabled={settingTopStory}
                                                style={[styles.btn, topStoryId === item.id ? { borderColor: '#facc15aa', backgroundColor: '#facc1522' } : { borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.04)' }]}
                                            >
                                                <Star size={14} color="#facc15" fill={topStoryId === item.id ? '#facc15' : 'none'} />
                                                <Text style={[styles.btnText, { color: '#facc15' }]}>{topStoryId === item.id ? 'Unset Top' : 'Set as Top'}</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}
                            </ScrollView>
                        )
                    ) : pending.length === 0 ? (
                        <View style={styles.center}>
                            <Text style={styles.emptyEmoji}>📭</Text>
                            <Text style={[styles.emptyTitle, { color: colors.primaryText }]}>Queue is empty</Text>
                            <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>New submissions will appear here.</Text>
                        </View>
                    ) : (
                        <ScrollView contentContainerStyle={styles.list}>
                            {pending.map(item => (
                                <View key={item.id} style={[styles.card, { borderColor: 'rgba(255,255,255,0.07)' }]}>
                                    <Text style={[styles.itemTitle, { color: colors.primaryText }]}>{item.title}</Text>
                                    <Text style={[styles.itemMeta, { color: colors.secondaryText }]}>
                                        {item.author}{item.location ? ` · ${item.location}` : ''}{' · '}{format(item.submittedAt, 'MMM d, h:mm a')}
                                    </Text>
                                    <View style={styles.tagsRow}>
                                        {item.tags.map(t => (
                                            <View key={t} style={[styles.tag, { borderColor: colors.accent + '44' }]}>
                                                <Text style={[styles.tagText, { color: colors.accent }]}>{t}</Text>
                                            </View>
                                        ))}
                                    </View>
                                    <Text style={[styles.body, { color: colors.primaryText }]}>{item.body}</Text>
                                    <View style={styles.actions}>
                                        <TouchableOpacity onPress={() => handleRejectStory(item)} disabled={storyWorking === item.id} style={[styles.btn, { borderColor: 'rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.08)' }]}>
                                            <Trash2 size={14} color="#ef4444" />
                                            <Text style={[styles.btnText, { color: '#ef4444' }]}>Reject</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => handleApproveStory(item)} disabled={storyWorking === item.id} style={[styles.btn, { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                                            {storyWorking === item.id ? <ActivityIndicator size="small" color="#0a1228" /> : <><Check size={14} color="#0a1228" strokeWidth={3} /><Text style={[styles.btnText, { color: '#0a1228' }]}>Approve</Text></>}
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                    )
                )}

                {/* ══ Leaderboard ══ */}
                {section === 'leaderboard' && (
                    entriesLoading ? (
                        <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
                    ) : entries.length === 0 ? (
                        <View style={styles.center}>
                            <Text style={styles.emptyEmoji}>🏆</Text>
                            <Text style={[styles.emptyTitle, { color: colors.primaryText }]}>No entries yet</Text>
                            <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>Opted-in members will appear here.</Text>
                        </View>
                    ) : (
                        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
                            {entries.map(item => (
                                <View
                                    key={item.uid}
                                    style={[styles.card, {
                                        borderColor: item.reportCount > 0 ? '#ef444466' : item.hidden ? '#94a3b833' : 'rgba(255,255,255,0.07)',
                                        opacity: item.hidden ? 0.6 : 1,
                                    }]}
                                >
                                    <View style={styles.statusRow}>
                                        {item.reportCount > 0 && (
                                            <View style={[styles.badge, { backgroundColor: '#ef444422', borderColor: '#ef444466' }]}>
                                                <Flag size={10} color="#ef4444" />
                                                <Text style={[styles.badgeText, { color: '#ef4444' }]}>{item.reportCount} {item.reportCount === 1 ? 'report' : 'reports'}</Text>
                                            </View>
                                        )}
                                        {item.hidden && (
                                            <View style={[styles.badge, { backgroundColor: '#94a3b822', borderColor: '#94a3b855' }]}>
                                                <EyeOff size={10} color="#94a3b8" />
                                                <Text style={[styles.badgeText, { color: '#94a3b8' }]}>Hidden</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={[styles.itemTitle, { color: colors.primaryText }]}>
                                        {item.country ? `${flagEmoji(item.country)} ` : ''}{item.nickname}
                                    </Text>
                                    <Text style={[styles.itemMeta, { color: colors.secondaryText }]}>
                                        {item.dhikrAllTime.toLocaleString()} dhikr · {item.quranAllTime.toLocaleString()} ayahs · {item.tahajjudAllTime.toLocaleString()} tahajjud
                                    </Text>
                                    <View style={styles.actions}>
                                        {item.hidden ? (
                                            <TouchableOpacity onPress={() => handleUnhideEntry(item)} disabled={entryWorking === item.uid} style={[styles.btn, { borderColor: colors.accent + '55', backgroundColor: colors.accent + '14' }]}>
                                                <Eye size={14} color={colors.accent} />
                                                <Text style={[styles.btnText, { color: colors.accent }]}>Unhide</Text>
                                            </TouchableOpacity>
                                        ) : (
                                            <TouchableOpacity onPress={() => handleHideEntry(item)} disabled={entryWorking === item.uid} style={[styles.btn, { borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.04)' }]}>
                                                <EyeOff size={14} color="#cbd5e1" />
                                                <Text style={[styles.btnText, { color: '#cbd5e1' }]}>Hide</Text>
                                            </TouchableOpacity>
                                        )}
                                        <TouchableOpacity onPress={() => handleDeleteEntry(item)} disabled={entryWorking === item.uid} style={[styles.btn, { borderColor: '#ef444466', backgroundColor: '#ef444414' }]}>
                                            {entryWorking === item.uid ? <ActivityIndicator size="small" color="#ef4444" /> : <><Trash2 size={14} color="#ef4444" /><Text style={[styles.btnText, { color: '#ef4444' }]}>Delete</Text></>}
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                            <View style={[styles.infoBox, { borderColor: colors.accent + '22' }]}>
                                <AlertTriangle size={14} color={colors.accent} />
                                <Text style={[styles.infoText, { color: colors.secondaryText }]}>Entries auto-hide after 5 reports. Hiding removes them from rankings; deleting also drops their synced counts.</Text>
                            </View>
                        </ScrollView>
                    )
                )}

                {/* ══ Announcement ══ */}
                {section === 'announcement' && (
                    announcementLoading ? (
                        <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
                    ) : (
                        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            {currentAnnouncement && (
                                <View style={[styles.card, { borderColor: currentAnnouncement.active ? colors.accent + '55' : 'rgba(255,255,255,0.07)' }]}>
                                    <View style={styles.statusRow}>
                                        <View style={[styles.badge, currentAnnouncement.active
                                            ? { backgroundColor: colors.accent + '22', borderColor: colors.accent + '44' }
                                            : { backgroundColor: '#94a3b822', borderColor: '#94a3b855' }]}
                                        >
                                            <Megaphone size={10} color={currentAnnouncement.active ? colors.accent : '#94a3b8'} />
                                            <Text style={[styles.badgeText, { color: currentAnnouncement.active ? colors.accent : '#94a3b8' }]}>
                                                {currentAnnouncement.active ? 'Currently live' : 'Inactive'}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={[styles.itemTitle, { color: colors.primaryText }]}>{currentAnnouncement.title}</Text>
                                    {!!currentAnnouncement.body && (
                                        <Text style={[styles.body, { color: colors.primaryText }]}>{currentAnnouncement.body}</Text>
                                    )}
                                    {currentAnnouncement.active && (
                                        <View style={styles.actions}>
                                            <TouchableOpacity onPress={handleDeactivateAnnouncement} disabled={deactivating} style={[styles.btn, { borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.04)' }]}>
                                                {deactivating ? <ActivityIndicator size="small" color="#cbd5e1" /> : <><EyeOff size={14} color="#cbd5e1" /><Text style={[styles.btnText, { color: '#cbd5e1' }]}>Deactivate</Text></>}
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            )}

                            <View style={[styles.card, { borderColor: 'rgba(255,255,255,0.07)' }]}>
                                <Text style={[styles.itemTitle, { color: colors.primaryText, marginBottom: 12 }]}>
                                    {currentAnnouncement?.active ? 'Publish a new one' : 'Publish an announcement'}
                                </Text>
                                <TextInput
                                    value={announcementTitle}
                                    onChangeText={setAnnouncementTitle}
                                    placeholder="Title"
                                    placeholderTextColor="#475569"
                                    style={[styles.announcementInput, { color: colors.primaryText, borderColor: colors.accent + '22' }]}
                                    maxLength={80}
                                />
                                <TextInput
                                    value={announcementBody}
                                    onChangeText={setAnnouncementBody}
                                    placeholder="Message (optional)"
                                    placeholderTextColor="#475569"
                                    style={[styles.announcementInput, styles.announcementTextarea, { color: colors.primaryText, borderColor: colors.accent + '22' }]}
                                    maxLength={500}
                                    multiline
                                    textAlignVertical="top"
                                />
                                <TouchableOpacity
                                    onPress={handlePublishAnnouncement}
                                    disabled={publishing || announcementTitle.trim().length === 0}
                                    style={[styles.publishBtn, { backgroundColor: colors.accent, opacity: announcementTitle.trim().length === 0 ? 0.5 : 1 }]}
                                >
                                    {publishing
                                        ? <ActivityIndicator size="small" color="#0a1228" />
                                        : <><Megaphone size={14} color="#0a1228" /><Text style={styles.publishBtnText}>Publish to everyone</Text></>}
                                </TouchableOpacity>
                            </View>

                            <View style={[styles.infoBox, { borderColor: colors.accent + '22' }]}>
                                <AlertTriangle size={14} color={colors.accent} />
                                <Text style={[styles.infoText, { color: colors.secondaryText }]}>
                                    No app update needed — every user sees this the next time they open the app, whether they've seen a previous announcement or not. Publishing replaces the current one.
                                </Text>
                            </View>
                        </ScrollView>
                    )
                )}
            </LinearGradient>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    headerCenter: { flex: 1, alignItems: 'center' },
    title: { fontSize: 15, fontWeight: '800' },
    subtitle: { fontSize: 11, fontWeight: '600', marginTop: 3 },

    tabRow: {
        paddingTop: 14, paddingBottom: 14,
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    tabRowContent: { flexDirection: 'row', gap: 8, paddingHorizontal: 20 },
    tabPill: {
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
        backgroundColor: 'rgba(255,255,255,0.03)',
        minHeight: 34, justifyContent: 'center',
    },
    tabText: { fontSize: 12, fontWeight: '800', lineHeight: 16 },

    subTabRow: {
        flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12,
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    subTabPill: {
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    },
    subTabText: { fontSize: 11, fontWeight: '700' },

    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
    emptyEmoji: { fontSize: 32, marginBottom: 16 },
    emptyTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
    emptyBody: { fontSize: 13, textAlign: 'center' },

    list: { padding: 16, gap: 12 },
    card: { padding: 16, borderRadius: 14, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.02)' },

    statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
    topBadgeRow: { flexDirection: 'row', marginBottom: 10 },
    badge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1,
    },
    badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

    duaText: { fontSize: 14, lineHeight: 21, marginBottom: 10 },
    timestamp: { fontSize: 11, fontWeight: '600', marginBottom: 14 },

    itemTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
    itemMeta: { fontSize: 11, marginBottom: 10 },
    tagsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 12 },
    tag: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
    tagText: { fontSize: 10, fontWeight: '800' },
    body: { fontSize: 13, lineHeight: 20, marginBottom: 14 },

    actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
    btn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1,
    },
    btnText: { fontSize: 13, fontWeight: '800' },

    infoBox: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 8,
        padding: 12, borderRadius: 12, borderWidth: 1,
        backgroundColor: 'rgba(255,255,255,0.02)',
        marginTop: 4, marginBottom: 40,
    },
    infoText: { flex: 1, fontSize: 11, lineHeight: 17, fontWeight: '500' },

    announcementInput: {
        borderWidth: 1, borderRadius: 12,
        paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
        backgroundColor: 'rgba(255,255,255,0.03)',
        marginBottom: 12,
    },
    announcementTextarea: { minHeight: 100 },
    publishBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        paddingVertical: 12, borderRadius: 12,
    },
    publishBtnText: { color: '#0a1228', fontSize: 14, fontWeight: '800' },
});
