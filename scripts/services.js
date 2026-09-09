// Registry of the school services Oikotie can automate.
//
// Every supported service ends up on the same MPASSid proxy
// (mpass-proxy.csc.fi) and from there on the school's own ADFS page, so the
// hard parts of the flow - school selection and credential submission - are
// shared. What differs per service is only how you get from the service's own
// pages to the MPASSid proxy, which is what this table describes.

(function () {
    'use strict';

    // Shared MPASSid infrastructure. Not a service in its own right - it is the
    // point where all service flows converge.
    const MPASS_PROXY_HOST = 'mpass-proxy.csc.fi';

    const SERVICES = Object.freeze({
        kampus: Object.freeze({
            id: 'kampus',
            name: 'Kampus',
            // Sanoma Pro. Landing page redirects to Kampus, Kampus bounces to
            // kirjautuminen.sanomapro.fi, which carries the MPASSid link.
            flowHosts: Object.freeze([
                'sanomapro.fi',
                'www.sanomapro.fi',
                'kampus.sanomapro.fi',
                'kirjautuminen.sanomapro.fi'
            ]),
            homeUrl: 'https://kampus.sanomapro.fi/'
        }),
        nova: Object.freeze({
            id: 'nova',
            name: 'Nova',
            // Otava. Root page asks which role you are; each role page then
            // carries a "With MPASSid" button.
            flowHosts: Object.freeze([
                'nova.otava.fi'
            ]),
            homeUrl: 'https://nova.otava.fi/'
        }),
        studeo: Object.freeze({
            id: 'studeo',
            name: 'Studeo',
            // Studeo. /auth/login carries an icon-only MPASSid link, which leads
            // to a grade-level picker before handing off to MPASSid.
            flowHosts: Object.freeze([
                'studeo.fi',
                'www.studeo.fi',
                'app.studeo.fi'
            ]),
            homeUrl: 'https://app.studeo.fi/'
        })
    });

    const SERVICE_IDS = Object.freeze(Object.keys(SERVICES));

    // Storage defaults. Services are opt-out: a user who installs the extension
    // presumably wants every service they actually visit to be automated.
    const DEFAULT_SERVICES_ENABLED = Object.freeze(
        SERVICE_IDS.reduce((acc, id) => Object.assign(acc, { [id]: true }), {})
    );

    // Nova asks which kind of user you are before showing the MPASSid button.
    // Lukio students are the target audience, so that is the default.
    const NOVA_ROLES = Object.freeze(['student', 'pupil', 'teacher']);
    const DEFAULT_NOVA_ROLE = 'student';

    // Studeo asks for a grade range. "secondary" covers grades 7-9 and lukio.
    const STUDEO_LEVELS = Object.freeze(['secondary', 'elementary']);
    const DEFAULT_STUDEO_LEVEL = 'secondary';

    function hostMatches(host, candidate) {
        const normalized = (host || '').toLowerCase();
        return normalized === candidate || normalized.endsWith(`.${candidate}`);
    }

    // Which service, if any, owns the given hostname.
    function getServiceForHost(host) {
        for (const id of SERVICE_IDS) {
            if (SERVICES[id].flowHosts.some((candidate) => hostMatches(host, candidate))) {
                return SERVICES[id];
            }
        }
        return null;
    }

    // Loose containment check used against referrers and query strings, where
    // the host is embedded in a longer string rather than being the whole value.
    function includesServiceHost(value) {
        if (typeof value !== 'string' || value.length === 0) {
            return false;
        }
        const normalized = value.toLowerCase();
        return SERVICE_IDS.some((id) =>
            SERVICES[id].flowHosts.some((host) => normalized.includes(host))
        );
    }

    function getServiceIdFromValue(value) {
        if (typeof value !== 'string' || value.length === 0) {
            return null;
        }
        const normalized = value.toLowerCase();
        for (const id of SERVICE_IDS) {
            if (SERVICES[id].flowHosts.some((host) => normalized.includes(host))) {
                return id;
            }
        }
        return null;
    }

    globalThis.OikotieServices = Object.freeze({
        MPASS_PROXY_HOST,
        SERVICES,
        SERVICE_IDS,
        DEFAULT_SERVICES_ENABLED,
        NOVA_ROLES,
        DEFAULT_NOVA_ROLE,
        STUDEO_LEVELS,
        DEFAULT_STUDEO_LEVEL,
        getServiceForHost,
        includesServiceHost,
        getServiceIdFromValue
    });
})();
