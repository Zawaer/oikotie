// Shared plumbing for the browser-driven tests.
//
// The packaged extension cannot be side-loaded: branded Google Chrome ignores
// --load-extension. So instead of installing it, these tests reproduce what the
// browser does for it - stub the extension APIs, then inject the same script
// files the manifest lists, on the same hosts the manifest matches.

import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');

export const CHROME_PATH = process.env.CHROME_PATH
    || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// Loaded before every content script, exactly as the manifest declares.
export const COMMON_SCRIPTS = Object.freeze([
    'scripts/services.js',
    'ui/i18n.js',
    'scripts/content-common.js'
]);

export const OVERLAY_ID = 'oikotie-autologin-overlay';
export const SCHOOL_OVERLAY_ID = 'oikotie-autologin-school-required';

// A school that exists in MPASSid and has a known ADFS domain, so the flow can
// be followed all the way to a real credential prompt.
export const TEST_SCHOOL = 'Otaniemen lukio';
export const TEST_ADFS_DOMAIN = 'sts.edu.espoo.fi';

export function defaultSettings(overrides = {}) {
    return {
        autoLoginEnabled: true,
        schoolSupported: true,
        autoFillCredentialsEnabled: true,
        schoolName: TEST_SCHOOL,
        adfsDomain: TEST_ADFS_DOMAIN,
        language: 'fi',
        servicesEnabled: { kampus: true, nova: true, studeo: true },
        novaRole: 'student',
        studeoLevel: 'secondary',
        ...overrides
    };
}

export function launchBrowser(extraArgs = []) {
    return puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-dev-shm-usage', ...extraArgs]
    });
}

// Give a page a working `chrome.storage`, plus a record of every overlay the
// extension puts on screen.
//
// Storage is held in Node rather than in the page so it survives the
// cross-origin hops of a real login flow, the way extension storage does.
// Overlays are reported by a MutationObserver the instant they appear: a
// successful click can tear the document down within tens of milliseconds,
// which is far too fast to catch by polling from Node.
export async function installExtensionStubs(page, { sync = defaultSettings(), local = {} } = {}) {
    const overlaysSeen = new Set();

    await page.exposeFunction('__stubGet', (area, defaults) => {
        const source = area === 'sync' ? sync : local;
        const out = {};
        for (const [key, fallback] of Object.entries(defaults || {})) {
            out[key] = key in source ? source[key] : fallback;
        }
        return out;
    });
    await page.exposeFunction('__stubSet', (area, items) => {
        Object.assign(area === 'sync' ? sync : local, items);
        return true;
    });
    await page.exposeFunction('__overlaySeen', (id) => { overlaysSeen.add(id); });

    await page.evaluateOnNewDocument(() => {
        const area = (name) => ({
            get: (defaults) => window.__stubGet(name, defaults || {}),
            set: (items) => window.__stubSet(name, items)
        });
        globalThis.chrome = {
            storage: {
                sync: area('sync'),
                local: area('local'),
                onChanged: { addListener() {} }
            },
            runtime: {
                sendMessage: () => {},
                lastError: null,
                getManifest: () => ({ version: '0.0-test' })
            }
        };

        // Observe `document`, not `document.documentElement`: this runs at
        // document-start, when the root element may not exist yet.
        new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.id && String(node.id).startsWith('oikotie-autologin')) {
                        window.__overlaySeen(node.id);
                    }
                }
            }
        }).observe(document, { childList: true, subtree: true });
    });

    return { sync, local, overlaysSeen };
}

export async function injectScripts(page, scripts) {
    for (const file of scripts) {
        await page.addScriptTag({ path: path.join(ROOT, file) });
    }
}
