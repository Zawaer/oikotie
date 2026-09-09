# Store listing copy — Oikotie v3.0

Copy for the Chrome Web Store and Firefox Add-ons (AMO) listings. Keep this in
sync with the manifest and README when the extension changes.

Character limits: Chrome short description 132, AMO summary 250. Chrome takes
the extension **name** from the manifest (`Oikotie`) and it cannot differ in
the listing, so discoverability keywords (Kampus, Nova, Studeo, MPASSid) have
to live in the descriptions. AMO lets you edit the name; keep it `Oikotie`.

---

## Short description / summary

**Chrome (≤132):**

> Skip the login screens. One-click MPASSid sign-in for Kampus, Nova and Studeo.

**AMO (≤250):**

> Skip the login screens. Oikotie automates the repetitive MPASSid sign-in for Kampus (Sanoma Pro), Nova (Otava) and Studeo — from the front page to the password prompt without a single click. Never touches your password.

**Suomeksi (Chrome ≤132):**

> Ohita kirjautumisruudut. MPASSid-kirjautuminen Kampukseen, Novaan ja Studeoon yhdellä klikkauksella.

---

## Detailed description — English

Tired of clicking through the same login screens every lesson? Oikotie automates the repetitive sign-in steps for the learning platforms Finnish schools actually use — **Kampus** (Sanoma Pro), **Nova** (Otava) and **Studeo** — and takes you from the front page to the password prompt without a single click.

**What it does**

All three services sign you in through MPASSid and then through your own school's login page. Oikotie clicks the buttons you would have clicked:

- Kampus — the MPASSid button
- Nova — your role, then "MPASSid:llä"
- Studeo — through to the app, MPASSid, then your grade level

From there it selects your school on MPASSid, hands off to your school's login page, and continues once your browser has filled in your saved credentials.

**Oikotie never handles your password.** It waits for your browser's own autofill and presses the button you would have pressed. Nothing is collected, and nothing is sent anywhere — the extension makes no network requests of its own.

**It stays out of the way**

- Already signed in? Nothing happens — no spinner over a page you're using.
- Only landing pages redirect. Pricing, blog and support pages are left alone.
- Reached MPASSid from a site Oikotie doesn't handle? It leaves the page alone.
- Each service can be switched off on its own from the popup.

**Setup**

1. Click the extension icon and open Settings.
2. Pick your school from the list. If it's supported, the login address fills in automatically.
3. Choose your Nova user type and Studeo grade level.
4. Save, and allow the permission prompt for your school's login address.

If your school isn't supported yet, you can still save it and request support from the settings page.

**Open source** — GPL-3.0. Read the code, report bugs or suggest schools: https://github.com/Zawaer/oikotie

*Oikotie is an unofficial extension. It is not affiliated with, endorsed by, or supported by Sanoma Pro, Otava, Studeo, MPASSid, or any school or municipality, and it is unrelated to the classifieds site at oikotie.fi.*

---

## Detailed description — Suomeksi

Kyllästynyt klikkailemaan samat kirjautumisruudut läpi joka tunnilla? Oikotie automatisoi toistuvat kirjautumisvaiheet suomalaisten koulujen oppimisalustoille — **Kampus** (Sanoma Pro), **Nova** (Otava) ja **Studeo** — ja vie sinut etusivulta salasanakenttään ilman yhtäkään klikkausta.

**Mitä se tekee**

Kaikki kolme palvelua kirjaavat sinut sisään MPASSid:n ja sen jälkeen oman koulusi kirjautumissivun kautta. Oikotie painaa ne napit, jotka olisit painanut itse:

- Kampus — MPASSid-painike
- Nova — käyttäjätyyppi, sitten "MPASSid:llä"
- Studeo — sovellukseen, MPASSid, sitten kouluaste

Sen jälkeen se valitsee koulusi MPASSid:ssä, siirtyy koulusi kirjautumissivulle ja jatkaa, kun selain on täyttänyt tallennetut tunnuksesi.

**Oikotie ei koske salasanaasi.** Se odottaa selaimen omaa automaattitäyttöä ja painaa vasta sitten Kirjaudu. Mitään ei kerätä eikä lähetetä minnekään — laajennus ei tee omia verkkopyyntöjä.

**Pysyy poissa tieltä**

- Oletko jo kirjautunut? Mitään ei tapahdu — ei latauskuvaketta käytössä olevan sivun päälle.
- Vain etusivut ohjaavat eteenpäin. Hinnasto-, blogi- ja tukisivut jätetään rauhaan.
- Päädyitkö MPASSid:iin muualta? Oikotie ei puutu siihen.
- Jokaisen palvelun voi kytkeä erikseen pois ponnahdusikkunasta.

**Käyttöönotto**

