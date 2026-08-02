/**
 * Single source of truth for all external website URLs the app links to.
 *
 * If you change your hosting domain (e.g. point to tahajjudplus.app), update
 * BASE here and every link in the app picks it up.
 */

import { getLocale } from './i18n';

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

/**
 * Appends the app's current language as a ?lang= param, so the website
 * opens already in whatever language the user has set in-app — on top of
 * the site's own language picker for anyone visiting directly. No-ops
 * (returns the URL unchanged) for mailto: links, which don't take query
 * params the same way.
 */
export function localizedUrl(url: string): string {
    if (url.startsWith('mailto:')) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}lang=${getLocale()}`;
}
