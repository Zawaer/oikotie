# Oikotie

Skip the login. Oikotie automates the repetitive sign-in steps for the learning platforms Finnish schools actually use — **Kampus** (Sanoma Pro), **Nova** (Otava) and **Studeo** — taking you from the front page to the password prompt without a single click.

## Install

- **Chrome, Edge, Brave, and other Chromium browsers** — [Chrome Web Store](https://chromewebstore.google.com/detail/jnlidjmljocgjaapbnmfjbkcmghmogkd)
- **Firefox and Zen** — [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/2983122/)

## What it does

All three services sign you in through the same MPASSid proxy and then through your own school's login page. Only the first step differs:

| Service | Start at | What it clicks for you |
| --- | --- | --- |
| **Kampus** | `kampus.sanomapro.fi` | The MPASSid button |
| **Nova** | `nova.otava.fi` | Your role, then *MPASSid:llä* — or straight through to the dashboard if you're already signed in |
| **Studeo** | `studeo.fi` | Through to the app, MPASSid, then your grade level |

From there it selects your school on MPASSid, hands off to your school's login page, and continues once your browser has filled in your saved credentials.

**Oikotie never handles your password.** It waits for your browser's own autofill and presses the button you would have pressed.

### It stays out of the way

These services log you out on their own schedule, so the same address might be a login page or your dashboard. Oikotie only acts when there is something to act on:

- Already signed in? Nothing happens — no spinner over a page you're using.
- Only the landing pages redirect. Pricing, blog and support pages are left alone.
- Reached MPASSid from a site Oikotie doesn't handle? It stays out of it.
- School not set up, or not supported yet? It asks instead of guessing.
- Each service can be switched off on its own from the popup.

## Setup

1. Click the extension icon and open **Settings**.
2. Start typing your school name and pick it from the list.
3. If your school is supported, the login address fills in automatically.
4. Choose your **Nova user type** and **Studeo grade level** — these answer the questions those two services ask on the way to MPASSid.
5. Save, and allow the permission prompt for your school's login address.

If your school isn't supported yet, you can still save it and request support from the settings page.

## Privacy

Oikotie stores only what it needs to log you in: your school, its login address, your language, and your toggle settings. Nothing else is collected, and nothing is sent anywhere. If you have browser sync on, those settings sync between your own browsers.

It asks for access to the login pages of the supported services, plus the one school login address you pick during setup. Your password is never stored or read.

## Development

```bash
npm install
npm run build      # -> dist/chrome/ and dist/firefox/
npm run package    # -> dist/releases/*.zip
npm test           # see below
```

Load `dist/chrome` via **Load unpacked** at `chrome://extensions/` with Developer mode on. For Firefox, `npm run dev:firefox` opens a temporary profile with the extension loaded; `npm run lint:firefox` validates the build before an AMO upload.

These services change their markup without warning, which is by far the most likely way Oikotie breaks, so the tests drive a real Chrome against the real login pages. `npm test` runs the offline checks plus a live pass over every service; `npm run test:resilience` adds cold and warm sessions and a throttled connection. Set `CHROME_PATH` if Chrome isn't in the default location.

Tests stop at the password prompt — finishing a login needs real MPASSid credentials, so a fully rendered login form is the pass condition.

## Disclaimer

Oikotie is an unofficial extension. It is not affiliated with, endorsed by, or supported by Sanoma Pro, Otava, Studeo, MPASSid, or any school or municipality, and it is unrelated to the classifieds site at oikotie.fi.

## License

[GNU General Public License v3.0](LICENSE).
