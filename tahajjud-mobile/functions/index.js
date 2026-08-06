/**
 * Tahajjud+ Cloud Functions.
 *
 * Single-purpose for now: auto-hide duas on the public wall once enough
 * users have reported them. Triggered by writes to public-duas/{duaId}.
 *
 * The client-side report() in utils/duaWall.ts increments reportCount via
 * Firestore's `increment(1)`. This trigger watches for that increment and
 * flips `hidden: true` when the threshold is crossed.
 *
 * Admins can manually unhide via the in-app moderation tool.
 */

const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const logger = require('firebase-functions/logger');
const { Translate } = require('@google-cloud/translate').v2;

initializeApp();
const translateClient = new Translate();

const REPORT_THRESHOLD = 5;

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

// Mirrors utils/i18n.ts's Locale union — the only languages the app can
// actually display a translation in, so there's no point (or budget) paying
// Cloud Translation for anything outside this set.
const SUPPORTED_LANGS = new Set([
    'en', 'ar', 'ur', 'tr', 'id', 'ms', 'bn', 'fr', 'fa', 'hi', 'ru', 'bs', 'es', 'de', 'sq',
]);
// Matches the largest content-length cap across duas (280), comments (200),
// and testimony bodies (2000) — see firestore.rules — so this can't be used
// to run arbitrary large translations at the app's expense.
const MAX_TEXT_LENGTH = 2000;
const PARENT_COLLECTIONS = { dua: 'public-duas', testimony: 'community', comment: 'comments' };

/**
 * On-demand translation for user-posted duas/stories/replies, tapped from a
 * "Translate" link in the app (never automatic — this is a billed API call).
 *
 * Every result is cached on the source document itself, under
 * `translations.{langCode}` — content here is immutable once posted (no
 * edit feature), so a cached translation never goes stale. The cache is
 * checked BEFORE calling the API: a popular dua gets translated into any
 * given language at most once total, not once per viewer. Writes go through
 * the Admin SDK, bypassing firestore.rules entirely (same trust boundary as
 * autoHideReportedDuas above) — regular clients can read the field once
 * written (existing read rules on these collections already allow it) but
 * can never write it directly.
 */
exports.translateText = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const { text, targetLang, parentType, docId } = request.data || {};
    if (typeof text !== 'string' || text.trim().length === 0) {
        throw new HttpsError('invalid-argument', 'text is required.');
    }
    if (text.length > MAX_TEXT_LENGTH) {
        throw new HttpsError('invalid-argument', 'text is too long.');
    }
    if (typeof targetLang !== 'string' || !SUPPORTED_LANGS.has(targetLang)) {
        throw new HttpsError('invalid-argument', 'unsupported targetLang.');
    }
    const collectionName = PARENT_COLLECTIONS[parentType];
    if (!collectionName || typeof docId !== 'string' || !docId) {
        throw new HttpsError('invalid-argument', 'valid parentType and docId are required.');
    }

    const db = getFirestore();
    const docRef = db.doc(`${collectionName}/${docId}`);
    const snap = await docRef.get();
    if (!snap.exists) {
        throw new HttpsError('not-found', 'Source document no longer exists.');
    }
    const data = snap.data() || {};
    // The doc's own text/body is the only thing we'll ever actually
    // translate — a caller can't pass arbitrary text through this endpoint
    // against someone else's docId to pollute their cached translations.
    const sourceText = parentType === 'testimony' ? (data.body ?? '') : (data.text ?? '');
    if (sourceText !== text) {
        throw new HttpsError('failed-precondition', 'text does not match the source document.');
    }

    const cached = data.translations && data.translations[targetLang];
    if (cached) {
        return { translated: cached, cached: true };
    }

    let translated;
    try {
        [translated] = await translateClient.translate(sourceText, targetLang);
    } catch (e) {
        logger.error('[translateText] Translate API error', e);
        throw new HttpsError('internal', 'Translation failed.');
    }

    docRef.set({ translations: { [targetLang]: translated } }, { merge: true }).catch((e) => {
        logger.error('[translateText] cache write failed', e);
    });

    return { translated, cached: false };
});
