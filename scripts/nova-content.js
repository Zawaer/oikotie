// Content script for nova.otava.fi (Otava Nova).
//
// nova.otava.fi/ is a marketing landing page, and what it offers depends on
// whether you are signed in:
//
//   signed out - role links ("I am a student", ...) further down the page,
//                each leading to a page with a "With MPASSid" button
//   signed in  - a link into the app at /dashboard, and no role links at all
//
// So the landing page has two jobs: start the login when signed out, and get
// out of the way onto /dashboard when signed in. Doing nothing in the second
// case leaves the user staring at marketing copy for a product they already
// use, which is not what they came for.

(function () {
    'use strict';

    const extensionApi = globalThis.browser || globalThis.chrome;
    const common = globalThis.OikotieContentCommon || {};
    const services = globalThis.OikotieServices || {};

    const SERVICE_ID = 'nova';
    const VALID_ROLES = services.NOVA_ROLES || ['student', 'pupil', 'teacher'];
    const DEFAULT_ROLE = services.DEFAULT_NOVA_ROLE || 'student';

    console.log('Oikotie: Running on nova.otava.fi');

    const DASHBOARD_PATH = '/dashboard';

    // How long to wait for a role link before concluding we are signed in.
    // The links are server-rendered, so they are normally there immediately.
    const LANDING_SETTLE_MS = 5000;

    // A signed-in landing page offers a way into the app. Matching it by markup
    // is guesswork - Nova's header controls are not plain links, the signed-out
    // "Log in" has no href at all - so these are a fast path only, and the real
    // decision is made by whether role links show up at all.
    const SIGNED_IN_SELECTORS = Object.freeze([
        `a[href="${DASHBOARD_PATH}"]`,
        `a[href$="${DASHBOARD_PATH}"]`,
        `a[href*="${DASHBOARD_PATH}"]`
    ]);
    const SIGNED_IN_SCORE_RULES = Object.freeze([
        { match: 'avaa palvelu', points: 100 },
        { match: 'open service', points: 100 },
        { match: 'siirry palveluun', points: 100 },
        { match: 'öppna tjänsten', points: 100 },
        { match: DASHBOARD_PATH, points: 80 }
    ]);

    function goToDashboard(reason) {
        console.log(`Oikotie: ${reason}; going to the Nova dashboard`);
        try {
            window.location.assign(new URL(DASHBOARD_PATH, window.location.origin).toString());
        } catch (error) {
            console.error('Oikotie: Failed to open the Nova dashboard', error);
        }
    }

    // The role links are rendered as relative hrefs ("login/student"), but be
    // tolerant of an absolute form too.
    function roleSelectors(role) {
        return [
            `a[href="login/${role}"]`,
            `a[href="/login/${role}"]`,
            `a[href$="/login/${role}"]`,
            `a[href$="login/${role}"]`
        ];
    }

    // The landing page, and only when no in-page anchor is involved. "What is
    // Nova?" and the FAQ are '/#what-is-nova' and '/#faq' - same path, and a
    // deliberate request to read the marketing page rather than leave it.
    function isLandingPage() {
        const path = (window.location.pathname || '/').replace(/\/+$/, '');
        return (path === '' || path === '/login') && !window.location.hash;
    }

    // If /dashboard sent us back here, we are not signed in after all. Going
    // straight back would just bounce between the two.
    function arrivedFromDashboard() {
        try {
            return (document.referrer || '').includes(DASHBOARD_PATH);
        } catch (error) {
            return false;
        }
    }

    function currentRolePage() {
        const match = (window.location.pathname || '').match(/\/login\/([a-z]+)/i);
        return match ? match[1].toLowerCase() : null;
    }

    async function run() {
        if (!await common.isAutomationEnabled(extensionApi, SERVICE_ID)) {
            console.log('Oikotie: Auto-login disabled for Nova, skipping automation');
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

        const role = VALID_ROLES.includes(settings.novaRole) ? settings.novaRole : DEFAULT_ROLE;

        if (currentRolePage()) {
            // Step 2: the MPASSid button on a role page. /login/<role> is only
            // served when signed out, so the spinner is safe to show up front.
            await common.markLoginFlow(extensionApi, SERVICE_ID);

            return common.waitForTargetAndClick(
                { scoreRules: common.MPASS_SCORE_RULES },
                {
                    overlayMessage: t(uiLanguage, 'commonLoggingInLabel'),
                    overlayMode: 'immediate',
                    onGiveUp: () => console.log('Oikotie: Could not find the Nova MPASSid button in time')
                }
            );
        }

        if (!isLandingPage()) {
            console.log('Oikotie: Nova page is not part of the login flow, skipping');
            return null;
        }

        // Signed in already: the only thing between the user and the app is this
        // landing page, so step over it. Skip when /dashboard is what sent us
        // here, because that means we are not signed in after all.
        const cameFromDashboard = arrivedFromDashboard();

        if (!cameFromDashboard && common.findTarget({
            selectors: SIGNED_IN_SELECTORS,
            scoreRules: SIGNED_IN_SCORE_RULES
        })) {
            common.showLoadingOverlay(t(uiLanguage, 'commonLoggingInLabel'));
            goToDashboard('Already signed in to Nova');
            return null;
        }

        // Step 1: pick the configured role.
        //
        // A signed-in user gets the Nova app on this same path, not the role
        // picker, and Nova drops the session often enough that both outcomes are
        // common. So commit to nothing until a role link actually appears: no
        // spinner over a working dashboard, and no login-flow flag either.
        // Otherwise decide by what the page actually offers. A role link means
        // signed out, so start the login. No role link at all means signed in -
        // whatever the button into the app is called this week - so head for
        // the dashboard. If that guess is wrong, /dashboard bounces straight
        // back here and the referrer check sends us down the login path.
        return common.waitForTargetAndClick(
            { selectors: roleSelectors(role) },
            {
                overlayMessage: t(uiLanguage, 'commonLoggingInLabel'),
                overlayMode: 'onFound',
                timeoutMs: LANDING_SETTLE_MS,
                onTargetFound: () => { common.markLoginFlow(extensionApi, SERVICE_ID); },
                onGiveUp: () => {
                    if (cameFromDashboard) {
                        console.log(`Oikotie: No Nova "${role}" role link, and /dashboard sent us here; leaving the page alone`);
                        return;
                    }
                    goToDashboard(`No Nova "${role}" role link appeared, so the session looks active`);
                }
            }
        );
    }

    // Nova routes between the role picker and the role pages client-side, so a
    // single injection has to follow the whole journey itself.
    common.runForEachRoute(run);
})();
