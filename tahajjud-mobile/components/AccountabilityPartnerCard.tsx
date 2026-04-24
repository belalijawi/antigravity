import React, { useEffect, useState, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    Modal, KeyboardAvoidingView, Platform, Alert, Share, Clipboard,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Users, Moon, X, Copy, CheckCircle } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { AccountabilityPartner, PartnerData } from '../utils/accountabilityPartner';
import { haptic } from '../utils/haptic';
import { format } from 'date-fns';
import Animated, { FadeInDown } from 'react-native-reanimated';

export function AccountabilityPartnerCard() {
    const { colors, cardBg, cardBorder, blurIntensity } = useTheme();
    const [partnerData, setPartnerData] = useState<PartnerData | null>(null);
    const [partnerPrayed, setPartnerPrayed] = useState(false);
    const [partnerPrayedAt, setPartnerPrayedAt] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [codeInput, setCodeInput] = useState('');
    const [nameInput, setNameInput] = useState('');
    const [connecting, setConnecting] = useState(false);
    const [copied, setCopied] = useState(false);
    const unsubRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        init();
        return () => unsubRef.current?.();
    }, []);

    const init = async () => {
        const data = await AccountabilityPartner.getOrCreate();
        setPartnerData(data);
        if (data.partnerUserId) {
            listenToPartner(data.partnerUserId);
        }
    };

    const listenToPartner = (partnerUserId: string) => {
        unsubRef.current?.();
        unsubRef.current = AccountabilityPartner.listenToPartner(
            partnerUserId,
            (prayed, prayedAt) => {
                setPartnerPrayed(prayed);
                setPartnerPrayedAt(prayedAt);
            }
        );
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
            if (updated.partnerUserId) listenToPartner(updated.partnerUserId);
            setShowModal(false);
            setCodeInput('');
            setNameInput('');
        } else {
            Alert.alert('Not found', 'That code doesn\'t match any account. Double-check and try again.');
        }
    };

    const handleDisconnect = () => {
        Alert.alert('Disconnect partner?', 'You can reconnect anytime.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Disconnect', style: 'destructive', onPress: async () => {
                    unsubRef.current?.();
                    await AccountabilityPartner.disconnect();
                    setPartnerData(prev => prev ? { ...prev, partnerUserId: null, partnerCode: null, partnerName: null } : null);
                    setPartnerPrayed(false);
                }
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

    const hasPartner = !!partnerData.partnerUserId;

    return (
        <>
            <Animated.View entering={FadeInDown.duration(400).delay(200)}>
                <BlurView intensity={blurIntensity} tint="dark" style={[styles.card, { borderColor: cardBorder }]}>
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: cardBg, borderRadius: 20 }]} />

                    {!hasPartner ? (
                        /* ── No partner yet ── */
                        <TouchableOpacity style={styles.inner} onPress={() => setShowModal(true)} activeOpacity={0.8}>
                            <View style={[styles.iconWrap, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '33' }]}>
                                <Users size={20} color={colors.accent} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.title}>Add Accountability Partner</Text>
                                <Text style={styles.sub}>Stay consistent together 🌙</Text>
                            </View>
                            <View style={[styles.addBtn, { backgroundColor: colors.accent + '22', borderColor: colors.accent + '44' }]}>
                                <Text style={[styles.addBtnText, { color: colors.accent }]}>Connect</Text>
                            </View>
                        </TouchableOpacity>
                    ) : (
                        /* ── Partner connected ── */
                        <View style={styles.inner}>
                            <View style={[styles.iconWrap, { backgroundColor: partnerPrayed ? '#22c55e18' : colors.accent + '18', borderColor: partnerPrayed ? '#22c55e44' : colors.accent + '33' }]}>
                                {partnerPrayed
                                    ? <CheckCircle size={20} color="#22c55e" />
                                    : <Moon size={20} color={colors.accent} />
                                }
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.title}>{partnerData.partnerName ?? 'Your Partner'}</Text>
                                <Text style={[styles.sub, partnerPrayed && { color: '#22c55e' }]}>
                                    {partnerPrayed
                                        ? `Prayed tonight${partnerPrayedAt ? ' at ' + format(new Date(partnerPrayedAt), 'h:mm a') : ''} 🌙`
                                        : 'Hasn\'t prayed yet tonight'
                                    }
                                </Text>
                            </View>
                            <TouchableOpacity onPress={handleDisconnect} style={styles.disconnectBtn}>
                                <X size={16} color="#475569" />
                            </TouchableOpacity>
                        </View>
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
                        <Text style={styles.modalTitle}>Accountability Partner</Text>
                        <View style={{ width: 28 }} />
                    </View>

                    <View style={styles.modalContent}>
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
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    card: { borderRadius: 20, borderWidth: 1, marginBottom: 12, overflow: 'hidden' },
    inner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
    iconWrap: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    title: { color: '#f1f5f9', fontSize: 15, fontWeight: '700' },
    sub: { color: '#64748b', fontSize: 13, marginTop: 2 },
    addBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
    addBtnText: { fontSize: 13, fontWeight: '700' },
    disconnectBtn: { padding: 8 },
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
});
