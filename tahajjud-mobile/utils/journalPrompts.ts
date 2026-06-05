/**
 * Daily reflection prompts for the journal + letter modals.
 *
 * Selected deterministically by today's date so every user sees the same
 * prompt on the same night across reopens. Rotates through the pool over
 * the year — each prompt surfaces ~16-18 times.
 */

export const JOURNAL_PROMPTS: string[] = [
    'Ya Allah, tonight I…',
    "What's weighing on my heart…",
    'Ya Allah, I am grateful for…',
    'What I felt in sujood tonight…',
    'Ya Allah, my dua tonight is…',
    'What I want to ask You for…',
    'Ya Allah, please help me with…',
    'Tonight felt different because…',
    'Ya Allah, I put my trust in You for…',
    'Something I want to remember tonight…',
    'What did I cry about to Him tonight…',
    'Whom did I mention by name in my dua…',
    'What does my soul need that no one else can give…',
    'Ya Allah, forgive me for…',
    'What I want to change before next Ramadan…',
    'A moment today when I felt close to You…',
    'Ya Allah, I thank You for the small mercy of…',
    'What I learned about myself tonight…',
    'Ya Rabbi, guide me through…',
    'If this was my last Tahajjud — I would tell You…',
];

/** Deterministic prompt for `date` — same prompt across every reopen on same day. */
export function getPromptForDate(date: Date = new Date()): string {
    // Day index since epoch — stable per calendar day regardless of timezone DST.
    const dayIndex = Math.floor(date.getTime() / (24 * 60 * 60 * 1000));
    return JOURNAL_PROMPTS[((dayIndex % JOURNAL_PROMPTS.length) + JOURNAL_PROMPTS.length) % JOURNAL_PROMPTS.length];
}
