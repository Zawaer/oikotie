// Content script for Studeo (www.studeo.fi and app.studeo.fi).
//
// Studeo's marketing site and its app live on different hosts, and the "Kirjaudu"
// button on the marketing landing page is just a link to the app. So the first
// step is getting off www.studeo.fi and onto app.studeo.fi.
//
// From there Studeo needs two clicks: an icon-only MPASSid link on /auth/login,
// and then a grade-level choice on /auth/sso/mpass before it hands off to MPASSid.
//
// The MPASSid link carries no text at all, so it can only be found by its
// href. The grade options are the opposite case - both share the same href
// ("/auth/sso/mpass"), so they can only be told apart by their label.

(function () {
    'use strict';

    const extensionApi = globalThis.browser || globalThis.chrome;
    const common = globalThis.OikotieContentCommon || {};
    const services = globalThis.OikotieServices || {};

    const SERVICE_ID = 'studeo';
    const VALID_LEVELS = services.STUDEO_LEVELS || ['secondary', 'elementary'];
    const DEFAULT_LEVEL = services.DEFAULT_STUDEO_LEVEL || 'secondary';

    const SSO_PATH = '/auth/sso/mpass';
    const APP_HOME = (services.SERVICES && services.SERVICES.studeo.homeUrl) || 'https://app.studeo.fi/';

    // Studeo currently renders these labels in Finnish whatever the interface
    // language is, but match the Swedish and English wordings too so a future
    // localisation does not silently break the step.
    const LEVEL_PATTERNS = Object.freeze({
        // "Ylakoulu (luokat 7-9) tai lukio" - grades 7-9 and upper secondary.
        secondary: /yläkoulu|lukio|gymnasi|middle|high school|secondary/i,
        // "Alakoulu (luokat 1-6)" - grades 1-6.
        elementary: /alakoulu|lågstadi|elementary|primary/i
    });

    console.log('Oikotie: Running on Studeo');

    function currentPath() {
        return (window.location.pathname || '/').replace(/\/+$/, '') || '/';
    }

    function isSsoPage() {
        return currentPath().toLowerCase() === SSO_PATH;
    }

    function isDedicatedLoginPage() {
        return currentPath().toLowerCase() === '/auth/login';
    }

    // app.studeo.fi/ serves the signed-in app when there is a session and
    // redirects to /auth/login when there is not, so the root is ambiguous.
    function isAppRoot() {
        return currentPath() === '/';
    }

    // The marketing site, which is a different host from the app.
    function isMarketingSite() {
        const host = (window.location.hostname || '').toLowerCase();
        return host === 'studeo.fi' || host === 'www.studeo.fi';
    }

    // A real grade option always states its range - "(luokat 1-6)", "(luokat
    // 7-9)". Requiring that keeps the loose fallback selectors from mistaking
    // ordinary prose for an option: the help link on this very page reads
    // "Ohjeet kirjautumiseen ja lukio-opintoihin", which otherwise matches the
    // upper-secondary pattern perfectly.
    const GRADE_RANGE_HINT = /\d|luokat|luokka|årskurs|grades?\b/i;

    // On the grade picker every option shares one href, so filter by label and
    // make sure the option we pick is not also a match for the other level.
    function makeLevelFilter(level) {
        const wanted = LEVEL_PATTERNS[level];
        const other = LEVEL_PATTERNS[level === 'secondary' ? 'elementary' : 'secondary'];
        return (element) => {
            const text = common.normalizeText(element.textContent || '');
            if (!text || !GRADE_RANGE_HINT.test(text)) {
                return false;
            }
            return wanted.test(text) && !other.test(text);
        };
    }

    async function run() {
        if (!await common.isAutomationEnabled(extensionApi, SERVICE_ID)) {
            console.log('Oikotie: Auto-login disabled for Studeo, skipping automation');
            return null;
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
            return null;
        }

        if (isMarketingSite()) {
            // Only the landing page. The rest of the marketing site is ordinary
            // content someone may well have come to read, and bouncing them to
            // the app from a pricing or blog page would just be rude.
            if (currentPath() !== '/') {
                console.log('Oikotie: Studeo marketing subpage, not redirecting');
                return null;
            }

            // "Kirjaudu" here is a plain link to the app, which then decides
            // between the login page and the signed-in app. Going straight there
            // is steadier than hunting a button on a site that gets restyled.
            console.log('Oikotie: Redirecting from the Studeo landing page to the app');
            await common.markLoginFlow(extensionApi, SERVICE_ID);
            common.showLoadingOverlay(t(uiLanguage, 'commonLoggingInLabel'));
            window.location.assign(APP_HOME);
            return null;
        }

        const level = VALID_LEVELS.includes(settings.studeoLevel) ? settings.studeoLevel : DEFAULT_LEVEL;

        if (isSsoPage()) {
            // Step 2: grade level.
            await common.markLoginFlow(extensionApi, SERVICE_ID);

            return common.waitForTargetAndClick(
                {
                    selectors: [`a[href*="${SSO_PATH}"]`, 'a', 'button'],
                    filter: makeLevelFilter(level)
                },
                {
                    overlayMessage: t(uiLanguage, 'commonLoggingInLabel'),
                    overlayMode: 'immediate',
                    onGiveUp: () => console.log(`Oikotie: Could not find the Studeo "${level}" grade option in time`)
                }
            );
        }

        if (!isDedicatedLoginPage() && !isAppRoot()) {
            console.log('Oikotie: Studeo page is not part of the login flow, skipping');
            return null;
        }

        // Step 1: the icon-only MPASSid link.
        //
        // On /auth/login we know the user is signed out. On the root we do not:
        // a live session renders the app there instead. Defer both the spinner
        // and the login-flow flag until the link actually appears.
        const onDedicatedLoginPage = isDedicatedLoginPage();
        if (onDedicatedLoginPage) {
            await common.markLoginFlow(extensionApi, SERVICE_ID);
        }

        return common.waitForTargetAndClick(
            {
                selectors: [`a[href*="${SSO_PATH}"]`, 'a[href*="mpass"]'],
                scoreRules: common.MPASS_SCORE_RULES
            },
            {
                overlayMessage: t(uiLanguage, 'commonLoggingInLabel'),
                overlayMode: onDedicatedLoginPage ? 'immediate' : 'onFound',
                timeoutMs: onDedicatedLoginPage
                    ? common.DEDICATED_PAGE_TIMEOUT_MS
                    : common.AMBIGUOUS_PAGE_TIMEOUT_MS,
                onTargetFound: () => {
                    if (!onDedicatedLoginPage) {
                        common.markLoginFlow(extensionApi, SERVICE_ID);
                    }
                },
                onGiveUp: () => console.log('Oikotie: No Studeo MPASSid link appeared; assuming an active session')
            }
        );
    }

    // Studeo routes from the login page to the grade picker client-side, so a
    // single injection has to follow the whole journey itself.
    common.runForEachRoute(run);
})();
