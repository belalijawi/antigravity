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
