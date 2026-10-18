import React from 'react';
import { AbsoluteFill } from 'remotion';
import { fontFamily } from './font';
import { Mark } from './Mark';
import { T } from './theme';

// 440x280 small promo tile and 1400x560 marquee share this: mark + wordmark + tagline on spruce.
export const Tile: React.FC<{ tagline: string; scale?: number }> = ({ tagline, scale = 1 }) => (
  <AbsoluteFill style={{ fontFamily, background: T.ink, color: T.page, alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 28 * scale, transform: `translateY(${-4 * scale}px)` }}>
      <Mark size={108 * scale} tile={T.inkRaised} />
      <div>
        <div style={{ fontSize: 52 * scale, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>Oikotie</div>
        <div style={{ marginTop: 12 * scale, fontSize: 17 * scale, fontWeight: 500, color: T.inkMuted, lineHeight: 1.35, maxWidth: 270 * scale, whiteSpace: 'pre-line' }}>{tagline}</div>
      </div>
    </div>
  </AbsoluteFill>
);
