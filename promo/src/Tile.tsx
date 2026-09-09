import React from 'react';
import { AbsoluteFill } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';
import { Mark } from './Mark';
import { T } from './theme';

const { fontFamily } = loadFont('normal', { weights: ['500', '800'] });

// 440x280 small promo tile and 1400x560 marquee share this: mark + wordmark + tagline on the accent.
export const Tile: React.FC<{ tagline: string; scale?: number }> = ({ tagline, scale = 1 }) => (
  <AbsoluteFill style={{ fontFamily, background: `linear-gradient(135deg, ${T.accent}, ${T.accentDeep})`, color: '#fff', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ position: 'absolute', left: -40 * scale, bottom: -120 * scale, opacity: 0.12 }}><Mark size={420 * scale} color="#fff" /></div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 28 * scale, transform: `translateY(${-4 * scale}px)` }}>
      <Mark size={116 * scale} color="#fff" />
      <div>
        <div style={{ fontSize: 50 * scale, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>Oikotie</div>
        <div style={{ marginTop: 10 * scale, fontSize: 17 * scale, fontWeight: 500, opacity: 0.92, lineHeight: 1.35, maxWidth: 260 * scale }}>{tagline}</div>
      </div>
    </div>
  </AbsoluteFill>
);
