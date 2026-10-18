import React from 'react';
import { AbsoluteFill } from 'remotion';
import { fontFamily } from './font';
import { Mark } from './Mark';
import { Collage, CollageProps } from './Collage';
import { T } from './theme';

export type HeroProps = {
  headline: string;
  accentWord: string;
  tagline: string;
  destination?: CollageProps['destination'];
  tilt: { rotateY: number; rotateX: number; rotateZ: number };
};

// 1280x800 Chrome Web Store screenshot: copy block left, tilted tablet right.
export const Hero: React.FC<HeroProps> = ({ headline, accentWord, tagline, destination, tilt }) => {
  const [before, after] = headline.split(accentWord);
  const screenW = 660, screenH = 440, bezel = 16;
  return (
    <AbsoluteFill style={{ fontFamily, color: T.text, background: T.page }}>
      {/* spruce band behind the copy; the tablet overlaps its edge */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 600, background: T.ink }} />

      <div style={{ position: 'absolute', left: 72, top: 226, width: 440, color: T.page }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontWeight: 800, fontSize: 24, letterSpacing: '-0.035em', marginBottom: 30 }}>
          <Mark size={36} tile={T.inkRaised} /> <span>Oikotie</span>
        </div>
        <h1 style={{ margin: 0, fontSize: 66, lineHeight: 1.0, fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 22 }}>
          {before}<span style={{ color: T.signal }}>{accentWord}</span>{after}
        </h1>
        <p style={{ margin: 0, fontSize: 22, lineHeight: 1.45, color: T.inkMuted, fontWeight: 500, maxWidth: 400 }}>{tagline}</p>
      </div>

      <div style={{ position: 'absolute', left: 528, top: 96, width: 720, height: 620, perspective: 2000, perspectiveOrigin: '15% 50%' }}>
        <div style={{
          position: 'absolute', left: 8, top: 66, width: screenW + bezel * 2, height: screenH + bezel * 2,
          borderRadius: 30, background: T.bezel, padding: bezel,
          transform: `rotateY(${tilt.rotateY}deg) rotateX(${tilt.rotateX}deg) rotateZ(${tilt.rotateZ}deg)`,
          boxShadow: '40px 64px 96px rgba(4,20,16,.34), inset 0 0 0 1px rgba(255,255,255,.07)',
        }}>
          <div style={{ width: screenW, height: screenH, borderRadius: 16, overflow: 'hidden', background: T.page }}>
            <Collage width={screenW} height={screenH} destination={destination} />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
