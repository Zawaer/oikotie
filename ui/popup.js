// Popup JavaScript for the Oikotie extension
// Uses extensionApi from i18n.js and the registry from scripts/services.js

document.addEventListener('DOMContentLoaded', async function() {
    const toggle = document.getElementById('autoLoginToggle');
    const autofillToggle = document.getElementById('autoFillToggle');
    const schoolDisplay = document.getElementById('schoolDisplay');
    const domainDisplay = document.getElementById('domainDisplay');
    const changeLink = document.getElementById('changeMunicipality');
    const serviceToggleContainer = document.getElementById('serviceToggles');

    const services = globalThis.OikotieServices || {};
    const serviceIds = services.SERVICE_IDS || [];
    const serviceInputs = new Map();

    const lang = await getLanguage();
    applyTranslations(lang);

    renderServiceToggles();
    await loadSettings(lang);
    toggle.addEventListener('change', handleToggleChange);
    autofillToggle.addEventListener('change', handleAutofillToggleChange);

    // One toggle per service, built from the registry so adding a service to
    // scripts/services.js is all it takes to get a switch here.
    function renderServiceToggles() {
        if (!serviceToggleContainer) {
            return;
        }

        for (const id of serviceIds) {
            const service = services.SERVICES[id];

            const row = document.createElement('label');
            row.className = 'toggle-row';

            const info = document.createElement('span');
            info.className = 'toggle-info';
            const name = document.createElement('span');
            name.className = 'toggle-name';
            name.textContent = service.name;
            const desc = document.createElement('span');
            desc.className = 'toggle-desc';
            try {
                desc.textContent = new URL(service.homeUrl).hostname;
            } catch (e) {
                desc.textContent = '';
            }
            info.appendChild(name);
            info.appendChild(desc);

            const switchWrap = document.createElement('span');
            switchWrap.className = 'toggle-switch';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.id = `serviceToggle-${id}`;
            input.addEventListener('change', () => handleServiceToggleChange(id, input));
            const slider = document.createElement('span');
            slider.className = 'slider';
            switchWrap.appendChild(input);
            switchWrap.appendChild(slider);

            row.appendChild(info);
            row.appendChild(switchWrap);
            serviceToggleContainer.appendChild(row);

            serviceInputs.set(id, input);
        }
    }

    // The per-service switches only mean anything while auto-login is on.
    function syncServiceToggleAvailability() {
        const enabled = toggle.checked;
        for (const input of serviceInputs.values()) {
            input.disabled = !enabled;
        }
        if (serviceToggleContainer) {
            serviceToggleContainer.style.opacity = enabled ? '1' : '0.5';
        }
    }

    async function handleServiceToggleChange(id, input) {
        const isEnabled = input.checked;
        try {
            const { servicesEnabled } = await extensionApi.storage.sync.get({
                servicesEnabled: services.DEFAULT_SERVICES_ENABLED || {}
            });
            await extensionApi.storage.sync.set({
                servicesEnabled: Object.assign({}, servicesEnabled, { [id]: isEnabled })
            });
        } catch (error) {
            console.error('Error saving service setting:', error);
            input.checked = !isEnabled;
        }
    }

    changeLink.addEventListener('click', openSettings);

    async function openSettings() {
        try {
            if (extensionApi.runtime?.openOptionsPage) {
                await extensionApi.runtime.openOptionsPage();
                window.close();
                return;
            }

            await new Promise((resolve, reject) => {
                extensionApi.runtime.sendMessage({ action: 'openSetupPage' }, (response) => {
                    if (extensionApi.runtime.lastError) {
                        reject(extensionApi.runtime.lastError);
                        return;
                    }

                    if (response?.opened === false) {
                        reject(new Error(response.error || 'Failed to open settings page'));
                        return;
                    }

                    resolve(response);
                });
            });
            window.close();
        } catch (error) {
            console.error('Error opening settings page:', error);
        }
    }

    async function loadSettings(lang) {
        try {
            const result = await extensionApi.storage.sync.get({
                autoLoginEnabled: true,
                autoFillCredentialsEnabled: true,
                schoolName: '',
                adfsDomain: '',
                servicesEnabled: services.DEFAULT_SERVICES_ENABLED || {}
            });

            toggle.checked = result.autoLoginEnabled;
            autofillToggle.checked = result.autoFillCredentialsEnabled;
            for (const [id, input] of serviceInputs) {
                // Absent means enabled: a service added in a later version must
                // not read as switched off for existing users.
                input.checked = result.servicesEnabled[id] !== false;
            }
            syncServiceToggleAvailability();
            const notSet = t(lang, 'popupNotSet');
            schoolDisplay.textContent = result.schoolName || notSet;
            domainDisplay.textContent = result.adfsDomain || notSet;
            return result;
        } catch (error) {
            console.error('Error loading settings:', error);
            toggle.checked = true;
            autofillToggle.checked = true;
            return {
                autoLoginEnabled: true,
                autoFillCredentialsEnabled: true,
                schoolName: '',
                adfsDomain: ''
            };
        }
    }


    async function handleToggleChange() {
        const isEnabled = toggle.checked;
        
        try {
            await extensionApi.storage.sync.set({
                autoLoginEnabled: isEnabled
            });
            syncServiceToggleAvailability();
        } catch (error) {
            console.error('Error saving settings:', error);
            toggle.checked = !isEnabled;
        }
    }

    async function handleAutofillToggleChange() {
        const isEnabled = autofillToggle.checked;

        try {
            await extensionApi.storage.sync.set({
                autoFillCredentialsEnabled: isEnabled
            });
        } catch (error) {
            console.error('Error saving autofill setting:', error);
            autofillToggle.checked = !isEnabled;
        }
    }

    // Add keyboard support
    document.addEventListener('keydown', function(event) {
        if (event.key === ' ' || event.key === 'Enter') {
            if (event.target === toggle) {
                event.preventDefault();
                toggle.checked = !toggle.checked;
                handleToggleChange();
            } else if (event.target === autofillToggle) {
                event.preventDefault();
                autofillToggle.checked = !autofillToggle.checked;
                handleAutofillToggleChange();
            }
        }
    });
});
