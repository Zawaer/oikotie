// Capture the extension's real UI for the store listing images, then render
// those images with the Remotion project in promo/.
//
// The capture lands in promo/public/screens/popup-<lang>.png: the popup at 2x,
// which ends the login-flow collage. The other panels are the page captures
// in promo/public/tiles/ (refresh those with build-promo-tiles.mjs when a
// service restyles its login page).
//
// Then `npm run render` in promo/ writes the finished PNGs to dist/store/.
//
//   node scripts/build-store-assets.mjs            # captures + render
//   node scripts/build-store-assets.mjs --no-render
import { launchBrowser, installExtensionStubs, defaultSettings }
  from '../tests/harness.mjs';
import { mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'promo', 'public', 'screens');
mkdirSync(OUT, { recursive: true });

const LANGS = ['fi', 'en'];
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

for (const lang of LANGS) {
  {
    // The popup sizes to its content; fullPage grows the short viewport to fit.
    const page = await uiPage(lang, 300, 100);
    await page.goto(`file://${ROOT}/ui/popup.html`, { waitUntil: 'networkidle0' });
    await settle(900);
    await page.screenshot({ path: path.join(OUT, `popup-${lang}.png`), fullPage: true });
    await page.close();
  }
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
