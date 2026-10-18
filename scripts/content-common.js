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
    // cannot inherit anything and every value has to be restated. These mirror
    // ui/brand.css; keeping them in one place is what stops the overlays
    // drifting apart.
    //
    // "Oikotie Grotesk" is the brand face, registered on the page by
    // loadOverlayFont(). Until it arrives - or if it never does - the system
    // stack takes over. Leaving out -apple-system there renders the overlays
    // in a different fallback typeface from the popup on macOS.
    // ---------------------------------------------------------------------

    const OVERLAY_FONT_FAMILY = 'Oikotie Grotesk';

    const OVERLAY_TOKENS = [
        `--oikotie-font: "${OVERLAY_FONT_FAMILY}", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;`,
        '--oikotie-ink: #0f2e27;',
        '--oikotie-ink-hover: #1a4038;',
        '--oikotie-signal: #c6f24e;',
        '--oikotie-text: #0f2e27;',
        '--oikotie-muted: #4a5d57;',
        '--oikotie-page: #f3f5f1;',
        '--oikotie-raised: #ffffff;',
        '--oikotie-border: #dce3de;',
        '--oikotie-pending: #c3cfc9;',
        '--oikotie-ring: rgba(15, 46, 39, 0.14);',
        '--oikotie-scrim: rgba(15, 46, 39, 0.62);',
        '--oikotie-radius-card: 20px;',
        '--oikotie-radius-control: 12px;',
        '--oikotie-shadow: 0 24px 60px rgba(4, 20, 16, 0.35);'
    ].join(' ');

    function overlayHostRule(zIndex, pointerEvents = 'auto') {
        return `:host { all: initial; position: fixed; inset: 0; z-index: ${zIndex}; pointer-events: ${pointerEvents}; ${OVERLAY_TOKENS} }`;
    }

    // The scrim and card shared by every overlay. Anything specific to one
    // overlay is appended after these.
    const OVERLAY_BASE_RULES = Object.freeze([
        '.overlay { width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px; background: var(--oikotie-scrim); box-sizing: border-box; }',
        '.card { box-sizing: border-box; display: flex; flex-direction: column; align-items: center; background: var(--oikotie-raised); color: var(--oikotie-text); border-radius: var(--oikotie-radius-card); box-shadow: var(--oikotie-shadow); font-family: var(--oikotie-font); text-align: center; -webkit-font-smoothing: antialiased; }',
        '.title { margin: 0; font-size: 17px; font-weight: 800; line-height: 1.3; letter-spacing: -0.01em; color: var(--oikotie-text); }',
        '.description { margin: 0; font-size: 14px; font-weight: 400; line-height: 1.5; color: var(--oikotie-muted); }',
        '.button { box-sizing: border-box; display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; height: 46px; padding: 0 16px; border: 0; border-radius: var(--oikotie-radius-control); background: var(--oikotie-ink); color: var(--oikotie-page); font-family: var(--oikotie-font); font-size: 15px; font-weight: 700; line-height: 1; cursor: pointer; transition: background-color 0.15s ease; }',
        '.button:hover { background: var(--oikotie-ink-hover); }',
        '.button:focus-visible { outline: 2px solid var(--oikotie-ink); outline-offset: 2px; }'
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

    // Auto-login runs when it is on globally and this particular service has
    // not been switched off. It does not depend on the school being supported:
    // the service and MPASSid steps work for any school MPASSid lists. Only the
    // last step, on the school's own login page, needs a known AD FS address,
    // and the background script registers that one for supported schools only.
    async function isAutomationEnabled(extensionApi, serviceId) {
        const settings = await getSettings(extensionApi);
        if (!settings.autoLoginEnabled) {
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
    // `overlayMessage` + `overlayMode` control the "Logging in…" overlay:
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

    const SVG_NS = 'http://www.w3.org/2000/svg';

    function createSvg(tagName, attributes) {
        const element = document.createElementNS(SVG_NS, tagName);
        for (const [name, value] of Object.entries(attributes || {})) {
            element.setAttribute(name, String(value));
        }
        return element;
    }

    // The Oikotie mark, as in ui/icons/icon.svg: an O whose corner is cut by
    // the shortcut.
    function createMarkSvg(size) {
        const svg = createSvg('svg', { width: size, height: size, viewBox: '0 0 32 32', 'aria-hidden': 'true' });
        svg.appendChild(createSvg('rect', { width: 32, height: 32, rx: 8, fill: '#0f2e27' }));
        svg.appendChild(createSvg('path', { d: 'M16 7.5A8.5 8.5 0 1 0 24.5 16', fill: 'none', stroke: '#f3f5f1', 'stroke-width': 4, 'stroke-linecap': 'round' }));
        svg.appendChild(createSvg('path', { d: 'M16 7.5L24.5 16', stroke: '#c6f24e', 'stroke-width': 4, 'stroke-linecap': 'round' }));
        return svg;
    }

    function createStrokeIcon(pathData, { size = 18, stroke = 'currentColor', strokeWidth = 2 } = {}) {
        const svg = createSvg('svg', {
            width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke,
            'stroke-width': strokeWidth, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true'
        });
        for (const d of [].concat(pathData)) {
            svg.appendChild(createSvg('path', { d }));
        }
        return svg;
    }

    // Registers the brand face for the overlays. A FontFace added to the
    // document also applies inside shadow roots. The bytes come from the
    // background script (see getOverlayFont there) and are handed over as an
    // ArrayBuffer, so neither the page's CSP nor web_accessible_resources is
    // involved. Best effort: on any failure the overlays keep the system stack.
    let overlayFontRequested = false;

    function loadOverlayFont() {
        if (overlayFontRequested) {
            return;
        }
        overlayFontRequested = true;

        try {
            // chrome.* takes callbacks in both Chrome and Firefox; browser.*
            // in Firefox would ignore one.
            const api = globalThis.chrome || globalThis.browser;
            if (!api?.runtime?.sendMessage || typeof FontFace !== 'function' || !document.fonts) {
                return;
            }
            api.runtime.sendMessage({ action: 'getOverlayFont' }, (response) => {
                try {
                    if (api.runtime.lastError || !response?.font) {
                        return;
                    }
                    const binary = atob(response.font);
                    const bytes = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) {
                        bytes[i] = binary.charCodeAt(i);
                    }
                    const face = new FontFace(OVERLAY_FONT_FAMILY, bytes.buffer, { weight: '400 900' });
                    face.load().then((loaded) => document.fonts.add(loaded)).catch(() => {});
                } catch (e) {}
            });
        } catch (e) {}
    }

    // Where the current page sits in the service -> MPASSid -> school login
    // route. Null when the service is unknown, in which case the overlay shows
    // no trail rather than a wrong one.
    function getLoginTrail(serviceId) {
        const host = (window.location.hostname || '').toLowerCase();
        const pageService = typeof services.getServiceForHost === 'function'
            ? services.getServiceForHost(host)
            : null;

        let activeStep = 2;
        if (host === services.MPASS_PROXY_HOST) {
            activeStep = 1;
        } else if (pageService) {
            activeStep = 0;
        }

        const service = (services.SERVICES || {})[serviceId] || pageService;
        if (!service) {
            return null;
        }
        return { activeStep, labels: [service.name, 'MPASSid', 'Koulu'] };
    }

    // `serviceId` names the flow on pages that do not belong to a service
    // (MPASSid, the school login); on a service's own pages it is inferred.
    function showLoadingOverlay(message, { id = LOADING_OVERLAY_ID, zIndex = 2147483646, serviceId = null } = {}) {
        try {
            const created = createShadowHost(id, { zIndex });
            if (!created) {
                return false;
            }
            loadOverlayFont();

            const { host, shadowRoot } = created;
            appendShadowStyles(shadowRoot, [
                overlayHostRule(zIndex),
                ...OVERLAY_BASE_RULES,
                '.card { width: min(380px, calc(100vw - 32px)); gap: 22px; padding: 24px 24px 26px; align-items: stretch; text-align: left; }',
                '.card.compact { width: auto; padding: 20px 26px 20px 20px; }',
                '.head { display: flex; align-items: center; gap: 12px; }',
                '.head svg { display: block; flex: 0 0 auto; }',
                '.trail { display: flex; align-items: flex-start; }',
                '.step { display: flex; flex: 0 0 auto; flex-direction: column; align-items: center; gap: 8px; width: 76px; }',
                '.dot { box-sizing: border-box; display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: var(--oikotie-raised); }',
                '.done .dot { background: var(--oikotie-ink); }',
                '.active .dot { border: 3px solid var(--oikotie-ink); }',
                '.pending .dot { border: 2px solid var(--oikotie-pending); }',
                '.step-label { max-width: 76px; overflow: hidden; color: var(--oikotie-text); font-size: 12px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }',
                '.pending .step-label { color: var(--oikotie-muted); font-weight: 600; }',
                '.link { flex: 1; height: 3px; margin-top: 10px; border-radius: 2px; }',
                '.link.done { background: var(--oikotie-ink); }',
                '.link.next, .link.later { background-image: radial-gradient(circle, var(--dots) 1.5px, transparent 1.6px); background-size: 6px 3px; background-repeat: repeat-x; }',
                '.link.next { --dots: #9db1aa; animation: oikotie-march 0.6s linear infinite; }',
                '.link.later { --dots: var(--oikotie-pending); }',
                '@keyframes oikotie-march { to { background-position: 6px 0; } }',
                '@media (prefers-reduced-motion: reduce) { .link.next { animation: none; } }'
            ]);

            const overlay = document.createElement('div');
            overlay.className = 'overlay';
            const card = document.createElement('div');
            card.className = 'card';
            card.setAttribute('role', 'status');

            const head = document.createElement('div');
            head.className = 'head';
            const label = document.createElement('div');
            label.className = 'title';
            label.textContent = message;
            head.appendChild(createMarkSvg(32));
            head.appendChild(label);
            card.appendChild(head);

            const trail = getLoginTrail(serviceId);
            if (trail) {
                const row = document.createElement('div');
                row.className = 'trail';
                row.setAttribute('aria-hidden', 'true');
                trail.labels.forEach((text, index) => {
                    if (index > 0) {
                        const link = document.createElement('div');
                        const linkIndex = index - 1;
                        link.className = `link ${linkIndex < trail.activeStep ? 'done' : linkIndex === trail.activeStep ? 'next' : 'later'}`;
                        row.appendChild(link);
                    }
                    const state = index < trail.activeStep ? 'done' : index === trail.activeStep ? 'active' : 'pending';
                    const step = document.createElement('div');
                    step.className = `step ${state}`;
                    const dot = document.createElement('div');
                    dot.className = 'dot';
                    if (state === 'done') {
                        dot.appendChild(createStrokeIcon('m5 12 5 5 9-10', { size: 12, stroke: '#c6f24e', strokeWidth: 3.5 }));
                    }
                    const stepLabel = document.createElement('div');
                    stepLabel.className = 'step-label';
                    stepLabel.textContent = text;
                    step.appendChild(dot);
                    step.appendChild(stepLabel);
                    row.appendChild(step);

                    // The last step is the only translated one; i18n.js is
                    // loaded ahead of this script in every content script.
                    if (index === trail.labels.length - 1 && typeof getLanguage === 'function') {
                        getLanguage().then((lang) => {
                            stepLabel.textContent = t(lang, 'commonStepSchool');
                        }).catch(() => {});
                    }
                });
                card.appendChild(row);
            } else {
                card.classList.add('compact');
            }

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
            loadOverlayFont();

            const { host, shadowRoot } = created;
            appendShadowStyles(shadowRoot, [
                overlayHostRule(2147483647),
                ...OVERLAY_BASE_RULES,
                '.card { position: relative; width: min(380px, calc(100vw - 32px)); gap: 12px; padding: 28px 28px 24px; align-items: flex-start; text-align: left; }',
                '.close-button { position: absolute; top: 12px; right: 12px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; padding: 0; border: none; border-radius: 999px; background: transparent; color: var(--oikotie-muted); cursor: pointer; }',
                '.close-button:hover { background: rgba(15, 46, 39, 0.06); color: var(--oikotie-text); }',
                '.close-button:focus-visible { outline: 2px solid var(--oikotie-ink); outline-offset: 2px; }',
                '.icon { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 12px; background: var(--oikotie-page); color: var(--oikotie-ink); }',
                '.title { font-size: 19px; }',
                '.button { margin-top: 8px; }'
            ]);

            const overlay = document.createElement('div');
            overlay.className = 'overlay';
            const card = document.createElement('div');
            card.className = 'card';
            const closeButton = document.createElement('button');
            closeButton.type = 'button';
            closeButton.className = 'close-button';
            closeButton.setAttribute('aria-label', 'Close');
            closeButton.appendChild(createStrokeIcon('M6 6l12 12M18 6 6 18', { strokeWidth: 2.2 }));
            closeButton.addEventListener('click', hideSchoolRequiredOverlay);
            const icon = document.createElement('div');
            icon.className = 'icon';
            icon.appendChild(createStrokeIcon(['M3 10 12 5l9 5-9 5-9-5Z', 'M7 12v4c0 1.5 2.2 3 5 3s5-1.5 5-3v-4'], { size: 22 }));
            const title = document.createElement('div');
            title.className = 'title';
            title.textContent = titleMessage;
            const description = document.createElement('div');
            description.className = 'description';
            description.textContent = descriptionMessage;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'button';
            const buttonLabel = document.createElement('span');
            buttonLabel.textContent = actionLabel;
            button.appendChild(buttonLabel);
            button.appendChild(createStrokeIcon('M5 12h14M13 6l6 6-6 6', { size: 16, stroke: '#c6f24e', strokeWidth: 2.5 }));
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
            card.appendChild(icon);
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
        loadOverlayFont,
        createMarkSvg,

        runWhenReady
    });
})();
