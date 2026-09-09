// Render the store listing assets: four 1280x800 screenshots and a 440x280
// promo tile, into dist/store/.
//
// 1280x800 is exactly what the Chrome Web Store requires; AMO is flexible and
// accepts the same files. The extension UI is captured at 2x and scaled down
// inside the frame so it stays crisp. Two of the shots photograph the real
// MPASSid picker and the real school ADFS page mid-flow, so this needs network
// access and takes a minute.
//
//   node scripts/build-store-assets.mjs
import { COMMON_SCRIPTS, TEST_ADFS_DOMAIN, launchBrowser, installExtensionStubs, injectScripts, defaultSettings }
  from '../tests/harness.mjs';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist', 'store');
const RAW = path.join(OUT, 'raw');
mkdirSync(RAW, { recursive: true });
const MARK = readFileSync(path.join(ROOT, 'ui/icons/icon.svg'), 'utf8').replace(/<\?xml[^>]*>/, '').replace(/ style="color:[^"]*"/, '');
const b64 = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;

const ACCENT = '#c2410c';
const FRAME_CSS = `
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 1280px; height: 800px; overflow: hidden; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #1f2937;
         background: #f9f8f6; position: relative; }
  .glow { position: absolute; right: -180px; bottom: -260px; width: 760px; height: 760px; border-radius: 50%;
          background: radial-gradient(closest-side, rgba(194,65,12,0.16), rgba(194,65,12,0)); }
  .frame { position: relative; z-index: 1; display: grid; grid-template-columns: 520px 1fr; gap: 56px; height: 100%; padding: 72px 80px; align-items: center; }
  .brand { display: flex; align-items: center; gap: 10px; color: ${ACCENT}; font-weight: 700; font-size: 22px; margin-bottom: 34px; }
  .brand svg { width: 30px; height: 30px; }
  h1 { font-size: 54px; line-height: 1.08; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 22px; }
  p  { font-size: 22px; line-height: 1.45; color: #495057; max-width: 480px; }
  .shot { display: flex; justify-content: center; align-items: center; height: 100%; }
  .shot img { max-height: 656px; max-width: 100%; border-radius: 18px; box-shadow: 0 30px 70px rgba(30,20,10,0.22), 0 0 0 1px rgba(0,0,0,0.05); }
  .full { position: absolute; inset: 0; z-index: 0; }
  .full img { width: 1280px; height: 800px; display: block; }
  .caption { position: absolute; left: 56px; bottom: 56px; z-index: 2; background: rgba(255,255,255,0.96); padding: 26px 32px; border-radius: 16px;
             box-shadow: 0 24px 60px rgba(0,0,0,0.28); max-width: 620px; }
  .caption h1 { font-size: 34px; margin-bottom: 8px; }
  .caption p { font-size: 18px; }
`;

function sideBySide({ headline, sub, img }) {
  return `<style>${FRAME_CSS}</style><div class="glow"></div><div class="frame">
    <div><div class="brand">${MARK}<span>Oikotie</span></div><h1>${headline}</h1><p>${sub}</p></div>
    <div class="shot"><img src="${img}"></div></div>`;
}
function fullBleed({ headline, sub, img }) {
  return `<style>${FRAME_CSS}</style><div class="full"><img src="${img}"></div>
    <div class="caption"><div class="brand" style="margin-bottom:12px;font-size:18px">${MARK}<span>Oikotie</span></div><h1>${headline}</h1><p>${sub}</p></div>`;
}
function promoTile() {
  return `<style>*{box-sizing:border-box;margin:0}html,body{width:440px;height:280px;overflow:hidden}
    body{background:${ACCENT};color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;display:flex;align-items:center;gap:26px;padding:0 44px}
    svg{width:110px;height:110px;flex:0 0 auto;color:#fff}
    h1{font-size:46px;font-weight:700;letter-spacing:-0.02em;line-height:1}p{margin-top:10px;font-size:17px;opacity:.92;line-height:1.35}</style>
    ${MARK}<div><h1>Oikotie</h1><p>Ohita kirjautumisruudut.<br>Kampus · Nova · Studeo</p></div>`;
}

const browser = await launchBrowser(['--allow-file-access-from-files', '--lang=fi-FI']);

// ---- raw UI captures at 2x -------------------------------------------------
async function uiPage(w, h) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
  await installExtensionStubs(page, { sync: { ...defaultSettings(), language: 'fi' } });
  await page.evaluateOnNewDocument((root) => {
    chrome.runtime.getURL = (p) => `file://${root}/${p}`;
    chrome.runtime.getManifest = () => ({ version: '3.0' });
  }, ROOT);
  return page;
}
{
  const page = await uiPage(300, 580);
  await page.goto(`file://${ROOT}/ui/popup.html`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(RAW, 'popup.png'), fullPage: true });
  await page.close();
}
{
  const page = await uiPage(560, 900);
  await page.goto(`file://${ROOT}/ui/setup.html`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1500));
  // Hide the school-list error the harness causes; the real page never shows it here.
  await page.addStyleTag({ content: '#schoolErrorMessage{display:none!important} body{padding:0!important;min-height:0!important;display:block!important}' });
  await page.evaluate(() => { document.getElementById('schoolSearch').value = 'Otaniemen lukio'; });
  const card = await page.$('.setup-container');
  await card.screenshot({ path: path.join(RAW, 'setup.png') });
  await page.close();
}

