// Content script for kirjautuminen.sanomapro.fi (Sanoma Pro Kampus).
// Clicks the MPASSid login button, handing the flow over to the shared
// MPASSid proxy script.

(function () {
    'use strict';

    const extensionApi = globalThis.browser || globalThis.chrome;
    const common = globalThis.OikotieContentCommon || {};

    const SERVICE_ID = 'kampus';

    // Ordered from most to least specific. The current page wraps the link in
    // .idp-links and points it at the MPASSid SAML endpoint; the #mpass markup
    // is kept for older/other realms that still use it.
    const MPASS_SELECTORS = Object.freeze([
        '.idp-links a[href*="mpass"]',
        'a[href*="mpass-proxy.csc.fi"]',
        'a[href*="spssoinit"][href*="mpass"]',
        '#mpass > div.form-group > a',
        '#mpass a'
    ]);

    console.log('Oikotie: Running on kirjautuminen.sanomapro.fi');

    // The login page's MPASSid link runs an inline onclick that copies the
    // current `goto` into RelayState, so the IdP round-trip comes back to
    // Kampus. Mirror that whenever we have to navigate by hand.
    function withRelayState(href) {
        try {
            const goto = new URLSearchParams(window.location.search).get('goto');
            if (!goto) {
                return href;
            }

            const url = new URL(href, window.location.href);
            if (!url.searchParams.has('RelayState')) {
                url.searchParams.set('RelayState', goto);
            }
            return url.toString();
        } catch (error) {
            return href;
        }
    }

    async function run() {
        const pathname = (window.location.pathname || '').toLowerCase();
        const href = (window.location.href || '').toLowerCase();
        if (pathname.includes('/logout') || href.includes('/logout/')) {
            console.log('Oikotie: Logout page detected, skipping automation');
            return;
        }

        if (!await common.isAutomationEnabled(extensionApi, SERVICE_ID)) {
            console.log('Oikotie: Auto-login disabled for Kampus, skipping automation');
            return;
        }

        const uiLanguage = await getLanguage();
        const settings = await common.getSettings(extensionApi);
        if (!settings.schoolName.trim()) {
            console.log('Oikotie: No school configured, not starting auto-login flow');
            await common.clearLoginFlow(extensionApi);
            common.hideLoadingOverlay();
            common.showSchoolRequiredOverlay(
                extensionApi,
                t(uiLanguage, 'mpassSchoolRequiredTitle'),
                t(uiLanguage, 'mpassSchoolRequiredDescription'),
                t(uiLanguage, 'mpassSchoolRequiredAction')
            );
            return;
        }

        await common.markLoginFlow(extensionApi, SERVICE_ID);

        console.log('Oikotie: Auto-login is enabled, proceeding...');

        // This host only ever serves the login page, so the spinner can go up
        // straight away rather than waiting for the SPA to render the button.
        common.waitForTargetAndClick(
            {
                selectors: MPASS_SELECTORS,
                scoreRules: common.MPASS_SCORE_RULES
            },
            {
                rewriteHref: withRelayState,
                overlayMessage: t(uiLanguage, 'commonLoggingInLabel'),
                overlayMode: 'immediate',
                onGiveUp: () => console.log('Oikotie: Could not find the Kampus MPASSid button in time')
            }
        );
    }

    common.runWhenReady(run);
})();
