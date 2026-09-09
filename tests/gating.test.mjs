// Gating tests: the extension must stay out of the way.
//
// These check the cases where automation should NOT happen. They matter more
// than the happy path: a wrong click here means hijacking a page the user was
// using, or driving an MPASSid login the user never asked for.
//
// Pages are served synthetically through request interception, so each DOM
// state - signed in, signed out, mid-flow - can be reproduced exactly.
//
//   node tests/gating.test.mjs

import {
    COMMON_SCRIPTS, OVERLAY_ID, SCHOOL_OVERLAY_ID,
    launchBrowser, installExtensionStubs, injectScripts, defaultSettings
} from './harness.mjs';

const NOVA_DASHBOARD = `<!doctype html><html lang="fi"><body>
  <h1>Nova</h1>
  <nav><a href="/courses">Kurssit</a><a href="/profile">Profiili</a></nav>
  <p>Tervetuloa takaisin!</p></body></html>`;

// Signed in: Nova shows marketing plus a way into the app, and no role links.
const NOVA_LANDING_SIGNED_IN = `<!doctype html><html lang="fi"><body>
  <header><a href="/dashboard">Avaa palvelu</a></header>
  <h1>Uuden ajan oppimiskokemus</h1>
  <a href="/#what-is-nova">Mikä Nova on?</a>
  <a href="/#faq">Usein kysyttyä</a>
  <a href="/policies/privacy-and-terms">Tietosuoja</a></body></html>`;

const NOVA_ROLE_PICKER = `<!doctype html><html lang="fi"><body>
  <a href="login/pupil">Olen oppilas</a>
  <a href="login/student">Olen opiskelija</a>
  <a href="login/teacher">Olen opettaja</a></body></html>`;

const STUDEO_APP = `<!doctype html><html lang="fi"><body>
  <h1>Studeo</h1><a href="/materials">Materiaalit</a></body></html>`;

const STUDEO_MARKETING = `<!doctype html><html lang="fi"><body>
  <h1>Sukelletaan yhdessä sujuvampaan kouluarkeen</h1>
  <a href="https://app.studeo.fi/">Kirjaudu</a>
  <a href="/hinnasto">Hinnasto</a></body></html>`;

const MPASS_PICKER = `<!doctype html><html lang="fi"><body>
  <div id="selectedList"></div>
  <input id="searchschoolterm" />
  <button id="continueButton">Jatka</button></body></html>`;

// A populated list that does not contain the configured school. Picking any of
// these would send the user to a stranger's municipality login.
const MPASS_PICKER_WRONG_SCHOOLS = `<!doctype html><html lang="fi"><body>
  <div id="selectedList"></div>
  <input id="searchschoolterm" />
  <div id="item-1" class="listItem">Helsingin normaalilyseo</div>
  <div id="item-2" class="listItem">Tampereen klassillinen lukio</div>
  <div id="item-3" class="listItem">Turun Suomalainen Yhteiskoulu</div>
  <button id="continueButton">Jatka</button>
  <script>
    document.getElementById('continueButton').addEventListener('click', function () {
      if (window.__recordContinue) window.__recordContinue();
    });
    document.querySelectorAll('.listItem').forEach(function (el) {
      el.addEventListener('click', function () {
        if (window.__recordSchoolClick) window.__recordSchoolClick(el.textContent.trim());
      });
    });
  </script></body></html>`;

