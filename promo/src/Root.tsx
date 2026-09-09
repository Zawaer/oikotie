import React from 'react';
import { Still } from 'remotion';
import { Hero } from './Hero';
import { Tile } from './Tile';

const TAGLINE = 'Automate the repetitive login process for Kampus, Nova and Studeo.';

export const RemotionRoot: React.FC = () => (
  <>
    <Still id="ChromeHero" component={Hero} width={1280} height={800}
      defaultProps={{
        headline: 'Skip the login screens.',
        accentWord: 'Skip',
        tagline: TAGLINE,
        // Drop a logged-in dashboard capture into public/tiles to replace the
        // final tile: destination: 'tiles/kampus-dash.png',
        destination: undefined,
        tilt: { rotateY: -11, rotateX: 3.5, rotateZ: 1 },
      }} />
    <Still id="PromoTile" component={Tile} width={440} height={280}
      defaultProps={{ tagline: 'Skip the login screens.\nKampus · Nova · Studeo', scale: 1 }} />
    <Still id="Marquee" component={Tile} width={1400} height={560}
      defaultProps={{ tagline: TAGLINE, scale: 2 }} />
  </>
);
