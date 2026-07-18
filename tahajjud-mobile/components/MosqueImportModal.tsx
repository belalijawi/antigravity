import React, { useState } from 'react';
import {
    Modal, View, Text, TouchableOpacity, StyleSheet,
    ActivityIndicator, Alert, ScrollView, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { BlurView } from 'expo-blur';
import { Camera, ImageIcon, X, Check, Trash2, AlertCircle } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import {
    extractTimetableFromImage, saveMosqueTimetable, clearMosqueTimetable,
    getMosqueTimetable, MosqueTimetable,
} from '../utils/mosqueTimetable';
import { localDateStr } from '../utils/localDate';
import { DeviceEventEmitter } from 'react-native';
import { t, getLocale } from '../utils/i18n';
import { format12Hour } from '../utils/timeFormat';

interface Props {
    visible: boolean;
    onClose: () => void;
}

type Step = 'idle' | 'processing' | 'preview' | 'success' | 'error';

function monthLabel(month: string): string {
    try {
        const [y, mo] = month.split('-').map(Number);
        if (isNaN(y) || isNaN(mo)) return month; // fallback to raw string
        return new Date(y, mo - 1, 1).toLocaleDateString(getLocale(), { month: 'short', year: 'numeric' });
    } catch { return month; }
}

function prayerLabel(p: string): string {
    switch (p) {
        case 'fajr': return t('prayer.fajr');
        case 'dhuhr': return t('prayer.dhuhr');
        case 'asr': return t('prayer.asr');
        case 'maghrib': return t('prayer.maghrib');
        case 'isha': return t('prayer.isha');
        default: return p;
    }
}

export function MosqueImportModal({ visible, onClose }: Props) {
    const { colors, blurIntensity } = useTheme();
    const [step, setStep] = useState<Step>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [preview, setPreview] = useState<MosqueTimetable | null>(null);
    const [existingTimetable, setExistingTimetable] = useState<MosqueTimetable | null>(null);

    React.useEffect(() => {
        if (visible) {
            getMosqueTimetable().then(setExistingTimetable).catch(() => {});
            setStep('idle');
            setPreview(null);
            setErrorMsg('');
        }
    }, [visible]);

    const pickImage = async (fromCamera: boolean) => {
        try {
            let result: ImagePicker.ImagePickerResult;
            if (fromCamera) {
                const { status } = await ImagePicker.requestCameraPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert(t('mosqueImport.cameraNeededTitle'), t('mosqueImport.cameraNeededBody'));
                    return;
                }
                result = await ImagePicker.launchCameraAsync({
                    quality: 0.85,
                    base64: true,
                    allowsEditing: false,
                });
            } else {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert(t('mosqueImport.libraryNeededTitle'), t('mosqueImport.libraryNeededBody'));
                    return;
                }
                result = await ImagePicker.launchImageLibraryAsync({
                    quality: 0.85,
                    base64: true,
                    allowsEditing: false,
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                });
            }

            if (result.canceled || !result.assets?.[0]?.base64) return;

            const base64 = result.assets[0].base64!;

            // Warn if image is very large — over 4MB base64 (~3MB actual) may
            // be slow or timeout. Advise user to retake at lower resolution.
            if (base64.length > 4_000_000) {
                Alert.alert(
                    t('mosqueImport.imageLargeTitle'),
                    t('mosqueImport.imageLargeBody'),
                    [
                        { text: t('btn.cancel'), style: 'cancel' },
                        { text: t('mosqueImport.continueAnyway'), onPress: async () => { try { await processImage(base64, result.assets![0].mimeType); } catch { setErrorMsg(t('mosqueImport.genericError')); setStep('error'); } } },
                    ]
                );
                return;
            }

            await processImage(base64, result.assets[0].mimeType);
        } catch (e: any) {
            setErrorMsg(t('mosqueImport.genericError'));
            setStep('error');
        }
    };

    const processImage = async (base64: string, mimeType?: string | null) => {
        try {
            setStep('processing');
            const mediaType = mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
            const extracted = await extractTimetableFromImage(base64, mediaType);

            if (!extracted.ok) {
                let msg = t('mosqueImport.genericError');
                if (extracted.error === 'no_key') msg = t('mosqueImport.errNoKey');
                else if (extracted.error === 'not_a_timetable') msg = t('mosqueImport.errNotTimetable');
                else if (extracted.error === 'image_unclear') msg = t('mosqueImport.errImageUnclear');
                else if (extracted.error === 'network') msg = t('mosqueImport.errNetwork');
                setErrorMsg(msg);
                setStep('error');
                return;
            }

            setPreview(extracted.timetable);
            setStep('preview');
        } catch {
            setErrorMsg(t('mosqueImport.genericError'));
            setStep('error');
        }
    };

    const handleSave = async () => {
        if (!preview) return;
        try {
            await saveMosqueTimetable(preview);
            setExistingTimetable(preview);
            setStep('success');
            DeviceEventEmitter.emit('mosqueTimetableUpdated');
            import('../utils/featureDiscovery').then(m => m.markFeatureUsed('mosque_timetable')).catch(() => {});
        } catch {
            Alert.alert(t('mosqueImport.saveFailedTitle'), t('mosqueImport.saveFailedBody'));
        }
    };

    const handleDelete = () => {
        Alert.alert(
            t('mosqueImport.removeTitle'),
            t('mosqueImport.removeBody'),
            [
                { text: t('btn.cancel'), style: 'cancel' },
                {
                    text: t('mosqueImport.removeBtn'), style: 'destructive',
                    onPress: async () => {
                        await clearMosqueTimetable();
                        setExistingTimetable(null);
                        DeviceEventEmitter.emit('mosqueTimetableUpdated');
                    }
                }
            ]
        );
    };

    const today = localDateStr(new Date());

    // Preview: show first 5 days of the timetable
    const previewDays = preview
        ? Object.entries(preview.times)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(0, 5)
        : [];

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.root, { backgroundColor: '#080d1f' }]}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <X size={20} color="#64748b" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{t('mosqueImport.mosqueTimetableHeader')}</Text>
                    <View style={{ width: 28 }} />
                </View>

                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                    {/* ── IDLE ── */}
                    {step === 'idle' && (
                        <>
                            {existingTimetable ? (
                                <View style={styles.existingCard}>
                                    <BlurView intensity={Math.round(20 * blurIntensity)} tint="dark" style={StyleSheet.absoluteFill} />
                                    <View style={styles.existingRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.existingTitle}>
                                                {existingTimetable.mosqueName ?? t('mosqueEdit.mosqueTimetableFallback')}
                                            </Text>
                                            <Text style={styles.existingSub}>
                                                {t('mosqueImport.daysLoaded', { month: monthLabel(existingTimetable.month), n: Object.keys(existingTimetable.times).length })}
                                            </Text>
                                            {existingTimetable.times[today] && (
                                                <Text style={[styles.existingSub, { color: '#22c55e', marginTop: 4 }]}>
                                                    {t('mosqueImport.activeToday')}
                                                </Text>
                                            )}
                                        </View>
                                        <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
                                            <Trash2 size={16} color="#ef4444" />
                                        </TouchableOpacity>
                                    </View>
                                    {existingTimetable.times[today] && (() => {
                                        const t = existingTimetable.times[today];
                                        return (
                                            <View style={styles.todayRow}>
                                                {(['fajr','dhuhr','asr','maghrib','isha'] as const).map(p => (
                                                    <View key={p} style={styles.todayCell}>
                                                        <Text style={styles.todayPrayer}>{prayerLabel(p)}</Text>
                                                        <Text style={styles.todayTime}>{format12Hour(t[p])}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        );
                                    })()}
                                </View>
                            ) : (
                                <View style={styles.emptyState}>
                                    <Text style={styles.emptyTitle}>{t('mosqueImport.noTimetable')}</Text>
                                    <Text style={styles.emptySub}>
                                        {t('mosqueImport.noTimetableBody')}
                                    </Text>
                                </View>
                            )}

                            <Text style={styles.sectionLabel}>
                                {existingTimetable ? t('mosqueImport.importNewTimetable') : t('mosqueImport.importTimetable')}
                            </Text>

                            <TouchableOpacity
                                style={[styles.importBtn, { backgroundColor: colors.accent }]}
                                onPress={() => pickImage(true)}
                                activeOpacity={0.85}
                            >
                                <Camera size={20} color="#fff" />
                                <Text style={styles.importBtnText}>{t('mosqueImport.takePhoto')}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.importBtnOutline, { borderColor: colors.accent + '55' }]}
                                onPress={() => pickImage(false)}
                                activeOpacity={0.85}
                            >
                                <ImageIcon size={20} color={colors.accent} />
                                <Text style={[styles.importBtnText, { color: colors.accent }]}>{t('mosqueImport.chooseFromLibrary')}</Text>
                            </TouchableOpacity>

                            <Text style={styles.tip}>
                                {t('mosqueImport.tip')}
                            </Text>
                        </>
                    )}

                    {/* ── PROCESSING ── */}
                    {step === 'processing' && (
                        <View style={styles.centred}>
                            <ActivityIndicator size="large" color={colors.accent} />
                            <Text style={styles.processingTitle}>{t('mosqueImport.readingTimetable')}</Text>
                            <Text style={styles.processingSub}>{t('mosqueImport.takesAbout10s')}</Text>
                        </View>
                    )}

                    {/* ── PREVIEW ── */}
                    {step === 'preview' && preview && (
                        <>
                            <View style={styles.previewHeader}>
                                <Text style={styles.previewTitle}>
                                    {preview.mosqueName ?? t('mosqueImport.timetableFound')}
                                </Text>
                                <Text style={styles.previewSub}>
                                    {t('mosqueImport.daysExtracted', { month: monthLabel(preview.month), n: Object.keys(preview.times).length })}
                                </Text>
                            </View>

                            {/* Warn if days are missing */}
                            {(() => {
                                const [year, month] = preview.month.split('-').map(Number);
                                if (isNaN(year) || isNaN(month)) return null;
                                const daysInMonth = new Date(year, month, 0).getDate();
                                const extracted = Object.keys(preview.times).length;
                                const missing = daysInMonth - extracted;
                                if (missing <= 0 || isNaN(missing)) return null;
                                return (
                                    <View style={styles.warningBox}>
                                        <AlertCircle size={14} color="#f59e0b" />
                                        <Text style={styles.warningText}>
                                            {t(missing > 1 ? 'mosqueImport.daysCouldntBeReadPlural' : 'mosqueImport.daysCouldntBeRead', { n: missing })}
                                        </Text>
                                    </View>
                                );
                            })()}

                            <Text style={styles.sectionLabel}>{t('mosqueImport.previewFirst5')}</Text>

                            {previewDays.map(([date, times]) => {
                                const [, , d] = date.split('-');
                                return (
                                    <View key={date} style={styles.previewRow}>
                                        <Text style={styles.previewDate}>{parseInt(d)}</Text>
                                        {(['fajr','dhuhr','asr','maghrib','isha'] as const).map(p => (
                                            <View key={p} style={styles.previewCell}>
                                                <Text style={styles.previewPrayer}>{p.slice(0,3)}</Text>
                                                <Text style={styles.previewTime}>{times[p]}</Text>
                                            </View>
                                        ))}
                                    </View>
                                );
                            })}

                            <Text style={styles.previewNote}>
                                {t('mosqueImport.previewNote')}
                            </Text>

                            <TouchableOpacity
                                style={[styles.importBtn, { backgroundColor: colors.accent }]}
                                onPress={handleSave}
                                activeOpacity={0.85}
                            >
                                <Check size={20} color="#fff" />
                                <Text style={styles.importBtnText}>{t('mosqueImport.saveTimetable')}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.importBtnOutline, { borderColor: '#475569' }]}
                                onPress={() => setStep('idle')}
                                activeOpacity={0.85}
                            >
                                <Text style={[styles.importBtnText, { color: '#64748b' }]}>{t('mosqueImport.retakePhoto')}</Text>
                            </TouchableOpacity>
                        </>
                    )}

                    {/* ── SUCCESS ── */}
                    {step === 'success' && (
                        <View style={styles.centred}>
                            <View style={[styles.successCircle, { borderColor: '#22c55e55', backgroundColor: '#22c55e12' }]}>
                                <Check size={44} color="#22c55e" />
                            </View>
                            <Text style={styles.successTitle}>{t('mosqueImport.timetableSaved')}</Text>
                            <Text style={styles.processingSub}>
                                {t('mosqueImport.savedBody')}
                            </Text>
                            <TouchableOpacity
                                style={[styles.fullBtn, { backgroundColor: colors.accent, marginTop: 16 }]}
                                onPress={onClose}
                                activeOpacity={0.85}
                            >
                                <Check size={18} color="#0a1228" strokeWidth={3} />
                                <Text style={styles.fullBtnText}>{t('btn.done')}</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* ── ERROR ── */}
                    {step === 'error' && (
                        <View style={styles.centred}>
                            <View style={[styles.successCircle, { borderColor: '#ef444455', backgroundColor: '#ef444412' }]}>
                                <AlertCircle size={44} color="#ef4444" />
                            </View>
                            <Text style={[styles.processingTitle, { color: '#ef4444' }]}>{t('mosqueImport.couldntRead')}</Text>
                            <Text style={styles.processingSub}>{errorMsg}</Text>
                            <TouchableOpacity
                                style={[styles.fullBtn, { backgroundColor: colors.accent, marginTop: 16 }]}
                                onPress={() => setStep('idle')}
                                activeOpacity={0.85}
                            >
                                <Text style={styles.fullBtnText}>{t('mosqueImport.tryAgain')}</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </ScrollView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    headerTitle: { color: '#f1f5f9', fontSize: 17, fontWeight: '700' },
    content: { padding: 24, paddingBottom: 60 },
    // Existing timetable
    existingCard: {
        borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        overflow: 'hidden', marginBottom: 24,
    },
    existingRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
    existingTitle: { color: '#f1f5f9', fontSize: 15, fontWeight: '700' },
    existingSub: { color: '#64748b', fontSize: 13, marginTop: 2 },
    deleteBtn: { padding: 8 },
    todayRow: {
        flexDirection: 'row', justifyContent: 'space-around',
        paddingHorizontal: 12, paddingBottom: 14,
        borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
        paddingTop: 12,
    },
    todayCell: { alignItems: 'center' },
    todayPrayer: { color: '#64748b', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
    todayTime: { color: '#f1f5f9', fontSize: 13, fontWeight: '700', marginTop: 3 },
    // Empty state
    emptyState: { alignItems: 'center', paddingVertical: 24, marginBottom: 24 },
    emptyTitle: { color: '#f1f5f9', fontSize: 18, fontWeight: '800', marginBottom: 10 },
    emptySub: { color: '#64748b', fontSize: 14, textAlign: 'center', lineHeight: 21 },
    // Labels & buttons
    sectionLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 },
    importBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        borderRadius: 14, paddingVertical: 15, marginBottom: 12,
    },
    fullBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        borderRadius: 18, paddingVertical: 17,
        width: '100%',
        shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
        elevation: 6,
    },
    fullBtnText: { color: '#0a1228', fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
    importBtnOutline: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        borderRadius: 14, paddingVertical: 15, marginBottom: 12,
        borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.03)',
    },
    importBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    tip: { color: '#475569', fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: 8 },
    // Processing / success / error
    centred: { alignItems: 'center', paddingVertical: 48, gap: 16, width: '100%' },
    processingTitle: { color: '#f1f5f9', fontSize: 18, fontWeight: '800', textAlign: 'center' },
    processingSub: { color: '#64748b', fontSize: 14, textAlign: 'center', lineHeight: 21 },
    successCircle: {
        width: 100, height: 100, borderRadius: 50,
        borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    },
    successTitle: { color: '#f1f5f9', fontSize: 24, fontWeight: '800' },
    // Preview
    previewHeader: { marginBottom: 20 },
    previewTitle: { color: '#f1f5f9', fontSize: 18, fontWeight: '800' },
    previewSub: { color: '#64748b', fontSize: 13, marginTop: 4 },
    previewRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    previewDate: { color: '#94a3b8', fontSize: 13, fontWeight: '700', width: 28 },
    previewCell: { flex: 1, alignItems: 'center' },
    previewPrayer: { color: '#475569', fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
    previewTime: { color: '#f1f5f9', fontSize: 12, fontWeight: '600', marginTop: 2 },
    previewNote: { color: '#64748b', fontSize: 13, marginVertical: 16, lineHeight: 20 },
    warningBox: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 8,
        backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: 10,
        borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)',
        padding: 12, marginBottom: 16,
    },
    warningText: { color: '#f59e0b', fontSize: 13, lineHeight: 18, flex: 1 },
});
