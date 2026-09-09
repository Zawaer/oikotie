// Shared content-script helpers for Oikotie.
//
// Everything here is service-agnostic. The DOM-poking half (finding a control,
// clicking it like a user would, waiting for a single-page app to render it)
// started life inside the Kampus login script and was hardened against a
// handful of real failures - slow-loading SPAs, our own overlay swallowing
// synthetic clicks, pages that cancel the click and navigate themselves. Nova
// and Studeo hit the same problems, so it lives here now.

(function () {
    'use strict';

    const services = globalThis.OikotieServices || {};
    const includesServiceHost = services.includesServiceHost || (() => false);
    const getServiceIdFromValue = services.getServiceIdFromValue || (() => null);

    const OVERLAY_ID_PREFIX = 'oikotie-autologin';
    const LOADING_OVERLAY_ID = `${OVERLAY_ID_PREFIX}-overlay`;
    const SCHOOL_REQUIRED_OVERLAY_ID = `${OVERLAY_ID_PREFIX}-school-required`;
    const HINT_OVERLAY_ID = `${OVERLAY_ID_PREFIX}-hint`;

    const FLOW_MAX_AGE_MS = 10 * 60 * 1000;

    // ---------------------------------------------------------------------
    // Overlay design tokens
    //
    // The overlays live inside shadow roots on pages we do not control, so they
    // cannot inherit anything and every value has to be restated. Keeping them
    // in one place is what stops the three overlays drifting apart.
    //
    // The font stack matters more than it looks: leaving out -apple-system
    // renders the overlays in a different typeface from the popup on macOS.
    // ---------------------------------------------------------------------

    const OVERLAY_TOKENS = [
        '--oikotie-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;',
        '--oikotie-accent: #c2410c;',
        '--oikotie-accent-hover: #a5370a;',
        '--oikotie-accent-active: #8c2f09;',
        '--oikotie-accent-ring: rgba(194, 65, 12, 0.25);',
        '--oikotie-text: #1f2937;',
        '--oikotie-body: #495057;',
        '--oikotie-muted: #6c757d;',
        '--oikotie-surface: #faf9f7;',
        '--oikotie-raised: #ffffff;',
        '--oikotie-border: #e6e3df;',
        '--oikotie-scrim: rgba(0, 0, 0, 0.55);',
        '--oikotie-radius-card: 14px;',
        '--oikotie-radius-control: 8px;',
        '--oikotie-shadow: 0 12px 28px rgba(0, 0, 0, 0.2);'
    ].join(' ');

    function overlayHostRule(zIndex, pointerEvents = 'auto') {
        return `:host { all: initial; position: fixed; inset: 0; z-index: ${zIndex}; pointer-events: ${pointerEvents}; ${OVERLAY_TOKENS} }`;
    }

    // The scrim and card shared by every overlay. Anything specific to one
    // overlay is appended after these.
    const OVERLAY_BASE_RULES = Object.freeze([
        '.overlay { width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px; background: var(--oikotie-scrim); box-sizing: border-box; }',
        '.card { box-sizing: border-box; display: flex; flex-direction: column; align-items: center; background: var(--oikotie-surface); color: var(--oikotie-text); border-radius: var(--oikotie-radius-card); box-shadow: var(--oikotie-shadow); font-family: var(--oikotie-font); text-align: center; }',
        '.title { margin: 0; font-size: 16px; font-weight: 600; line-height: 1.35; color: var(--oikotie-text); }',
        '.description { margin: 0; font-size: 14px; font-weight: 400; line-height: 1.5; color: var(--oikotie-body); }',
        '.button { width: 100%; padding: 11px 16px; border: 1px solid transparent; border-radius: var(--oikotie-radius-control); background: var(--oikotie-accent); color: #fff; font-family: var(--oikotie-font); font-size: 15px; font-weight: 600; line-height: 1.4; cursor: pointer; transition: background-color 0.2s ease, box-shadow 0.2s ease; }',
        '.button:hover { background: var(--oikotie-accent-hover); }',
        '.button:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--oikotie-accent-ring); }',
        '.button:active { background: var(--oikotie-accent-active); }'
    ]);

    // Keyword weights for locating a service's MPASSid entry point when it has
    // no stable selector. Every service labels the control differently -
    // "Kayta MPASSid:ta", "MPASSid:lla", "With MPASSid", "Med MPASSid" - but
    // they all contain the product name somewhere in the text or the href.
    const MPASS_SCORE_RULES = Object.freeze([
        { match: 'kayta mpassid:ta', points: 120 },
        { match: '\u00e4yt\u00e4 mpassid', points: 120 },
        { match: 'mpassid', points: 90 },
        { match: 'mpass', points: 60 }
    ]);

    // ---------------------------------------------------------------------
    // Login-flow bookkeeping
    //
    // The MPASSid proxy and the school's ADFS page are shared by every service
    // and are also reachable from unrelated sites, so before automating them we
    // need evidence that the user actually came from a service we handle. The
    // referrer covers most cases; this short-lived flag covers the rest (some
    // hops strip the referrer entirely).
    // ---------------------------------------------------------------------

    async function markLoginFlow(extensionApi, serviceId) {
        try {
            await extensionApi.storage.local.set({
                loginFlow: { service: serviceId, startedAt: Date.now() }
            });
            return true;
        } catch (e) {
            console.warn('Oikotie: Failed to store login flow flag', e);
            return false;
        }
    }

    async function clearLoginFlow(extensionApi) {
        try {
            await extensionApi.storage.local.set({ loginFlow: null });
        } catch (e) {}
    }

    async function getRecentLoginFlow(extensionApi, maxAgeMs = FLOW_MAX_AGE_MS) {
        try {
            const { loginFlow } = await extensionApi.storage.local.get({ loginFlow: null });
            if (!loginFlow || !loginFlow.startedAt) {
                return null;
            }
            if (Date.now() - loginFlow.startedAt >= maxAgeMs) {
                return null;
            }
            return loginFlow;
        } catch (e) {
            return null;
        }
    }

    function referrerIncludesServiceHost() {
        try {
            return includesServiceHost(document.referrer || '');
        } catch (e) {
            return false;
        }
    }

    function serviceIdFromReferrer() {
        try {
            return getServiceIdFromValue(document.referrer || '');
        } catch (e) {
            return null;
        }
    }

    // Identify the originating service on a shared page (MPASSid proxy, ADFS).
    // Query parameters carry the return URL on most hops, which is the most
    // reliable signal; referrer and the stored flag are the fallbacks.
    async function detectFlowService(extensionApi) {
        try {
            const params = new URLSearchParams(window.location.search);
            for (const [key, value] of params.entries()) {
                const id = getServiceIdFromValue(`${key}=${value}`);
                if (id) {
                    return id;
                }
            }
        } catch (e) {}

        const fromReferrer = serviceIdFromReferrer();
        if (fromReferrer) {
            return fromReferrer;
        }

        const flow = await getRecentLoginFlow(extensionApi);
        return flow ? flow.service : null;
    }

    // ---------------------------------------------------------------------
    // Settings
    // ---------------------------------------------------------------------

    async function getSettings(extensionApi) {
        const defaults = {
            autoLoginEnabled: true,
            schoolSupported: true,
            schoolName: '',
            adfsDomain: '',
            servicesEnabled: services.DEFAULT_SERVICES_ENABLED || {},
            novaRole: services.DEFAULT_NOVA_ROLE || 'student',
            studeoLevel: services.DEFAULT_STUDEO_LEVEL || 'secondary'
        };

        try {
            const stored = await extensionApi.storage.sync.get(defaults);
            // A partially-populated servicesEnabled object (written by an older
            // version, or after adding a service) must not read as "disabled"
            // for the services it does not mention.
            stored.servicesEnabled = Object.assign(
                {},
                defaults.servicesEnabled,
                stored.servicesEnabled || {}
            );
            return stored;
        } catch (error) {
            console.error('Oikotie: Error reading settings', error);
            return defaults;
        }
    }

    // Auto-login runs only when it is on globally, the school is supported, and
    // this particular service has not been switched off.
    async function isAutomationEnabled(extensionApi, serviceId) {
        const settings = await getSettings(extensionApi);
        if (!settings.autoLoginEnabled || !settings.schoolSupported) {
            return false;
        }
        if (serviceId && settings.servicesEnabled[serviceId] === false) {
            return false;
        }
        return true;
    }

    // ---------------------------------------------------------------------
    // DOM helpers
    // ---------------------------------------------------------------------

    function normalizeText(value) {
        return (value || '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    function isVisible(element) {
        if (!element) {
            return false;
        }

        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none') {
            return false;
        }

        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    const CLICKABLE_SELECTOR = 'a, button, [role="button"], input[type="button"], input[type="submit"], [onclick], [tabindex]';

    function findClickableAncestor(element) {
        if (!element) {
            return null;
        }
        return element.closest(CLICKABLE_SELECTOR) || element;
    }

    // Guards against clicking a page-sized wrapper that happens to contain the
    // text we searched for.
    function isLikelyContainer(element) {
        if (!element) {
            return true;
        }
        const id = normalizeText(element.id || '');
        const className = normalizeText(typeof element.className === 'string' ? element.className : '');
        const containerTokens = ['wrapper', 'container', 'content', 'main', 'layout', 'page'];
        if (containerTokens.some((token) => id === token || className.includes(token))) {
            return true;
        }

        const rect = element.getBoundingClientRect();
        const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
        const elementArea = rect.width * rect.height;
        return elementArea > viewportArea * 0.35;
    }

    function isOwnOverlay(element) {
        return Boolean(
            element &&
            typeof element.id === 'string' &&
            element.id.startsWith(OVERLAY_ID_PREFIX)
        );
    }

    function pickTopmostAtCenter(element) {
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        if (centerX < 0 || centerY < 0 || centerX > window.innerWidth || centerY > window.innerHeight) {
            return element;
        }

        // Our own loading overlay covers the whole viewport, so elementFromPoint
        // would hand back the overlay and the synthetic click would land there
        // instead of on the login link. Walk the hit-test stack past it.
        const stack = typeof document.elementsFromPoint === 'function'
            ? document.elementsFromPoint(centerX, centerY)
            : [document.elementFromPoint(centerX, centerY)];

        for (const candidate of stack) {
            if (!candidate || isOwnOverlay(candidate)) {
                continue;
            }

            // Only accept the hit-test result when it is actually related to the
            // element we meant to click. An unrelated element on top - a cookie
            // banner, a chat widget - must not steal the click: dispatching the
            // event straight at the intended target still reaches its own
            // handler, which is far better than activating something else.
            if (candidate === element || element.contains(candidate) || candidate.contains(element)) {
                return findClickableAncestor(candidate) || candidate;
            }

            return element;
        }

        return element;
    }

    // Returns true when the page's own handler consumed the click (it cancels
    // the event), which means it has already started navigating and we must not
    // navigate on top of it.
    function dispatchUserClick(target) {
        const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });

        target.focus && target.focus();
        target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }));
        target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        target.dispatchEvent(clickEvent);

        if (clickEvent.defaultPrevented) {
            return true;
        }

        if (typeof target.click === 'function') {
            target.click();
        }
        return false;
    }

    // Click `element` the way a user would. `rewriteHref` lets a caller adjust
    // the URL used for the manual-navigation fallback (Kampus needs to carry
    // its `goto` parameter across as RelayState).
    function clickElement(element, { rewriteHref } = {}) {
        const target = findClickableAncestor(element);
        if (!target) {
            console.warn('Oikotie: No clickable ancestor found');
            return false;
        }

        if (!isVisible(target)) {
            console.warn('Oikotie: Target not visible');
            return false;
        }

        try {
            target.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
        } catch (e) {}

        try {
            const topmost = pickTopmostAtCenter(target);
            const clickTarget = topmost || target;
            const handledByPage = dispatchUserClick(clickTarget);

            if (!handledByPage && target.tagName === 'A' && target.href) {
                const targetHref = typeof rewriteHref === 'function'
                    ? rewriteHref(target.href)
                    : target.href;

                let unloading = false;
                const markUnloading = () => { unloading = true; };
                window.addEventListener('beforeunload', markUnloading, { once: true });
                window.addEventListener('pagehide', markUnloading, { once: true });

                setTimeout(() => {
                    if (unloading) {
                        return;
                    }
                    try {
                        window.location.href = targetHref;
                    } catch (e) {
                        console.error('Oikotie: Navigation failed', e);
                    }
                }, 400);
            }

            return true;
        } catch (error) {
            console.error('Oikotie: Click failed', error);
            try {
                target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                return true;
            } catch (dispatchError) {
                console.error('Oikotie: Fallback click failed', dispatchError);
                return false;
            }
        }
    }

    function getDescendantImageAlt(element) {
        try {
            const image = element.querySelector && element.querySelector('img[alt]');
            return image ? image.getAttribute('alt') : '';
        } catch (e) {
            return '';
        }
    }

    // Score every visible control against a set of weighted keyword rules and
    // return the best match. Used when a service renders its MPASSid entry
    // point without a stable selector.
    //
    // `rules` is an array of { match: string|RegExp, points: number }. A control
    // that matches no rule is never returned: scoring only clickability made
    // this happily click a footer link while the SPA was still rendering.
    function findBestScoredControl(rules) {
        const controls = document.querySelectorAll(`${CLICKABLE_SELECTOR}, div, span`);
        const ranked = [];

        for (const element of controls) {
            // Score on cheap string reads first. Resolving the clickable
            // ancestor and measuring visibility both force layout, and running
            // that over every node on the page - several times a second, for as
            // long as the timeout allows - is enough to make a heavy login SPA
            // stutter. Only candidates that already look right pay that cost.
            const attr = (name) => normalizeText(
                element.getAttribute && element.getAttribute(name)
            );

            const haystack = [
                normalizeText(element.textContent || element.value || ''),
                normalizeText(element.id || ''),
                normalizeText(typeof element.className === 'string' ? element.className : ''),
                attr('href'),
                attr('aria-label'),
                attr('title'),
                normalizeText(getDescendantImageAlt(element))
            ].join(' | ');

            let score = 0;
            let matchedAnyRule = false;

            for (const rule of rules) {
                const matched = rule.match instanceof RegExp
                    ? rule.match.test(haystack)
                    : haystack.includes(String(rule.match).toLowerCase());
                if (matched) {
                    score += rule.points;
                    if (rule.points > 0) {
                        matchedAnyRule = true;
                    }
                }
            }

            if (!matchedAnyRule) {
                continue;
            }

            const clickable = findClickableAncestor(element);
            if (!clickable || !isVisible(clickable)) {
                continue;
            }

            if (clickable.matches('a, button, [role="button"], input[type="button"], input[type="submit"]')) {
                score += 30;
            }
            if (isLikelyContainer(clickable)) {
                score -= 100;
            }

            if (score > 0) {
                ranked.push({ element: clickable, score });
            }
        }

        ranked.sort((a, b) => b.score - a.score);
        return ranked.length > 0 ? ranked[0].element : null;
    }

    // Resolve a target using CSS selectors first (ordered most to least
    // specific), then fall back to keyword scoring.
    function findTarget({ selectors = [], scoreRules = null, filter = null }) {
        for (const selector of selectors) {
            let candidates;
            try {
                candidates = document.querySelectorAll(selector);
            } catch (e) {
                continue;
            }
            for (const candidate of candidates) {
                if (!isVisible(candidate)) {
                    continue;
                }
                if (typeof filter === 'function' && !filter(candidate)) {
                    continue;
                }
                return candidate;
            }
        }

        if (scoreRules && scoreRules.length > 0) {
            const scored = findBestScoredControl(scoreRules);
            if (scored && (typeof filter !== 'function' || filter(scored))) {
                return scored;
            }
        }

        return null;
    }

    // Wait for a target to appear and click it.
    //
    // These login pages are single-page apps: at document_end the DOM is often
    // still a "Loading..." placeholder and the real control is rendered seconds
    // later. On a slow connection - or when several tabs opened from a bookmark
    // folder fight over bandwidth - that can take well over twenty seconds, so
    // the budget is generous and driven by both a MutationObserver and a poll.
    // `overlayMessage` + `overlayMode` control the "Logging in..." spinner:
    //
    //   'immediate' - show it right away. Correct on pages that only ever exist
    //                 when logged out, such as a dedicated login page.
    //   'onFound'   - show it only once the target actually turns up. Correct on
    //                 pages that double as the signed-in app: Nova and Studeo
    //                 both serve their dashboard from the same path they serve
    //                 the login page from, and covering a working dashboard
    //                 with a spinner for the whole timeout would be wrong.
    // A dedicated login page is worth waiting a long time for - a throttled
    // connection can take over twenty seconds just to render the button. An
    // ambiguous page is not: there, a timeout is the normal outcome for a
    // signed-in user, and watching the DOM of an app they are actively using
    // for the full budget is pure waste.
    const DEDICATED_PAGE_TIMEOUT_MS = 45000;
    const AMBIGUOUS_PAGE_TIMEOUT_MS = 20000;

    function waitForTargetAndClick(spec, {
        timeoutMs = DEDICATED_PAGE_TIMEOUT_MS,
        pollIntervalMs = 500,
        rewriteHref,
        onGiveUp,
        onTargetFound,
        overlayMessage = null,
        overlayMode = 'immediate'
    } = {}) {
        let overlayShown = false;
        let announcedTarget = false;
        const ensureOverlay = () => {
            if (overlayMessage && !overlayShown) {
                showLoadingOverlay(overlayMessage);
                overlayShown = true;
            }
            // Fires once, the moment we are sure this really is a login page.
            // Callers use it to record the login flow, which must not happen on
            // a page that merely might have been one.
            if (!announcedTarget) {
                announcedTarget = true;
                if (typeof onTargetFound === 'function') {
                    try { onTargetFound(); } catch (e) {}
                }
            }
        };

        if (overlayMessage && overlayMode === 'immediate') {
            ensureOverlay();
        }

        const tryClick = () => {
            const target = findTarget(spec);
            if (!target) {
                return false;
            }
            ensureOverlay();
            return clickElement(target, { rewriteHref });
        };

        const clicked = tryClick();

        let observer = null;
        let poll = null;

        const stopWatching = () => {
            if (observer) {
                observer.disconnect();
                observer = null;
            }
            if (poll) {
                clearInterval(poll);
                poll = null;
            }
        };

        // The timeout keeps running even after a successful click: if the click
        // somehow does not navigate, it still clears the overlay so the user is
        // not left staring at a spinner over a perfectly usable login form.
        const giveUpTimer = setTimeout(() => {
            if (observer || poll) {
                stopWatching();
                if (typeof onGiveUp === 'function') {
                    onGiveUp();
                }
            }
            removeElementWithFade(LOADING_OVERLAY_ID);
        }, timeoutMs);

        // Cancelling from outside means this step is obsolete - the app routed
        // to the next one. Drop the timer too: left running, it would fire
        // mid-login and tear down the *next* step's spinner.
        const cancel = () => {
            clearTimeout(giveUpTimer);
            stopWatching();
        };

        const attempt = () => {
            if (tryClick()) {
                stopWatching();
            }
        };

        if (clicked) {
            return cancel;
        }

        observer = new MutationObserver(attempt);
        observer.observe(document.documentElement, { childList: true, subtree: true });
        poll = setInterval(attempt, pollIntervalMs);

        return cancel;
    }

    // Watch for in-page route changes.
    //
    // Nova and Studeo are both single-page apps: moving from the role picker to
    // the MPASSid button, or from the login page to the grade picker, never
    // loads a new document, so the content script is injected exactly once and
    // has to notice the rest of the journey itself.
    //
    // Polling is the mechanism rather than a patched history.pushState: a
    // content script runs in an isolated world, so reassigning history methods
    // there never sees the page's own calls.
    function observeLocationChanges(callback, { intervalMs = 400 } = {}) {
        let lastHref = window.location.href;

        const fire = () => {
            if (window.location.href === lastHref) {
                return;
            }
            lastHref = window.location.href;
            try {
                callback(lastHref);
            } catch (error) {
                console.error('Oikotie: Route change handler failed', error);
            }
        };

        window.addEventListener('popstate', fire);
        window.addEventListener('hashchange', fire);
        const timer = setInterval(fire, intervalMs);

        return () => {
            clearInterval(timer);
            window.removeEventListener('popstate', fire);
            window.removeEventListener('hashchange', fire);
        };
    }

    // Drive a single-page-app login flow: run `handler` for the current route,
    // then again after every in-page navigation. The handler is given a chance
    // to tear down whatever it started for the previous route first, and never
    // runs twice for the same URL.
    function runForEachRoute(handler) {
        let cancelCurrent = null;
        let lastHandled = null;

        const runOnce = async () => {
            const href = window.location.href;
            if (href === lastHandled) {
                return;
            }
            lastHandled = href;

            if (typeof cancelCurrent === 'function') {
                try { cancelCurrent(); } catch (e) {}
                cancelCurrent = null;
            }

            try {
                cancelCurrent = await handler();
            } catch (error) {
                console.error('Oikotie: Route handler failed', error);
            }
        };

        runWhenReady(runOnce);
        observeLocationChanges(runOnce);
    }

    // ---------------------------------------------------------------------
    // Overlays
    // ---------------------------------------------------------------------

    function removeElementWithFade(elementOrId, durationMs = 250) {
        try {
            const element = typeof elementOrId === 'string'
                ? document.getElementById(elementOrId)
                : elementOrId;

            if (!element) {
                return false;
            }

            element.style.opacity = '0';
            element.style.transition = 'opacity 0.2s ease';
            setTimeout(() => {
                try {
                    element.remove();
                } catch (e) {}
            }, durationMs);
            return true;
        } catch (e) {
            return false;
        }
    }

    function createShadowHost(id, { zIndex = 2147483646, pointerEvents = 'auto' } = {}) {
        if (document.getElementById(id)) {
            return null;
        }

        const host = document.createElement('div');
        host.id = id;
        host.style.position = 'fixed';
        host.style.inset = '0';
        host.style.zIndex = String(zIndex);
        host.style.pointerEvents = pointerEvents;

        const shadowRoot = host.attachShadow({ mode: 'open' });
        return { host, shadowRoot };
    }

    function appendShadowStyles(shadowRoot, rules) {
        const style = document.createElement('style');
        style.textContent = Array.isArray(rules) ? rules.join('\n') : String(rules || '');
        shadowRoot.appendChild(style);
        return style;
    }

    function showLoadingOverlay(message, { id = LOADING_OVERLAY_ID, zIndex = 2147483646 } = {}) {
        try {
            const created = createShadowHost(id, { zIndex });
            if (!created) {
                return false;
            }

            const { host, shadowRoot } = created;
            appendShadowStyles(shadowRoot, [
                overlayHostRule(zIndex),
                ...OVERLAY_BASE_RULES,
                '.card { gap: 16px; padding: 28px 40px; }',
                '.spinner { width: 28px; height: 28px; border: 3px solid rgba(0, 0, 0, 0.12); border-top-color: var(--oikotie-accent); border-radius: 50%; animation: oikotie-spin 0.7s linear infinite; }',
                '.label { font-size: 15px; font-weight: 500; letter-spacing: 0.2px; color: var(--oikotie-text); }',
                '@keyframes oikotie-spin { to { transform: rotate(360deg); } }',
                '@media (prefers-reduced-motion: reduce) { .spinner { animation-duration: 2.4s; } }'
            ]);

            const overlay = document.createElement('div');
            overlay.className = 'overlay';
            const card = document.createElement('div');
            card.className = 'card';
            const spinner = document.createElement('div');
            spinner.className = 'spinner';
            const label = document.createElement('div');
            label.className = 'label';
            label.textContent = message;

            card.appendChild(spinner);
            card.appendChild(label);
            overlay.appendChild(card);
            shadowRoot.appendChild(overlay);
            document.documentElement.appendChild(host);
            return true;
        } catch (e) {
            return false;
        }
    }

    function hideLoadingOverlay() {
        return removeElementWithFade(LOADING_OVERLAY_ID);
    }

    function hideSchoolRequiredOverlay() {
        removeElementWithFade(SCHOOL_REQUIRED_OVERLAY_ID);
    }

    function showSchoolRequiredOverlay(extensionApi, titleMessage, descriptionMessage, actionLabel) {
        try {
            const created = createShadowHost(SCHOOL_REQUIRED_OVERLAY_ID, { zIndex: 2147483647 });
            if (!created) {
                return false;
            }

            const { host, shadowRoot } = created;
            appendShadowStyles(shadowRoot, [
                overlayHostRule(2147483647),
                ...OVERLAY_BASE_RULES,
                '.card { position: relative; width: min(380px, calc(100vw - 32px)); gap: 12px; padding: 28px 32px; }',
                '.close-button { position: absolute; top: 10px; right: 10px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: none; border-radius: 999px; background: transparent; color: var(--oikotie-muted); font-family: var(--oikotie-font); font-size: 22px; line-height: 1; cursor: pointer; }',
                '.close-button:hover { background: rgba(0, 0, 0, 0.06); color: var(--oikotie-text); }',
                '.close-button:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--oikotie-accent-ring); }',
                '.title { font-size: 18px; color: var(--oikotie-accent); }',
                '.button { margin-top: 4px; }'
            ]);

            const overlay = document.createElement('div');
            overlay.className = 'overlay';
            const card = document.createElement('div');
            card.className = 'card';
            const closeButton = document.createElement('button');
            closeButton.type = 'button';
            closeButton.className = 'close-button';
            closeButton.setAttribute('aria-label', 'Close');
            closeButton.textContent = '×';
            closeButton.addEventListener('click', hideSchoolRequiredOverlay);
            const title = document.createElement('div');
            title.className = 'title';
            title.textContent = titleMessage;
            const description = document.createElement('div');
            description.className = 'description';
            description.textContent = descriptionMessage;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'button';
            button.textContent = actionLabel;
            button.addEventListener('click', () => {
                try {
                    extensionApi.runtime.sendMessage({ action: 'openSetupPage' }, () => {
                        if (extensionApi.runtime.lastError) {
                            console.error('Oikotie: Failed to open settings page', extensionApi.runtime.lastError);
                        }
                    });
                } catch (error) {
                    console.error('Oikotie: Failed to open settings page', error);
                }
            });

            card.appendChild(closeButton);
            card.appendChild(title);
            card.appendChild(description);
            card.appendChild(button);
            overlay.appendChild(card);
            shadowRoot.appendChild(overlay);
            document.documentElement.appendChild(host);
            return true;
        } catch (error) {
            console.error('Oikotie: Failed to show school-required overlay', error);
            return false;
        }
    }

    function runWhenReady(callback) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', callback);
        } else {
            callback();
        }
    }

    globalThis.OikotieContentCommon = Object.freeze({
        OVERLAY_ID_PREFIX,
        MPASS_SCORE_RULES,
        overlayHostRule,
        OVERLAY_BASE_RULES,
        DEDICATED_PAGE_TIMEOUT_MS,
        AMBIGUOUS_PAGE_TIMEOUT_MS,
        LOADING_OVERLAY_ID,
        SCHOOL_REQUIRED_OVERLAY_ID,
        HINT_OVERLAY_ID,

        markLoginFlow,
        clearLoginFlow,
        getRecentLoginFlow,
        referrerIncludesServiceHost,
        serviceIdFromReferrer,
        detectFlowService,

        getSettings,
        isAutomationEnabled,

        normalizeText,
        isVisible,
        findClickableAncestor,
        isLikelyContainer,
        clickElement,
        findBestScoredControl,
        findTarget,
        waitForTargetAndClick,
        observeLocationChanges,
        runForEachRoute,

        removeElementWithFade,
        createShadowHost,
        appendShadowStyles,
        showLoadingOverlay,
        hideLoadingOverlay,
        hideSchoolRequiredOverlay,
        showSchoolRequiredOverlay,

        runWhenReady
    });
})();
