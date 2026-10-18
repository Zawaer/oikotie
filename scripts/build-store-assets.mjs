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
const MARK = readFileSync(path.join(ROOT, 'ui/icons/icon.svg'), 'utf8').replace(/<\?xml[^>]*>/, '');
// On spruce grounds the mark's own tile would vanish, so lift it a shade.
const MARK_ON_INK = MARK.replace('fill="#0f2e27"', 'fill="#16413a"');
const b64 = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;

// Brand tokens, as in ui/brand.css.
const INK = '#0f2e27';
const INK_MUTED = '#a9c2b8';
const SIGNAL = '#c6f24e';
const PAGE = '#f3f5f1';
const MUTED = '#4a5d57';

// The bundled brand face, inlined so the composed frames do not depend on
// file access from about:blank. Also used to put it on the real pages.
const FONT_FACE = `@font-face { font-family: "Oikotie Grotesk"; font-weight: 400 900;
  src: url(data:font/woff2;base64,${readFileSync(path.join(ROOT, 'ui/fonts/schibsted-grotesk.woff2')).toString('base64')}) format("woff2"); }`;
const FONT = '"Oikotie Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const FRAME_CSS = `
  ${FONT_FACE}
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 1280px; height: 800px; overflow: hidden; }
  body { font-family: ${FONT}; color: ${INK}; background: ${PAGE}; position: relative; -webkit-font-smoothing: antialiased; }
  .band { position: absolute; left: 0; top: 0; bottom: 0; width: 600px; background: ${INK}; }
  .frame { position: relative; z-index: 1; display: grid; grid-template-columns: 440px 1fr; gap: 120px; height: 100%; padding: 72px 80px; align-items: center; }
  .copy { color: ${PAGE}; }
  .brand { display: flex; align-items: center; gap: 12px; font-weight: 800; font-size: 24px; letter-spacing: -0.035em; margin-bottom: 40px; }
  .brand svg { width: 36px; height: 36px; }
  h1 { font-size: 54px; line-height: 1.04; font-weight: 800; letter-spacing: -0.035em; margin-bottom: 22px; }
  p  { font-size: 21px; line-height: 1.5; color: ${INK_MUTED}; max-width: 440px; }
  .shot { display: flex; justify-content: center; align-items: center; height: 100%; }
  .shot img { max-height: 656px; max-width: 100%; border-radius: 16px; box-shadow: 0 30px 70px rgba(4,20,16,0.28), 0 0 0 1px rgba(15,46,39,0.08); }
  .full { position: absolute; inset: 0; z-index: 0; }
  .full img { width: 1280px; height: 800px; display: block; }
  .caption { position: absolute; left: 56px; bottom: 56px; z-index: 2; background: ${INK}; color: ${PAGE}; padding: 28px 32px; border-radius: 20px;
             box-shadow: 0 24px 60px rgba(4,20,16,0.35); max-width: 620px; }
  .caption .brand { margin-bottom: 14px; font-size: 18px; }
  .caption .brand svg { width: 28px; height: 28px; }
  .caption h1 { font-size: 34px; margin-bottom: 8px; }
  .caption p { font-size: 18px; }
`;

function sideBySide({ headline, sub, img }) {
  return `<style>${FRAME_CSS}</style><div class="band"></div><div class="frame">
    <div class="copy"><div class="brand">${MARK_ON_INK}<span>Oikotie</span></div><h1>${headline}</h1><p>${sub}</p></div>
    <div class="shot"><img src="${img}"></div></div>`;
}
function fullBleed({ headline, sub, img }) {
  return `<style>${FRAME_CSS}</style><div class="full"><img src="${img}"></div>
    <div class="caption"><div class="brand">${MARK_ON_INK}<span>Oikotie</span></div><h1>${headline}</h1><p>${sub}</p></div>`;
}
function promoTile() {
  return `<style>${FONT_FACE}*{box-sizing:border-box;margin:0}html,body{width:440px;height:280px;overflow:hidden}
    body{background:${INK};color:${PAGE};font-family:${FONT};display:flex;align-items:center;gap:26px;padding:0 44px;-webkit-font-smoothing:antialiased}
    svg{width:104px;height:104px;flex:0 0 auto}
    h1{font-size:50px;font-weight:800;letter-spacing:-0.04em;line-height:1}p{margin-top:12px;font-size:17px;line-height:1.35;color:${INK_MUTED}}
    p strong{color:${SIGNAL};font-weight:600}</style>
    ${MARK_ON_INK}<div><h1>Oikotie</h1><p><strong>Kirjautuminen ilman kiertoteitä.</strong><br>Kampus · Nova · Studeo</p></div>`;
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
  const page = await uiPage(300, 100); // fullPage grows it to the popup's real height
  await page.goto(`file://${ROOT}/ui/popup.html`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(RAW, 'popup.png'), fullPage: true });
  await page.close();
}
{
  // Narrow enough that the brand panel wraps above the form; only the form is shot.
  const page = await uiPage(600, 900);
  await page.goto(`file://${ROOT}/ui/setup.html`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1500));
  // Hide the school-list error the harness causes; the real page never shows it here.
  await page.addStyleTag({ content: '#schoolErrorMessage,#schoolDropdown{display:none!important}' });
  await page.evaluate(() => { document.getElementById('schoolSearch').value = 'Otaniemen lukio'; });
  const card = await page.$('.form-column');
  await card.screenshot({ path: path.join(RAW, 'setup.png') });
  await page.close();
}

// ---- real pages: MPASSid picker with overlay, and ADFS with the hint -------
async function flowPage() {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  // The brand face is injected into the real pages below; their CSP must not veto it.
  await page.setBypassCSP(true);
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
  await page.addStyleTag({ content: FONT_FACE });
  await page.evaluate(() => globalThis.OikotieContentCommon.showLoadingOverlay('Kirjaudutaan…', { serviceId: 'kampus' }));
  await new Promise(r => setTimeout(r, 800));
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
  await page.addStyleTag({ content: FONT_FACE });
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
