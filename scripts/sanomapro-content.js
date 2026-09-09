// Content script for sanomapro.fi (Sanoma Pro landing page).
// Redirects to kampus.sanomapro.fi so the Kampus login flow can start.
//
// Nova and Studeo need no equivalent: nova.otava.fi already opens on its role
// picker, and app.studeo.fi redirects itself to /auth/login.

(function () {
    'use strict';

    const extensionApi = globalThis.browser || globalThis.chrome;
    const common = globalThis.OikotieContentCommon || {};
    const services = globalThis.OikotieServices || {};

    const SERVICE_ID = 'kampus';
    const kampusDirectUrl = (services.SERVICES && services.SERVICES.kampus.homeUrl) || 'https://kampus.sanomapro.fi/';

    console.log('Oikotie: Running on sanomapro.fi');

    // The support pages are ordinary content, so only treat them as part of the
    // login flow when the user demonstrably came through it.
    async function isKampusFlow() {
        if (common.referrerIncludesServiceHost()) {
            return true;
        }
        const flow = await common.getRecentLoginFlow(extensionApi);
        return Boolean(flow && flow.service === SERVICE_ID);
    }

    async function runSanomaProRedirect() {
        if (!await common.isAutomationEnabled(extensionApi, SERVICE_ID)) {
            console.log('Oikotie: Auto-login disabled; will not redirect on sanomapro');
            return;
        }

        const host = window.location.hostname;
        if (host.includes('kampus.sanomapro.fi')) {
            console.log('Oikotie: Already on kampus host; no redirect needed');
            return;
        }

        if (host === 'sanomapro.fi' || host === 'www.sanomapro.fi') {
            const path = window.location.pathname;
            const isLandingPage = path === '/' || path === '' || path === '/#';
            const isTukiPage = path.startsWith('/tuki');

            // Redirect the support page too when it is part of the Kampus flow.
            if (isLandingPage || (isTukiPage && await isKampusFlow())) {
                console.log('Oikotie: Redirecting directly to Kampus page');
                const uiLanguage = await getLanguage();
                common.showLoadingOverlay(t(uiLanguage, 'commonLoggingInLabel'));
                window.location.assign(kampusDirectUrl);
            } else {
                console.log('Oikotie: On sanomapro subpage', path, '— not redirecting');
            }
            return;
        }

        console.log('Oikotie: Host does not require sanomapro redirect');
    }

    common.runWhenReady(runSanomaProRedirect);
})();
