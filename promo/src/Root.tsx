import React from 'react';
import { Still } from 'remotion';
import { Shot, ShotProps } from './Shot';
import { Tile } from './Tile';

// The store screenshot, one per language: the whole login flow on a tablet.
// public/screens/ comes from scripts/build-store-assets.mjs; public/tiles/
// from scripts/build-promo-tiles.mjs.
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
