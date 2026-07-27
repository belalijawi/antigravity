import React, { useEffect, useState, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    Modal, KeyboardAvoidingView, Platform, Alert, Share, Clipboard,
    TouchableWithoutFeedback, Keyboard, ScrollView,
} from 'react-native';
import { GlassBg as BlurView } from './GlassBg';
import { Users, Moon, X, Copy, CheckCircle, UserPlus, Lock } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { usePurchases } from '../context/PurchasesContext';
import { AccountabilityPartner, PartnerData, PartnerEntry } from '../utils/accountabilityPartner';
import { haptic } from '../utils/haptic';
import { format } from 'date-fns';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { t } from '../utils/i18n';
import { CommunityProfileStore } from '../utils/communityProfile';
import { KnownNameField } from './KnownNameField';

interface PartnerStatus {
    prayed: boolean;
    prayedAt: string | null;
}

/** Free users get 0 partners — this is a premium-only feature. */
const FREE_PARTNER_LIMIT = 0;
const PREMIUM_PARTNER_LIMIT = 5;

function formatPrayedAt(prayedAt: string | null): string {
    if (!prayedAt) return '';
    try {
        return t('partner.prayedAtPrefix', { time: format(new Date(prayedAt), 'h:mm a') });
    } catch {
        return '';
    }
}