const CASES = [
    {
        name: 'Nova: the dashboard itself is left alone',
        url: 'https://nova.otava.fi/dashboard', body: NOVA_DASHBOARD,
        script: 'scripts/nova-content.js',
        expect: { overlay: false, schoolOverlay: false, flow: false, navigated: false }
    },
    {
        // Signed in, and nothing on the page identifies the way into the app.
        // No role links is itself the signal: take the user to the dashboard
        // rather than leaving them on marketing copy.
        name: 'Nova: landing page with no role links falls through to the dashboard',
        url: 'https://nova.otava.fi/', body: NOVA_DASHBOARD,
        script: 'scripts/nova-content.js', settleMs: 9000,
        expect: { schoolOverlay: false, navigated: true }
    },
    {
        // Unless /dashboard is what sent us here - then we are signed out and
        // going back would just bounce between the two pages.
        name: 'Nova: no bounce when the dashboard sent us to the landing page',
        url: 'https://nova.otava.fi/', body: NOVA_DASHBOARD,
        script: 'scripts/nova-content.js', settleMs: 9000,
        referer: 'https://nova.otava.fi/dashboard',
        expect: { navigated: false }
    },
    {
        name: 'Studeo: signed-in app is left alone',
        url: 'https://app.studeo.fi/', body: STUDEO_APP,
        script: 'scripts/studeo-content.js',
        expect: { overlay: false, schoolOverlay: false, flow: false, navigated: false }
    },
    {
        name: 'Nova: auto-login switched off globally',
        url: 'https://nova.otava.fi/', body: NOVA_ROLE_PICKER,
        script: 'scripts/nova-content.js', settings: { autoLoginEnabled: false },
        expect: { overlay: false, schoolOverlay: false, flow: false, navigated: false }
    },
    {
        name: 'Nova: Nova switched off while other services stay on',
        url: 'https://nova.otava.fi/', body: NOVA_ROLE_PICKER,
        script: 'scripts/nova-content.js',
        settings: { servicesEnabled: { kampus: true, nova: false, studeo: true } },
        expect: { overlay: false, schoolOverlay: false, flow: false, navigated: false }
    },
    {
        name: 'Nova: unsupported school blocks automation',
        url: 'https://nova.otava.fi/', body: NOVA_ROLE_PICKER,
        script: 'scripts/nova-content.js', settings: { schoolSupported: false },
        expect: { overlay: false, schoolOverlay: false, flow: false, navigated: false }
    },
    {
        name: 'Nova: no school configured prompts instead of guessing',
        url: 'https://nova.otava.fi/', body: NOVA_ROLE_PICKER,
        script: 'scripts/nova-content.js', settings: { schoolName: '' },
        expect: { overlay: false, schoolOverlay: true, flow: false, navigated: false }
    },
    {
        name: 'Nova: role picker with everything enabled (control)',
        url: 'https://nova.otava.fi/', body: NOVA_ROLE_PICKER,
        script: 'scripts/nova-content.js',
        expect: { overlay: true, schoolOverlay: false, flow: true, navigated: true }
    },
    {
        // The landing page is all a signed-in user sees at nova.otava.fi/, and
        // the app they actually wanted is one link away at /dashboard.
        name: 'Nova: signed-in landing page goes through to the dashboard',
        url: 'https://nova.otava.fi/', body: NOVA_LANDING_SIGNED_IN,
        script: 'scripts/nova-content.js',
        expect: { overlay: true, schoolOverlay: false, navigated: true }
    },
    {
        // "/#faq" is the same path as the landing page. Someone reading the FAQ
        // asked to be on the marketing page, so leave them there.
        name: 'Nova: marketing anchors on the landing page are left alone',
        url: 'https://nova.otava.fi/#faq', body: NOVA_ROLE_PICKER,
        script: 'scripts/nova-content.js',
        expect: { overlay: false, schoolOverlay: false, flow: false, navigated: false }
    },
    {
        name: 'Studeo: marketing landing page redirects to the app',
        url: 'https://www.studeo.fi/', body: STUDEO_MARKETING,
        script: 'scripts/studeo-content.js',
        expect: { overlay: true, schoolOverlay: false, flow: true, navigated: true }
    },
    {
        // Someone reading the pricing page did not ask to be sent to a login.
        name: 'Studeo: marketing subpages are left alone',
        url: 'https://www.studeo.fi/hinnasto', body: STUDEO_MARKETING,
        script: 'scripts/studeo-content.js',
        expect: { overlay: false, schoolOverlay: false, flow: false, navigated: false }
    },
    {
        name: 'MPASSid: reached outside any of our flows is left alone',
        url: 'https://mpass-proxy.csc.fi/idp/profile/SAML2/Redirect/SSO', body: MPASS_PICKER,
        script: 'scripts/mpass-content.js',
        expect: { overlay: false, schoolOverlay: false, searchFilled: false }
    },
    {
        name: 'MPASSid: reached from a service flow does select the school',
        url: 'https://mpass-proxy.csc.fi/idp/profile/SAML2/Redirect/SSO', body: MPASS_PICKER,
        script: 'scripts/mpass-content.js',
        local: { loginFlow: { service: 'nova', startedAt: Date.now() } },
        expect: { overlay: true, schoolOverlay: false, searchFilled: true }
    },
    {
        name: 'MPASSid: a school that is not in the list is never substituted',
        url: 'https://mpass-proxy.csc.fi/idp/profile/SAML2/Redirect/SSO', body: MPASS_PICKER_WRONG_SCHOOLS,
        script: 'scripts/mpass-content.js',
        local: { loginFlow: { service: 'nova', startedAt: Date.now() } },
        // It should search, find nothing that matches, and stop - never pick a
        // different school and never press Continue.
        expect: { searchFilled: true, schoolClicked: false, continueClicked: false }
    },
    {
        name: 'MPASSid: a stale flow flag has expired and is ignored',
        url: 'https://mpass-proxy.csc.fi/idp/profile/SAML2/Redirect/SSO', body: MPASS_PICKER,
        script: 'scripts/mpass-content.js',
        // Older than the ten-minute window the flow flag is trusted for.
        local: { loginFlow: { service: 'nova', startedAt: Date.now() - (11 * 60 * 1000) } },
        expect: { overlay: false, schoolOverlay: false, searchFilled: false }
    }
];

