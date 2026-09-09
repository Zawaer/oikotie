// Content script for municipality ADFS sign-in pages (sts.edu.<municipality>.fi)
// Clicks the Sign in button when credentials are already autofilled

(function () {
    'use strict';

    const browserApi = globalThis.browser || globalThis.chrome;
    const common = globalThis.OikotieContentCommon || {};
    const createShadowHost = common.createShadowHost;
    const appendShadowStyles = common.appendShadowStyles;
    const isVisible = common.isVisible;
    const showLoadingOverlay = common.showLoadingOverlay;
    const removeElementWithFade = common.removeElementWithFade;
    const HINT_OVERLAY_ID = common.HINT_OVERLAY_ID;
    const LOADING_OVERLAY_ID = common.LOADING_OVERLAY_ID;
    const isFirefoxLikeBrowser = /Firefox\//.test(navigator.userAgent || '');
    const svgNamespace = 'http://www.w3.org/2000/svg';

    function createSvgElement(tagName, attributes) {
        const element = document.createElementNS(svgNamespace, tagName);
        Object.entries(attributes || {}).forEach(([name, value]) => {
            element.setAttribute(name, value);
        });
        return element;
    }

    function createAnimatedCircle({ strokeWidth, opacityValues, begin }) {
        const circle = createSvgElement('circle', {
            cx: '70',
            cy: '70',
            fill: 'none',
            stroke: 'var(--oikotie-accent)',
            'stroke-width': strokeWidth
        });
        circle.appendChild(createSvgElement('animate', {
            attributeName: 'r',
            values: '0;48',
            dur: '1.8s',
            begin,
            repeatCount: 'indefinite',
            calcMode: 'spline',
            keySplines: '0.22 1 0.36 1'
        }));
        circle.appendChild(createSvgElement('animate', {
            attributeName: 'opacity',
            values: opacityValues,
            dur: '1.8s',
            begin,
            repeatCount: 'indefinite',
            calcMode: 'spline',
            keySplines: '0.22 1 0.36 1'
        }));
        return circle;
    }

    function createCursorAnimationSvg() {
        const svg = createSvgElement('svg', {
            width: '104',
            height: '104',
            viewBox: '0 0 140 140',
            xmlns: svgNamespace
        });
        svg.appendChild(createAnimatedCircle({
            strokeWidth: '1.8',
            opacityValues: '0.7;0',
            begin: '0.85s'
        }));
        svg.appendChild(createAnimatedCircle({
            strokeWidth: '1.2',
            opacityValues: '0.42;0',
            begin: '1.08s'
        }));
        svg.appendChild(createSvgElement('path', {
            d: 'M70 70L70 112L80 102L86 118L92 115.5L86 100L99 100L70 70Z',
            fill: 'var(--oikotie-surface)',
            stroke: 'var(--oikotie-text)',
            'stroke-width': '2',
            'stroke-linejoin': 'round',
            'stroke-linecap': 'round'
        }));
        return svg;
    }

    function showContinueHint(titleMessage, subtitleMessage) {
        try {
            const created = createShadowHost(HINT_OVERLAY_ID, {
                zIndex: 2147483646,
                pointerEvents: 'none'
            });
            if (!created) {
                return;
            }

            const { host, shadowRoot } = created;
            appendShadowStyles(shadowRoot, [
                common.overlayHostRule(2147483646, 'none'),
                ...common.OVERLAY_BASE_RULES,
                '@keyframes clickCursor { 0%, 30% { transform: scale(1); } 45% { transform: scale(0.88); } 65%, 100% { transform: scale(1); } }',
                '@keyframes fadeInScale { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }',
                '.card { position: relative; gap: 14px; width: min(320px, calc(100vw - 32px)); padding: 22px 30px 26px; animation: fadeInScale 0.35s cubic-bezier(0.22, 1, 0.36, 1) both; }',
                '.cursor-wrap { width: 104px; height: 104px; animation: clickCursor 1.8s cubic-bezier(0.22, 1, 0.36, 1) infinite; }',
                '.cursor-wrap svg { display: block; width: 100%; height: 100%; }',
                // One sentence of instruction rather than a heading, so it sits
                // a step below the shared title weight.
                '.title { max-width: 270px; font-size: 15px; font-weight: 500; line-height: 1.45; letter-spacing: 0.2px; }',
                // Deliberately not a positioning context: the tooltip is sized
                // and placed against the card instead. Anchored to this 18px
                // button it hung off the card edge and covered the very
                // sentence it was explaining.
                '.info-wrap { position: static; display: inline-flex; align-items: center; margin-left: 5px; vertical-align: -3px; pointer-events: auto; }',
                '.info-button { width: 18px; height: 18px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--oikotie-border); border-radius: 999px; background: var(--oikotie-raised); color: var(--oikotie-muted); font-family: var(--oikotie-font); font-size: 11px; font-weight: 700; line-height: 1; cursor: help; }',
                '.info-button:hover { color: var(--oikotie-text); border-color: var(--oikotie-muted); }',
                '.info-button:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--oikotie-accent-ring); }',
                // A light panel, like every other surface in the extension. It
                // used to be a dark tooltip, which was the only inverted
                // surface anywhere and read as belonging to the host page.
                '.tooltip { position: absolute; bottom: calc(100% + 10px); left: 0; right: 0; padding: 12px 14px; border: 1px solid var(--oikotie-border); border-radius: var(--oikotie-radius-control); background: var(--oikotie-raised); color: var(--oikotie-body); font-family: var(--oikotie-font); font-size: 12.5px; font-weight: 400; line-height: 1.55; letter-spacing: 0; text-align: left; box-shadow: var(--oikotie-shadow); box-sizing: border-box; opacity: 0; transform: translateY(4px); transition: opacity 0.16s ease, transform 0.16s ease; pointer-events: none; visibility: hidden; }',
                // Two stacked triangles so the arrow keeps the panel's border.
                '.tooltip::after { content: ""; position: absolute; top: 100%; left: 50%; transform: translateX(-50%); border: 7px solid transparent; border-top-color: var(--oikotie-border); }',
                '.tooltip::before { content: ""; position: absolute; top: calc(100% - 1px); left: 50%; transform: translateX(-50%); border: 6px solid transparent; border-top-color: var(--oikotie-raised); z-index: 1; }',
                '.info-wrap:hover .tooltip, .info-wrap:focus-within .tooltip { opacity: 1; transform: translateY(0); visibility: visible; }',
                '@media (prefers-reduced-motion: reduce) { .cursor-wrap { animation: none; } .card { animation: none; } }'
            ]);

            const overlay = document.createElement('div');
            overlay.className = 'overlay';
            const card = document.createElement('div');
            card.className = 'card';
            const cursorWrap = document.createElement('div');
            cursorWrap.className = 'cursor-wrap';
            cursorWrap.setAttribute('aria-hidden', 'true');
            cursorWrap.appendChild(createCursorAnimationSvg());
            const title = document.createElement('p');
            title.className = 'title';
            const titleText = document.createElement('span');
            titleText.textContent = titleMessage;
            const infoWrap = document.createElement('span');
            infoWrap.className = 'info-wrap';
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.setAttribute('role', 'tooltip');
            tooltip.textContent = subtitleMessage;
            const infoButton = document.createElement('button');
            infoButton.type = 'button';
            infoButton.className = 'info-button';
            infoButton.setAttribute('aria-label', subtitleMessage);
            infoButton.textContent = 'i';

            infoWrap.appendChild(tooltip);
            infoWrap.appendChild(infoButton);
            title.appendChild(titleText);
            title.appendChild(infoWrap);
            card.appendChild(cursorWrap);
            card.appendChild(title);
            overlay.appendChild(card);
            shadowRoot.appendChild(overlay);
            document.documentElement.appendChild(host);
        } catch (e) {}
    }

    async function isAutofillAutoContinueEnabled() {
        try {
            const result = await browserApi.storage.sync.get({ autoFillCredentialsEnabled: true });
            return result.autoFillCredentialsEnabled;
        } catch (error) {
            console.error('Oikotie: Error reading autofill setting on ADFS page', error);
            return true;
        }
    }

    function getAdfsElements() {
        const userField = document.querySelector('#userNameInput, input[name="UserName"], input[type="email"], input[type="text"]');
        const passField = document.querySelector('#passwordInput, input[name="Password"], input[type="password"]');
        const signInButton = document.querySelector('#submitButton');
        const form = (signInButton && signInButton.form) || (passField && passField.form) || document.querySelector('form');

        return { userField, passField, signInButton, form };
    }

    function getCredentialState() {
        const { userField, passField } = getAdfsElements();
        const userValue = (userField && userField.value || '').trim();
        const passValue = (passField && passField.value || '').trim();

        return {
            userLength: userValue.length,
            passLength: passValue.length,
            actuallyFilled: userValue.length > 0 && passValue.length > 0
        };
    }

    function credentialsActuallyFilled() {
        return getCredentialState().actuallyFilled;
    }

    function nudgeField(field) {
        if (!field) {
            return;
        }

        try {
            field.focus();
        } catch (e) {}

        try {
            field.blur();
        } catch (e) {}
    }

    function nudgeCredentialFields() {
        if (isFirefoxLikeBrowser) {
            return;
        }

        const { userField, passField } = getAdfsElements();
        nudgeField(userField);
        nudgeField(passField);
    }

    function clickSignInButton() {
        const { userField, passField, signInButton, form } = getAdfsElements();
        if (!signInButton || !isVisible(signInButton) || signInButton.disabled) {
            return false;
        }

        try {
            if (isFirefoxLikeBrowser) {
                if (typeof signInButton.click === 'function') {
                    signInButton.click();
                } else if (form && typeof form.requestSubmit === 'function') {
                    form.requestSubmit(signInButton);
                }
                console.log('Oikotie: Clicked ADFS Sign in button (Firefox-like)');
                return true;
            }

            nudgeField(userField);
            nudgeField(passField);
            signInButton.focus && signInButton.focus();
            signInButton.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
            signInButton.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
            signInButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
            if (typeof signInButton.click === 'function') {
                signInButton.click();
            }

            if (form && typeof form.requestSubmit === 'function') {
                setTimeout(() => {
                    try {
                        if (window.location.pathname.startsWith('/adfs/ls/')) {
                            form.requestSubmit(signInButton);
                        }
                    } catch (e) {}
                }, 250);
            }

            console.log('Oikotie: Clicked ADFS Sign in button');
            return true;
        } catch (error) {
            console.error('Oikotie: Failed to click ADFS Sign in button', error);
            return false;
        }
    }

    function installFieldWatchers(onFilled) {
        const { userField, passField } = getAdfsElements();
        const fields = [userField, passField].filter(Boolean);

        for (const field of fields) {
            const handler = () => {
                if (credentialsActuallyFilled()) {
                    onFilled();
                }
            };
            field.addEventListener('input', handler, { passive: true });
            field.addEventListener('change', handler, { passive: true });
            field.addEventListener('blur', handler, { passive: true });
            field.addEventListener('focus', handler, { passive: true });
        }
    }

    async function runADFSAutomation() {
        const currentHost = window.location.hostname;
        let configuredDomain;
        try {
            const result = await browserApi.storage.sync.get({ adfsDomain: '' });
            configuredDomain = result.adfsDomain;
        } catch (e) {
            configuredDomain = '';
        }

        if (!configuredDomain) {
            console.log('Oikotie: No ADFS domain configured, skipping. Open extension options to set your login domain.');
            return;
        }

        if (currentHost !== configuredDomain) {
            return;
        }

        console.log('Oikotie: Running on', currentHost, 'ADFS page');

        // The school's ADFS page is a general-purpose sign-in page for the whole
        // municipality, so only automate it when the user got here through one
        // of the services we handle.
        const serviceId = await common.detectFlowService(browserApi);
        if (!serviceId) {
            console.log('Oikotie: ADFS page not part of a known service flow, skipping');
            return;
        }

        if (!(await common.isAutomationEnabled(browserApi, serviceId))) {
            console.log(`Oikotie: Auto-login disabled for ${serviceId}, skipping ADFS Sign in click`);
            return;
        }

        if (!(await isAutofillAutoContinueEnabled())) {
            console.log('Oikotie: Autofill auto-continue disabled, skipping ADFS auto-click');
            return;
        }

        const uiLanguage = await getLanguage();
        if (isFirefoxLikeBrowser) {
            showLoadingOverlay(t(uiLanguage, 'commonLoggingInLabel'));
        } else {
            showContinueHint(
                t(uiLanguage, 'adfsContinueTitle'),
                t(uiLanguage, 'adfsContinueDescription')
            );
        }

        let finished = false;
        let attemptingContinue = false;

        const tryContinue = () => {
            if (finished || attemptingContinue) {
                return finished;
            }

            attemptingContinue = true;
            try {
                const state = getCredentialState();
                if (state.actuallyFilled && clickSignInButton()) {
                    finished = true;
                    removeElementWithFade(HINT_OVERLAY_ID);
                    return true;
                }
                return false;
            } finally {
                attemptingContinue = false;
            }
        };

        installFieldWatchers(() => {
            tryContinue();
        });

        if (tryContinue()) {
            return;
        }

        if (!isFirefoxLikeBrowser) {
            // Chrome can show autofill styling before values are committed to the page.
            // Nudge focus/blur and then wait for actual input values only.
            nudgeCredentialFields();
        }

        await new Promise((resolve) => setTimeout(resolve, isFirefoxLikeBrowser ? 300 : 1500));

        if (tryContinue()) {
            return;
        }

        let attempts = 0;
        const maxAttempts = isFirefoxLikeBrowser ? 24 : null;
        const interval = setInterval(() => {
            attempts += 1;
            if (!isFirefoxLikeBrowser && attempts % 5 === 0) {
                nudgeCredentialFields();
            }

            if (tryContinue()) {
                clearInterval(interval);
                return;
            }

            if (maxAttempts && attempts >= maxAttempts) {
                clearInterval(interval);
                removeElementWithFade(LOADING_OVERLAY_ID);
                const state = getCredentialState();
                console.log('Oikotie: ADFS fields never became real input values in time; not clicking Sign in', {
                    userLength: state.userLength,
                    passLength: state.passLength,
                    browser: isFirefoxLikeBrowser ? 'firefox-like' : 'chromium-like'
                });
            }
        }, isFirefoxLikeBrowser ? 250 : 400);
    }

    common.runWhenReady(runADFSAutomation);
})();
