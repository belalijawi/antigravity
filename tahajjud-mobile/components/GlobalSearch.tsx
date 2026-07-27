import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
    SectionList, ActivityIndicator, Platform, Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Search, X, BookOpen, Heart, ScrollText, Moon, LayoutGrid } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { duaDatabase, Dua } from '../data/duas';
import { relatedTerms } from '../utils/synonyms';
import { QuranService, SurahMeta } from '../services/QuranService';
import { TahajjudJournal, JournalEntry } from '../utils/tahajjudJournal';
import { getPersonalDuas, PersonalDua } from '../utils/personalDuas';
import { t } from '../utils/i18n';

interface Props { visible: boolean; onClose: () => void; onResultPress?: (result: SearchResult) => void; }

type SearchResult =
    | { kind: 'surah'; surah: SurahMeta }
    | { kind: 'dua'; dua: Dua }
    | { kind: 'letter'; letter: PersonalDua }
    | { kind: 'journal'; entry: JournalEntry }
    | { kind: 'verse'; surahNumber: number; ayahNumber: number }
    | { kind: 'tab'; tabName: 'Home' | 'Guide' | 'Duas' | 'Quran' | 'Prayers'; label: string; subtitle: string };

// Top-level destinations the user can search for by name ("quran", "duas",
// "prayers", "qibla", "home"). Matched on any of the aliases (kept in English
// since these are internal search-matching keywords, not displayed text).
const TAB_DESTINATIONS: { tabName: 'Home' | 'Guide' | 'Duas' | 'Quran' | 'Prayers'; aliases: string[] }[] = [
    { tabName: 'Home',    aliases: ['home', 'tahajjud', 'gate', 'tonight'] },
    { tabName: 'Quran',   aliases: ['quran', 'koran', 'mushaf', 'surah', 'surahs', 'recitation', 'reciter', 'audio'] },
    { tabName: 'Duas',    aliases: ['dua', 'duas', 'dhikr', 'wall', 'letter', 'letters', 'tasbeeh', 'tasbih', 'hifz', 'memorise', 'memorize'] },
    { tabName: 'Prayers', aliases: ['prayer', 'prayers', 'salah', 'salat', 'tracker', 'history', 'qibla', 'compass'] },
    { tabName: 'Guide',   aliases: ['guide', 'why', 'hadith', 'hadiths', 'learn', 'sources', 'methodology', 'about'] },
];

function tabLabel(tabName: 'Home' | 'Guide' | 'Duas' | 'Quran' | 'Prayers'): string {
    switch (tabName) {
        case 'Home': return t('globalSearch.tabHome');
        case 'Quran': return t('globalSearch.tabQuran');
        case 'Duas': return t('globalSearch.tabDuas');
        case 'Prayers': return t('globalSearch.tabPrayers');
        case 'Guide': return t('globalSearch.tabGuide');
    }
}
function tabSubtitle(tabName: 'Home' | 'Guide' | 'Duas' | 'Quran' | 'Prayers'): string {
    switch (tabName) {
        case 'Home': return t('globalSearch.tabHomeSub');
        case 'Quran': return t('globalSearch.tabQuranSub');
        case 'Duas': return t('globalSearch.tabDuasSub');
        case 'Prayers': return t('globalSearch.tabPrayersSub');
        case 'Guide': return t('globalSearch.tabGuideSub');
    }
}

const VERSE_REF_REGEX = /^\s*(\d{1,3})\s*:\s*(\d{1,3})\s*$/;

// Same normalize/subsequence/plural/"al-" tolerance the Duas tab and Quran
// tab searches already use — Global Search used to have its own weaker,
// duplicated copy of this logic with no subsequence fallback at all, so
// typing "ftha" found nothing here even though the in-tab Quran search
// (which does have a subsequence fallback) happily finds Al-Fatiha with it.
// Safe to reuse the more capable version here too: Global Search already
// restricts matching to short identifying fields (names/titles), never long
// free text — the false-positive risk a subsequence fallback would pose only
// applies to long body text, which this never searches against.
function normalize(s: string): string {
    return s.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // strip Latin diacritics
        .replace(/[\u064b-\u065f\u0670\u06d6-\u06ed]/g, '')  // strip Arabic diacritics/tashkeel
        .replace(/[^a-z0-9\u0600-\u06ff]/g, '');             // strip punctuation, keep Arabic script
}

// English plural \u2192 singular tolerance for short queries.
// "duas" \u2192 "dua", "ayahs" \u2192 "ayah". Min length 4 so we don't kill
// real names like "yas" or "us".
function stripPlural(s: string): string {
    return s.length >= 4 && s.endsWith('s') ? s.slice(0, -1) : s;
}