const SETTLE_MS = 5000;

const browser = await launchBrowser();
let failures = 0;

for (const testCase of CASES) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });

    const schoolClicks = [];
    let continueClicks = 0;
    await page.exposeFunction('__recordSchoolClick', (text) => { schoolClicks.push(text); });
    await page.exposeFunction('__recordContinue', () => { continueClicks++; });

    const { local, overlaysSeen } = await installExtensionStubs(page, {
        sync: defaultSettings(testCase.settings || {}),
        local: { ...(testCase.local || {}) }
    });

    if (testCase.referer) {
        await page.setExtraHTTPHeaders({ Referer: testCase.referer });
        await page.evaluateOnNewDocument((ref) => {
            Object.defineProperty(document, 'referrer', { get: () => ref });
        }, testCase.referer);
    }

    await page.setRequestInterception(true);
    page.on('request', (request) => {
        if (request.isInterceptResolutionHandled()) return;
        request.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: testCase.body });
    });

    let navigations = 0;
    page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) navigations++; });

    await page.goto(testCase.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await injectScripts(page, [...COMMON_SCRIPTS, testCase.script]);

    let searchFilled = false;
    const settleMs = testCase.settleMs || SETTLE_MS;
    for (let i = 0; i < settleMs / 200; i++) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        try {
            searchFilled ||= await page.evaluate(
                () => !!(document.getElementById('searchschoolterm') || {}).value
            );
        } catch (error) {
            // Document was replaced by a navigation; nothing more to sample.
        }
    }

    const actual = {
        overlay: overlaysSeen.has(OVERLAY_ID),
        schoolOverlay: overlaysSeen.has(SCHOOL_OVERLAY_ID),
        searchFilled,
        flow: Boolean(local.loginFlow && local.loginFlow.service),
        navigated: navigations > 1,
        schoolClicked: schoolClicks.length > 0,
        continueClicked: continueClicks > 0
    };

    const diffs = Object.entries(testCase.expect)
        .filter(([key, want]) => actual[key] !== want)
        .map(([key, want]) => `${key}: expected ${want}, got ${actual[key]}`);

    if (diffs.length > 0) {
        failures++;
        console.log(`FAIL  ${testCase.name}`);
        diffs.forEach((d) => console.log(`        ${d}`));
    } else {
        console.log(`pass  ${testCase.name}`);
    }

    await page.close();
}

await browser.close();
console.log(`\n${failures === 0 ? 'ALL GATING CASES PASSED' : `${failures} gating case(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);
