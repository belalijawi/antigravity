# Store listing copy

Per-locale App Store / Google Play listing text, ready to paste into
App Store Connect (App Store tab → version → localization) and Play Console
(Store presence → Main store listing → manage translations).

Each locale folder contains:

- `name.txt` — app name / title (App Store ≤30 chars, Play ≤50 chars — "Tahajjud+" fits both, unchanged across locales)
- `subtitle.txt` — App Store subtitle (≤30 chars)
- `short_description.txt` — Play Store short description (≤80 chars)
- `description.txt` — full description (App Store ≤4000 chars, Play ≤4000 chars)
- `keywords.txt` — App Store keywords only, comma-separated (≤100 chars). Play has no keywords field; it indexes the description instead.

Locales: `en` (base), `ar`, `fr`, `de`, `ur`.

Character limits are Apple's/Google's hard caps — verify in the live counter
in ASC/Play Console before publishing, since exact rendering (e.g. combining
characters in Arabic/Urdu) can count slightly differently than a plain
`.length` check.
