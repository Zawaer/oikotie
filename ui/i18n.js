// i18n – translations for the Oikotie extension

const translations = {
    en: {
        // Setup page
        setupPageTitle: 'Settings',
        setupSchoolLabel: 'School name',
        setupSchoolPlaceholder: 'Otaniemen lukio',
        setupDomainLabel: 'Login domain',
        setupDomainPlaceholder: 'sts.edu.espoo.fi',
        setupDomainHint: 'The address appears in the browser address bar when on your municipality\'s login page.',
        setupSaveBtn: 'Save',
        setupSuccessMsg: 'Settings saved.',
        setupSaveError: 'Save failed.',
        setupPermissionRequired: 'Please allow the login domain permission to enable auto login.',
        setupSchoolLoading: 'Loading schools...',
        setupSchoolLoadError: 'Could not load schools. You can type your school name manually.',
        setupSchoolNotFound: 'No schools found.',
        setupUnsupportedSchoolTitle: 'Your school is not yet supported.',
        setupUnsupportedSchoolDescription: 'You can still save this school, but auto login will not run for it yet.',
        setupRequestSchoolSupport: 'Request school support',
        setupNovaRoleLabel: 'Nova user type',
        setupNovaRoleHint: 'Nova asks who you are before showing the MPASSid button. This answers it for you.',
        setupNovaRoleStudent: 'Student - upper secondary or adult education',
        setupNovaRolePupil: 'Pupil - primary or lower secondary',
        setupNovaRoleTeacher: 'Teacher or school staff',
        setupStudeoLevelLabel: 'Studeo grade level',
        setupStudeoLevelHint: 'Studeo asks for your grade range on the way to MPASSid. This answers it for you.',
        setupStudeoLevelSecondary: 'Grades 7-9 or upper secondary',
        setupStudeoLevelElementary: 'Grades 1-6',
        setupSourceCode: 'Source code',
        setupLangLabel: 'Language:',
        setupLangFi: 'Finnish',
        setupLangEn: 'English',

        // Popup page
        popupTitle: 'Oikotie',
        popupEnableToggle: 'Auto Login',
        popupAutoLoginDescription: 'Enable automatic login',
        popupAutofillToggle: 'Use autofilled credentials',
        popupAutofillDescription: 'Continue login when browser fills saved username and password',
        popupServicesTitle: 'Services',
        popupServicesDescription: 'Automate the login for these services',
        popupNotSet: '-',
        popupChangeSettings: 'Settings',
        popupReportBug: 'Report a bug',
        popupFeedback: 'Give feedback',

        // Shared labels
        commonLoggingInLabel: 'Logging in...',

        // MPASS page
        mpassSchoolRequiredTitle: 'School selection required',
        mpassSchoolRequiredDescription: 'Select a school in the extension settings so the login process can continue.',
        mpassSchoolRequiredAction: 'Open settings',

        // ADFS page
        adfsContinueTitle: 'Click anywhere or press any key to continue...',
        adfsContinueDescription: 'Chrome protects autofilled passwords by not exposing them to the page until the login form is interacted with. Clicking anywhere or pressing any key lets the browser finish applying the saved credentials, so the extension can continue logging in.',
    },
    fi: {
        // Setup page
        setupPageTitle: 'Asetukset',
        setupSchoolLabel: 'Koulun nimi',
        setupSchoolPlaceholder: 'Otaniemen lukio',
        setupDomainLabel: 'Kirjautumisosoite',
        setupDomainPlaceholder: 'sts.edu.espoo.fi',
        setupDomainHint: 'Osoite näkyy selaimen osoitepalkissa kun olet kunnan kirjautumissivulla.',
        setupSaveBtn: 'Tallenna',
        setupSuccessMsg: 'Asetukset tallennettu.',
        setupSaveError: 'Tallennus epäonnistui.',
        setupPermissionRequired: 'Salli kirjautumisosoitteen käyttöoikeus, jotta automaattinen kirjautuminen toimii.',
        setupSchoolLoading: 'Ladataan kouluja...',
        setupSchoolLoadError: 'Kouluja ei voitu ladata. Voit kirjoittaa koulun nimen manuaalisesti.',
        setupSchoolNotFound: 'Kouluja ei löytynyt.',
        setupUnsupportedSchoolTitle: 'Kouluasi ei vielä tueta.',
        setupUnsupportedSchoolDescription: 'Voit silti tallentaa koulun, mutta automaattinen kirjautuminen ei vielä toimi sille.',
        setupRequestSchoolSupport: 'Ehdota koulun lisäämistä',
        setupNovaRoleLabel: 'Nova-käyttäjätyyppi',
        setupNovaRoleHint: 'Nova kysyy kuka olet ennen MPASSid-painikkeen näyttämistä. Tämä vastaa siihen puolestasi.',
        setupNovaRoleStudent: 'Opiskelija - lukio tai aikuisopiskelu',
        setupNovaRolePupil: 'Oppilas - alakoulu tai yläkoulu',
        setupNovaRoleTeacher: 'Opettaja tai koulun henkilökunta',
        setupStudeoLevelLabel: 'Studeon kouluaste',
        setupStudeoLevelHint: 'Studeo kysyy kouluasteesi matkalla MPASSid-kirjautumiseen. Tämä vastaa siihen puolestasi.',
        setupStudeoLevelSecondary: 'Yläkoulu (7-9) tai lukio',
        setupStudeoLevelElementary: 'Alakoulu (1-6)',
        setupSourceCode: 'Lähdekoodi',
        setupLangLabel: 'Kieli:',
        setupLangFi: 'Suomi',
        setupLangEn: 'Englanti',

        // Popup page
        popupTitle: 'Oikotie',
        popupEnableToggle: 'Automaattinen kirjautuminen',
        popupAutoLoginDescription: 'Ota automaattinen kirjautuminen käyttöön',
        popupAutofillToggle: 'Käytä selaimen täyttämiä tunnuksia',
        popupAutofillDescription: 'Jatka kirjautumista, kun selain täyttää tallennetun käyttäjänimen ja salasanan',
        popupServicesTitle: 'Palvelut',
        popupServicesDescription: 'Automatisoi kirjautuminen näihin palveluihin',
        popupNotSet: '-',
        popupChangeSettings: 'Asetukset',
        popupReportBug: 'Ilmoita ongelmasta',
        popupFeedback: 'Anna palautetta',

        // Shared labels
        commonLoggingInLabel: 'Kirjaudutaan...',

        // MPASS page
        mpassSchoolRequiredTitle: 'Koulua ei ole valittu',
        mpassSchoolRequiredDescription: 'Valitse koulu laajennuksen asetuksista jotta kirjautumisprosessi voi jatkua.',
        mpassSchoolRequiredAction: 'Avaa asetukset',

        // ADFS page
        adfsContinueTitle: 'Jatka klikkaamalla mistä tahansa tai painamalla mitä tahansa näppäintä...',
        adfsContinueDescription: 'Chrome suojaa selaimen automaattisesti täyttämiä salasanoja eikä anna sivun nähdä niitä ennen kuin kirjautumislomaketta käytetään. Klikkaaminen tai näppäimen painaminen antaa selaimen viimeistellä tallennettujen tunnusten täyttämisen, jotta laajennus voi jatkaa kirjautumista.',
    },
};

const extensionApi = globalThis.browser || globalThis.chrome;

async function getLanguage() {
    try {
        const result = await extensionApi.storage.sync.get({ language: 'en' });
        return result.language === 'fi' ? 'fi' : 'en';
    } catch (e) {
        return 'en';
    }
}

async function setLanguage(lang) {
    await extensionApi.storage.sync.set({ language: lang });
}

function t(lang, key) {
    const dict = translations[lang] || translations.en;
    return dict[key] ?? key;
}

function applyTranslations(lang, scope) {
    const root = scope && scope.querySelectorAll ? scope : document;
    const dict = translations[lang] || translations.en;
    root.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = el.getAttribute('data-i18n');
        const value = dict[key];
        if (value != null) {
            if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.getAttribute('data-i18n-attr')) {
                const attr = el.getAttribute('data-i18n-attr') || 'placeholder';
                el.setAttribute(attr, value);
            } else {
                el.textContent = value;
            }
            if (key === 'setupPageTitle' && el.tagName === 'TITLE') {
                document.title = value;
            }
        }
    });
    if (typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.lang = lang === 'fi' ? 'fi' : 'en';
    }
}
