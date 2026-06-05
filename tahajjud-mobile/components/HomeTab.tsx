import React, { useEffect, useState, useRef } from 'react';
import { View, ScrollView, StyleSheet, Text, TouchableOpacity, Modal, DeviceEventEmitter, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SlidersHorizontal, Search } from 'lucide-react-native';
import { t } from '../utils/i18n';
import { GlobalSearch } from './GlobalSearch';
import { NightCalculator } from './NightCalculator';
import { TasbeehCard } from './TasbeehCard';
import { HadithCard } from './HadithCard';
import { DuaNetwork } from './DuaNetwork';
import { AccountabilityPartnerCard } from './AccountabilityPartnerCard';
import { VerseOfTheDay } from './VerseOfTheDay';
import { NightHomeScreen, isInTahajjudWindow } from './NightHomeScreen';
import { TahajjudChallengeCard } from './TahajjudChallengeCard';
import { BedtimeCard } from './BedtimeCard';
import { ChallengesCard } from './ChallengesCard';
import { FridayKahfCard } from './FridayKahfCard';
import { EidCard } from './EidCard';
import { LiveActivity } from '../utils/liveActivity';
import { SettingsScreen } from './SettingsScreen';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
    FadeInUp, FadeInDown,
    useSharedValue, useAnimatedStyle,
    withRepeat, withSequence, withTiming,
    cancelAnimation,
} from 'react-native-reanimated';

// Reanimated cascade entrance animations look polished on iOS but were adding
// ~800ms of staggered layout work on Android — making the home tab feel
// sluggish on cold start. Disable entering animations on Android entirely;
// cards appear instantly which feels faster and less janky.
const fadeIn = (delay: number) =>
    Platform.OS === 'android' ? undefined : FadeInDown.delay(delay).duration(800);
const fadeInUp = (delay: number) =>
    Platform.OS === 'android' ? undefined : FadeInUp.delay(delay).duration(800);
import { useTheme } from '../context/ThemeContext';
import { tabletContentStyle } from '../utils/layout';
import { NightCalculation, PrayerTimes } from '../lib/prayer-times';
import { format } from 'date-fns';
import { PrayerCountdown } from './PrayerCountdown';
import { localDateStr } from '../utils/localDate';
import { usePurchases } from '../context/PurchasesContext';