// ---- real pages: MPASSid picker with overlay, and ADFS with the hint -------
async function flowPage() {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  const stubs = await installExtensionStubs(page);
  return { page, stubs };
}
{
  const { page } = await flowPage();
  // Ride the Kampus flow to the MPASSid picker, but do not inject the MPASSid
  // script there so the page holds still for the photo.
  page.on('load', async () => {
    try {
      const h = new URL(page.url()).hostname;
      if (h === 'kirjautuminen.sanomapro.fi') await injectScripts(page, [...COMMON_SCRIPTS, 'scripts/kampus-login-content.js']);
    } catch (e) {}
  });
  await page.goto('https://kampus.sanomapro.fi/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  for (let i = 0; i < 40 && !page.url().includes('mpass-proxy'); i++) await new Promise(r => setTimeout(r, 500));
  await page.waitForSelector('#searchschoolterm', { timeout: 20000 });
  await new Promise(r => setTimeout(r, 1200));
  await page.type('#searchschoolterm', 'Otaniemen lukio', { delay: 40 });
  await new Promise(r => setTimeout(r, 1500));
  await injectScripts(page, COMMON_SCRIPTS);
  await page.evaluate(() => globalThis.OikotieContentCommon.showLoadingOverlay('Kirjaudutaan...'));
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(RAW, 'mpass.png') });
  await page.close();
}
{
  const { page, stubs } = await flowPage();
  stubs.local.loginFlow = { service: 'kampus', startedAt: Date.now() };
  const MATCH = [
    ['kirjautuminen.sanomapro.fi', 'scripts/kampus-login-content.js'],
    ['mpass-proxy.csc.fi', 'scripts/mpass-content.js'],
    [TEST_ADFS_DOMAIN, 'scripts/adfs-content.js'],
  ];
  page.on('load', async () => {
    try {
      const h = new URL(page.url()).hostname;
      const m = MATCH.find(([host]) => host === h);
      if (m) await injectScripts(page, [...COMMON_SCRIPTS, m[1]]);
    } catch (e) {}
  });
  await page.goto('https://kampus.sanomapro.fi/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  for (let i = 0; i < 90 && !page.url().includes(TEST_ADFS_DOMAIN); i++) await new Promise(r => setTimeout(r, 500));
  await new Promise(r => setTimeout(r, 2500));
  await page.evaluate(() => {
    const host = document.getElementById('oikotie-autologin-hint');
    if (!host) return;
    const st = document.createElement('style');
    st.textContent = '.tooltip{opacity:1!important;visibility:visible!important;transform:translateY(0)!important}';
    host.shadowRoot.appendChild(st);
  });
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: path.join(RAW, 'adfs.png') });
  await page.close();
}

// ---- compose -----------------------------------------------------------------
const frames = [
  ['01-hero',     sideBySide({ headline: 'Ohita kirjautumisruudut.', sub: 'Oikotie vie sinut Kampukseen, Novaan ja Studeoon ilman yhtäkään klikkausta.', img: b64(path.join(RAW, 'popup.png')) })],
  ['02-mpass',    fullBleed({ headline: 'Valitsee koulusi MPASSid:ssä puolestasi.', sub: 'Sama koulu, joka kerta – kirjoittamatta.', img: b64(path.join(RAW, 'mpass.png')) })],
  ['03-adfs',     fullBleed({ headline: 'Ei koske salasanaasi.', sub: 'Oikotie odottaa, että selain täyttää tallennetut tunnuksesi, ja painaa vasta sitten Kirjaudu.', img: b64(path.join(RAW, 'adfs.png')) })],
  ['04-settings', sideBySide({ headline: 'Yksi asetus, kolme palvelua.', sub: 'Valitse koulusi kerran. Nova- ja Studeo-kysymyksiin Oikotie vastaa puolestasi.', img: b64(path.join(RAW, 'setup.png')) })],
];
for (const [name, html] of frames) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: path.join(OUT, `${name}.png`), clip: { x: 0, y: 0, width: 1280, height: 800 } });
  await page.close();
  console.log(`${name}.png`);
}
{
  const page = await browser.newPage();
  await page.setViewport({ width: 440, height: 280, deviceScaleFactor: 1 });
  await page.setContent(promoTile(), { waitUntil: 'networkidle0' });
  await page.screenshot({ path: path.join(OUT, 'promo-tile-440x280.png'), clip: { x: 0, y: 0, width: 440, height: 280 } });
  await page.close();
  console.log('promo-tile-440x280.png');
}
await browser.close();