// Returns true if every char of needle appears in haystack in order — lets
// "ftha" match "fatiha", "mlk" match "mulk".
function isSubsequence(needle: string, haystack: string): boolean {
    let i = 0;
    for (let j = 0; i < needle.length && j < haystack.length; j++) {
        if (needle[i] === haystack[j]) i++;
    }
    return i === needle.length;
}

// Drop the leading "al" article so "alfatiha" and "fatiha" both work
// regardless of which side it's on.
function dropAl(s: string): string {
    return s.startsWith('al') && s.length > 3 ? s.slice(2) : s;
}

function fuzzyMatch(haystack: string, needle: string): boolean {
    const h = normalize(haystack);
    const n = normalize(needle);
    if (!n || !h) return false;
    if (n.length < 2) return false; // single-letter queries are too noisy
    // Try the query as-is and with a trailing "s" stripped so plural
    // queries ("duas") still match singular content ("dua").
    const variants = new Set<string>([n, dropAl(n), stripPlural(n), dropAl(stripPlural(n))]);
    const hs = dropAl(h);
    for (const v of variants) {
        if (!v) continue;
        if (h.includes(v) || hs.includes(v)) return true;
        if (isSubsequence(v, hs) || isSubsequence(v, h)) return true;
    }
    return false;
}

