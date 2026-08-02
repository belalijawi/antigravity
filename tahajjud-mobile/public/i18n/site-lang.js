/**
 * Shared language switcher for the marketing/legal pages (privacy, terms,
 * support, home). Each page loads its own translations dictionary first
 * (e.g. privacy.i18n.js sets window.PAGE_I18N), then this script.
 *
 * Language is picked, in order:
 *   1. ?lang= in the URL — set by the app when it opens one of these pages,
 *      so the site matches whatever language the user has in-app.
 *   2. A previously-saved choice from the picker (localStorage), so a
 *      direct website visitor's choice persists across pages/visits.
 *   3. The browser's own language, if it's one of the 15 supported.
 *   4. English.
 */
(function () {
    var LANGS = [
        { code: 'en', native: 'English',        rtl: false },
        { code: 'ar', native: 'العربية',        rtl: true  },
        { code: 'ur', native: 'اردو',           rtl: true  },
        { code: 'tr', native: 'Türkçe',         rtl: false },
        { code: 'id', native: 'Bahasa Indonesia', rtl: false },
        { code: 'ms', native: 'Bahasa Melayu',  rtl: false },
        { code: 'bn', native: 'বাংলা',           rtl: false },
        { code: 'fr', native: 'Français',       rtl: false },
        { code: 'fa', native: 'فارسی',          rtl: true  },
        { code: 'hi', native: 'हिन्दी',          rtl: false },
        { code: 'ru', native: 'Русский',        rtl: false },
        { code: 'bs', native: 'Bosanski',       rtl: false },
        { code: 'es', native: 'Español',        rtl: false },
        { code: 'de', native: 'Deutsch',        rtl: false },
        { code: 'sq', native: 'Shqip',          rtl: false },
    ];
    var STORAGE_KEY = 'site_lang';

    function supportedCodes() {
        // Only offer languages this specific page actually has translations
        // for — every page ships 'en' at minimum, others land page by page.
        var dict = window.PAGE_I18N || {};
        return LANGS.filter(function (l) { return dict[l.code]; });
    }

    function detectInitialLang() {
        var params = new URLSearchParams(window.location.search);
        var fromUrl = params.get('lang');
        var available = supportedCodes().map(function (l) { return l.code; });

        if (fromUrl && available.indexOf(fromUrl) !== -1) return fromUrl;

        var saved = null;
        try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) {}
        if (saved && available.indexOf(saved) !== -1) return saved;

        var nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
        if (available.indexOf(nav) !== -1) return nav;

        return 'en';
    }

    function applyLang(code) {
        var dict = (window.PAGE_I18N || {})[code] || (window.PAGE_I18N || {}).en || {};
        var langMeta = LANGS.find(function (l) { return l.code === code; }) || LANGS[0];

        document.documentElement.lang = code;
        document.documentElement.dir = langMeta.rtl ? 'rtl' : 'ltr';

        document.querySelectorAll('[data-i18n]').forEach(function (el) {
            var key = el.getAttribute('data-i18n');
            if (dict[key] != null) el.innerHTML = dict[key];
        });

        var label = document.getElementById('langBtnLabel');
        if (label) label.textContent = langMeta.native;

        document.querySelectorAll('.lang-option').forEach(function (opt) {
            opt.classList.toggle('active', opt.getAttribute('data-code') === code);
        });

        try { localStorage.setItem(STORAGE_KEY, code); } catch (e) {}
    }

    function buildMenu() {
        var menu = document.getElementById('langMenu');
        if (!menu) return;
        menu.innerHTML = '';
        supportedCodes().forEach(function (l) {
            var opt = document.createElement('div');
            opt.className = 'lang-option';
            opt.setAttribute('role', 'option');
            opt.setAttribute('data-code', l.code);
            opt.textContent = l.native;
            opt.addEventListener('click', function () {
                applyLang(l.code);
                menu.classList.remove('open');
                document.getElementById('langBtn').setAttribute('aria-expanded', 'false');
            });
            menu.appendChild(opt);
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        buildMenu();
        applyLang(detectInitialLang());

        var btn = document.getElementById('langBtn');
        var menu = document.getElementById('langMenu');
        if (btn && menu) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var open = menu.classList.toggle('open');
                btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            });
            document.addEventListener('click', function () {
                menu.classList.remove('open');
                btn.setAttribute('aria-expanded', 'false');
            });
        }
    });
})();
