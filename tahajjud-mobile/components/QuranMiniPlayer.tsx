import React, { useEffect, useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    ActivityIndicator, Platform,
} from 'react-native';
import { GlassBg as BlurView } from './GlassBg';
import { Play, Pause, SkipBack, SkipForward, X, Volume2 } from 'lucide-react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuranAudio } from '../context/QuranAudioContext';
import { useTheme } from '../context/ThemeContext';
import { getCurrentReciter, subscribeReciter } from '../utils/reciters';
import { FullScreenPlayer } from './FullScreenPlayer';

export function QuranMiniPlayer() {
    const audio = useQuranAudio();
    const { colors, blurIntensity } = useTheme();
    const insets = useSafeAreaInsets();
    const [reciterName, setReciterName] = useState(getCurrentReciter().name);
    const [showFull, setShowFull] = useState(false);

    useEffect(() => {
        const unsub = subscribeReciter(() => setReciterName(getCurrentReciter().name));
        return () => unsub();
    }, []);

    if (!audio.currentSurahNumber) return null;

    // Sit just above the floating tab bar
    const BAR_BOTTOM = Math.max(insets.bottom, 14) + 4;
    const BAR_HEIGHT = 64;
    const bottom = BAR_BOTTOM + BAR_HEIGHT + 8;

    const content = (
        <>
            {/* Info area — tap to open full-screen player */}
            <TouchableOpacity
                style={styles.infoArea}
                activeOpacity={0.7}
                onPress={() => setShowFull(true)}
                accessibilityRole="button"
                accessibilityLabel={`Now playing ${audio.currentSurahName ?? 'recitation'}. Open full player.`}
            >
                <View style={[
                    styles.iconWrap,
                    { backgroundColor: colors.accent + '22', borderColor: colors.accent + '44' },
                ]}>
                    <Volume2 size={12} color={colors.accent} />
                </View>
                <View style={styles.textArea}>
                    <Text style={styles.surahName} numberOfLines={1}>
                        {audio.currentSurahName ?? 'Loading…'}
                    </Text>
                    <Text style={styles.sub} numberOfLines={1}>
                        {audio.playlistName && audio.queueTotal > 0
                            ? `${reciterName} · ${audio.queueIndex + 1} / ${audio.queueTotal}`
                            : reciterName}
                    </Text>
                </View>
            </TouchableOpacity>

            {/* Controls */}
            <View style={styles.controls}>
                <TouchableOpacity
                    onPress={audio.skipPrev}
                    style={styles.ctrlBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Previous surah"
                >
                    <SkipBack size={16} color="#94a3b8" />
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={audio.togglePlayPause}
                    style={[styles.playBtn, { backgroundColor: colors.accent }]}
                    accessibilityRole="button"
                    accessibilityLabel={audio.isPlaying ? 'Pause recitation' : 'Play recitation'}
                    accessibilityState={{ busy: audio.isLoading }}
                >
                    {audio.isLoading
                        ? <ActivityIndicator size="small" color="#000" />
                        : audio.isPlaying
                            ? <Pause size={18} color="#000" fill="#000" />
                            : <Play size={18} color="#000" fill="#000" style={{ marginLeft: 1 }} />
                    }
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={audio.skipNext}
                    style={styles.ctrlBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Next surah"
                >
                    <SkipForward size={16} color="#94a3b8" />
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={audio.stop}
                    style={styles.ctrlBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Stop and close player"
                >
                    <X size={16} color="#475569" />
                </TouchableOpacity>
            </View>
        </>
    );

    return (
        <>
            <Animated.View
                entering={FadeInDown.duration(300)}
                exiting={FadeOutDown.duration(200)}
                style={[styles.container, { bottom }]}
            >
                {Platform.OS === 'ios' ? (
                    <BlurView
                        intensity={Math.round(80 * blurIntensity)}
                        tint="dark"
                        style={styles.inner}
                    >
                        {content}
                    </BlurView>
                ) : (
                    <View style={[styles.inner, { backgroundColor: 'rgba(10,15,30,0.97)' }]}>
                        {content}
                    </View>
                )}
            </Animated.View>
            <FullScreenPlayer visible={showFull} onClose={() => setShowFull(false)} />
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 16,
        right: 16,
        borderRadius: 20,
        overflow: 'hidden',
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
        zIndex: 999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.10)',
    },
    inner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
    },
    infoArea: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    iconWrap: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    textArea: {
        flex: 1,
    },
    surahName: {
        color: '#f1f5f9',
        fontSize: 14,
        fontWeight: '700',
    },
    sub: {
        color: '#64748b',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 1,
    },
    controls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    playBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ctrlBtn: {
        width: 34,
        height: 34,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
