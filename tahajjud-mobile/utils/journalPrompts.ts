/**
 * Daily reflection prompts for the journal + letter modals.
 *
 * Selected deterministically by today's date so every user sees the same
 * prompt on the same night across reopens. Rotates through the pool over
 * the year — each prompt surfaces ~16-18 times.
 */

import { t } from './i18n';

const PROMPT_COUNT = 20;

/** Translated reflection prompts in the current locale, in rotation order. */
function getJournalPrompts(): string[] {
    return Array.from({ length: PROMPT_COUNT }, (_, i) => t(`journalModal.prompt${i}`));
}

/** Deterministic prompt for `date` — same prompt across every reopen on same day. */
export function getPromptForDate(date: Date = new Date()): string {
    // Day index since epoch — stable per calendar day regardless of timezone DST.
    const dayIndex = Math.floor(date.getTime() / (24 * 60 * 60 * 1000));
    const prompts = getJournalPrompts();
    return prompts[((dayIndex % prompts.length) + prompts.length) % prompts.length];
}
