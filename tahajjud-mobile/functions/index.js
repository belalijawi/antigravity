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
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const logger = require('firebase-functions/logger');

initializeApp();

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
