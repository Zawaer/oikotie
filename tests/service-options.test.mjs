// Per-service option tests.
//
// Nova asks which kind of user you are and Studeo asks for a grade range, and
// the extension answers both from settings. Getting the answer wrong sends the
// user into the wrong login path, so each option is checked against a page that
// offers all the choices at once.
//
//   node tests/service-options.test.mjs

import {
    COMMON_SCRIPTS, launchBrowser, installExtensionStubs, injectScripts, defaultSettings
} from './harness.mjs';

// Records clicks in Node, so the record survives the navigation the click causes.
const CLICK_RECORDER = `<script>
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a, button');
    if (a && window.__recordClick) window.__recordClick((a.textContent || '').replace(/\\s+/g, ' ').trim());
  }, true);
</script>`;

const NOVA_ROLE_PICKER = `<!doctype html><html lang="fi"><body>
  <a href="login/pupil">Olen oppilas Alakoulu ja yläkoulu</a>
  <a href="login/student">Olen opiskelija Lukio ja aikuisopiskelu</a>
  <a href="login/teacher">Olen opettaja Koulun henkilökunta</a>
  ${CLICK_RECORDER}</body></html>`;

// Both options share one href, exactly as Studeo serves them, so only the
// label can tell them apart.
const STUDEO_GRADE_PICKER = `<!doctype html><html lang="fi"><body>
  <a href="/auth/sso/mpass">Alakoulu (luokat 1-6)</a>
  <a href="/auth/sso/mpass">Yläkoulu (luokat 7-9) tai lukio</a>
  <a href="/auth/sso/mpass/help">Ohjeet kirjautumiseen ja lukio-opintoihin</a>
  ${CLICK_RECORDER}</body></html>`;

const CASES = [
    { name: 'Nova role: student (default)', url: 'https://nova.otava.fi/', body: NOVA_ROLE_PICKER,
      script: 'scripts/nova-content.js', settings: { novaRole: 'student' }, expectClick: /olen opiskelija/i },
    { name: 'Nova role: pupil', url: 'https://nova.otava.fi/', body: NOVA_ROLE_PICKER,
      script: 'scripts/nova-content.js', settings: { novaRole: 'pupil' }, expectClick: /olen oppilas/i },
    { name: 'Nova role: teacher', url: 'https://nova.otava.fi/', body: NOVA_ROLE_PICKER,
      script: 'scripts/nova-content.js', settings: { novaRole: 'teacher' }, expectClick: /olen opettaja/i },
    { name: 'Nova role: unknown value falls back to student', url: 'https://nova.otava.fi/', body: NOVA_ROLE_PICKER,
      script: 'scripts/nova-content.js', settings: { novaRole: 'nonsense' }, expectClick: /olen opiskelija/i },

    { name: 'Studeo grade: secondary (default)', url: 'https://app.studeo.fi/auth/sso/mpass', body: STUDEO_GRADE_PICKER,
      script: 'scripts/studeo-content.js', settings: { studeoLevel: 'secondary' }, expectClick: /^yläkoulu/i },
    { name: 'Studeo grade: elementary', url: 'https://app.studeo.fi/auth/sso/mpass', body: STUDEO_GRADE_PICKER,
      script: 'scripts/studeo-content.js', settings: { studeoLevel: 'elementary' }, expectClick: /^alakoulu/i },
    { name: 'Studeo grade: unknown value falls back to secondary', url: 'https://app.studeo.fi/auth/sso/mpass', body: STUDEO_GRADE_PICKER,
      script: 'scripts/studeo-content.js', settings: { studeoLevel: 'nonsense' }, expectClick: /^yläkoulu/i },

    // The help link on the real page says "lukio-opintoihin", which matches the
    // upper-secondary wording. It must never be mistaken for a grade option,
    // even when it shares the href the real options use.
    { name: 'Studeo grade: prose mentioning "lukio" is not an option', url: 'https://app.studeo.fi/auth/sso/mpass',
      body: `<!doctype html><html lang="fi"><body>
        <a href="/auth/sso/mpass/help">Ohjeet kirjautumiseen ja lukio-opintoihin</a>
        <a href="/auth/sso/mpass">Yläkoulu (luokat 7-9) tai lukio</a>
        ${CLICK_RECORDER}</body></html>`,
      script: 'scripts/studeo-content.js', settings: { studeoLevel: 'secondary' }, expectClick: /^yläkoulu/i }
];

const browser = await launchBrowser();
let failures = 0;

for (const testCase of CASES) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });

    const clicks = [];
    await page.exposeFunction('__recordClick', (text) => { clicks.push(text); });
    await installExtensionStubs(page, { sync: defaultSettings(testCase.settings || {}) });

    await page.setRequestInterception(true);
    page.on('request', (request) => {
        if (request.isInterceptResolutionHandled()) return;
        request.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: testCase.body });
    });

    await page.goto(testCase.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await injectScripts(page, [...COMMON_SCRIPTS, testCase.script]);
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const first = clicks[0];
    if (!first) {
        failures++;
        console.log(`FAIL  ${testCase.name}`);
        console.log('        nothing was clicked');
    } else if (!testCase.expectClick.test(first)) {
        failures++;
        console.log(`FAIL  ${testCase.name}`);
        console.log(`        clicked "${first}", expected something matching ${testCase.expectClick}`);
    } else {
        console.log(`pass  ${testCase.name}  -> "${first.slice(0, 46)}"`);
    }

    await page.close();
}

await browser.close();
console.log(`\n${failures === 0 ? 'ALL OPTION CASES PASSED' : `${failures} option case(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);
