// Resilience tests: the same flows under hostile conditions.
//
// Two things break login automation in practice.
//
// Session state. These services expire sessions at their own pace, so the same
// click lands somewhere different depending on what is still cached. A cold
// session makes MPASSid ask for the school by name; a warm one offers it as a
// remembered choice. Both paths have to work, and a shared cookie jar would
// silently only ever test the warm one.
//
// Slow loading. Every one of these login pages is a single-page app that
// renders its button seconds after the document is "loaded". This is what a
// fixed retry budget got wrong before: on a throttled connection the Kampus
// form took over twenty seconds to appear.
//
//   node tests/resilience.test.mjs

import {
    COMMON_SCRIPTS, TEST_ADFS_DOMAIN,
    launchBrowser, installExtensionStubs, injectScripts
} from './harness.mjs';

const MATCHES = [
    { host: (h) => h === 'kirjautuminen.sanomapro.fi', script: 'scripts/kampus-login-content.js' },
    { host: (h) => h === 'sanomapro.fi' || h === 'www.sanomapro.fi', script: 'scripts/sanomapro-content.js' },
    { host: (h) => h === 'nova.otava.fi', script: 'scripts/nova-content.js' },
    { host: (h) => h === 'app.studeo.fi', script: 'scripts/studeo-content.js' },
    { host: (h) => h === 'mpass-proxy.csc.fi', script: 'scripts/mpass-content.js' },
    { host: (h) => h === TEST_ADFS_DOMAIN, script: 'scripts/adfs-content.js' }
];

const SERVICES = [
    { name: 'Kampus', url: 'https://kampus.sanomapro.fi/' },
    { name: 'Nova', url: 'https://nova.otava.fi/' },
    { name: 'Studeo', url: 'https://app.studeo.fi/' }
];

// 400 kbps is roughly what reproduced the original slow-render failure.
const SLOW = { offline: false, downloadThroughput: 400 * 1024 / 8, uploadThroughput: 400 * 1024 / 8, latency: 400 };

const ALL_CONDITIONS = [
    { key: 'cold', label: 'cold session (cookies cleared)', clearCookies: true, timeoutMs: 90000 },
    { key: 'warm', label: 'warm session (cookies kept)', clearCookies: false, timeoutMs: 90000 },
    { key: 'slow', label: 'cold session on a 400 kbps link', clearCookies: true, throttle: SLOW, timeoutMs: 180000 }
];

// node tests/resilience.test.mjs slow      # one condition
// node tests/resilience.test.mjs slow nova # one condition, one service
const requested = process.argv.slice(2).map((a) => a.toLowerCase());
const CONDITIONS = ALL_CONDITIONS.filter((c) => requested.length === 0 || requested.includes(c.key));
const wantedServices = requested.filter((a) => !ALL_CONDITIONS.some((c) => c.key === a));

async function runFlow(browser, service, condition) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await installExtensionStubs(page);

    const client = await page.createCDPSession();
    if (condition.clearCookies) {
        await client.send('Network.clearBrowserCookies');
        await client.send('Network.clearBrowserCache');
    }
    if (condition.throttle) {
        await client.send('Network.emulateNetworkConditions', condition.throttle);
    }

    const chain = [];
    const notes = [];
    page.on('framenavigated', (f) => { if (f === page.mainFrame()) chain.push(f.url()); });
    page.on('console', (m) => {
        const text = m.text();
        if (!text.includes('Oikotie')) return;
        // Record which MPASSid path was taken, to prove both are exercised.
        if (text.includes('Filling search input')) notes.push('searched-for-school');
        if (text.includes('last selected school')) notes.push('used-remembered-school');
    });

    page.on('load', async () => {
        try {
            const host = new URL(page.url()).hostname;
            const match = MATCHES.find((m) => m.host(host));
            if (match) await injectScripts(page, [...COMMON_SCRIPTS, match.script]);
        } catch (error) { /* navigated away mid-injection */ }
    });

    const started = Date.now();
    try {
        await page.goto(service.url, { waitUntil: 'domcontentloaded', timeout: condition.timeoutMs });
    } catch (error) { /* slow links can exceed the goto budget and still recover */ }

    const deadline = started + condition.timeoutMs;
    let reached = false;
    while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 1500));
        let url = '';
        try { url = page.url(); } catch (error) { break; }
        if (url.includes(TEST_ADFS_DOMAIN)) { reached = true; break; }
    }

    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    await page.close();
    return { reached, elapsed, notes: [...new Set(notes)], hops: [...new Set(chain)].length };
}

let failures = 0;
const summary = [];

for (const condition of CONDITIONS) {
    console.log(`\n${'='.repeat(68)}\n## ${condition.label}\n${'='.repeat(68)}`);
    // A fresh browser per condition guarantees the cookie jar really is cold.
    const browser = await launchBrowser(['--lang=fi-FI']);
    const services = wantedServices.length === 0
        ? SERVICES
        : SERVICES.filter((s) => wantedServices.includes(s.name.toLowerCase()));
    for (const service of services) {
        const result = await runFlow(browser, service, condition);
        const status = result.reached ? 'PASS' : 'FAIL';
        if (!result.reached) failures++;
        const note = result.notes.length ? ` [${result.notes.join(', ')}]` : '';
        console.log(`  ${status}  ${service.name.padEnd(7)} ${result.elapsed}s, ${result.hops} hops${note}`);
        summary.push({ condition: condition.key, service: service.name, ...result });
    }
    await browser.close();
}

console.log(`\n${'='.repeat(68)}`);
const searched = summary.filter((s) => s.notes.includes('searched-for-school')).length;
const remembered = summary.filter((s) => s.notes.includes('used-remembered-school')).length;
console.log(`MPASSid school-search path exercised   : ${searched} run(s)`);
console.log(`MPASSid remembered-school path exercised: ${remembered} run(s)`);
console.log(failures === 0 ? '\nALL RESILIENCE RUNS PASSED' : `\n${failures} run(s) failed`);
process.exit(failures === 0 ? 0 : 1);