export function AccountabilityPartnerCard() {
    const { colors, cardBg, cardBorder, blurIntensity } = useTheme();
    const { isPremium, openPaywall } = usePurchases();
    const [partnerData, setPartnerData] = useState<PartnerData | null>(null);
    const [partnerStatuses, setPartnerStatuses] = useState<Record<string, PartnerStatus>>({});
    const [showModal, setShowModal] = useState(false);
    const [codeInput, setCodeInput] = useState('');
    const [nameInput, setNameInput] = useState('');
    // Known name from CommunityProfileStore — see KnownNameField. Shows
    // "Known as X · not you?" instead of a blank-looking box once a name is
    // already known from the Dua Wall, a comment, the Leaderboard, or a
    // Testimony — still required here (your partner needs to know who's
    // waking them up), just not asked again from scratch.
    const [nameProfileName, setNameProfileName] = useState<string | null>(null);
    const [editingNameInput, setEditingNameInput] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [copied, setCopied] = useState(false);
    const [wakingPartnerId, setWakingPartnerId] = useState<string | null>(null);

    // Map of partnerUserId → unsubscribe function
    const unsubRefs = useRef<Map<string, () => void>>(new Map());
    const partnershipUnsubRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        init();
        return () => {
            // Clean up all listeners
            unsubRefs.current.forEach(unsub => unsub());
            unsubRefs.current.clear();
            partnershipUnsubRef.current?.();
        };
    }, []);

    const init = async () => {
        const data = await AccountabilityPartner.getOrCreate();
        setPartnerData(data);
        syncListeners(data.partners);

        // Listen for real-time partner connects/disconnects
        partnershipUnsubRef.current = AccountabilityPartner.listenToPartnership((updated) => {
            setPartnerData(updated);
            syncListeners(updated.partners);
        });
    };

    // Keep per-partner Firestore listeners in sync with the current partners list
    const syncListeners = (partners: PartnerEntry[]) => {
        const newIds = new Set(partners.map(p => p.userId));

        // Remove listeners for partners no longer in list
        for (const [userId, unsub] of unsubRefs.current) {
            if (!newIds.has(userId)) {
                unsub();
                unsubRefs.current.delete(userId);
                setPartnerStatuses(prev => {
                    const next = { ...prev };
                    delete next[userId];
                    return next;
                });
            }
        }

        // Add listeners for new partners
        for (const partner of partners) {
            if (!unsubRefs.current.has(partner.userId)) {
                const unsub = AccountabilityPartner.listenToPartner(
                    partner.userId,
                    (prayed, prayedAt) => {
                        setPartnerStatuses(prev => ({
                            ...prev,
                            [partner.userId]: { prayed, prayedAt },
                        }));
                    }
                );
                unsubRefs.current.set(partner.userId, unsub);
            }
        }
    };

    const partnersCount = partnerData?.partners.length ?? 0;
    const partnerLimit = isPremium ? PREMIUM_PARTNER_LIMIT : FREE_PARTNER_LIMIT;
    const atPartnerLimit = partnersCount >= partnerLimit;

    const handleOpenAddPartner = () => {
        if (!isPremium) {
            openPaywall('feature_gate:accountability', 'accountability_partner');
            return;
        }
        if (atPartnerLimit) {
            Alert.alert(t('partner.circleFullTitle'), t('partner.circleFullBody', { n: PREMIUM_PARTNER_LIMIT }));
            return;
        }
        // Prefill from the shared community name (set on the Leaderboard, a
        // dua post, or a comment reply) — same name people already recognize
        // you by elsewhere, instead of a blank field every time.
        CommunityProfileStore.get().then(profile => {
            if (!profile?.nickname) return;
            setNameProfileName(profile.nickname);
            setNameInput(prev => prev || profile.nickname);
        });
        setEditingNameInput(false);
        setShowModal(true);
    };

    const handleConnect = async () => {
        if (!codeInput.trim() || !nameInput.trim()) return;
        setConnecting(true);
        haptic.light();
        const result = await AccountabilityPartner.connectPartner(codeInput, nameInput);
        setConnecting(false);
        if (result.success) {
            haptic.success();
            // Propagate this name to the Leaderboard, Dua Wall, and comments —
            // whichever surface you name yourself on first flows to the others.
            CommunityProfileStore.set(nameInput).catch(() => {});
            const updated = await AccountabilityPartner.getOrCreate();
            setPartnerData(updated);
            syncListeners(updated.partners);
            setShowModal(false);
            setCodeInput('');
            setNameInput('');
            import('../utils/featureDiscovery').then(m => m.markFeatureUsed('accountability_partner')).catch(() => {});
        } else {
            Alert.alert(t('partner.notFoundTitle'), t('partner.notFoundBody'));
        }
    };

    const handleWake = async (partner: PartnerEntry) => {
        if (wakingPartnerId) return;
        haptic.medium();
        setWakingPartnerId(partner.userId);
        const result = await AccountabilityPartner.wakePartner(partner.userId);
        setWakingPartnerId(null);
        const detailSuffix = result.detail ? t('partner.detailSuffix', { detail: result.detail }) : '';
        switch (result.ok) {
            case 'sent':
                Alert.alert(t('partner.wakeSentTitle', { name: partner.name }), t('partner.wakeSentBody'));
                break;
            case 'rate_limited':
                Alert.alert(t('partner.wakeNotSentTitle'), t('partner.wakeRateLimitBody'));
                break;
            case 'no_token':
                Alert.alert(
                    t('partner.cantReachTitle', { name: partner.name }),
                    t('partner.noTokenBody', { name: partner.name, detail: detailSuffix })
                );
                break;
            case 'device_invalid':
                Alert.alert(
                    t('partner.cantReachTitle', { name: partner.name }),
                    t('partner.deviceInvalidBody', { name: partner.name, detail: detailSuffix })
                );
                break;
            case 'failed':
            default:
                Alert.alert(t('partner.wakeNotSentTitle'), t('partner.wakeFailedBody', { detail: detailSuffix }));
                break;
        }
    };

    const handleDisconnect = (partner: PartnerEntry) => {
        Alert.alert(t('partner.disconnectTitle', { name: partner.name }), t('partner.disconnectBody'), [
            { text: t('btn.cancel'), style: 'cancel' },
            {
                text: t('partner.disconnectBtn'), style: 'destructive', onPress: async () => {
                    await AccountabilityPartner.disconnectPartner(partner.userId);
                    const updated = await AccountabilityPartner.getOrCreate();
                    setPartnerData(updated);
                    syncListeners(updated.partners);
                },
            },
        ]);
    };

    const handleCopyCode = () => {
        if (!partnerData?.myCode) return;
        Clipboard.setString(partnerData.myCode);
        haptic.success();
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleShare = async () => {
        if (!partnerData?.myCode) return;
        await Share.share({
            message: t('partner.shareMessage', { code: partnerData.myCode }),
        });
    };

    if (!partnerData) return null;

    const partners = partnerData.partners;

    return (
        <>
            <Animated.View entering={FadeInDown.duration(400).delay(200)}>
                <BlurView intensity={blurIntensity} tint="dark" style={[styles.card, { borderColor: cardBorder }]}>
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: cardBg, borderRadius: 20 }]} />

                    {/* Header — shows "your circle" when 2+ partners are connected */}
                    <View style={styles.header}>
                        <View style={[styles.iconWrap, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '33' }]}>
                            <Users size={18} color={colors.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.headerTitle}>
                                {partners.length >= 2 ? t('partner.yourCircle') : t('partner.accountabilityPartner')}
                            </Text>
                            {partners.length >= 2 && (() => {
                                const prayedCount = partners.reduce(
                                    (n, p) => n + (partnerStatuses[p.userId]?.prayed ? 1 : 0),
                                    0,
                                );
                                return (
                                    <Text style={[styles.circleStat, { color: colors.secondaryText }]}>
                                        {t('partner.prayedTonightCount', { prayed: prayedCount, total: partners.length })}
                                    </Text>
                                );
                            })()}
                        </View>
                        <TouchableOpacity
                            onPress={handleOpenAddPartner}
                            style={[styles.addBtn, { backgroundColor: colors.accent + '22', borderColor: colors.accent + '44' }]}
                            activeOpacity={0.7}
                        >
                            <UserPlus size={14} color={colors.accent} />
                            <Text style={[styles.addBtnText, { color: colors.accent }]}>{t('partner.addBtn')}</Text>
                            {!isPremium && <Lock size={10} color="#f59e0b" />}
                        </TouchableOpacity>
                    </View>

                    {/* Partner rows */}
                    {partners.length === 0 ? (
                        <TouchableOpacity style={styles.emptyRow} onPress={handleOpenAddPartner} activeOpacity={0.7}>
                            <Text style={styles.emptyText}>
                                {isPremium
                                    ? t('partner.emptyPremium')
                                    : t('partner.emptyFree')}
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        partners.map((partner, index) => {
                            const status = partnerStatuses[partner.userId];
                            const prayed = status?.prayed ?? false;
                            const prayedAt = status?.prayedAt ?? null;
                            const isLast = index === partners.length - 1;
                            return (
                                <View
                                    key={partner.userId}
                                    style={[styles.partnerRow, !isLast && { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }]}
                                >
                                    <View style={[
                                        styles.statusDot,
                                        { backgroundColor: prayed ? '#22c55e' : 'rgba(255,255,255,0.12)' },
                                    ]} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.partnerName} numberOfLines={1}>{partner.name}</Text>
                                        <Text style={[styles.partnerStatus, prayed && { color: '#22c55e' }]}>
                                            {prayed
                                                ? t('partner.prayedTonight', { time: formatPrayedAt(prayedAt) })
                                                : t('partner.notPrayedYet')
                                            }
                                        </Text>
                                    </View>
                                    {/* Wake-up button — only show when the partner
                                        HASN'T prayed yet (otherwise pointless) */}
                                    {!prayed && (() => {
                                        const isWaking = wakingPartnerId === partner.userId;
                                        return (
                                            <TouchableOpacity
                                                onPress={() => handleWake(partner)}
                                                disabled={!!wakingPartnerId}
                                                style={[styles.wakeBtn, { borderColor: colors.accent + '55', backgroundColor: colors.accent + '15', opacity: isWaking ? 0.5 : 1 }]}
                                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                accessibilityLabel={`Send wake-up to ${partner.name}`}
                                            >
                                                <Moon size={11} color={colors.accent} />
                                                <Text style={[styles.wakeText, { color: colors.accent }]}>{isWaking ? '…' : t('partner.wakeBtn')}</Text>
                                            </TouchableOpacity>
                                        );
                                    })()}
                                    <TouchableOpacity
                                        onPress={() => handleDisconnect(partner)}
                                        style={styles.disconnectBtn}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <X size={14} color="#475569" />
                                    </TouchableOpacity>
                                </View>
                            );
                        })
                    )}
                </BlurView>
            </Animated.View>

            {/* Connect Modal */}
            <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
                <KeyboardAvoidingView
                    style={{ flex: 1, backgroundColor: '#0a0f1e' }}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setShowModal(false)}>
                            <X size={20} color="#64748b" />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>{t('partner.addPartnerTitle')}</Text>
                        <View style={{ width: 28 }} />
                    </View>

                    <ScrollView
                        style={styles.modalContent}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="on-drag"
                        automaticallyAdjustKeyboardInsets
                        contentContainerStyle={{ paddingBottom: 60 }}
                    >
                        {/* Your code */}
                        <View style={styles.myCodeSection}>
                            <Text style={styles.sectionLabel}>{t('partner.yourPartnerCode')}</Text>
                            <Text style={styles.sectionSub}>{t('partner.shareCodeSub')}</Text>
                            <View style={styles.codeRow}>
                                <Text style={styles.codeText}>{partnerData.myCode}</Text>
                                <TouchableOpacity onPress={handleCopyCode} style={styles.codeAction}>
                                    {copied
                                        ? <CheckCircle size={18} color="#22c55e" />
                                        : <Copy size={18} color="#64748b" />
                                    }
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity
                                onPress={handleShare}
                                style={[styles.shareBtn, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '33' }]}
                            >
                                <Text style={[styles.shareBtnText, { color: colors.accent }]}>{t('partner.shareMyCode')}</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.divider} />

                        {/* Enter partner code */}
                        <Text style={styles.sectionLabel}>{t('partner.enterTheirCode')}</Text>
                        <Text style={styles.sectionSub}>{t('partner.enterCodeSub')}</Text>

                        <KnownNameField
                            name={nameInput}
                            onChangeName={setNameInput}
                            knownName={nameProfileName}
                            editing={editingNameInput}
                            onStartEditing={() => setEditingNameInput(true)}
                            accent={colors.accent}
                            prefixKey="partner.namedAs"
                            placeholder={t('partner.namePlaceholder')}
                            autoCapitalize="words"
                            inputStyle={[styles.textInput, { borderColor: 'rgba(255,255,255,0.12)', color: '#f1f5f9' }]}
                            rowStyle={styles.knownNameRow}
                        />

                        <TextInput
                            style={[styles.textInput, { borderColor: 'rgba(255,255,255,0.12)', color: '#f1f5f9', letterSpacing: 4, fontSize: 20, fontWeight: '700', textAlign: 'center' }]}
                            placeholder="ABC123"
                            placeholderTextColor="#334155"
                            value={codeInput}
                            onChangeText={t => setCodeInput(t.toUpperCase())}
                            maxLength={6}
                            autoCapitalize="characters"
                        />

                        <TouchableOpacity
                            onPress={handleConnect}
                            disabled={connecting || !codeInput.trim() || !nameInput.trim()}
                            style={[styles.connectBtn, { backgroundColor: colors.accent, opacity: connecting || !codeInput.trim() || !nameInput.trim() ? 0.5 : 1 }]}
                        >
                            <Text style={styles.connectBtnText}>{connecting ? t('partner.connecting') : t('partner.connectBtn')}</Text>
                        </TouchableOpacity>

                        {/* Current partners summary */}
                        {partners.length > 0 && (
                            <>
                                <View style={styles.divider} />
                                <Text style={styles.sectionLabel}>{t('partner.connectedCount', { n: partners.length })}</Text>
                                {partners.map(p => (
                                    <View key={p.userId} style={styles.existingPartnerRow}>
                                        <Text style={styles.existingPartnerName} numberOfLines={1}>{p.name}</Text>
                                        <TouchableOpacity onPress={() => {
                                            setShowModal(false);
                                            handleDisconnect(p);
                                        }}>
                                            <Text style={styles.removeText}>{t('partner.removeBtn')}</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </>
                        )}
                    </ScrollView>
                </KeyboardAvoidingView>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    card: { borderRadius: 20, borderWidth: 1, marginBottom: 12, overflow: 'hidden' },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, paddingBottom: 12 },
    iconWrap: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { color: '#f1f5f9', fontSize: 14, fontWeight: '700' },
    addBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
    addBtnText: { fontSize: 12, fontWeight: '700' },
    emptyRow: { paddingHorizontal: 16, paddingBottom: 16 },
    emptyText: { color: '#475569', fontSize: 13, lineHeight: 20 },
    partnerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    partnerName: { color: '#f1f5f9', fontSize: 14, fontWeight: '700' },
    partnerStatus: { color: '#64748b', fontSize: 12, marginTop: 2 },
    circleStat: { fontSize: 12, fontWeight: '600', marginTop: 2 },
    wakeBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1,
    },
    wakeText: { fontSize: 11, fontWeight: '700' },
    disconnectBtn: { padding: 4 },
    // Modal
    modalHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    modalTitle: { color: '#f1f5f9', fontSize: 17, fontWeight: '700' },
    modalContent: { padding: 24, gap: 12 },
    myCodeSection: { gap: 8 },
    sectionLabel: { color: '#f1f5f9', fontSize: 15, fontWeight: '700' },
    sectionSub: { color: '#64748b', fontSize: 13 },
    codeRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 16,
    },
    codeText: { color: '#f1f5f9', fontSize: 28, fontWeight: '800', letterSpacing: 6 },
    codeAction: { padding: 4 },
    shareBtn: { borderWidth: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
    shareBtnText: { fontSize: 14, fontWeight: '700' },
    divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 4 },
    textInput: {
        borderWidth: 1, borderRadius: 12, padding: 14,
        backgroundColor: 'rgba(255,255,255,0.04)', fontSize: 15,
    },
    knownNameRow: {
        borderWidth: 1, borderRadius: 12, padding: 14,
        borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.04)',
    },
    connectBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
    connectBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
    existingPartnerRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    // flex + single line so a long partner name truncates instead of pushing
    // the Remove button off the row edge.
    existingPartnerName: { color: '#cbd5e1', fontSize: 14, fontWeight: '600', flex: 1, marginRight: 12 },
    removeText: { color: '#ef4444', fontSize: 13, fontWeight: '700' },
});
