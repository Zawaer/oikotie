import React from 'react';
import { Img, staticFile } from 'remotion';
import { T } from './theme';

// A 2x2 collage of the real pages one login passes through, edge to edge, with
// arrows drawn over them. Deliberately linear rather than a three-in/three-out
// diagram: the tagline already names all three services, and drawing every
// branch turned this into a flowchart. One flow, shown properly.
//
// Tiles are cropped to what identifies a page at this size - a coloured header,
// a logo, a branded panel - not to its login form, which is white boxes and
// unreadable text however much you zoom.

export type CollageProps = {
  width: number;
  height: number;
  /** Swap in a logged-in dashboard capture for the final tile. */
  destination?: string;
};

type Quad = { src: string; pos?: string; zoom?: number; device?: boolean };

export const Collage: React.FC<CollageProps> = ({ width: W, height: H, destination }) => {
  const w = W / 2, h = H / 2;

  const quads: (Quad & { x: number; y: number })[] = [
    // Sanoma Pro's green wordmark and the orange KIRJAUDU button.
    { x: 0, y: 0, src: 'tiles/kampus.png', pos: '50% 13%', zoom: 1.45 },
    // MPASSid's navy bar and the lilac "Viimeksi valitut" panel.
    { x: w, y: 0, src: 'tiles/mpass.png', pos: '62% 26%', zoom: 1.1 },
    // The extension itself as the payoff; replaced by `destination` when given.
    // The popup is a 300px-wide UI, not a 1280px page: cover-cropping it puts it
    // on screen at roughly four times the scale of the other tiles. Show it as a
    // product shot instead - sized to match, bleeding off the bottom edge.
    destination
      ? { x: 0, y: h, src: destination, pos: '50% 30%', zoom: 1.1 }
      : { x: 0, y: h, src: 'tiles/popup.png', device: true },
    // Espoo's blue graphic and the ESPOO ESBO mark.
    { x: w, y: h, src: 'tiles/espoo.png', pos: '52% 42%', zoom: 1.15 },
  ];

  // Flow: entry -> MPASSid -> school login -> in. Three arrows, each with its
  // own weight and curvature so they read as drawn rather than plotted.
  const arrows = [
    { d: `M ${W * 0.30} ${H * 0.20} C ${W * 0.40} ${H * 0.13}, ${W * 0.46} ${H * 0.16}, ${W * 0.545} ${H * 0.235}`, sw: 4.6 },
    { d: `M ${W * 0.93} ${H * 0.40} C ${W * 0.975} ${H * 0.50}, ${W * 0.93} ${H * 0.56}, ${W * 0.845} ${H * 0.615}`, sw: 4.2 },
    { d: `M ${W * 0.62} ${H * 0.86} C ${W * 0.55} ${H * 0.93}, ${W * 0.47} ${H * 0.90}, ${W * 0.405} ${H * 0.815}`, sw: 4.6 },
  ];

  return (
    <div style={{ position: 'relative', width: W, height: H, background: T.surface, overflow: 'hidden' }}>
      {quads.map((q, i) => (
        <div key={i} style={{
          position: 'absolute', left: q.x, top: q.y, width: w, height: h, overflow: 'hidden',
          background: q.device ? `linear-gradient(150deg, ${T.surface} 0%, ${T.warm} 130%)` : '#fff',
        }}>
          <Img src={staticFile(q.src)} style={q.device
            ? {
                position: 'absolute', left: '50%', top: h * 0.13, width: w * 0.46,
                transform: 'translateX(-50%)', display: 'block',
                borderRadius: 9, boxShadow: '0 14px 30px rgba(30,20,10,.26)',
              }
            : {
                width: '100%', height: '100%', objectFit: 'cover', objectPosition: q.pos, display: 'block',
                transform: `scale(${q.zoom ?? 1})`, transformOrigin: q.pos,
              }} />
        </div>
      ))}

      {/* hairlines, so the quadrants read as separate pages without gaps */}
      <div style={{ position: 'absolute', left: w - 1, top: 0, width: 2, height: H, background: 'rgba(31,41,55,.10)' }} />
      <div style={{ position: 'absolute', left: 0, top: h - 1, width: W, height: 2, background: 'rgba(31,41,55,.10)' }} />

      <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <marker id="head" viewBox="0 0 10 10" refX="7.5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
            <path d="M1 1 L9 5 L1 9 z" fill={T.text} />
          </marker>
          <filter id="hand" x="-6%" y="-6%" width="112%" height="112%">
            <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves={2} seed={11} result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale={2.4} />
          </filter>
          <filter id="lift" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#fff" floodOpacity="0.9" />
          </filter>
        </defs>
        <g fill="none" stroke={T.text} strokeLinecap="round" strokeLinejoin="round"
           markerEnd="url(#head)" filter="url(#hand)">
          {arrows.map((a, i) => (
            <path key={i} d={a.d} strokeWidth={a.sw} style={{ filter: 'url(#lift)' }} />
          ))}
        </g>
      </svg>
    </div>
  );
};
