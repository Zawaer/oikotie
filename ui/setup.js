// Setup page – user enters their municipality's ADFS domain and selects school
// Uses extensionApi from i18n.js (loaded first)

async function closeSetupTab() {
    try {
        window.close();
    } catch (e) {}

    await new Promise((resolve) => setTimeout(resolve, 100));
    if (!window.closed && !document.hidden) {
        throw new Error('Window did not close');
    }
}

function showSuccessOverlay(message) {
    if (document.getElementById('kampus-setup-success-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'kampus-setup-success-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483646;';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'width:100vw;height:100vh;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;';
    const card = document.createElement('div');
    card.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:16px;padding:28px 40px;background:#f7f7fb;color:#1f2937;border-radius:14px;box-shadow:0 12px 28px rgba(0,0,0,0.2);font-family:"Segoe UI",Roboto,Arial,sans-serif;box-sizing:border-box;';
    const checkWrap = document.createElement('div');
    checkWrap.style.cssText = 'width:48px;height:48px;display:flex;align-items:center;justify-content:center;';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '48');
    svg.setAttribute('height', '48');
    svg.setAttribute('viewBox', '0 0 48 48');
    svg.setAttribute('fill', 'none');
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '24');
    circle.setAttribute('cy', '24');
    circle.setAttribute('r', '24');
    circle.setAttribute('fill', '#28a745');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M14 24l8 8 12-14');
    path.setAttribute('stroke', '#fff');
    path.setAttribute('stroke-width', '2.5');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(circle);
    svg.appendChild(path);
    checkWrap.appendChild(svg);
    const label = document.createElement('div');
    label.style.cssText = 'font-size:15px;font-weight:500;letter-spacing:0.3px;';
    label.textContent = message;
    card.appendChild(checkWrap);
    card.appendChild(label);
    wrap.appendChild(card);
    overlay.appendChild(wrap);
    document.documentElement.appendChild(overlay);
}

function hideSuccessOverlay() {
    const el = document.getElementById('kampus-setup-success-overlay');
    if (el) {
        el.style.opacity = '0';
        el.style.transition = 'opacity 0.2s ease';
        setTimeout(() => el.remove(), 250);
    }
}

