/**
 * Topic synonyms / related terms for dua search.
 *
 * Lets a user type "money" and find duas in the "Wealth" category;
 * "stress" and find Anxiety duas; "school" and find Knowledge duas.
 *
 * Keys are normalized (lowercase, alphanumeric only). Values are the
 * related terms to also search against. The relationship is intentionally
 * symmetric — if "money" → ["wealth"], then "wealth" → [...] should also
 * include "money" if we want the inverse to work.
 *
 * Used by GlobalSearch and DuasTab.
 */

const RAW: Record<string, string[]> = {
    // ── Wealth / money / rizq ──
    money: ['wealth', 'rizq', 'sustenance', 'provision', 'income', 'finance', 'financial', 'salary', 'cash', 'debt'],
    wealth: ['money', 'rizq', 'sustenance', 'provision', 'finance', 'prosperity', 'barakah'],
    rizq: ['wealth', 'money', 'sustenance', 'provision', 'halal'],
    sustenance: ['wealth', 'money', 'rizq', 'provision'],
    provision: ['wealth', 'rizq', 'sustenance', 'money'],
    debt: ['money', 'wealth', 'finance', 'loan'],
    halal: ['wealth', 'money', 'rizq'],
    business: ['wealth', 'work', 'money', 'success', 'job'],

    // ── Anxiety / stress / sadness ──
    anxiety: ['worry', 'fear', 'stress', 'panic', 'sad', 'sadness', 'depression', 'peace', 'calm'],
    worry: ['anxiety', 'fear', 'stress', 'concern'],
    stress: ['anxiety', 'worry', 'pressure'],
    fear: ['anxiety', 'worry', 'protection', 'scared'],
    scared: ['fear', 'anxiety', 'protection'],
    depression: ['sadness', 'anxiety', 'grief', 'sad'],
    sad: ['sadness', 'grief', 'anxiety', 'depression'],
    sadness: ['sad', 'grief', 'anxiety', 'depression'],
    peace: ['anxiety', 'calm', 'tranquility', 'sakinah'],
    calm: ['peace', 'anxiety', 'tranquility'],

    // ── Forgiveness / sin / repentance ──
    forgive: ['forgiveness', 'tawbah', 'istighfar', 'mercy', 'sin', 'repent', 'repentance'],
    forgiveness: ['tawbah', 'istighfar', 'mercy', 'sin', 'repent', 'repentance', 'forgive'],
    tawbah: ['forgiveness', 'repent', 'repentance', 'istighfar', 'sin'],
    istighfar: ['forgiveness', 'tawbah', 'repent', 'repentance', 'sin'],
    repent: ['forgiveness', 'tawbah', 'istighfar', 'sin', 'repentance'],
    repentance: ['forgiveness', 'tawbah', 'istighfar', 'sin', 'repent'],
    sin: ['forgiveness', 'tawbah', 'repent', 'repentance', 'istighfar', 'temptation', 'mistake'],
    mercy: ['forgiveness', 'rahmah', 'compassion'],
    rahmah: ['mercy', 'forgiveness', 'compassion'],

    // ── Gratitude / thankfulness ──
    thanks: ['gratitude', 'shukr', 'thankful', 'alhamdulillah'],
    thankful: ['gratitude', 'shukr', 'thanks', 'alhamdulillah'],
    gratitude: ['thanks', 'shukr', 'thankful', 'alhamdulillah'],
    shukr: ['gratitude', 'thanks', 'thankful', 'alhamdulillah'],
    alhamdulillah: ['gratitude', 'thanks', 'shukr', 'thankful', 'praise'],
    praise: ['gratitude', 'hamd', 'tasbih', 'glorify'],
    hamd: ['praise', 'gratitude', 'alhamdulillah'],

    // ── Guidance ──
    guidance: ['hidayah', 'path', 'direction', 'way', 'guide'],
    hidayah: ['guidance', 'path'],
    path: ['guidance', 'hidayah', 'way', 'direction'],
    direction: ['guidance', 'path', 'way'],
    guide: ['guidance', 'hidayah'],
    lost: ['guidance', 'hidayah', 'path', 'confused'],
    confused: ['guidance', 'lost', 'direction'],

    // ── Patience / sabr ──
    patience: ['sabr', 'endurance', 'persistence'],
    sabr: ['patience', 'endurance'],

    // ── Health / sickness / healing ──
    health: ['sick', 'illness', 'healing', 'shifa', 'recovery', 'wellness', 'ill', 'disease'],
    sick: ['health', 'illness', 'healing', 'shifa', 'ill', 'disease', 'pain'],
    illness: ['health', 'sick', 'healing', 'shifa', 'disease', 'pain'],
    ill: ['health', 'sick', 'illness'],
    disease: ['illness', 'sick', 'health', 'shifa', 'pain'],
    healing: ['health', 'shifa', 'sick', 'recovery'],
    shifa: ['healing', 'health', 'sick', 'recovery'],
    recovery: ['healing', 'health', 'shifa', 'sick'],
    pain: ['health', 'sick', 'illness', 'healing'],

    // ── Knowledge / education ──
    knowledge: ['ilm', 'learning', 'study', 'wisdom', 'education', 'exam', 'student'],
    ilm: ['knowledge', 'learning', 'wisdom'],
    learn: ['knowledge', 'ilm', 'learning', 'study'],
    learning: ['knowledge', 'ilm', 'study', 'education'],
    study: ['knowledge', 'learning', 'ilm', 'exam', 'student'],
    exam: ['knowledge', 'study', 'success', 'student'],
    school: ['knowledge', 'study', 'education', 'exam'],
    university: ['knowledge', 'study', 'education', 'exam'],
    student: ['knowledge', 'study', 'learning', 'exam'],
    education: ['knowledge', 'study', 'learning'],
    wisdom: ['knowledge', 'ilm'],

    // ── Success / work / career ──
    success: ['barakah', 'blessing', 'victory', 'prosperity', 'achievement', 'win'],
    work: ['success', 'wealth', 'job', 'career', 'business', 'money'],
    job: ['work', 'wealth', 'success', 'career', 'money'],
    career: ['work', 'job', 'success', 'wealth'],
    victory: ['success', 'win', 'triumph'],
    blessing: ['barakah', 'success', 'gratitude'],
    barakah: ['blessing', 'success', 'wealth'],

    // ── Protection / evil eye / jinn ──
    protection: ['protect', 'safety', 'evil', 'jinn', 'shaytan', 'harm', 'evil eye', 'hasad'],
    protect: ['protection', 'safety', 'shield'],
    safety: ['protection', 'safe', 'protect'],
    safe: ['safety', 'protection', 'protect'],
    evil: ['protection', 'shaytan', 'devil', 'jinn', 'sin', 'eye'],
    jinn: ['evil', 'protection', 'shaytan'],
    shaytan: ['evil', 'protection', 'devil', 'sin', 'temptation'],
    devil: ['shaytan', 'evil', 'sin', 'protection', 'temptation'],
    temptation: ['sin', 'shaytan', 'devil', 'lust', 'anger'],
    envy: ['evil eye', 'protection', 'jealousy', 'hasad'],
    jealousy: ['envy', 'evil eye', 'protection', 'hasad'],
    hasad: ['envy', 'evil eye', 'jealousy', 'protection'],

    // ── Death / afterlife / grave ──
    death: ['grief', 'loss', 'dying', 'grave', 'akhirah', 'died', 'dead'],
    die: ['death', 'dying'],
    dying: ['death', 'die', 'grief', 'grave'],
    dead: ['death', 'died', 'grief', 'loss', 'grave'],
    died: ['death', 'dead', 'grief', 'loss'],
    grave: ['death', 'dying', 'akhirah', 'qabr', 'afterlife'],
    qabr: ['grave', 'death', 'afterlife', 'akhirah'],
    akhirah: ['afterlife', 'hereafter', 'jannah', 'grave', 'death'],
    afterlife: ['akhirah', 'hereafter', 'jannah', 'grave'],
    hereafter: ['akhirah', 'afterlife', 'jannah'],
    paradise: ['jannah', 'afterlife', 'heaven'],
    heaven: ['jannah', 'paradise', 'afterlife'],
    jannah: ['paradise', 'heaven', 'afterlife', 'hereafter'],
    hell: ['jahannam', 'hellfire', 'fire', 'punishment'],
    hellfire: ['jahannam', 'hell', 'fire', 'punishment'],
    jahannam: ['hell', 'hellfire', 'fire', 'punishment'],
    grief: ['loss', 'sad', 'sadness', 'death', 'bereavement', 'sorrow'],
    loss: ['grief', 'death', 'sad', 'sadness'],
    sorrow: ['grief', 'sad', 'sadness'],

    // ── Ramadan / fasting ──
    ramadan: ['fasting', 'fast', 'iftar', 'suhoor', 'laylatul qadr', 'taraweeh', 'eid'],
    fast: ['fasting', 'ramadan', 'iftar', 'suhoor'],
    fasting: ['ramadan', 'fast', 'iftar', 'suhoor'],
    iftar: ['fasting', 'ramadan', 'suhoor'],
    suhoor: ['fasting', 'ramadan', 'iftar'],
    taraweeh: ['ramadan', 'salah', 'prayer'],
    eid: ['ramadan', 'celebration'],

    // ── Prayer / salah / worship ──
    prayer: ['salah', 'namaz', 'worship', 'dua', 'supplication', 'pray'],
    pray: ['prayer', 'salah', 'namaz', 'dua', 'supplication', 'worship'],
    salah: ['prayer', 'namaz', 'worship', 'pray'],
    namaz: ['salah', 'prayer', 'worship', 'pray'],
    worship: ['prayer', 'salah', 'namaz', 'ibadah', 'dua', 'pray'],
    ibadah: ['worship', 'prayer', 'salah', 'dua'],
    dua: ['supplication', 'prayer', 'pray', 'asking'],
    supplication: ['dua', 'prayer', 'asking', 'pray'],
    dhikr: ['remembrance', 'tasbih', 'adhkar', 'morning', 'evening'],
    adhkar: ['dhikr', 'remembrance', 'morning', 'evening', 'daily', 'routine'],
    remembrance: ['dhikr', 'adhkar'],
    tasbih: ['dhikr', 'remembrance', 'praise'],
    tahajjud: ['prayer', 'salah', 'qiyam', 'night'],
    qiyam: ['tahajjud', 'prayer', 'salah', 'night'],
    witr: ['prayer', 'salah', 'night'],
    fajr: ['prayer', 'salah', 'morning'],
    dhuhr: ['prayer', 'salah'],
    asr: ['prayer', 'salah'],
    maghrib: ['prayer', 'salah', 'evening', 'sunset'],
    isha: ['prayer', 'salah', 'night', 'evening'],

    // ── Daily routine / time of day ──
    morning: ['adhkar', 'dhikr', 'daily', 'fajr', 'wake', 'sunrise'],
    evening: ['adhkar', 'dhikr', 'daily', 'maghrib', 'isha', 'sunset', 'night'],
    night: ['sleep', 'bedtime', 'evening', 'tahajjud', 'isha'],
    sleep: ['bedtime', 'night', 'dream', 'dreams', 'waking'],
    bedtime: ['sleep', 'night'],
    dream: ['sleep', 'nightmare', 'dreams'],
    dreams: ['dream', 'sleep'],
    nightmare: ['dream', 'sleep', 'protection'],
    wake: ['waking', 'morning'],
    waking: ['wake', 'morning'],
    sunrise: ['morning', 'fajr'],
    sunset: ['evening', 'maghrib'],

    // ── Food / drink / meals ──
    food: ['eating', 'drink', 'meal', 'sustenance'],
    eating: ['food', 'meal'],
    meal: ['food', 'eating', 'drink'],
    drink: ['food', 'water', 'thirst'],
    water: ['drink', 'thirst'],
    thirst: ['drink', 'water'],

    // ── Family ──
    family: ['parents', 'mother', 'father', 'children', 'kids', 'spouse', 'marriage'],
    parents: ['mother', 'father', 'family', 'mom', 'dad'],
    mother: ['mom', 'parents', 'family'],
    mom: ['mother', 'parents', 'family'],
    father: ['dad', 'parents', 'family'],
    dad: ['father', 'parents', 'family'],
    children: ['kids', 'family', 'child'],
    kids: ['children', 'family', 'child'],
    child: ['children', 'kids', 'family'],
    spouse: ['husband', 'wife', 'marriage', 'family'],
    husband: ['spouse', 'marriage', 'family', 'wife'],
    wife: ['spouse', 'marriage', 'family', 'husband'],
    marriage: ['spouse', 'family', 'husband', 'wife', 'nikah'],
    nikah: ['marriage', 'spouse'],

    // ── Friends / community ──
    friend: ['friends', 'friendship', 'companion'],
    friends: ['friend', 'friendship', 'companion'],
    friendship: ['friend', 'friends', 'brotherhood', 'sisterhood'],
    ummah: ['muslims', 'community', 'brotherhood', 'sisterhood', 'unity', 'people'],
    community: ['ummah', 'brotherhood', 'sisterhood', 'people'],
    brotherhood: ['ummah', 'community', 'unity'],
    sisterhood: ['ummah', 'community', 'unity'],

    // ── Travel ──
    travel: ['journey', 'trip', 'road', 'flight', 'plane', 'car', 'drive'],
    journey: ['travel', 'trip', 'road'],
    trip: ['travel', 'journey'],
    flight: ['travel', 'journey', 'plane'],
    plane: ['travel', 'journey', 'flight'],
    car: ['travel', 'drive'],
    drive: ['travel', 'car'],

    // ── Love / mercy ──
    love: ['muhabbah', 'affection', 'compassion'],
    muhabbah: ['love'],

    // ── Anger ──
    anger: ['rage', 'temptation', 'sin', 'patience'],
    rage: ['anger'],

    // ── Ruqyah / healing recitation ──
    ruqyah: ['healing', 'protection', 'evil eye', 'shifa', 'recitation', 'sick'],

    // ── Morning & Evening adhkar ──
    sayyid: ['istighfar', 'forgiveness'],
    asbahna: ['morning'],
    amsayna: ['evening'],

    // ── Gratitude / shukr ──
    accept: ['gratitude', 'dua', 'accepted', 'taqabbal'],
    accepted: ['accept', 'gratitude', 'taqabbal'],
    taqabbal: ['accept', 'accepted', 'gratitude'],

    // ── Success / ease ──
    ease: ['success', 'difficulty', 'hardship', 'easy'],
    difficult: ['ease', 'hardship', 'success', 'anxiety'],
    hardship: ['ease', 'difficult', 'anxiety', 'sabr', 'patience'],
    task: ['success', 'work', 'exam', 'ease'],

    // ── Knowledge ──
    memory: ['knowledge', 'study', 'learning', 'quran'],
    understand: ['knowledge', 'ilm', 'wisdom', 'study'],
    beneficial: ['knowledge', 'ilm', 'shukr'],

    // ── Protection specifics ──
    marketplace: ['protection', 'travel', 'work'],
    sleeping: ['sleep', 'protection', 'night', 'bedtime'],
    enter: ['protection', 'travel', 'daily'],

    // ── Evil eye specifics ──
    nazar: ['evil eye', 'protection', 'hasad', 'envy'],
    admire: ['evil eye', 'protection', 'jealousy'],
    jealous: ['evil eye', 'jealousy', 'envy', 'hasad', 'protection'],
};

