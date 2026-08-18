/**
 * Emails tahajjud.letters@gmail.com the moment someone applies to become a
 * Tahajjud+ creator/ambassador (app/creators/page.tsx on the website writes
 * to ambassador-applications, this just watches that collection).
 *
 * Uses Gmail SMTP via nodemailer rather than a third-party email API — no
 * new service to sign up for, since the destination is already a Gmail
 * inbox. Requires a Gmail App Password (not the account's real password —
 * Google blocks plain-password SMTP login for security), stored as a
 * Firebase secret, never as a literal in source. Set it up with:
 *
 *   firebase functions:secrets:set GMAIL_APP_PASSWORD
 *
 * — run that yourself, in your own terminal (it prompts for the value
 * interactively, so the password itself never has to be typed anywhere
 * else, including here). Generate the App Password at
 * https://myaccount.google.com/apppasswords (requires 2-Step Verification
 * to be turned on for tahajjud.letters@gmail.com first).
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const nodemailer = require('nodemailer');

const GMAIL_APP_PASSWORD = defineSecret('GMAIL_APP_PASSWORD');
const NOTIFY_EMAIL = 'tahajjud.letters@gmail.com';

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
}

const FIELD_LABELS = {
    name: 'Name',
    email: 'Email',
    location: 'Location',
    instagram: 'Instagram',
    tiktok: 'TikTok',
    youtube: 'YouTube',
    otherPlatform: 'Other platform',
    audienceSize: 'Audience size',
    workLinks: 'Best work',
    why: 'Why they want to be a creator',
};

exports.notifyAmbassadorApplication = onDocumentCreated(
    { document: 'ambassador-applications/{appId}', secrets: [GMAIL_APP_PASSWORD] },
    async (event) => {
        const data = event.data?.data();
        if (!data) return;

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: NOTIFY_EMAIL, pass: GMAIL_APP_PASSWORD.value() },
        });

        const rows = Object.entries(FIELD_LABELS)
            .filter(([key]) => data[key])
            .map(([key, label]) => `<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td><td style="padding:4px 0;white-space:pre-wrap;">${escapeHtml(data[key])}</td></tr>`)
            .join('');

        try {
            await transporter.sendMail({
                from: `Tahajjud+ Creators <${NOTIFY_EMAIL}>`,
                to: NOTIFY_EMAIL,
                replyTo: data.email,
                subject: `New creator application: ${data.name || 'Unknown'}`,
                html: `<table style="font-family:sans-serif;font-size:14px;">${rows}</table>`,
            });
            logger.info(`Sent creator application email for ${event.params.appId}`);
        } catch (err) {
            // Application is already durably saved in Firestore either way —
            // an email failure shouldn't retry-loop the function, just get
            // logged so it can be checked manually if emails stop arriving.
            logger.error(`Failed to send creator application email for ${event.params.appId}`, err);
        }
    }
);
