// Capture the extension's real UI for the store listing images, then render
// those images with the Remotion project in promo/.
//
// The captures land in promo/public/screens/, one per language:
//   popup-<lang>.png     the popup, 2x
//   settings-<lang>.png  the settings page, 1200x800 at 2x
//   mpass-<lang>.png     the loading overlay on the MPASSid picker
//   school-<lang>.png    the loading overlay on the school's login page
//
// The two overlay shots put the real overlay over the page captures in
// promo/public/tiles/ (refresh those with build-promo-tiles.mjs when a service
// restyles its login page). The page is served from the real host name so the
// overlay draws the right step of its login trail; nothing goes to the network.
//
// Then `npm run render` in promo/ writes the finished PNGs to dist/store/.
//
//   node scripts/build-store-assets.mjs            # captures + render
//   node scripts/build-store-assets.mjs --no-render
import { COMMON_SCRIPTS, launchBrowser, installExtensionStubs, injectScripts, defaultSettings }
  from '../tests/harness.mjs';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'promo', 'public', 'screens');
const TILES = path.join(ROOT, 'promo', 'public', 'tiles');
mkdirSync(OUT, { recursive: true });

const LANGS = ['fi', 'en'];
const LOGGING_IN = { fi: 'Kirjaudutaan…', en: 'Logging in…' };

// The overlays fetch the brand face from the background script, which the
// harness does not run, so it is declared on the page instead.
const FONT_FACE = `@font-face { font-family: "Oikotie Grotesk"; font-weight: 400 900;
  src: url(data:font/woff2;base64,${readFileSync(path.join(ROOT, 'ui/fonts/schibsted-grotesk.woff2')).toString('base64')}) format("woff2"); }`;

const settle = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const browser = await launchBrowser(['--allow-file-access-from-files']);

async function uiPage(lang, width, height) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 2 });
  await installExtensionStubs(page, { sync: { ...defaultSettings(), language: lang } });
  await page.evaluateOnNewDocument((root) => {
    chrome.runtime.getURL = (p) => `file://${root}/${p}`;
    chrome.runtime.getManifest = () => ({ version: '3.1' });
  }, ROOT);
  return page;
}

async function overlayShot(lang, host, tile, name) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
  await installExtensionStubs(page, { sync: { ...defaultSettings(), language: lang } });
  const background = readFileSync(path.join(TILES, tile));
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (request.url().endsWith('/__page.png')) {
      request.respond({ status: 200, contentType: 'image/png', body: background });
    } else {
      request.respond({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: '<!doctype html><html><body style="margin:0;width:1280px;height:800px;background:url(/__page.png) 0 0 / 1280px 800px no-repeat"></body></html>'
      });
    }
  });
  await page.goto(`https://${host}/`, { waitUntil: 'networkidle0' });
  await injectScripts(page, COMMON_SCRIPTS);
  await page.addStyleTag({ content: FONT_FACE });
  await page.evaluate((message) => {
    globalThis.OikotieContentCommon.showLoadingOverlay(message, { serviceId: 'kampus' });
  }, LOGGING_IN[lang]);
  await settle(900);
  await page.screenshot({ path: path.join(OUT, `${name}-${lang}.png`) });
  await page.close();
}

for (const lang of LANGS) {
  {
    // The popup sizes to its content; fullPage grows the short viewport to fit.
    const page = await uiPage(lang, 300, 100);
    await page.goto(`file://${ROOT}/ui/popup.html`, { waitUntil: 'networkidle0' });
    await settle(900);
    await page.screenshot({ path: path.join(OUT, `popup-${lang}.png`), fullPage: true });
    await page.close();
  }
  {
    const page = await uiPage(lang, 1200, 800);
    await page.goto(`file://${ROOT}/ui/setup.html`, { waitUntil: 'networkidle0' });
    await settle(1200);
    // The school list cannot load from file:// in the harness; the real page
    // never shows that error once a school is saved.
    await page.addStyleTag({ content: '#schoolErrorMessage,#schoolDropdown{display:none!important}' });
    await page.screenshot({ path: path.join(OUT, `settings-${lang}.png`) });
    await page.close();
  }
  await overlayShot(lang, 'mpass-proxy.csc.fi', 'mpass.png', 'mpass');
  await overlayShot(lang, 'sts.edu.espoo.fi', 'espoo.png', 'school');
  console.log(`captured ${lang}`);
}
await browser.close();

if (!process.argv.includes('--no-render')) {
  const promo = path.join(ROOT, 'promo');
  if (!existsSync(path.join(promo, 'node_modules'))) {
    console.error('promo/node_modules is missing: run `npm install` in promo/ first.');
    process.exit(1);
  }
  const result = spawnSync('npm', ['run', 'render'], { cwd: promo, stdio: 'inherit' });
  process.exit(result.status ?? 1);
}
