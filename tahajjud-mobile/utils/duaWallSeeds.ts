/**
 * Curated "seed" duas that fill the Dua Wall when the live community feed
 * is sparse. These are explicitly labeled in the UI ("Universal dua" badge)
 * so we never deceive users into thinking these are real community posts —
 * they're starter content drawn from the Quran, hadith, and dua tradition.
 *
 * Stable IDs (prefixed `seed-`) so they have a place in the Ameen tracker
 * without colliding with Firestore IDs.
 */
import type { PublicDua } from './duaWall';

export interface SeedDua extends PublicDua {
    isSeed: true;
}

const NOW = new Date();

export const SEED_DUAS: SeedDua[] = [
    {
        id: 'seed-1',
        text: 'Ya Allah, soften the hearts of my parents and grant them long life in your obedience.',
        ameenCount: 0, reportCount: 0, hidden: false,
        createdAt: new Date(NOW.getTime() - 2 * 60 * 60 * 1000),
        isSeed: true,
    },
    {
        id: 'seed-2',
        text: 'Ya Rabb, make me of those who pray Tahajjud regularly with sincerity, not for show.',
        ameenCount: 0, reportCount: 0, hidden: false,
        createdAt: new Date(NOW.getTime() - 3 * 60 * 60 * 1000),
        isSeed: true,
    },
    {
        id: 'seed-3',
        text: 'Forgive me for the sins I committed openly and the ones I hid from people but never from You.',
        ameenCount: 0, reportCount: 0, hidden: false,
        createdAt: new Date(NOW.getTime() - 4 * 60 * 60 * 1000),
        isSeed: true,
    },
    {
        id: 'seed-4',
        text: 'Ya Allah, grant the people of Palestine, Sudan, Yemen and all oppressed Muslims relief, victory, and steadfast faith.',
        ameenCount: 0, reportCount: 0, hidden: false,
        createdAt: new Date(NOW.getTime() - 5 * 60 * 60 * 1000),
        isSeed: true,
    },
    {
        id: 'seed-5',
        text: 'Provide for me from halal sources I never expected, and protect me from haram earnings.',
        ameenCount: 0, reportCount: 0, hidden: false,
        createdAt: new Date(NOW.getTime() - 6 * 60 * 60 * 1000),
        isSeed: true,
    },
    {
        id: 'seed-6',
        text: 'Heal my heart from envy, anger, and pride. Replace them with patience and gratitude.',
        ameenCount: 0, reportCount: 0, hidden: false,
        createdAt: new Date(NOW.getTime() - 7 * 60 * 60 * 1000),
        isSeed: true,
    },
    {
        id: 'seed-7',
        text: "Ya Allah, let my last words be 'La ilaha illa Allah'.",
        ameenCount: 0, reportCount: 0, hidden: false,
        createdAt: new Date(NOW.getTime() - 8 * 60 * 60 * 1000),
        isSeed: true,
    },
    {
        id: 'seed-8',
        text: 'Protect my children from harm, from evil eye, and guide them to be people of the Quran.',
        ameenCount: 0, reportCount: 0, hidden: false,
        createdAt: new Date(NOW.getTime() - 9 * 60 * 60 * 1000),
        isSeed: true,
    },
    {
        id: 'seed-9',
        text: 'Grant me a heart that is content with Your decree, and a tongue that remembers You often.',
        ameenCount: 0, reportCount: 0, hidden: false,
        createdAt: new Date(NOW.getTime() - 10 * 60 * 60 * 1000),
        isSeed: true,
    },
    {
        id: 'seed-10',
        text: 'Ya Allah, the night is silent and You hear me. I have nothing left but to ask You.',
        ameenCount: 0, reportCount: 0, hidden: false,
        createdAt: new Date(NOW.getTime() - 11 * 60 * 60 * 1000),
        isSeed: true,
    },
    {
        id: 'seed-11',
        text: "Ya Wadood, make my marriage a sanctuary of mercy and tranquility — and grant the same to anyone still searching for their spouse.",
        ameenCount: 0, reportCount: 0, hidden: false,
        createdAt: new Date(NOW.getTime() - 12 * 60 * 60 * 1000),
        isSeed: true,
    },
    {
        id: 'seed-12',
        text: "Ya Shafi, heal everyone reading this who is silently struggling with illness — physical or unseen.",
        ameenCount: 0, reportCount: 0, hidden: false,
        createdAt: new Date(NOW.getTime() - 13 * 60 * 60 * 1000),
        isSeed: true,
    },
];

export function isSeedDua(d: PublicDua | SeedDua): d is SeedDua {
    return (d as SeedDua).isSeed === true;
}