export function HomeTab() {
    const { colors, userName, cardBg, cardBorder, blurIntensity } = useTheme();
    const scrollRef = useRef<ScrollView>(null);
    const { openPaywall } = usePurchases();
    const [isSettingsVisible, setIsSettingsVisible] = useState(false);
    const [showSearch, setShowSearch] = useState(false);

    useEffect(() => {
        const scrollSub = DeviceEventEmitter.addListener('scrollToTop', (tab: string) => {
            if (tab === 'Home') scrollRef.current?.scrollTo({ y: 0, animated: true });
        });
        const paywallSub = DeviceEventEmitter.addListener('openPaywall', () => {
            openPaywall();
        });
        return () => { scrollSub.remove(); paywallSub.remove(); };
    }, [openPaywall]);
    const [nightCalc, setNightCalc] = useState<NightCalculation | null>(null);
    const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [refreshKey, setRefreshKey] = useState(0);
    const [nightModeSkipped, setNightModeSkipped] = useState(false);
    // True only if the user opened the app WHILE already in the last third
    // of the night. We don't want the Tahajjud screen to auto-pop in the
    // middle of a normal session if the time naturally crosses into the
    // last third — only on a fresh app open during that window.
    const [openedDuringLastThird, setOpenedDuringLastThird] = useState(false);
    useEffect(() => {
        if (nightCalc && isInTahajjudWindow(nightCalc, new Date())) {
            setOpenedDuringLastThird(true);
        }
    }, [nightCalc]);

    // Restore "skipped night mode" flag — keyed by date so it resets next Tahajjud
    useEffect(() => {
        const today = localDateStr(new Date());
        AsyncStorage.getItem(`night-mode-skipped-${today}`).then(v => {
            if (v === 'true') setNightModeSkipped(true);
        }).catch(() => {});
    }, []);

    const skipNightMode = async () => {
        const today = localDateStr(new Date());
        await AsyncStorage.setItem(`night-mode-skipped-${today}`, 'true');
        setNightModeSkipped(true);
    };

    const handlePrayedTahajjudFromNightMode = async () => {
        // Append today to tracker history; Tracker recomputes streak on its
        // own next mount. We persist directly here so it works without that tab being open.
        let alreadyLogged = false;
        try {
            const raw = await AsyncStorage.getItem('prayer-tracker-v2');
            const history = raw ? JSON.parse(raw) : { fajr: [], dhuhr: [], asr: [], maghrib: [], isha: [], tahajjud: [] };
            const today = localDateStr(new Date());
            alreadyLogged = (history.tahajjud || []).some((d: string) => localDateStr(d) === today);
            if (!alreadyLogged) {
                history.tahajjud = [...(history.tahajjud || []), new Date().toISOString()];
                await AsyncStorage.setItem('prayer-tracker-v2', JSON.stringify(history));
            }
        } catch { /* never block the user */ }

        if (!alreadyLogged) {
            // Notify accountability partner (same as Tracker does)
            const { AccountabilityPartner } = await import('../utils/accountabilityPartner');
            AccountabilityPartner.logTahajjudForPartner().catch(() => {});

            // Tally toward the 40-night challenge (idempotent for today)
            const { TahajjudChallenge } = await import('../utils/tahajjudChallenge');
            await TahajjudChallenge.recordTahajjudToday().catch(() => null);

            // Track analytics
            const { track } = await import('../utils/analytics');
            track('prayer_logged', { prayer: 'tahajjud', source: 'night_mode' });

            // Emit so HistoryCalendar and PrayerAnalytics refresh
            const { DeviceEventEmitter } = await import('react-native');
            DeviceEventEmitter.emit('prayerLogged');
        }

        await skipNightMode();
    };

    // Tick every minute so the badge updates without reloading
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Live Activity: start ONCE when the Tahajjud window opens, end when it closes.
    // We track which (lastThirdStart, fajr) pair has an activity already so the
    // minute-tick re-render doesn't spawn a new activity every minute.
    const liveActivityStartedFor = useRef<string | null>(null);
    useEffect(() => {
        if (!nightCalc) return;
        const key = `${nightCalc.lastThirdStart.getTime()}_${nightCalc.nightEnd.getTime()}`;
        const inWindow = currentTime >= nightCalc.lastThirdStart && currentTime < nightCalc.nightEnd;

        if (inWindow && liveActivityStartedFor.current !== key) {
            LiveActivity.start(nightCalc.lastThirdStart, nightCalc.nightEnd).catch(() => {});
            liveActivityStartedFor.current = key;
        } else if (!inWindow && currentTime >= nightCalc.nightEnd && liveActivityStartedFor.current === key) {
            LiveActivity.endAll().catch(() => {});
            liveActivityStartedFor.current = null;
        }
    }, [nightCalc?.lastThirdStart?.getTime(), nightCalc?.nightEnd?.getTime(),
        // Re-evaluate on minute ticks
        Math.floor(currentTime.getTime() / 60000)]);

    const isGateOpen = nightCalc
        ? currentTime >= nightCalc.lastThirdStart && currentTime < nightCalc.nightEnd
        : false;

    // ── Gate-open animations ──────────────────────────────────────
    const moonPulse   = useSharedValue(1);
    const moonOpacity = useSharedValue(0.4);
    const badgePulse  = useSharedValue(0);
    const s1 = useSharedValue(0);
    const s2 = useSharedValue(0);
    const s3 = useSharedValue(0);
    const s4 = useSharedValue(0);
    const s5 = useSharedValue(0);

    useEffect(() => {
        if (isGateOpen) {
            moonPulse.value = withRepeat(
                withSequence(withTiming(1.28, { duration: 2400 }), withTiming(1.0, { duration: 2400 })),
                -1, false,
            );
            moonOpacity.value = withRepeat(
                withSequence(withTiming(0.7, { duration: 2400 }), withTiming(0.2, { duration: 2400 })),
                -1, false,
            );
            badgePulse.value = withRepeat(
                withSequence(withTiming(1, { duration: 1600 }), withTiming(0.15, { duration: 1600 })),
                -1, false,
            );
            s1.value = withRepeat(withSequence(withTiming(1, { duration: 900 }), withTiming(0, { duration: 700 })), -1, false);
            s2.value = withRepeat(withSequence(withTiming(0, { duration: 500 }), withTiming(1, { duration: 700 }), withTiming(0, { duration: 600 })), -1, false);
            s3.value = withRepeat(withSequence(withTiming(0, { duration: 1100 }), withTiming(1, { duration: 600 }), withTiming(0, { duration: 500 })), -1, false);
            s4.value = withRepeat(withSequence(withTiming(1, { duration: 1400 }), withTiming(0, { duration: 900 })), -1, false);
            s5.value = withRepeat(withSequence(withTiming(0, { duration: 800 }), withTiming(0.9, { duration: 700 }), withTiming(0, { duration: 900 })), -1, false);
        } else {
            cancelAnimation(moonPulse);  cancelAnimation(moonOpacity);
            cancelAnimation(badgePulse);
            cancelAnimation(s1); cancelAnimation(s2); cancelAnimation(s3); cancelAnimation(s4); cancelAnimation(s5);
            moonPulse.value   = withTiming(1,   { duration: 700 });
            moonOpacity.value = withTiming(0.4, { duration: 700 });
            badgePulse.value  = withTiming(0,   { duration: 500 });
            s1.value = withTiming(0); s2.value = withTiming(0); s3.value = withTiming(0);
            s4.value = withTiming(0); s5.value = withTiming(0);
        }
    }, [isGateOpen]);

    const moonAura1Style = useAnimatedStyle(() => ({
        transform: [{ scale: moonPulse.value }],
        opacity: moonOpacity.value,
    }));
    const moonAura2Style = useAnimatedStyle(() => ({
        transform: [{ scale: 0.85 + (moonPulse.value - 1) * 0.5 }],
        opacity: moonOpacity.value * 0.5,
    }));
    const badgeGlowStyle = useAnimatedStyle(() => ({
        shadowOpacity: badgePulse.value * 0.9,
        shadowRadius: 6 + badgePulse.value * 10,
    }));
    const s1Style = useAnimatedStyle(() => ({ opacity: s1.value }));
    const s2Style = useAnimatedStyle(() => ({ opacity: s2.value }));
    const s3Style = useAnimatedStyle(() => ({ opacity: s3.value }));
    const s4Style = useAnimatedStyle(() => ({ opacity: s4.value }));
    const s5Style = useAnimatedStyle(() => ({ opacity: s5.value }));

    // ── Night mode gate ──
    // Show the focused Tahajjud ritual flow ONLY if:
    //   1. The user opened the app while already in the last third of the
    //      night (captured at mount — see `openedDuringLastThird` above).
    //   2. The window is still active right now.
    //   3. They haven't tapped "Skip" for tonight.
    // This prevents the screen from auto-popping when the user is mid-session
    // and the time naturally rolls into the last third.
    if (
        openedDuringLastThird
        && nightCalc
        && isInTahajjudWindow(nightCalc, currentTime)
        && !nightModeSkipped
    ) {
        // NOTE: plain View (not SafeAreaView) so NightHomeScreen's gradient
        // fills behind the status bar. NightHomeScreen handles its own
        // safe-area top padding internally via useSafeAreaInsets.
        return (
            <View style={styles.safeArea}>
                <NightHomeScreen
                    nightCalc={nightCalc}
                    onPrayedTahajjud={handlePrayedTahajjudFromNightMode}
                    onSkip={skipNightMode}
                />
                {/* Hidden NightCalculator keeps the calc fresh */}
                <View style={{ height: 0, overflow: 'hidden' }}>
                    <NightCalculator
                        onNightCalcReady={setNightCalc}
                        onPrayerTimesReady={setPrayerTimes}
                        refreshKey={refreshKey}
                    />
                </View>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView
                ref={scrollRef}
                style={styles.container}
                contentContainerStyle={[styles.contentContainer, tabletContentStyle()]}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={[styles.dateText, { color: colors.accent }]}>
                            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </Text>
                        <Text style={[styles.greetingText, { color: colors.secondaryText }]}>
                            {t('home.greeting')}
                        </Text>
                        <Text style={[styles.nameText, { color: colors.primaryText }]}>{userName || 'Servant'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => setShowSearch(true)}
                            style={styles.settingsButton}
                            accessibilityRole="button"
                            accessibilityLabel="Search"
                        >
                            <BlurView intensity={Math.round(25 * blurIntensity)} tint="dark" style={[StyleSheet.absoluteFill, { borderRadius: 22, backgroundColor: cardBg }]} />
                            <Search color={colors.primaryText} size={18} strokeWidth={2} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => setIsSettingsVisible(true)}
                            style={styles.settingsButton}
                            accessibilityRole="button"
                            accessibilityLabel="Settings"
                        >
                            <BlurView intensity={Math.round(25 * blurIntensity)} tint="dark" style={[StyleSheet.absoluteFill, { borderRadius: 22, backgroundColor: cardBg }]} />
                            <SlidersHorizontal color={colors.primaryText} size={18} strokeWidth={2} />
                        </TouchableOpacity>
                    </View>
                </View>

                <GlobalSearch
                    visible={showSearch}
                    onClose={() => setShowSearch(false)}
                    onResultPress={(result) => {
                        // Lazy-require avoids the App.tsx → HomeTab → App.tsx
                        // circular import.
                        const { switchToTab, requestOpen } = require('../App');
                        if (result.kind === 'surah') {
                            requestOpen({ kind: 'surah', surahNumber: result.surah.number });
                            switchToTab('Quran');
                        } else if (result.kind === 'verse') {
                            // Jump straight to the specific ayah, not the start of the surah.
                            requestOpen({ kind: 'surah', surahNumber: result.surahNumber, ayahNumber: result.ayahNumber });
                            switchToTab('Quran');
                        } else if (result.kind === 'dua') {
                            requestOpen({ kind: 'dua', id: result.dua.id });
                            switchToTab('Duas');
                        } else if (result.kind === 'letter') {
                            requestOpen({ kind: 'letter', id: result.letter.id });
                            switchToTab('Duas');
                        } else if (result.kind === 'journal') {
                            requestOpen({ kind: 'journal', id: result.entry.id });
                        } else if (result.kind === 'tab') {
                            switchToTab(result.tabName);
                        }
                    }}
                />

                {/* Hero: Celestial Portal */}
                <Animated.View
                    entering={FadeInUp.duration(1200)}
                    style={styles.heroPortal}
                >
                    <LinearGradient
                        colors={['rgba(248, 250, 252, 0.08)', 'rgba(79, 70, 229, 0.02)', 'transparent']}
                        style={[StyleSheet.absoluteFill, { borderRadius: 40 }]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    />
                    <BlurView intensity={Math.round(40 * blurIntensity)} tint="dark" style={[StyleSheet.absoluteFill, { borderRadius: 40, backgroundColor: cardBg }]} />

                    <View style={styles.moonContainer}>
                        <View style={styles.moon}>
                            {/* Base Moon Surface with Realistic Gradient */}
                            <LinearGradient
                                colors={['#b0b8c4', '#8895a5', '#6b7785', '#4a5568']}
                                style={[StyleSheet.absoluteFill, { borderRadius: 40 }]}
                                start={{ x: 0.2, y: 0.2 }}
                                end={{ x: 0.9, y: 0.9 }}
                            />

                            {/* Lunar Maria (Dark Seas) - More Realistic Patterns */}
                            <View style={[styles.moonSea, { top: 8, left: 5, width: 35, height: 28, transform: [{ rotate: '25deg' }], opacity: 0.15 }]} />
                            <View style={[styles.moonSea, { top: 25, right: 8, width: 22, height: 18, transform: [{ rotate: '-15deg' }], opacity: 0.12 }]} />
                            <View style={[styles.moonSea, { bottom: 12, left: 18, width: 28, height: 22, opacity: 0.10 }]} />
                            <View style={[styles.moonSea, { bottom: 20, right: 12, width: 18, height: 16, transform: [{ rotate: '40deg' }], opacity: 0.08 }]} />

                            {/* Impact Craters with Depth */}
                            {/* Large crater with rim highlight */}
                            <View style={[styles.craterOuter, { top: 15, left: 28, width: 18, height: 18 }]}>
                                <View style={[styles.moonCrater, { width: 14, height: 14, opacity: 0.18 }]} />
                                <View style={[styles.craterHighlight, { top: 2, left: 2, width: 8, height: 8 }]} />
                            </View>

                            {/* Medium craters */}
                            <View style={[styles.craterOuter, { top: 38, left: 18, width: 12, height: 12 }]}>
                                <View style={[styles.moonCrater, { width: 10, height: 10, opacity: 0.15 }]} />
                            </View>
                            <View style={[styles.craterOuter, { bottom: 24, left: 40, width: 14, height: 14 }]}>
                                <View style={[styles.moonCrater, { width: 11, height: 11, opacity: 0.12 }]} />
                                <View style={[styles.craterHighlight, { top: 1, left: 1, width: 6, height: 6 }]} />
                            </View>

                            {/* Small craters scattered */}
                            <View style={[styles.moonCrater, { top: 10, right: 18, width: 6, height: 6, opacity: 0.10 }]} />
                            <View style={[styles.moonCrater, { top: 28, right: 25, width: 5, height: 5, opacity: 0.08 }]} />
                            <View style={[styles.moonCrater, { bottom: 18, left: 12, width: 7, height: 7, opacity: 0.14 }]} />
                            <View style={[styles.moonCrater, { bottom: 35, right: 20, width: 8, height: 8, opacity: 0.11 }]} />
                            <View style={[styles.moonCrater, { top: 50, left: 8, width: 4, height: 4, opacity: 0.09 }]} />
                            <View style={[styles.moonCrater, { top: 22, left: 52, width: 5, height: 5, opacity: 0.07 }]} />

                            {/* Micro-craters for texture */}
                            <View style={[styles.moonCrater, { top: 18, left: 12, width: 3, height: 3, opacity: 0.06 }]} />
                            <View style={[styles.moonCrater, { top: 32, left: 32, width: 3, height: 3, opacity: 0.05 }]} />
                            <View style={[styles.moonCrater, { top: 44, right: 14, width: 3, height: 3, opacity: 0.07 }]} />
                            <View style={[styles.moonCrater, { bottom: 28, left: 25, width: 4, height: 4, opacity: 0.06 }]} />
                            <View style={[styles.moonCrater, { bottom: 42, right: 28, width: 3, height: 3, opacity: 0.05 }]} />
                            <View style={[styles.moonCrater, { top: 58, left: 46, width: 3, height: 3, opacity: 0.06 }]} />
                            <View style={[styles.moonCrater, { top: 14, left: 38, width: 2, height: 2, opacity: 0.04 }]} />
                            <View style={[styles.moonCrater, { bottom: 15, left: 8, width: 3, height: 3, opacity: 0.05 }]} />
                            <View style={[styles.moonCrater, { bottom: 48, left: 52, width: 2, height: 2, opacity: 0.04 }]} />
                            <View style={[styles.moonCrater, { top: 36, right: 10, width: 2, height: 2, opacity: 0.05 }]} />

                            {/* Subtle ray patterns (ejecta) */}
                            <View style={[styles.moonRay, { top: 12, left: 20, width: 1, height: 8, transform: [{ rotate: '25deg' }] }]} />
                            <View style={[styles.moonRay, { top: 26, left: 48, width: 1, height: 6, transform: [{ rotate: '-35deg' }] }]} />
                            <View style={[styles.moonRay, { bottom: 30, right: 18, width: 1, height: 7, transform: [{ rotate: '15deg' }] }]} />

                            {/* Subtle Highlight on Lit Side */}
                            <View style={styles.moonHighlight} />

                            {/* Terminator Shadow (Crescent Effect) */}
                            <View style={styles.moonShadow} />
                        </View>
                        {/* Atmospheric Glow — pulses when gate is open */}
                        <Animated.View style={[styles.moonAura, { borderColor: isGateOpen ? colors.accent + 'BB' : 'rgba(248, 250, 252, 0.25)' }, moonAura1Style]} />
                        <Animated.View style={[styles.moonAura, { width: 152, height: 152, borderRadius: 76, borderColor: isGateOpen ? colors.accent + '55' : 'rgba(255, 255, 255, 0.15)' }, moonAura2Style]} />

                        {/* Star sparkles — visible only when gate is open */}
                        <Animated.View style={[styles.starDot,   { top: 6,  left: 6  }, s1Style]} />
                        <Animated.View style={[styles.starDot,   { top: 14, right: 4 }, s2Style]} />
                        <Animated.View style={[styles.starDotSm, { bottom: 10, left: 16 }, s3Style]} />
                        <Animated.View style={[styles.starDot,   { bottom: 4, right: 14 }, s4Style]} />
                        <Animated.View style={[styles.starDotSm, { top: 32,  left: 0  }, s5Style]} />
                    </View>

                    <View style={styles.heroContent}>
                        {/*
                          Caps + shrink-to-fit on the hero text so the layout
                          stays intact for users with iOS "Larger Text"
                          accessibility setting enabled — otherwise the 30pt
                          title scales up, wraps to 3+ lines, overflows the
                          fixed-height portal, and pushes the moon + badge
                          around the box (seen on some users' devices).
                        */}
                        <Text
                            style={[styles.heroSubtitle, { color: colors.accent }]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            maxFontSizeMultiplier={1.2}
                        >
                            {t('home.tonightsJourney')}
                        </Text>
                        <Text
                            style={styles.heroTitle}
                            numberOfLines={2}
                            adjustsFontSizeToFit
                            minimumFontScale={0.6}
                            maxFontSizeMultiplier={1.2}
                        >
                            {t('home.enterSilent')}
                        </Text>
                        <Animated.View style={[styles.heroBadge, isGateOpen && styles.heroBadgeOpen, badgeGlowStyle]}>
                            <View style={[styles.pulseDot, isGateOpen && styles.pulseDotActive]} />
                            <Text
                                style={[styles.heroBadgeText, { color: isGateOpen ? colors.accent : '#64748b' }]}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                maxFontSizeMultiplier={1.2}
                            >
                                {isGateOpen
                                    ? t('home.gateOpen')
                                    : nightCalc
                                        ? (currentTime >= nightCalc.nightStart && currentTime < nightCalc.lastThirdStart
                                            ? t('home.gateOpens', { time: format(nightCalc.lastThirdStart, 'h:mm a') })
                                            : t('home.gateClosed'))
                                        : t('home.calculating')}
                            </Text>
                        </Animated.View>
                    </View>
                </Animated.View>

                {/* Bento Grid Layout */}
                <View style={styles.bentoContainer}>
                    {/* Large Card: Night Calculator */}
                    <Animated.View
                        entering={fadeIn(200)}
                        style={[styles.bentoCard, styles.bentoCardLarge]}
                    >
                        <BlurView intensity={Math.round(15 * blurIntensity)} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />
                        <NightCalculator onNightCalcReady={setNightCalc} onPrayerTimesReady={setPrayerTimes} refreshKey={refreshKey} />
                    </Animated.View>

                    {/* Prayer countdown */}
                    {prayerTimes && (
                        <Animated.View
                            entering={fadeIn(350)}
                            style={styles.fullWidthCard}
                        >
                            <PrayerCountdown prayerTimes={prayerTimes} />
                        </Animated.View>
                    )}

                    {/* Accountability Partner */}
                    <Animated.View entering={fadeIn(350)}>
                        <AccountabilityPartnerCard />
                    </Animated.View>

                    {/* Tasbeeh — full width */}
                    <Animated.View
                        entering={fadeIn(400)}
                        style={styles.fullWidthCard}
                    >
                        <TasbeehCard />
                    </Animated.View>

                    {/* Dua Network */}
                    <Animated.View
                        entering={fadeIn(600)}
                        style={[styles.bentoCard, styles.bentoCardLarge]}
                    >
                        <BlurView intensity={Math.round(20 * blurIntensity)} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: cardBg }]} />
                        <DuaNetwork />
                    </Animated.View>

                    {/* Bedtime intelligence — only renders if user enabled it in Settings */}
                    <Animated.View entering={fadeIn(680)}>
                        <BedtimeCard nightCalc={nightCalc} />
                    </Animated.View>

                    {/* Eid greeting — only renders on Eid al-Fitr / al-Adha */}
                    <EidCard />

                    {/* Friday Surah Al-Kahf — only renders on Fridays */}
                    <FridayKahfCard
                        onOpenKahf={() => {
                            const { switchToTab, requestOpen } = require('../App');
                            requestOpen({ kind: 'surah', surahNumber: 18 });
                            switchToTab('Quran');
                        }}
                    />

                    {/* Auto-rotating weekly + monthly challenges */}
                    <Animated.View entering={fadeIn(690)}>
                        <ChallengesCard />
                    </Animated.View>

                    {/* 40-night Tahajjud challenge */}
                    <Animated.View entering={fadeIn(700)}>
                        <TahajjudChallengeCard />
                    </Animated.View>

                    {/* Verse of the day — rotates daily, deep-links into surah on tap */}
                    <Animated.View entering={fadeIn(750)}>
                        <VerseOfTheDay
                            onOpenSurah={(surahNumber) => {
                                const { switchToTab, requestOpen } = require('../App');
                                requestOpen({ kind: 'surah', surahNumber });
                                switchToTab('Quran');
                            }}
                        />
                    </Animated.View>

                    {/* Horizontal: Hadith Carousel / Cards */}
                    <Animated.View entering={fadeIn(800)} style={styles.hadithCarousel}>
                        <HadithCard
                            text="The Lord descends every night to the lowest heaven when one-third of the night remains..."
                            source="Bukhari 1145"
                        />
                    </Animated.View>

                </View>
            </ScrollView>

            <Modal
                visible={isSettingsVisible}
                animationType="slide"
                presentationStyle="fullScreen"
                onRequestClose={() => {
                    setIsSettingsVisible(false);
                    setRefreshKey(prev => prev + 1);
                }}
            >
                <SettingsScreen onClose={() => {
                    setIsSettingsVisible(false);
                    setRefreshKey(prev => prev + 1);
                }} />
            </Modal>

        </SafeAreaView >
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
    contentContainer: {
        paddingBottom: 150, // Space for floating tab bar
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingTop: 30,
        paddingBottom: 40,
    },
    dateText: {
        fontSize: 12,
        color: '#facc15', // Fallback
        textTransform: 'uppercase',
        letterSpacing: 2,
        marginBottom: 8,
        fontWeight: '900',
    },
    greetingText: {
        fontSize: 16,
        color: '#94a3b8', // Stardust Grey
        fontWeight: '600',
    },
    nameText: {
        fontSize: 34,
        fontWeight: '900',
        color: '#f8fafc', // Moonlight White
        marginTop: 4,
        letterSpacing: -0.5,
    },
    settingsButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
    },
    heroPortal: {
        marginHorizontal: 20,
        height: 220,
        borderRadius: 40,
        overflow: 'hidden',
        flexDirection: 'row',
        alignItems: 'center',
        padding: 24,
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        marginBottom: 24,
        shadowColor: '#06b6d4',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 0,
    },
    moonContainer: {
        width: 110,
        height: 110,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 20,
    },
    moon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'transparent',
        shadowColor: '#ffffff',
        shadowRadius: 30,
        shadowOpacity: 0.5,
        elevation: 0,
    },
    moonCrater: {
        position: 'absolute',
        borderRadius: 50,
        backgroundColor: 'rgba(0,0,0,0.06)',
    },
    moonSea: {
        position: 'absolute',
        backgroundColor: 'rgba(15, 23, 42, 0.08)',
        borderRadius: 40,
    },
    craterOuter: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
    },
    craterHighlight: {
        position: 'absolute',
        borderRadius: 50,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
    },
    moonHighlight: {
        position: 'absolute',
        top: 8,
        left: 8,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    moonRay: {
        position: 'absolute',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 0.5,
    },
    moonShadow: {
        position: 'absolute',
        width: 85,
        height: 85,
        borderRadius: 42.5,
        backgroundColor: 'rgba(2, 6, 23, 0.25)',
        top: -5,
        right: -25,
    },
    moonAura: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 1,
        borderColor: 'rgba(248, 250, 252, 0.1)',
        opacity: 0.4,
    },
    heroContent: {
        flex: 1,
        alignItems: 'flex-start',
    },
    heroSubtitle: {
        fontSize: 12,
        color: '#facc15', // Fallback
        textTransform: 'uppercase',
        letterSpacing: 2.5,
        fontWeight: '900',
        marginBottom: 4,
    },
    heroTitle: {
        fontSize: 30,
        fontWeight: '900',
        color: '#f8fafc', // Moonlight White
        marginBottom: 12,
        letterSpacing: -0.5,
    },
    heroBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(248, 250, 252, 0.08)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 8,
        borderWidth: 1,
        borderColor: 'transparent',
        shadowColor: '#ffffff',
        shadowOffset: { width: 0, height: 0 },
    },
    heroBadgeOpen: {
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    starDot: {
        position: 'absolute',
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: '#e2e8f0',
    },
    starDotSm: {
        position: 'absolute',
        width: 2,
        height: 2,
        borderRadius: 1,
        backgroundColor: '#e2e8f0',
    },
    pulseDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#475569',
    },
    pulseDotActive: {
        backgroundColor: '#f8fafc',
    },
    heroBadgeText: {
        color: '#facc15', // Fallback
        fontSize: 12,
        fontWeight: '900',
    },
    bentoContainer: {
        paddingHorizontal: 20,
        gap: 16,
    },
    bentoCard: {
        borderRadius: 32,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
    },
    bentoCardContent: {
        flex: 1,
    },
    bentoCardLarge: {
        padding: 0,
    },
    bentoRow: {
        flexDirection: 'row',
        gap: 16,
    },
    bentoCardSquare: {
        flex: 1,
        aspectRatio: 0.9, // Even taller for more space
        justifyContent: 'center',
        padding: 0,
    },
    hadithCarousel: {
        marginTop: 8, // Added space above
        marginBottom: 16,
    },
    fullWidthCard: {
        marginBottom: 16,
    }
});