1. Klikkaa laajennuksen kuvaketta ja avaa Asetukset.
2. Valitse koulusi listasta. Jos koulu on tuettu, kirjautumisosoite täyttyy itsestään.
3. Valitse Nova-käyttäjätyyppi ja Studeon kouluaste.
4. Tallenna ja hyväksy koulusi kirjautumisosoitteen käyttöoikeus.

Jos kouluasi ei vielä tueta, voit silti tallentaa sen ja ehdottaa lisäämistä asetuksista.

**Avoin lähdekoodi** — GPL-3.0. Lue koodi, ilmoita ongelmista tai ehdota kouluja: https://github.com/Zawaer/oikotie

*Oikotie on epävirallinen laajennus. Se ei ole Sanoma Pron, Otavan, Studeon, MPASSid:n eikä minkään koulun tai kunnan tekemä, tukema tai hyväksymä, eikä se liity oikotie.fi-palveluun.*

---

## Release notes — v3.0

**English**

> Oikotie now signs you in to **Nova** and **Studeo** as well as Kampus — and has a new name to match (previously *Kampus Auto Login*). Same extension, same settings; your school carries over.
>
> **Chrome users:** this update adds access to nova.otava.fi and studeo.fi, so Chrome will disable the extension until you re-approve it. Click the extension icon and accept the new permissions.
>
> Also new: switch each service on or off separately from the popup; Nova user type and Studeo grade level in settings; far more reliable on slow connections; new icon and colour.

**Suomeksi**

> Oikotie kirjaa sinut nyt myös **Novaan** ja **Studeoon** Kampuksen lisäksi — ja on saanut nimen, joka sopii siihen (aiemmin *Kampus Auto Login*). Sama laajennus, samat asetukset; koulusi säilyy.
>
> **Chrome-käyttäjät:** päivitys lisää oikeudet nova.otava.fi- ja studeo.fi-sivustoille, joten Chrome poistaa laajennuksen käytöstä, kunnes hyväksyt ne uudelleen. Klikkaa laajennuksen kuvaketta ja hyväksy uudet oikeudet.
>
> Lisäksi: palvelut voi kytkeä erikseen päälle tai pois; Nova-käyttäjätyyppi ja Studeon kouluaste asetuksissa; huomattavasti luotettavampi hitailla yhteyksillä; uusi kuvake ja väri.

---

## Chrome Web Store — Privacy practices tab

These are required and are the most common reason for review rejection. Answer exactly.

**Single purpose description**

> Automates the repetitive steps of signing in to Kampus, Nova and Studeo through MPASSid, by clicking the buttons the user would otherwise click themselves.

**Permission justifications**

| Permission | Justification |
|---|---|
| `storage` | Saves the user's chosen school, its login address, interface language and on/off toggles. Nothing else is stored. |
| `scripting` | Registers the login-page content script for the one school login domain the user selects in settings. Done at runtime so the extension only ever gets access to that single domain, never to every school's. |
| Host: `kirjautuminen.sanomapro.fi`, `sanomapro.fi`, `www.sanomapro.fi` | Kampus login and landing pages, where the extension clicks the MPASSid button and redirects the landing page to Kampus. |
| Host: `nova.otava.fi` | Nova landing and login pages, where the extension picks the user's role and clicks the MPASSid button. |
| Host: `studeo.fi`, `www.studeo.fi`, `app.studeo.fi` | Studeo landing, login and grade-level pages, where the extension clicks through to MPASSid. |
| Host: `mpass-proxy.csc.fi` | The MPASSid school picker shared by all three services, where the extension selects the user's configured school. |
| Optional host: `https://*/adfs/ls/*` | A template only. The extension requests exactly one origin from it — the school login domain the user picks — and continues the login there once the browser has autofilled saved credentials. It is never granted as a wildcard. |

**Remote code:** No. All code is packaged with the extension.

**Data usage:** The extension does not collect, transmit or sell any user data. It makes no network requests. Settings are kept in browser extension storage only (and synced between the user's own browsers if they have browser sync on).

Certify: does not sell data · does not use data for unrelated purposes · does not use data for creditworthiness or lending.

---

## AMO — listing fields

- **Categories:** Privacy & Security; Other (or "Web Development" is wrong — avoid).
- **Support site:** https://github.com/Zawaer/oikotie/issues
- **Homepage:** https://github.com/Zawaer/oikotie
- **License:** GNU General Public License v3.0
- **Slug:** `oikotie` (change from `kampus-auto-login` **before** sharing any link)
- **Notes to reviewer:** Open source at the homepage URL. The extension automates button clicks on three specific Finnish school-platform login flows; it never reads or stores credentials, and makes no network requests. Test account: none needed to see the flow up to the credential prompt — visiting nova.otava.fi with a school configured shows the automation.