export function GlobalSearch({ visible, onClose, onResultPress }: Props) {
    const { colors } = useTheme();
    const [query, setQuery] = useState('');
    const [surahs, setSurahs] = useState<SurahMeta[]>([]);
    const [letters, setLetters] = useState<PersonalDua[]>([]);
    const [journal, setJournal] = useState<JournalEntry[]>([]);
    const [loaded, setLoaded] = useState(false);

    // Load search corpus when the modal opens
    useEffect(() => {
        if (!visible) return;
        (async () => {
            const [s, l, j] = await Promise.all([
                QuranService.getSurahList(),
                getPersonalDuas(),
                TahajjudJournal.getAll(),
            ]);
            setSurahs(s);
            setLetters(l);
            setJournal(j);
            setLoaded(true);
        })();
    }, [visible]);

    // Reset query when closing
    useEffect(() => { if (!visible) setQuery(''); }, [visible]);

    const sections = useMemo(() => {
        const q = query.trim();
        if (!q) return [];

        // Direct verse reference like "67:1" — special section first.
        // Validate against actual surah length so "67:67" (Al-Mulk has 30
        // ayahs) doesn't silently scroll to the last ayah.
        const verseMatch = q.match(VERSE_REF_REGEX);
        let verseSection: SearchResult[] = [];
        if (verseMatch) {
            const sNum = parseInt(verseMatch[1], 10);
            const aNum = parseInt(verseMatch[2], 10);
            const surahMeta = surahs.find(s => s.number === sNum);
            if (surahMeta && aNum >= 1 && aNum <= surahMeta.numberOfAyahs) {
                verseSection = [{ kind: 'verse', surahNumber: sNum, ayahNumber: aNum }];
            }
        }

        // Each category only matches against its IDENTIFYING fields (names,
        // titles, categories) — never against long free-form body text like
        // translations or notes. That way "fatiha" surfaces Surah Al-Fatiha
        // and not random duas that mention "fatiha" in a translation sentence.
        const surahHits: SearchResult[] = surahs
            .filter(s =>
                fuzzyMatch(s.englishName, q)
                || fuzzyMatch(s.englishNameTranslation ?? '', q)
                // Arabic name (e.g. "الفاتحة") — the in-tab Quran search already
                // matched against this field; Global Search was missing it.
                || fuzzyMatch(s.name ?? '', q)
                || String(s.number) === q
            )
            .slice(0, 10)
            .map(s => ({ kind: 'surah', surah: s }));

        // Dua search expands the query to all related topics — "money" pulls
        // in "wealth/rizq/provision/finance" so the right duas surface even
        // when the user doesn't know the exact category label.
        const queryVariants = relatedTerms(q);
        const duaHits: SearchResult[] = duaDatabase
            .filter(d => queryVariants.some(v => fuzzyMatch(d.title, v) || fuzzyMatch(d.category, v)))
            .slice(0, 10)
            .map(d => ({ kind: 'dua', dua: d }));

        const letterHits: SearchResult[] = letters
            .filter(l => fuzzyMatch(l.title, q))
            .slice(0, 10)
            .map(l => ({ kind: 'letter', letter: l }));

        // Journal: match on the mood/state ("grateful", "anxious"…) and the
        // date — not the free-form dua text, which is too noisy.
        const journalHits: SearchResult[] = journal
            .filter(e => fuzzyMatch(e.state, q) || fuzzyMatch(e.date, q))
            .slice(0, 10)
            .map(e => ({ kind: 'journal', entry: e }));

        // Tab destinations — surfaces "Open Quran tab" when user types "quran",
        // etc. Matches any alias substring after normalizing.
        const tabHits: SearchResult[] = TAB_DESTINATIONS
            .filter(dest => dest.aliases.some(a => fuzzyMatch(a, q)))
            .map(dest => ({ kind: 'tab', tabName: dest.tabName, label: tabLabel(dest.tabName), subtitle: tabSubtitle(dest.tabName) }));

        const out: { title: string; data: SearchResult[] }[] = [];
        if (verseSection.length) out.push({ title: t('globalSearch.goToVerse'), data: verseSection });
        if (tabHits.length) out.push({ title: t('globalSearch.sections'), data: tabHits });
        if (surahHits.length) out.push({ title: t('globalSearch.tabQuran'), data: surahHits });
        if (duaHits.length) out.push({ title: t('globalSearch.tabDuas'), data: duaHits });
        if (letterHits.length) out.push({ title: t('globalSearch.yourLetters'), data: letterHits });
        if (journalHits.length) out.push({ title: t('globalSearch.journal'), data: journalHits });
        return out;
    }, [query, surahs, letters, journal]);

    const renderItem = useCallback(({ item }: { item: SearchResult }) => {
        const onPress = () => {
            onResultPress?.(item);
            onClose();
        };
        if (item.kind === 'tab') {
            return (
                <TouchableOpacity style={styles.row} onPress={onPress}>
                    <View style={[styles.icon, { backgroundColor: colors.accent + '22', borderColor: colors.accent + '44' }]}>
                        <LayoutGrid size={14} color={colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.rowTitle, { color: colors.primaryText }]} numberOfLines={1}>
                            {t('globalSearch.openLabel', { label: item.label })}
                        </Text>
                        <Text style={[styles.rowSub, { color: colors.secondaryText }]} numberOfLines={1}>
                            {item.subtitle}
                        </Text>
                    </View>
                </TouchableOpacity>
            );
        }
        if (item.kind === 'verse') {
            return (
                <TouchableOpacity style={styles.row} onPress={onPress}>
                    <View style={[styles.icon, { backgroundColor: colors.accent + '22', borderColor: colors.accent + '44' }]}>
                        <BookOpen size={14} color={colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.rowTitle, { color: colors.primaryText }]}>
                            {t('globalSearch.surahAyah', { surah: item.surahNumber, ayah: item.ayahNumber })}
                        </Text>
                        <Text style={[styles.rowSub, { color: colors.secondaryText }]}>{t('globalSearch.openInReader')}</Text>
                    </View>
                </TouchableOpacity>
            );
        }
        if (item.kind === 'surah') {
            return (
                <TouchableOpacity style={styles.row} onPress={onPress}>
                    <View style={[styles.icon, { backgroundColor: colors.accent + '15' }]}>
                        <BookOpen size={14} color={colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.rowTitle, { color: colors.primaryText }]}>
                            {item.surah.number}. {item.surah.englishName}
                        </Text>
                        <Text style={[styles.rowSub, { color: colors.secondaryText }]}>
                            {item.surah.englishNameTranslation} · {t('hifzTab.ayahsCount', { n: item.surah.numberOfAyahs })}
                        </Text>
                    </View>
                </TouchableOpacity>
            );
        }
        if (item.kind === 'dua') {
            return (
                <TouchableOpacity style={styles.row} onPress={onPress}>
                    <View style={[styles.icon, { backgroundColor: colors.accent + '15' }]}>
                        <ScrollText size={14} color={colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.rowTitle, { color: colors.primaryText }]} numberOfLines={1}>{item.dua.title}</Text>
                        <Text style={[styles.rowSub, { color: colors.secondaryText }]} numberOfLines={1}>
                            {item.dua.category}
                        </Text>
                    </View>
                </TouchableOpacity>
            );
        }
        if (item.kind === 'letter') {
            return (
                <TouchableOpacity style={styles.row} onPress={onPress}>
                    <View style={[styles.icon, { backgroundColor: colors.accent + '15' }]}>
                        <Heart size={14} color={colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.rowTitle, { color: colors.primaryText }]} numberOfLines={1}>{item.letter.title}</Text>
                        <Text style={[styles.rowSub, { color: colors.secondaryText }]} numberOfLines={1}>
                            {item.letter.translation?.slice(0, 60) ?? t('globalSearch.personalLetter')}
                        </Text>
                    </View>
                </TouchableOpacity>
            );
        }
        // journal
        return (
            <TouchableOpacity style={styles.row} onPress={onPress}>
                <View style={[styles.icon, { backgroundColor: colors.accent + '15' }]}>
                    <Moon size={14} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, { color: colors.primaryText }]} numberOfLines={1}>{item.entry.date}</Text>
                    <Text style={[styles.rowSub, { color: colors.secondaryText }]} numberOfLines={2}>
                        {item.entry.duaText.slice(0, 100)}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    }, [colors, onResultPress, onClose]);

    return (
        <Modal visible={visible} animationType="fade" presentationStyle="overFullScreen" transparent onRequestClose={onClose}>
            <LinearGradient colors={['rgba(2,6,23,0.97)', 'rgba(8,12,30,0.99)']} style={styles.root}>
                <View style={styles.header}>
                    <View style={[styles.searchBox, { borderColor: colors.accent + '40' }]}>
                        <Search size={16} color={colors.secondaryText} />
                        <TextInput
                            value={query}
                            onChangeText={setQuery}
                            autoFocus
                            placeholder={t('globalSearch.searchPlaceholder')}
                            placeholderTextColor="#475569"
                            style={[styles.searchInput, { color: colors.primaryText }]}
                            returnKeyType="search"
                            // Cap font scaling so iOS "Larger Text" can't make
                            // the text bigger than the input row, which was
                            // clipping the bottom of descenders (y, g, p, j).
                            maxFontSizeMultiplier={1.2}
                        />
                        {query.length > 0 && (
                            <TouchableOpacity onPress={() => setQuery('')}>
                                <X size={16} color={colors.secondaryText} />
                            </TouchableOpacity>
                        )}
                    </View>
                    <TouchableOpacity
                        onPressIn={() => { Keyboard.dismiss(); onClose(); }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Text
                            style={[styles.cancel, { color: colors.accent }]}
                            maxFontSizeMultiplier={1.2}
                        >
                            {t('btn.cancel')}
                        </Text>
                    </TouchableOpacity>
                </View>

                {!loaded ? (
                    <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
                ) : query.trim().length === 0 ? (
                    <View style={styles.hint}>
                        <Text style={[styles.hintTitle, { color: colors.primaryText }]}>{t('globalSearch.searchAnything')}</Text>
                        <Text style={[styles.hintBody, { color: colors.secondaryText }]}>
                            {t('globalSearch.hintBody')}
                        </Text>
                    </View>
                ) : sections.length === 0 ? (
                    <View style={styles.hint}>
                        <Text style={[styles.hintTitle, { color: colors.secondaryText }]}>{t('globalSearch.noResults')}</Text>
                    </View>
                ) : (
                    <SectionList
                        sections={sections}
                        keyExtractor={(item, idx) => `${item.kind}-${idx}`}
                        renderItem={renderItem}
                        renderSectionHeader={({ section }) => (
                            <Text style={[styles.sectionHeader, { color: colors.accent }]}>
                                {section.title.toUpperCase()}
                            </Text>
                        )}
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={{ paddingBottom: 60 }}
                    />
                )}
            </LinearGradient>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, paddingTop: Platform.OS === 'ios' ? 56 : 24 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
    searchBox: {
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1,
        borderRadius: 14, paddingHorizontal: 14,
        // Bumped vertical padding (was 10) and added an explicit minHeight
        // so descender letters (y, g, p) aren't clipped by a too-tight row.
        paddingVertical: 12, minHeight: 44,
    },
    // lineHeight = 22 gives ~7px of room under the baseline for descenders;
    // pairs with the bumped searchBox padding above.
    searchInput: { flex: 1, fontSize: 15, lineHeight: 22, fontWeight: '500' },
    cancel: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
    sectionHeader: {
        fontSize: 11, fontWeight: '800', letterSpacing: 1.5,
        paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8,
    },
    row: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingVertical: 12, paddingHorizontal: 20,
    },
    icon: {
        width: 32, height: 32, borderRadius: 16,
        alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent',
    },
    rowTitle: { fontSize: 14, fontWeight: '700' },
    rowSub: { fontSize: 12, marginTop: 2 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    hint: { padding: 30, alignItems: 'center' },
    hintTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
    hintBody: { fontSize: 13, textAlign: 'center', lineHeight: 22 },
});
