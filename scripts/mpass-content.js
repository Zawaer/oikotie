// Content script for mpass-proxy.csc.fi (the shared MPASSid school picker).
//
// Every supported service funnels into this page, so nothing here is
// service-specific - it selects the school the user configured and continues.
// The only service-aware part is the guard at the top: this page is reachable
// from plenty of sites we do not handle, so we automate it only when we can
// tell the user arrived from one of ours.

(function () {
    'use strict';

    const extensionApi = globalThis.browser || globalThis.chrome;
    const common = globalThis.OikotieContentCommon || {};

    // The school list is fetched over the network as you type. On a slow link
    // that request can take far longer than it feels like it should, so the
    // budget here is generous for the same reason the MPASSid button's is: a
    // short fixed budget is exactly what made this fail on throttled
    // connections, giving up seconds before the results arrived.
    const SCHOOL_SEARCH_TIMEOUT_MS = 45000;
    const SCHOOL_POLL_INTERVAL_MS = 400;
    const SEARCH_RETRY_INTERVAL_MS = 2500;

    // "Continue" is not necessarily clickable the instant a school is picked.
    const CONTINUE_POLL_INTERVAL_MS = 250;
    const CONTINUE_TIMEOUT_MS = 15000;

    console.log('Oikotie: Running on mpass-proxy.csc.fi');

    // Choose a school and move on. Waiting for Continue to actually be there
    // and enabled beats a fixed delay: the old 300 ms guess was fine locally
    // and too short as soon as the connection was not.
    function selectSchoolAndContinue(schoolItem) {
        try {
            schoolItem.click();
        } catch (error) {
            console.error('Oikotie: Failed to click school item', error);
            return;
        }

        const started = Date.now();
        const timer = setInterval(() => {
            const continueButton = document.querySelector('#continueButton');
            if (continueButton && !continueButton.disabled && common.isVisible(continueButton)) {
                clearInterval(timer);
                try {
                    continueButton.click();
                    console.log('Oikotie: Clicked continue after selecting school');
                } catch (error) {
                    console.error('Oikotie: Failed to click continue', error);
                }
                return;
            }

            if (Date.now() - started > CONTINUE_TIMEOUT_MS) {
                clearInterval(timer);
                console.log('Oikotie: Continue button never became clickable');
                common.hideLoadingOverlay();
            }
        }, CONTINUE_POLL_INTERVAL_MS);
    }

    // Find school item by text content (matches configured school name)
    function findSchoolByText(searchTerm) {
        const items = document.querySelectorAll('[id^="item-"], .listItem, .schoolItem, li, div[role="option"]');
        const term = (searchTerm || '').toLowerCase();
        const termParts = term.split(/\s+/).filter(Boolean);
        for (const item of items) {
            const text = (item.textContent || '').toLowerCase();
            if (termParts.every((p) => text.includes(p)) || text.includes(term)) {
                return item;
            }
        }
        return null;
    }

    // Helper: observe for a selector to appear in the DOM and resolve with the element (or null on timeout)
    function observeSelector(selector, timeout = 10000) {
        return new Promise((resolve) => {
            const existing = document.querySelector(selector);
            if (existing) {
                return resolve(existing);
            }

            const observer = new MutationObserver(() => {
                const el = document.querySelector(selector);
                if (el) {
                    observer.disconnect();
                    resolve(el);
                }
            });

            observer.observe(document.documentElement || document.body, {
                childList: true,
                subtree: true
            });

            setTimeout(() => {
                try { observer.disconnect(); } catch (e) {}
                resolve(null);
            }, timeout);
        });
    }

    // Type the school name the way a person would, so the page's own search
    // handler fires. Repeating this is the whole point of extracting it: see
    // the retry loop below.
    function simulateSearchTyping(searchInput, searchTerm) {
        try {
            searchInput.focus();
            searchInput.click();
            searchInput.value = '';

            for (let i = 0; i < searchTerm.length; i++) {
                searchInput.value = searchTerm.substring(0, i + 1);
                searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: searchTerm[i], bubbles: true }));
                searchInput.dispatchEvent(new KeyboardEvent('keypress', { key: searchTerm[i], bubbles: true }));
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                searchInput.dispatchEvent(new KeyboardEvent('keyup', { key: searchTerm[i], bubbles: true }));
            }

            searchInput.dispatchEvent(new Event('change', { bubbles: true }));
            searchInput.dispatchEvent(new Event('blur', { bubbles: true }));
            return true;
        } catch (e) {
            console.warn('Oikotie: Error during search input simulation', e);
            return false;
        }
    }

    // State detection & handlers – uses configured school from storage
    async function handleMPassProxyStates() {
        const { schoolName } = await common.getSettings(extensionApi);
        const searchTerm = (schoolName || '').trim().toLowerCase();
        if (!searchTerm) {
            console.log('Oikotie: No school configured, skipping school selection');
            return 'no_school_configured';
        }

        // State 1: Check if there's a "last selected" school
        const lastSelectedSchool = document.querySelector('#selectedList > div > div.listItem > div');
        if (lastSelectedSchool) {
            const lastText = (lastSelectedSchool.textContent || '').toLowerCase();
            if (lastText.includes(searchTerm) || searchTerm.includes(lastText.split(/[\s,]+/)[0])) {
                console.log('Oikotie: Found last selected school matching config, clicking it');
                lastSelectedSchool.click();
                return 'clicked_last_selected';
            }
        }

        // State 2: Check if we need to search for and select the configured school
        const searchInput = document.querySelector('#searchschoolterm');
        if (searchInput) {
            const currentValue = (searchInput.value || '').trim().toLowerCase();
            const minMatch = searchTerm.substring(0, Math.min(4, searchTerm.length));

            if (!currentValue || !currentValue.includes(minMatch)) {
                console.log('Oikotie: Filling search input with', searchTerm);
                simulateSearchTyping(searchInput, searchTerm);
                return 'searching_school';
            }

            const schoolItem = findSchoolByText(searchTerm);
            const continueButton = document.querySelector('#continueButton');

            if (schoolItem && continueButton) {
                console.log('Oikotie: Found school and continue button');
                selectSchoolAndContinue(schoolItem);
                return 'clicked_search_result';
            }
        }

        // State 3: Check if page is automatically redirecting
        const scriptTags = document.querySelectorAll('script');
        for (let script of scriptTags) {
            if (script.textContent &&
                (script.textContent.includes('location.href') ||
                 script.textContent.includes('window.location') ||
                 script.textContent.includes('redirect'))) {
                console.log('Oikotie: Detected automatic redirect script, waiting...');
                return 'auto_redirecting';
            }
        }

        const metaRefresh = document.querySelector('meta[http-equiv="refresh"]');
        if (metaRefresh) {
            console.log('Oikotie: Detected meta refresh, waiting for automatic redirect...');
            return 'auto_redirecting';
        }

        return 'unknown_state';
    }

    async function waitAndTryClick() {
        // Which of our services sent the user here? Null means we have no
        // evidence this MPASSid page belongs to a flow we started.
        const serviceId = await common.detectFlowService(extensionApi);

        if (!serviceId) {
            console.log('Oikotie: MPASSid page not part of a known service flow, skipping');
            return;
        }

        if (!await common.isAutomationEnabled(extensionApi, serviceId)) {
            console.log(`Oikotie: Auto-login disabled for ${serviceId}, skipping automation`);
            return;
        }

        console.log(`Oikotie: Handling MPASSid picker for ${serviceId}`);

        const uiLanguage = await getLanguage();
        const { schoolName } = await common.getSettings(extensionApi);
        const searchTerm = (schoolName || '').trim().toLowerCase();
        if (!searchTerm) {
            console.log('Oikotie: No school configured, waiting for user to choose one in settings');
            common.hideLoadingOverlay();
            common.showSchoolRequiredOverlay(
                extensionApi,
                t(uiLanguage, 'mpassSchoolRequiredTitle'),
                t(uiLanguage, 'mpassSchoolRequiredDescription'),
                t(uiLanguage, 'mpassSchoolRequiredAction')
            );
            return;
        }

        console.log('Oikotie: Auto-login is enabled, proceeding...');
        common.showLoadingOverlay(t(uiLanguage, 'commonLoggingInLabel'));

        // First: try immediate presence of last-selected school (only if it matches configured school)
        const lastNow = document.querySelector('#selectedList > div > div.listItem > div');
        if (lastNow && searchTerm) {
            const lastText = (lastNow.textContent || '').toLowerCase();
            if (lastText.includes(searchTerm) || searchTerm.split(/\s+/).some((p) => lastText.includes(p))) {
                console.log('Oikotie: Found last selected school matching config, clicking it');
                try { lastNow.click(); } catch (e) { console.error('Error clicking last selected', e); }
                return;
            }
        }

        // Wait briefly for the last-selected school to appear. If it matches config, click and stop.
        const observedLast = await observeSelector('#selectedList > div > div.listItem > div', 2000);
        if (observedLast && searchTerm) {
            const lastText = (observedLast.textContent || '').toLowerCase();
            if (lastText.includes(searchTerm) || searchTerm.split(/\s+/).some((p) => lastText.includes(p))) {
                console.log('Oikotie: Observed last selected school matching config, clicking');
                try { observedLast.click(); } catch (e) { console.error('Error clicking observed element', e); }
                return;
            }
        }

        // If last-selected did not appear within the timeout, proceed to search/other handling
        const result = await handleMPassProxyStates();

        if (result === 'no_school_configured') {
            console.log('Oikotie: Configure your school in extension options');
            common.hideLoadingOverlay();
            common.showSchoolRequiredOverlay(
                extensionApi,
                t(uiLanguage, 'mpassSchoolRequiredTitle'),
                t(uiLanguage, 'mpassSchoolRequiredDescription'),
                t(uiLanguage, 'mpassSchoolRequiredAction')
            );
            return;
        }

        if (result === 'clicked_last_selected' || result === 'clicked_search_result') {
            console.log('Oikotie: Successfully handled mpass-proxy state:', result);
            return;
        }

        if (result === 'auto_redirecting') {
            console.log('Oikotie: Page is auto-redirecting, waiting...');
            return;
        }

        if (result === 'searching_school') {
            console.log('Oikotie: Initiated school search, waiting for completion...');

            await new Promise(r => setTimeout(r, 800));

            const schoolItem = findSchoolByText(searchTerm);
            if (schoolItem) {
                console.log('Oikotie: School found, clicking it');
                selectSchoolAndContinue(schoolItem);
                return;
            }

            console.log('Oikotie: School not found immediately, observing...');

            // Polling for results is not enough on a slow connection. The page
            // fetches its school list asynchronously, and if we finish typing
            // before that arrives, its search runs against an empty dataset and
            // finds nothing. The input then already holds the school name, so
            // nothing ever fires the search again and the page sits there
            // forever with a query that has already failed. Re-typing
            // periodically makes it search again once the data is really there.
            const start = Date.now();
            let lastRetry = Date.now();
            const checkInterval = setInterval(() => {
                const el = findSchoolByText(searchTerm);
                if (el) {
                    clearInterval(checkInterval);
                    console.log('Oikotie: Found school item, clicking it');
                    selectSchoolAndContinue(el);
                    return;
                }

                if (Date.now() - lastRetry >= SEARCH_RETRY_INTERVAL_MS) {
                    lastRetry = Date.now();
                    const input = document.querySelector('#searchschoolterm');
                    if (input) {
                        console.log('Oikotie: No results yet, re-running the school search');
                        simulateSearchTyping(input, searchTerm);
                    }
                }

                if (Date.now() - start > SCHOOL_SEARCH_TIMEOUT_MS) {
                    clearInterval(checkInterval);
                    console.log('Oikotie: School item not found after', SCHOOL_SEARCH_TIMEOUT_MS, 'ms');
                    common.hideLoadingOverlay();
                }
            }, SCHOOL_POLL_INTERVAL_MS);

            return;
        }

        // Retry logic for unknown state
        if (result === 'unknown_state') {
            const started = Date.now();
            const interval = setInterval(async () => {
                const retryResult = await handleMPassProxyStates();
                if (retryResult !== 'unknown_state') {
                    clearInterval(interval);
                    console.log('Oikotie: Successfully handled state on retry:', retryResult);
                    return;
                }
                if (Date.now() - started > SCHOOL_SEARCH_TIMEOUT_MS) {
                    clearInterval(interval);
                    console.log('Oikotie: Could not handle mpass-proxy state in time');
                    common.hideLoadingOverlay();
                }
            }, 1500);
        }
    }

    common.runWhenReady(waitAndTryClick);
})();
