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
        return ' at ' + format(new Date(prayedAt), 'h:mm a');
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
            openPaywall();
            return;
        }
        if (atPartnerLimit) {
            Alert.alert('Circle is full', `You've connected with your maximum of ${PREMIUM_PARTNER_LIMIT} partners.`);
            return;
        }
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
            const updated = await AccountabilityPartner.getOrCreate();
            setPartnerData(updated);
            syncListeners(updated.partners);
            setShowModal(false);
            setCodeInput('');
            setNameInput('');
            import('../utils/featureDiscovery').then(m => m.markFeatureUsed('accountability_partner')).catch(() => {});
        } else {
            Alert.alert('Not found', "That code doesn't match any account. Double-check and try again.");
        }
    };

    const handleWake = async (partner: PartnerEntry) => {
        if (wakingPartnerId) return;
        haptic.medium();
        setWakingPartnerId(partner.userId);
        const result = await AccountabilityPartner.wakePartner(partner.userId);
        setWakingPartnerId(null);
        const detailSuffix = result.detail ? `\n\nDetail: ${result.detail}` : '';
        switch (result.ok) {
            case 'sent':
                Alert.alert(`Wake-up sent to ${partner.name}`, "They'll get a push notification. Don't overdo it — limited to once every 8 hours.");
                break;
            case 'rate_limited':
                Alert.alert('Wake-up not sent', "You've already sent one to this partner in the last 8 hours.");
                break;
            case 'no_token':
                Alert.alert(
                    `Can't reach ${partner.name}`,
                    `${partner.name} hasn't enabled push notifications yet. Ask them to open the app, allow notifications, and re-open Partner.${detailSuffix}`
                );
                break;
            case 'device_invalid':
                Alert.alert(
                    `Can't reach ${partner.name}`,
                    `${partner.name}'s device is no longer registered (maybe they reinstalled). Ask them to open the app once to refresh.${detailSuffix}`
                );
                break;
            case 'failed':
            default:
                Alert.alert('Wake-up not sent', `Something went wrong. Check your connection and try again.${detailSuffix}`);
                break;
        }
    };

    const handleDisconnect = (partner: PartnerEntry) => {
        Alert.alert(`Disconnect ${partner.name}?`, 'You can reconnect anytime.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Disconnect', style: 'destructive', onPress: async () => {
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
            message: `Join me on Tahajjud+ and let's hold each other accountable 🌙\nMy partner code: ${partnerData.myCode}`,
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
                                {partners.length >= 2 ? 'Your Circle' : 'Accountability Partner'}
                            </Text>
                            {partners.length >= 2 && (() => {
                                const prayedCount = partners.reduce(
                                    (n, p) => n + (partnerStatuses[p.userId]?.prayed ? 1 : 0),
                                    0,
                                );
                                return (
                                    <Text style={[styles.circleStat, { color: colors.secondaryText }]}>
                                        {prayedCount} of {partners.length} prayed tonight 🌙
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
                            <Text style={[styles.addBtnText, { color: colors.accent }]}>Add</Text>
                            {!isPremium && <Lock size={10} color="#f59e0b" />}
                        </TouchableOpacity>
                    </View>

                    {/* Partner rows */}
                    {partners.length === 0 ? (
                        <TouchableOpacity style={styles.emptyRow} onPress={handleOpenAddPartner} activeOpacity={0.7}>
                            <Text style={styles.emptyText}>
                                {isPremium
                                    ? 'Tap Add to invite someone to pray with you 🌙'
                                    : 'Pray with a friend — see who prayed tonight, send wake-up calls. Premium only 🌙'}
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
                                        <Text style={styles.partnerName}>{partner.name}</Text>
                                        <Text style={[styles.partnerStatus, prayed && { color: '#22c55e' }]}>
                                            {prayed
                                                ? `Prayed tonight${formatPrayedAt(prayedAt)} 🌙`
                                                : "Hasn't prayed yet tonight"
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
                                                <Text style={[styles.wakeText, { color: colors.accent }]}>{isWaking ? '…' : 'Wake'}</Text>
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
                        <Text style={styles.modalTitle}>Add Partner</Text>
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
                            <Text style={styles.sectionLabel}>Your partner code</Text>
                            <Text style={styles.sectionSub}>Share this with someone you want to pray with</Text>
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
                                <Text style={[styles.shareBtnText, { color: colors.accent }]}>Share my code</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.divider} />

                        {/* Enter partner code */}
                        <Text style={styles.sectionLabel}>Enter their code</Text>
                        <Text style={styles.sectionSub}>Get their 6-character code and enter it below</Text>

                        <TextInput
                            style={[styles.textInput, { borderColor: 'rgba(255,255,255,0.12)', color: '#f1f5f9' }]}
                            placeholder="Your name (shown to partner)"
                            placeholderTextColor="#334155"
                            value={nameInput}
                            onChangeText={setNameInput}
                            autoCapitalize="words"
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
                            <Text style={styles.connectBtnText}>{connecting ? 'Connecting…' : 'Connect'}</Text>
                        </TouchableOpacity>

                        {/* Current partners summary */}
                        {partners.length > 0 && (
                            <>
                                <View style={styles.divider} />
                                <Text style={styles.sectionLabel}>Connected ({partners.length})</Text>
                                {partners.map(p => (
                                    <View key={p.userId} style={styles.existingPartnerRow}>
                                        <Text style={styles.existingPartnerName}>{p.name}</Text>
                                        <TouchableOpacity onPress={() => {
                                            setShowModal(false);
                                            handleDisconnect(p);
                                        }}>
                                            <Text style={styles.removeText}>Remove</Text>
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
    connectBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
    connectBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
    existingPartnerRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    existingPartnerName: { color: '#cbd5e1', fontSize: 14, fontWeight: '600' },
    removeText: { color: '#ef4444', fontSize: 13, fontWeight: '700' },
});
