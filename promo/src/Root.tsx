import React from 'react';
import { Still } from 'remotion';
import { Shot, ShotProps } from './Shot';
import { Tile } from './Tile';

// The store screenshots, one set per language. Captures in public/screens/
// come from scripts/build-store-assets.mjs; public/tiles/ from
// scripts/build-promo-tiles.mjs.
type Lang = 'fi' | 'en';

const SHOTS: { id: string; props: Record<Lang, ShotProps> }[] = [
  {
    id: 'flow',
    props: {
      fi: {
        headline: ['Oikotie', 'suoraan sisään.'], lockup: false,
        sub: 'Kampus, Nova ja Studeo: Oikotie klikkaa kirjautumisen välivaiheet puolestasi.',
        screen: { kind: 'collage', popup: 'screens/popup-fi.png' },
      },
      en: {
        headline: ['Oikotie', 'Straight in.'], lockup: false,
        sub: 'Kampus, Nova and Studeo: Oikotie clicks through the login steps for you.',
        screen: { kind: 'collage', popup: 'screens/popup-en.png' },
      },
    },
  },
  {
    id: 'popup',
    props: {
      fi: {
        headline: ['Kolme palvelua,', 'yksi laajennus.'],
        sub: 'Kytke Kampus, Nova ja Studeo päälle tai pois suoraan ponnahdusikkunasta.',
        screen: { kind: 'image', src: 'tiles/kampus.png' }, popup: 'screens/popup-fi.png',
      },
      en: {
        headline: ['Three services,', 'one extension.'],
        sub: 'Switch Kampus, Nova and Studeo on or off right from the popup.',
        screen: { kind: 'image', src: 'tiles/kampus.png' }, popup: 'screens/popup-en.png',
      },
    },
  },
  {
    id: 'mpassid',
    props: {
      fi: {
        headline: ['Valitsee koulusi', 'puolestasi.'],
        sub: 'Oikotie hakee koulusi MPASSidistä joka kerta. Ei kirjoittamista.',
        screen: { kind: 'image', src: 'screens/mpass-fi.png', pos: '50% 50%', zoom: 1.7 },
      },
      en: {
        headline: ['Picks your school', 'for you.'],
        sub: 'Oikotie finds your school in MPASSid every time. No typing.',
        screen: { kind: 'image', src: 'screens/mpass-en.png', pos: '50% 50%', zoom: 1.7 },
      },
    },
  },
  {
    id: 'password',
    props: {
      fi: {
        headline: ['Ei koske', 'salasanaasi.'],
        sub: 'Selaimesi täyttää tallennetut tunnuksesi. Oikotie ei tallenna niitä eikä lähetä minnekään.',
        screen: { kind: 'image', src: 'screens/school-fi.png', pos: '50% 50%', zoom: 1.7 },
      },
      en: {
        headline: ['Never touches', 'your password.'],
        sub: 'Your browser fills in your saved credentials. Oikotie never stores them or sends them anywhere.',
        screen: { kind: 'image', src: 'screens/school-en.png', pos: '50% 50%', zoom: 1.7 },
      },
    },
  },
  {
    id: 'settings',
    props: {
      fi: {
        headline: ['Valitse koulusi', 'kerran.'],
        sub: 'Asetukset hoituvat minuutissa: koulu, Nova-rooli ja Studeon kouluaste.',
        screen: { kind: 'image', src: 'screens/settings-fi.png' },
      },
      en: {
        headline: ['Set your school', 'once.'],
        sub: 'Setup takes a minute: your school, Nova role and Studeo grade level.',
        screen: { kind: 'image', src: 'screens/settings-en.png' },
      },
    },
  },
];

const TAGLINE: Record<Lang, string> = {
  fi: 'Kirjautuminen ilman kiertoteitä.\nKampus · Nova · Studeo',
  en: 'Sign in without the detours.\nKampus · Nova · Studeo',
};

export const RemotionRoot: React.FC = () => (
  <>
    {(['fi', 'en'] as Lang[]).flatMap((lang) => [
      ...SHOTS.map((shot, i) => (
        <Still key={`${shot.id}-${lang}`} id={`${String(i + 1).padStart(2, '0')}-${shot.id}-${lang}`}
          component={Shot} width={1280} height={800} defaultProps={shot.props[lang]} />
      )),
      <Still key={`tile-${lang}`} id={`promo-tile-${lang}`} component={Tile} width={440} height={280}
        defaultProps={{ tagline: TAGLINE[lang], scale: 1 }} />,
      <Still key={`marquee-${lang}`} id={`marquee-${lang}`} component={Tile} width={1400} height={560}
        defaultProps={{ tagline: TAGLINE[lang], scale: 2 }} />,
    ])}
  </>
);
