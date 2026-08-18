/**
 * Tahajjud+ Cloud Functions.
 *
 * - Auto-hide duas on the public wall once enough users have reported them.
 * - Translate a newly-submitted answered-dua testimony into every app
 *   locale, once, so the client never has to call a translation API itself.
 *
 * Both triggered by writes to public-duas/{duaId}.
 *
 * The client-side report() in utils/duaWall.ts increments reportCount via
 * Firestore's `increment(1)`. The auto-hide trigger watches for that
 * increment and flips `hidden: true` when the threshold is crossed.
 *
 * Admins can manually unhide via the in-app moderation tool.
 */

const { onDocumentUpdated, onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const logger = require('firebase-functions/logger');
const { Translate } = require('@google-cloud/translate').v2;

initializeApp();

const REPORT_THRESHOLD = 5;

// Keep in sync with the app's `Locale` union in utils/i18n.ts. All of these
// are valid Google Cloud Translation v2 target codes as-is.
const APP_LOCALES = ['en', 'ar', 'ur', 'tr', 'id', 'ms', 'bn', 'fr', 'fa', 'hi', 'ru', 'bs', 'es', 'de', 'sq'];

// Testimonies are short by design; this is just a cost/abuse safety valve.
const MAX_TRANSLATABLE_LENGTH = 2000;

/**
 * Auto-hide reported duas.
 *
 * Fires only when reportCount actually increased (avoids feedback loops with
 * our own writes to `hidden`). Idempotent — if hidden is already true, no-op.
 */
exports.autoHideReportedDuas = onDocumentUpdated(
    'public-duas/{duaId}',
    async (event) => {
        const before = event.data?.before?.data();
        const after = event.data?.after?.data();
        if (!before || !after) return;

        const reportsBefore = before.reportCount ?? 0;
        const reportsAfter = after.reportCount ?? 0;
        const isHidden = after.hidden === true;

        // Only act when reports went UP and crossed the threshold
        if (reportsAfter <= reportsBefore) return;
        if (reportsAfter < REPORT_THRESHOLD) return;
        if (isHidden) return; // already hidden by previous report or by admin

        logger.info(`Auto-hiding dua ${event.params.duaId} after ${reportsAfter} reports`);

        await getFirestore()
            .doc(`public-duas/${event.params.duaId}`)
            .update({
                hidden: true,
                hiddenAt: new Date(),
                hiddenReason: 'auto-report-threshold',
            });
    }
);

/**
 * Translate a newly-submitted testimony into every app locale, once, and
 * cache the results on the doc as `translations: { [locale]: string }` plus
 * the detected `sourceLocale`. The client (DuasHistoryScreen, DuaWall) reads
 * `translations[viewerLocale]` directly — no client-side API calls, no
 * re-translating on every view.
 *
 * Skips the detected source locale (nothing to translate into itself) and
 * anything over MAX_TRANSLATABLE_LENGTH. Failures are logged, not thrown —
 * a translation failure shouldn't retry-loop or block the testimony from
 * existing; the client just falls back to showing the original `text`.
 */
const translate = new Translate();

exports.translateNewDua = onDocumentCreated('public-duas/{duaId}', async (event) => {
    const data = event.data?.data();
    const text = data?.text;
    if (!text || typeof text !== 'string') return;
    if (text.length > MAX_TRANSLATABLE_LENGTH) {
        logger.warn(`Skipping translation for ${event.params.duaId}: text too long`);
        return;
    }

    try {
        const [[detection]] = await translate.detect([text]);
        const sourceLocale = detection?.language;

        const targets = APP_LOCALES.filter((locale) => locale !== sourceLocale);
        const results = await Promise.all(
            targets.map(async (locale) => {
                try {
                    const [translated] = await translate.translate(text, locale);
                    return [locale, translated];
                } catch (err) {
                    logger.error(`Translation to ${locale} failed for ${event.params.duaId}`, err);
                    return null;
                }
            })
        );

        const translations = Object.fromEntries(results.filter(Boolean));
        if (Object.keys(translations).length === 0) return;

        await getFirestore()
            .doc(`public-duas/${event.params.duaId}`)
            .update({ translations, sourceLocale: sourceLocale ?? null });

        logger.info(`Translated dua ${event.params.duaId} into ${Object.keys(translations).length} locales`);
    } catch (err) {
        logger.error(`translateNewDua failed for ${event.params.duaId}`, err);
    }
});

// Where each `parentType` from utils/translate.ts's on-demand caller
// actually lives, and which field holds its translatable text — needed to
// read the doc's real content and cache a fresh translation back onto it.
// Keep in sync with TranslateParentType in utils/translate.ts.
const TRANSLATABLE_SOURCES = {
    dua: { collection: 'public-duas', field: 'text' },
    testimony: { collection: 'community', field: 'body' },
    comment: { collection: 'comments', field: 'text' },
};

/**
 * On-demand translation, called from the client's "Translate" tap
 * (utils/translate.ts) whenever the automatic translateNewDua pass hasn't
 * covered a given locale yet — a dua posted before this locale was added to
 * APP_LOCALES, one that was too long for the automatic pass, one whose
 * automatic translation to this specific locale failed, or (mainly) content
 * types this function doesn't run against at all: testimonies and comments,
 * which are never auto-translated on creation, only ever on demand here.
 *
 * Writes the result back onto the source doc's `translations.{lang}` field,
 * same shape translateNewDua uses — so once anyone triggers a translation,
 * every future viewer gets it from the cached field for free, no repeat
 * billed API call.
 *
 * Every other collection in this app requires request.auth != null for read
 * AND write (see firestore.rules) — this callable is the one place that
 * both reads and writes without going through those rules at all (Admin SDK
 * bypasses them), so it has to enforce the same bar itself. Deliberately
 * ignores the client's own `text` for what gets translated/cached: trusting
 * it would let anyone call this directly with a forged docId and arbitrary
 * text, translating THAT and writing the result onto someone else's real
 * dua/testimony/comment for every future viewer in that locale to see.
 * Always re-reads the actual stored field instead.
 */
exports.translateText = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'sign-in required');
    }

    const { targetLang, parentType, docId } = request.data || {};
    if (!targetLang || !APP_LOCALES.includes(targetLang)) {
        throw new HttpsError('invalid-argument', 'targetLang is invalid');
    }
    const source = TRANSLATABLE_SOURCES[parentType];
    if (!source || !docId || typeof docId !== 'string') {
        throw new HttpsError('invalid-argument', 'parentType/docId is invalid');
    }

    const ref = getFirestore().doc(`${source.collection}/${docId}`);
    const snap = await ref.get();
    if (!snap.exists) {
        throw new HttpsError('not-found', 'document not found');
    }
    const data = snap.data() ?? {};
    const text = data[source.field];
    if (!text || typeof text !== 'string') {
        throw new HttpsError('failed-precondition', 'document has no translatable text');
    }
    if (text.length > MAX_TRANSLATABLE_LENGTH) {
        throw new HttpsError('invalid-argument', 'text too long');
    }

    // Someone else may have already triggered (or the automatic pass may
    // have already covered) this exact translation since the client's own
    // existingTranslations was fetched — re-check server-side rather than
    // pay for the same API call twice.
    const cached = data.translations?.[targetLang];
    if (cached) {
        return { translated: cached };
    }

    let translated;
    try {
        [translated] = await translate.translate(text, targetLang);
    } catch (err) {
        logger.error(`translateText failed for ${parentType}/${docId}`, err);
        throw new HttpsError('internal', 'translation failed');
    }

    await ref.update({ [`translations.${targetLang}`]: translated }).catch((err) => {
        // The translation itself succeeded — the caller still gets a result
        // even if this best-effort cache write fails (e.g. the doc was
        // deleted between the tap and this write landing).
        logger.error(`translateText: failed to cache ${source.collection}/${docId}.translations.${targetLang}`, err);
    });

    return { translated };
});

exports.notifyAmbassadorApplication = require('./ambassadorNotify').notifyAmbassadorApplication;
