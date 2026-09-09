// End-to-end test: drive each service's real login flow from its homepage and
// check it reaches the school's ADFS credential prompt without any human input.
//
// This talks to the live services on purpose. Their markup is the thing most
// likely to break this extension, and a fixture would never notice that.
//
// The flow cannot be completed: the final step needs real MPASSid credentials.
// Reaching the ADFS form with its username, password and submit fields present
// is therefore the pass condition - everything before the credential wall.
//
//   node tests/login-flows.test.mjs            # all services
//   node tests/login-flows.test.mjs nova       # one service

import {
    ROOT, COMMON_SCRIPTS, TEST_ADFS_DOMAIN,
    launchBrowser, installExtensionStubs, injectScripts
} from './harness.mjs';

// Mirrors manifest content_scripts, plus the ADFS script the background page
// registers dynamically once a school is configured.
const MATCHES = [
    { host: (h) => h === 'kirjautuminen.sanomapro.fi', script: 'scripts/kampus-login-content.js' },
    { host: (h) => h === 'sanomapro.fi' || h === 'www.sanomapro.fi', script: 'scripts/sanomapro-content.js' },
    { host: (h) => h === 'nova.otava.fi', script: 'scripts/nova-content.js' },
    { host: (h) => h === 'app.studeo.fi' || h === 'studeo.fi' || h === 'www.studeo.fi', script: 'scripts/studeo-content.js' },
    { host: (h) => h === 'mpass-proxy.csc.fi', script: 'scripts/mpass-content.js' },
    { host: (h) => h === TEST_ADFS_DOMAIN, script: 'scripts/adfs-content.js' }
];

const CASES = [
    { name: 'Kampus', url: 'https://kampus.sanomapro.fi/' },
    { name: 'Nova', url: 'https://nova.otava.fi/' },
    { name: 'Studeo', url: 'https://app.studeo.fi/' },
    // The marketing site is a different host, and its "Kirjaudu" link is the
    // way most people actually reach the app.
    { name: 'Studeo-landing', url: 'https://www.studeo.fi/' }
];

const FLOW_TIMEOUT_MS = 75000;

const filter = process.argv[2];
const cases = filter
    ? CASES.filter((c) => c.name.toLowerCase() === filter.toLowerCase())
    : CASES;

if (cases.length === 0) {
    console.error(`Unknown service "${filter}". Known: ${CASES.map((c) => c.name).join(', ')}`);
    process.exit(2);
}

const browser = await launchBrowser(['--lang=fi-FI']);
let failures = 0;

for (const testCase of cases) {
    console.log(`\n${'='.repeat(68)}\n### ${testCase.name}  (${testCase.url})\n${'='.repeat(68)}`);

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await installExtensionStubs(page);

    const chain = [];
    page.on('framenavigated', (frame) => {
        if (frame === page.mainFrame()) chain.push(frame.url());
    });
    page.on('console', (message) => {
        const text = message.text();
        if (text.includes('Oikotie')) console.log(`   | ${text}`);
    });

    // Re-inject on every document load, the way the browser would.
    page.on('load', async () => {
        try {
            const host = new URL(page.url()).hostname;
            const match = MATCHES.find((m) => m.host(host));
            if (!match) return;
            await injectScripts(page, [...COMMON_SCRIPTS, match.script]);
            console.log(`   [injected ${match.script.split('/').pop()} on ${host}]`);
        } catch (error) {
            // Navigated away mid-injection; the next load event covers it.
        }
    });

    try {
        await page.goto(testCase.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    } catch (error) {
        console.log(`   goto: ${error.message}`);
    }

    const deadline = Date.now() + FLOW_TIMEOUT_MS;
    let reachedAdfs = false;
    while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        let current = '';
        try { current = page.url(); } catch (error) { break; }
        if (current.includes(TEST_ADFS_DOMAIN)) { reachedAdfs = true; break; }
    }

    console.log('\n   --- navigation chain ---');
    [...new Set(chain)].forEach((url) => console.log(`    -> ${url.slice(0, 130)}`));

    const reachedMpass = chain.some((url) => url.includes('mpass-proxy.csc.fi'));
    console.log(`\n   reached mpass-proxy : ${reachedMpass ? 'YES' : 'no'}`);
    console.log(`   reached school ADFS : ${reachedAdfs ? 'YES' : 'no'}`);

    if (reachedAdfs) {
        // Landing on the ADFS URL is not the same as the form being rendered,
        // so give it a moment rather than judging the first paint.
        const readForm = () => page.evaluate(() => ({
            user: !!document.querySelector('#userNameInput, input[name="UserName"]'),
            pass: !!document.querySelector('#passwordInput, input[name="Password"]'),
            submit: !!document.querySelector('#submitButton')
        }));
        let form = await readForm();
        for (let i = 0; i < 20 && !(form.user && form.pass && form.submit); i++) {
            await new Promise((resolve) => setTimeout(resolve, 750));
            try { form = await readForm(); } catch (error) { break; }
        }
        const complete = form.user && form.pass && form.submit;
        console.log(`   ADFS form detected  : ${JSON.stringify(form)}`);
        if (complete) {
            console.log('   RESULT: PASS - automated the whole flow up to the credential prompt');
        } else {
            console.log('   RESULT: FAIL - reached ADFS but the credential form is incomplete');
            failures++;
        }
    } else if (reachedMpass) {
        console.log('   RESULT: FAIL - reached MPASSid but never the school ADFS page');
        failures++;
    } else {
        console.log('   RESULT: FAIL - never reached MPASSid');
        failures++;
    }

    await page.close();
}

await browser.close();
console.log(`\n${failures === 0 ? 'ALL FLOWS PASSED' : `${failures} flow(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);
