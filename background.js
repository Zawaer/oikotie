// Background service worker – open setup on install and keep the dynamic
// ADFS content script registration in sync with the user's settings.
//
// Every supported service (Kampus, Nova, Studeo) ends on the same school ADFS
// page, so one registration covers all of them.
//
// The ADFS domain is chosen per school at setup time, so it can't be a
// static content script in the manifest. It used to be injected from a
// tabs.onUpdated listener via scripting.executeScript, but that only fires
// while this background script happens to be running - Firefox-family
// browsers suspend it when idle, so that approach silently missed
// navigations once the extension went to sleep. registerContentScripts
// instead hands the pattern to the browser's own content-script engine,
// which injects it regardless of whether this script is currently awake.

const extensionApi = globalThis.browser || globalThis.chrome;

const ADFS_SCRIPT_ID = 'adfs-auto-login';

function getAdfsPattern(domain) {
    return `https://${domain}/adfs/ls/*`;
}

async function openSetupPage() {
    if (!extensionApi.runtime?.openOptionsPage) {
        throw new Error('Options page API is not available');
    }

    await extensionApi.runtime.openOptionsPage();
    return { opened: true, tabId: null, method: 'options' };
}

function sendAsyncResponse(sendResponse, action) {
    action()
        .then((result) => sendResponse(result))
        .catch((error) => {
            console.error('Oikotie:', error);
            sendResponse({
                opened: false,
                closed: 0,
                error: error?.message || String(error)
            });
        });
}

async function getRegisteredAdfsScript() {
    const scripts = await extensionApi.scripting.getRegisteredContentScripts({ ids: [ADFS_SCRIPT_ID] });
    return scripts[0] || null;
}

async function syncAdfsContentScript() {
    if (!extensionApi.scripting?.registerContentScripts) {
        return;
    }

    const settings = await extensionApi.storage.sync.get({
        adfsDomain: '',
        autoLoginEnabled: true,
        schoolSupported: true
    });

    const configuredDomain = (settings.adfsDomain || '').trim().toLowerCase();
    const wantsRegistration = Boolean(
        settings.autoLoginEnabled && settings.schoolSupported && configuredDomain
    );

    const pattern = wantsRegistration ? getAdfsPattern(configuredDomain) : null;
    const hasPermission = pattern && extensionApi.permissions?.contains
        ? await extensionApi.permissions.contains({ origins: [pattern] })
        : false;

    const existing = await getRegisteredAdfsScript();

    if (!wantsRegistration || !hasPermission) {
        if (existing) {
            await extensionApi.scripting.unregisterContentScripts({ ids: [ADFS_SCRIPT_ID] });
        }
        return;
    }

    if (existing && existing.matches?.length === 1 && existing.matches[0] === pattern) {
        return;
    }

    if (existing) {
        await extensionApi.scripting.unregisterContentScripts({ ids: [ADFS_SCRIPT_ID] });
    }

    await extensionApi.scripting.registerContentScripts([{
        id: ADFS_SCRIPT_ID,
        matches: [pattern],
        js: ['scripts/services.js', 'ui/i18n.js', 'scripts/content-common.js', 'scripts/adfs-content.js'],
        runAt: 'document_end'
    }]);
}

function runSync(context) {
    syncAdfsContentScript().catch((error) => {
        console.error(`Oikotie: Failed to sync ADFS content script (${context})`, error);
    });
}

extensionApi.runtime.onInstalled.addListener((details) => {
    runSync('onInstalled');

    if (details.reason === 'install') {
        openSetupPage().catch((error) => {
            console.error('Oikotie: Failed to open setup page on install', error);
        });
    }
});

if (extensionApi.runtime.onStartup) {
    extensionApi.runtime.onStartup.addListener(() => runSync('onStartup'));
}

if (extensionApi.storage?.onChanged) {
    extensionApi.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'sync') return;
        if (!('adfsDomain' in changes) && !('autoLoginEnabled' in changes) && !('schoolSupported' in changes)) {
            return;
        }
        runSync('storage.onChanged');
    });
}

extensionApi.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'openSetupPage') {
        sendAsyncResponse(sendResponse, openSetupPage);
        return true;
    }

    if (request.action === 'syncAdfsAutomation') {
        sendAsyncResponse(sendResponse, async () => {
            await syncAdfsContentScript();
            return { opened: true };
        });
        return true;
    }
});
