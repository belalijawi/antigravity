/**
 * Single source of truth for all external website URLs the app links to.
 *
 * If you change your hosting domain (e.g. point to tahajjudplus.app), update
 * BASE here and every link in the app picks it up.
 */

const BASE = 'https://tahajjud-2d7bf.web.app';

export const APP_URLS = {
    /** Marketing landing page */
    home:    `${BASE}/`,
    /** Privacy policy — required by Apple App Review */
    privacy: `${BASE}/privacy`,
    /** Terms of Use — required by Apple App Review for subscription apps */
    terms:   `${BASE}/terms`,
    /** Support / FAQ / contact */
    support: `${BASE}/support`,
    /** Contact email */
    email:   'mailto:tahajjud.letters@gmail.com',
};