function normalizeDomain(value) {
    const s = (value || '').trim().toLowerCase();
    return s.replace(/^https?:\/\//, '').replace(/\/.*$/, '').split('/')[0];
}

function getAdfsPattern(domain) {
    return `https://${domain}/adfs/ls/*`;
}

function normalizeSchoolSearchValue(value) {
    return (value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

const schoolSupportRequestUrl = 'https://forms.gle/yqLxByjw8DdKbaWe9';

const preconfiguredSchoolDomainGroups = Array.isArray(globalThis.KAMPUS_PRECONFIGURED_SCHOOL_DOMAIN_GROUPS)
    ? globalThis.KAMPUS_PRECONFIGURED_SCHOOL_DOMAIN_GROUPS
    : [];
const preconfiguredMpassTitleDomains =
    globalThis.KAMPUS_PRECONFIGURED_MPASS_TITLE_DOMAINS &&
    typeof globalThis.KAMPUS_PRECONFIGURED_MPASS_TITLE_DOMAINS === 'object' &&
    !Array.isArray(globalThis.KAMPUS_PRECONFIGURED_MPASS_TITLE_DOMAINS)
        ? globalThis.KAMPUS_PRECONFIGURED_MPASS_TITLE_DOMAINS
        : {};

function assignPreconfiguredSchoolDomain(domainBySchool, schoolName, domain, sourceLabel) {
    const normalizedSchoolName = typeof schoolName === 'string' ? schoolName.trim() : '';
    if (!normalizedSchoolName || !domain) {
        return;
    }

    const existingDomain = domainBySchool[normalizedSchoolName];
    if (existingDomain && existingDomain !== domain) {
        console.warn(
            `Oikotie: School "${normalizedSchoolName}" is assigned to multiple preconfigured domains (${existingDomain}, ${domain}) in ${sourceLabel}. Using the latest value.`
        );
    }

    domainBySchool[normalizedSchoolName] = domain;
}

function buildExplicitPreconfiguredSchoolDomains(groups, domainBySchool = Object.create(null)) {
    groups.forEach((group, groupIndex) => {
        const domain = normalizeDomain(group?.domain || '');
        const schools = Array.isArray(group?.schools) ? group.schools : [];

        if (!domain || schools.length === 0) {
            return;
        }

        schools.forEach((schoolName) => {
            assignPreconfiguredSchoolDomain(
                domainBySchool,
                schoolName,
                domain,
                `manual group #${groupIndex + 1}`
            );
        });
    });

    return domainBySchool;
}

function getMpassSchoolNames(group) {
    const schools = Array.isArray(group?.schools) ? group.schools : [];
    const schoolNames = schools
        .map((school) => {
            if (typeof school === 'string') {
                return school.trim();
            }
            return typeof school?.school === 'string' ? school.school.trim() : '';
        })
        .filter(Boolean);

    if (schoolNames.length === 0 && typeof group?.name === 'string') {
        const groupName = group.name.trim();
        if (groupName) {
            schoolNames.push(groupName);
        }
    }

    return schoolNames;
}

async function loadMpassGroups() {
    const response = await fetch(extensionApi.runtime.getURL('mpassid_response.json'));
    if (!response.ok) {
        throw new Error('Failed to load bundled MPASSid response');
    }

    const data = await response.json();
    if (!Array.isArray(data?.lista)) {
        throw new Error('Bundled MPASSid response does not contain a group list');
    }

    return data.lista;
}

function buildMpassTitlePreconfiguredSchoolDomains(
    groups,
    domainsByTitle,
    domainBySchool = Object.create(null)
) {
    groups.forEach((group) => {
        const title = typeof group?.title === 'string' ? group.title.trim() : '';
        const domain = normalizeDomain(domainsByTitle[title] || '');

        if (!title || !domain) {
            return;
        }

        getMpassSchoolNames(group).forEach((schoolName) => {
            assignPreconfiguredSchoolDomain(
                domainBySchool,
                schoolName,
                domain,
                `MPASSid title "${title}"`
            );
        });
    });

    return domainBySchool;
}

let preconfiguredSchoolDomains = Object.create(null);

async function initPreconfiguredSchoolDomains() {
    const domainBySchool = Object.create(null);

    try {
        const mpassGroups = await loadMpassGroups();
        buildMpassTitlePreconfiguredSchoolDomains(
            mpassGroups,
            preconfiguredMpassTitleDomains,
            domainBySchool
        );
    } catch (e) {
        console.warn('Oikotie: Could not load MPASSid grouped domain config:', e);
    }

    buildExplicitPreconfiguredSchoolDomains(preconfiguredSchoolDomainGroups, domainBySchool);
    preconfiguredSchoolDomains = domainBySchool;
    return preconfiguredSchoolDomains;
}

function getLockedSchoolDomain(schoolName) {
    return preconfiguredSchoolDomains[(schoolName || '').trim()] || '';
}

function clearNode(node) {
    while (node?.firstChild) {
        node.removeChild(node.firstChild);
    }
}

function hideUnsupportedSchoolMessage(messageElement) {
    messageElement?.classList.remove('show');
    clearNode(messageElement);
}

function showUnsupportedSchoolMessage(messageElement, lang) {
    if (!messageElement) {
        return;
    }

    clearNode(messageElement);

    const title = document.createElement('strong');
    title.textContent = t(lang, 'setupUnsupportedSchoolTitle');

    const description = document.createElement('span');
    description.textContent = t(lang, 'setupUnsupportedSchoolDescription');

    const supportLink = document.createElement('a');
    supportLink.href = schoolSupportRequestUrl;
    supportLink.target = '_blank';
    supportLink.rel = 'noopener noreferrer';
    supportLink.textContent = t(lang, 'setupRequestSchoolSupport');

    messageElement.appendChild(title);
    messageElement.appendChild(description);
    messageElement.appendChild(document.createTextNode(' '));
    messageElement.appendChild(supportLink);
    messageElement.classList.add('show');
}

function updateUnsupportedSchoolMessage(schoolName, messageElement, lang, { selected = false } = {}) {
    if (selected && schoolName && !getLockedSchoolDomain(schoolName)) {
        showUnsupportedSchoolMessage(messageElement, lang);
        return;
    }

    hideUnsupportedSchoolMessage(messageElement);
}

function applySchoolDomainRules(schoolName, domainInput, { selected = false } = {}) {
    const lockedDomain = getLockedSchoolDomain(schoolName);
    const previousLockedDomain = domainInput.dataset.lockedDomain || '';
    const normalizedSchoolName = (schoolName || '').trim();

    if (lockedDomain) {
        domainInput.value = lockedDomain;
        domainInput.disabled = true;
        domainInput.required = true;
        domainInput.dataset.lockedDomain = lockedDomain;
        delete domainInput.dataset.unsupportedSchool;
        return true;
    }

    if (previousLockedDomain && normalizeDomain(domainInput.value) === previousLockedDomain) {
        domainInput.value = '';
    }

    if (selected && normalizedSchoolName) {
        domainInput.value = '';
        domainInput.disabled = true;
        domainInput.required = false;
        domainInput.dataset.unsupportedSchool = 'true';
        delete domainInput.dataset.lockedDomain;
        return false;
    }

    domainInput.disabled = false;
    domainInput.required = true;
    delete domainInput.dataset.lockedDomain;
    delete domainInput.dataset.unsupportedSchool;
    return false;
}

async function ensureAdfsPermission(domain) {
    const optionalOrigins = extensionApi.runtime.getManifest()?.optional_host_permissions || [];
    const supportsOptionalAdfs = optionalOrigins.includes('https://*/adfs/ls/*');

    if (!supportsOptionalAdfs || !extensionApi.permissions?.request) {
        return true;
    }

    const pattern = getAdfsPattern(domain);
    try {
        // Firefox/Zen requires permissions.request() to stay directly tied to
        // the Save click. A permissions.contains() await before this can cause
        // the prompt to fail without appearing.
        return await extensionApi.permissions.request({ origins: [pattern] });
    } catch (error) {
        console.error('Oikotie: Failed to request ADFS permission', error);
        return false;
    }
}

function buildSchoolNamesFromMpassGroups(groups) {
    const schoolNames = new Set();

    groups.forEach((group) => {
        getMpassSchoolNames(group).forEach((schoolName) => {
            schoolNames.add(schoolName);
        });
    });

    return Array.from(schoolNames).sort((a, b) =>
        a.localeCompare(b, 'fi', { sensitivity: 'base' })
    );
}

async function loadSchoolNames() {
    try {
        const mpassGroups = await loadMpassGroups();
        return buildSchoolNamesFromMpassGroups(mpassGroups);
    } catch (e) {
        console.error('Failed to load school names:', e);
        return [];
    }
}

// Initialize school selector
async function initSchoolSelector(getCurrentLang) {
    const searchInput = document.getElementById('schoolSearch');
    const dropdown = document.getElementById('schoolDropdown');
    const schoolNameHidden = document.getElementById('schoolName');
    const domainInput = document.getElementById('adfsDomain');
    const unsupportedSchoolMessage = document.getElementById('unsupportedSchoolMessage');
    let allSchoolNames = [];
    let searchableSchoolNames = [];

    const errorMessage = document.getElementById('schoolErrorMessage');

    function clearDropdown() {
        while (dropdown.firstChild) {
            dropdown.removeChild(dropdown.firstChild);
        }
    }

    function showDropdownMessage(className, message) {
        clearDropdown();
        const node = document.createElement('div');
        node.className = className;
        node.textContent = message;
        dropdown.appendChild(node);
    }

    function showErrorMessage(message) {
        errorMessage.textContent = message;
        errorMessage.classList.add('show');
    }

    function hideErrorMessage() {
        errorMessage.classList.remove('show');
        errorMessage.textContent = '';
    }

    function translate(key) {
        return t(getCurrentLang(), key);
    }

    function getSchoolSearchMatch(entry, normalizedFilter) {
        if (!normalizedFilter) {
            return { rank: 0, index: 0 };
        }

        if (entry.normalizedName === normalizedFilter) {
            return { rank: 0, index: 0 };
        }

        if (entry.normalizedName.startsWith(normalizedFilter)) {
            return { rank: 1, index: 0 };
        }

        const wordPrefixIndex = entry.normalizedWords.findIndex((word) =>
            word.startsWith(normalizedFilter)
        );
        if (wordPrefixIndex !== -1) {
            return { rank: 2, index: wordPrefixIndex };
        }

        const includesIndex = entry.normalizedName.indexOf(normalizedFilter);
        if (includesIndex !== -1) {
            return { rank: 3, index: includesIndex };
        }

        return null;
    }

    // Show loading state
    showDropdownMessage('school-loading', translate('setupSchoolLoading'));
    dropdown.classList.add('active');

    allSchoolNames = await loadSchoolNames();
    searchableSchoolNames = allSchoolNames.map((schoolName) => ({
        schoolName,
        normalizedName: normalizeSchoolSearchValue(schoolName),
        normalizedWords: normalizeSchoolSearchValue(schoolName).split(/\s+/).filter(Boolean)
    }));

    if (allSchoolNames.length === 0) {
        dropdown.classList.remove('active');
        showErrorMessage(translate('setupSchoolLoadError'));
        return;
    }

    hideErrorMessage();

    // Render schools based on filter
    function renderSchools(filter = '') {
        const normalizedFilter = normalizeSchoolSearchValue(filter);
        const filtered = searchableSchoolNames
            .map((entry) => ({
                ...entry,
                match: getSchoolSearchMatch(entry, normalizedFilter)
            }))
            .filter(({ match }) => match)
            .sort((a, b) =>
                a.match.rank - b.match.rank ||
                a.match.index - b.match.index ||
                a.schoolName.localeCompare(b.schoolName, 'fi', { sensitivity: 'base' })
            );

        if (filtered.length === 0) {
            showDropdownMessage('school-error', translate('setupSchoolNotFound'));
            return;
        }

        clearDropdown();
        filtered.slice(0, 50).forEach(({ schoolName }) => {
            const option = document.createElement('div');
            option.className = 'school-option';
            option.dataset.school = schoolName;
            option.textContent = schoolName;
            option.addEventListener('click', () => {
                searchInput.value = schoolName;
                schoolNameHidden.value = schoolName;
                applySchoolDomainRules(schoolName, domainInput, { selected: true });
                updateUnsupportedSchoolMessage(schoolName, unsupportedSchoolMessage, getCurrentLang(), {
                    selected: true
                });
                dropdown.classList.remove('active');
            });
            dropdown.appendChild(option);
        });
    }

    // Load stored school name
    try {
        const stored = await extensionApi.storage.sync.get({ schoolName: '' });
        if (stored.schoolName) {
            searchInput.value = stored.schoolName;
            schoolNameHidden.value = stored.schoolName;
            applySchoolDomainRules(stored.schoolName, domainInput, { selected: true });
            updateUnsupportedSchoolMessage(stored.schoolName, unsupportedSchoolMessage, getCurrentLang(), {
                selected: true
            });
        }
    } catch (e) {
        console.error('Error loading stored school:', e);
    }

    // Search on input
    searchInput.addEventListener('input', (e) => {
        const filter = e.target.value.trim();
        schoolNameHidden.value = '';
        applySchoolDomainRules(filter, domainInput);
        hideUnsupportedSchoolMessage(unsupportedSchoolMessage);

        if (filter.length === 0) {
            dropdown.classList.remove('active');
            return;
        }

        hideErrorMessage();
        renderSchools(filter);
        dropdown.classList.add('active');
    });

    // Show dropdown on focus
    searchInput.addEventListener('focus', () => {
        if (searchInput.value.trim().length > 0) {
            renderSchools(searchInput.value.trim());
            dropdown.classList.add('active');
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (e.target.id !== 'schoolSearch' && !dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });

    // Close dropdown initially
    dropdown.classList.remove('active');
}

document.addEventListener('DOMContentLoaded', async function () {
    const searchInput = document.getElementById('schoolSearch');
    const schoolNameHidden = document.getElementById('schoolName');
    const domainInput = document.getElementById('adfsDomain');
    const form = document.getElementById('setupForm');
    const saveBtn = document.getElementById('saveBtn');
    const successMsg = document.getElementById('successMsg');
    const langSelect = document.getElementById('langSelect');
    const versionDisplay = document.getElementById('versionDisplay');
    const novaRoleSelect = document.getElementById('novaRole');
    const studeoLevelSelect = document.getElementById('studeoLevel');
    const services = globalThis.OikotieServices || {};

    function showFormError(message) {
        successMsg.textContent = message;
        successMsg.classList.add('show');
    }

    function hideFormError() {
        successMsg.classList.remove('show');
        successMsg.textContent = '';
    }

    let currentLang = await getLanguage();
    langSelect.value = currentLang;

    let storageResult = { schoolName: '', adfsDomain: '' };
    try {
        storageResult = await extensionApi.storage.sync.get({
            schoolName: '',
            adfsDomain: '',
            novaRole: services.DEFAULT_NOVA_ROLE || 'student',
            studeoLevel: services.DEFAULT_STUDEO_LEVEL || 'secondary'
        });
        if (storageResult.adfsDomain) domainInput.value = storageResult.adfsDomain;
        if (novaRoleSelect) novaRoleSelect.value = storageResult.novaRole;
        if (studeoLevelSelect) studeoLevelSelect.value = storageResult.studeoLevel;
    } catch (e) {
        console.error('Error loading settings:', e);
    }

    await initPreconfiguredSchoolDomains();
    applySchoolDomainRules(storageResult.schoolName, domainInput, {
        selected: Boolean((storageResult.schoolName || '').trim())
    });

    applyTranslations(currentLang);

    if (versionDisplay) {
        const version = extensionApi.runtime.getManifest()?.version || '';
        versionDisplay.textContent = version ? `Oikotie v${version}` : 'Oikotie';
    }

    // Initialize school selector
    await initSchoolSelector(() => currentLang);

    async function switchLanguage(lang) {
        currentLang = lang;
        try {
            await setLanguage(lang);
        } catch (e) {
            console.error('Error saving language:', e);
        }
        applyTranslations(currentLang);
        updateUnsupportedSchoolMessage(
            schoolNameHidden.value,
            document.getElementById('unsupportedSchoolMessage'),
            currentLang,
            { selected: Boolean((schoolNameHidden.value || '').trim()) }
        );
    }

    langSelect.addEventListener('change', () => switchLanguage(langSelect.value));

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        const schoolName = (schoolNameHidden.value || searchInput.value || '').trim();
        const lockedDomain = getLockedSchoolDomain(schoolName);
        const schoolSupported = Boolean(lockedDomain);
        const domain = schoolSupported ? normalizeDomain(domainInput.value || lockedDomain) : '';
        
        if (!schoolName || (schoolSupported && !domain)) {
            showFormError(t(currentLang, 'setupSaveError'));
            return;
        }

        hideFormError();
        saveBtn.disabled = true;
        try {
            if (schoolSupported) {
                const granted = await ensureAdfsPermission(domain);
                if (!granted) {
                    showFormError(t(currentLang, 'setupPermissionRequired'));
                    saveBtn.disabled = false;
                    return;
                }
            }

            await extensionApi.storage.sync.set({
                schoolName,
                adfsDomain: domain,
                schoolSupported,
                novaRole: novaRoleSelect ? novaRoleSelect.value : (services.DEFAULT_NOVA_ROLE || 'student'),
                studeoLevel: studeoLevelSelect ? studeoLevelSelect.value : (services.DEFAULT_STUDEO_LEVEL || 'secondary')
            });
            try {
                await extensionApi.runtime.sendMessage({ action: 'syncAdfsAutomation' });
            } catch (e) {
                // storage.onChanged in the background script covers this as a fallback.
            }
            const msg = t(currentLang, 'setupSuccessMsg');
            showSuccessOverlay(msg);
            setTimeout(() => {
                closeSetupTab().then(() => {}).catch(() => {
                    hideSuccessOverlay();
                    saveBtn.disabled = false;
                });
            }, 1500);
        } catch (err) {
            console.error('Error saving:', err);
            showFormError(t(currentLang, 'setupSaveError'));
            saveBtn.disabled = false;
        }
    });
});