// Build a normalized lookup with bidirectional links and self-inclusion.
const SYNONYM_MAP: Record<string, string[]> = {};
for (const [key, vals] of Object.entries(RAW)) {
    const k = key.toLowerCase();
    SYNONYM_MAP[k] = [k, ...vals.map(v => v.toLowerCase())];
    // Make reverse links — if "money" → "wealth", then "wealth" → "money" too.
    for (const v of vals) {
        const vk = v.toLowerCase();
        if (!SYNONYM_MAP[vk]) SYNONYM_MAP[vk] = [vk];
        if (!SYNONYM_MAP[vk].includes(k)) SYNONYM_MAP[vk].push(k);
        for (const v2 of vals) {
            const v2k = v2.toLowerCase();
            if (v2k !== vk && !SYNONYM_MAP[vk].includes(v2k)) SYNONYM_MAP[vk].push(v2k);
        }
    }
}

/**
 * Returns the query plus all its related terms. Always includes the original
 * query so callers don't lose exact matches.
 *
 * Example:
 *   relatedTerms("money") → ["money", "wealth", "rizq", "sustenance", ...]
 *   relatedTerms("random") → ["random"]
 */
export function relatedTerms(query: string): string[] {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    const direct = SYNONYM_MAP[q];
    if (direct) return direct;
    // Multi-word query — try each word separately and union results
    const words = q.split(/\s+/).filter(Boolean);
    if (words.length > 1) {
        const out = new Set<string>([q]);
        for (const w of words) {
            (SYNONYM_MAP[w] ?? [w]).forEach(t => out.add(t));
        }
        return Array.from(out);
    }
    return [q];
}
