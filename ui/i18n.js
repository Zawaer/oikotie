// i18n – translations for the Oikotie extension

const translations = {
    en: {
        // Setup page
        setupPageTitle: 'Settings',
        setupSchoolLabel: 'School name',
        setupSchoolPlaceholder: 'Otaniemen lukio',
        setupDomainLabel: 'Login domain',
        setupDomainHint: 'Filled in automatically from your school.',
        setupSaveBtn: 'Save',
        setupSuccessMsg: 'Settings saved.',
        setupSaveError: 'Save failed.',
        setupPermissionRequired: 'Please allow the login domain permission to enable auto login.',
        setupSchoolLoading: 'Loading schools...',
        setupSchoolLoadError: 'Could not load schools. You can type your school name manually.',
        setupSchoolNotFound: 'No schools found.',
        setupUnsupportedSchoolTitle: 'Oikotie takes you as far as your school\'s login page.',
        setupUnsupportedSchoolDescription: 'Sign in there yourself. Oikotie can\'t press the final Sign in button for this school yet.',
        setupRequestSchoolSupport: 'Request full support for your school',
        setupNovaRoleLabel: 'Nova user type',
        setupNovaRoleHint: 'Nova asks who you are before showing the MPASSid button. This answers it for you.',
        setupNovaRoleStudent: 'Student',
        setupNovaRoleStudentDetail: 'Upper secondary or adult education',
        setupNovaRolePupil: 'Pupil',
        setupNovaRolePupilDetail: 'Primary or lower secondary',
        setupNovaRoleTeacher: 'Teacher',
        setupNovaRoleTeacherDetail: 'Or other school staff',
        setupStudeoLevelLabel: 'Studeo grade level',
        setupStudeoLevelHint: 'Studeo asks for your grade range on the way to MPASSid. This answers it for you.',
        setupStudeoLevelSecondary: 'Secondary',
        setupStudeoLevelSecondaryDetail: 'Grades 7–9 and upper secondary',
        setupStudeoLevelElementary: 'Primary',
        setupStudeoLevelElementaryDetail: 'Grades 1–6',
        setupSourceCode: 'Source code',
        setupLangLabel: 'Language',
        setupSectionSchool: 'School',
        setupBrandHeadline: 'Sign in without the detours.',
        setupBrandBody: 'Pick your school once. Oikotie clicks through the in-between steps of Kampus, Nova and Studeo for you.',
        setupPasswordNote: 'Oikotie never handles your password. It uses your browser\'s own autofill.',
        setupLangFi: 'Finnish',
        setupLangEn: 'English',

        // Popup page
        popupTitle: 'Oikotie',
        popupEnableToggle: 'Auto Login',
        popupAutoLoginDescription: 'Enable automatic login',
        popupAutofillToggle: 'Use autofilled credentials',
        popupAutofillDescription: 'Continue login when browser fills saved username and password',
        popupServicesTitle: 'Services',
        popupNotSet: '-',
        popupChangeSettings: 'Settings',
        popupReportBug: 'Report a bug',
        popupFeedback: 'Give feedback',

        // Shared labels
        commonLoggingInLabel: 'Logging in…',
        commonStepSchool: 'School',

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
        setupDomainHint: 'Täytetty automaattisesti koulusi perusteella.',
        setupSaveBtn: 'Tallenna',
        setupSuccessMsg: 'Asetukset tallennettu.',
        setupSaveError: 'Tallennus epäonnistui.',
        setupPermissionRequired: 'Salli kirjautumisosoitteen käyttöoikeus, jotta automaattinen kirjautuminen toimii.',
        setupSchoolLoading: 'Ladataan kouluja...',
        setupSchoolLoadError: 'Kouluja ei voitu ladata. Voit kirjoittaa koulun nimen manuaalisesti.',
        setupSchoolNotFound: 'Kouluja ei löytynyt.',
        setupUnsupportedSchoolTitle: 'Oikotie vie sinut koulusi kirjautumissivulle asti.',
        setupUnsupportedSchoolDescription: 'Kirjaudu siellä itse. Viimeistä Kirjaudu-painiketta Oikotie ei vielä osaa painaa tälle koululle.',
        setupRequestSchoolSupport: 'Ehdota koululle täyttä tukea',
        setupNovaRoleLabel: 'Nova-käyttäjätyyppi',
        setupNovaRoleHint: 'Nova kysyy kuka olet ennen MPASSid-painikkeen näyttämistä. Tämä vastaa siihen puolestasi.',
        setupNovaRoleStudent: 'Opiskelija',
        setupNovaRoleStudentDetail: 'Lukio tai aikuisopiskelu',
        setupNovaRolePupil: 'Oppilas',
        setupNovaRolePupilDetail: 'Alakoulu tai yläkoulu',
        setupNovaRoleTeacher: 'Opettaja',
        setupNovaRoleTeacherDetail: 'Tai muu koulun henkilökunta',
        setupStudeoLevelLabel: 'Studeon kouluaste',
        setupStudeoLevelHint: 'Studeo kysyy kouluasteesi matkalla MPASSid-kirjautumiseen. Tämä vastaa siihen puolestasi.',
        setupStudeoLevelSecondary: 'Yläkoulu tai lukio',
        setupStudeoLevelSecondaryDetail: 'Luokat 7–9 ja lukio',
        setupStudeoLevelElementary: 'Alakoulu',
        setupStudeoLevelElementaryDetail: 'Luokat 1–6',
        setupSourceCode: 'Lähdekoodi',
        setupLangLabel: 'Kieli',
        setupSectionSchool: 'Koulu',
        setupBrandHeadline: 'Kirjautuminen ilman kiertoteitä.',
        setupBrandBody: 'Valitse koulusi kerran. Oikotie klikkaa Kampuksen, Novan ja Studeon välivaiheet puolestasi.',
        setupPasswordNote: 'Oikotie ei koskaan käsittele salasanaasi. Se käyttää selaimen omaa automaattista täyttöä.',
        setupLangFi: 'Suomi',
        setupLangEn: 'Englanti',

        // Popup page
        popupTitle: 'Oikotie',
        popupEnableToggle: 'Automaattinen kirjautuminen',
        popupAutoLoginDescription: 'Ota automaattinen kirjautuminen käyttöön',
        popupAutofillToggle: 'Käytä selaimen täyttämiä tunnuksia',
        popupAutofillDescription: 'Jatka kirjautumista, kun selain täyttää tallennetun käyttäjänimen ja salasanan',
        popupServicesTitle: 'Palvelut',
        popupNotSet: '-',
        popupChangeSettings: 'Asetukset',
        popupReportBug: 'Ilmoita ongelmasta',
        popupFeedback: 'Anna palautetta',

        // Shared labels
        commonLoggingInLabel: 'Kirjaudutaan…',
        commonStepSchool: 'Koulu',

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
        const result = await extensionApi.storage.sync.get({ language: 'fi' });
        return result.language === 'en' ? 'en' : 'fi';
    } catch (e) {
        return 'fi';
    }
}

async function setLanguage(lang) {
    await extensionApi.storage.sync.set({ language: lang });
}

function t(lang, key) {
    const dict = translations[lang] || translations.fi;
    return dict[key] ?? key;
}

function applyTranslations(lang, scope) {
    const root = scope && scope.querySelectorAll ? scope : document;
    const dict = translations[lang] || translations.fi;
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
        document.documentElement.lang = lang === 'en' ? 'en' : 'fi';
    }
}
