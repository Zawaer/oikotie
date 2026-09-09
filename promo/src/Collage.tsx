import React from 'react';
import { Img, staticFile } from 'remotion';
import { T } from './theme';

// The bowtie: three service logins converge on the shared MPASSid + school
// spine, then fan back out to three destinations. Arrow paths are derived from
// the tile rectangles, so moving a tile moves its arrows.

type Rect = { x: number; y: number; w: number; h: number };
type Tile = { id: string; rect: Rect; src?: string; pos?: string; zoom?: number; label?: string };

export type CollageProps = {
  width: number;
  height: number;
  /** Optional logged-in dashboard captures; placeholders are drawn when absent. */
  destinations?: { kampus?: string; nova?: string; studeo?: string };
  arrowColor?: string;
};

const col = (x: number, w: number, count: number, H: number, gap: number): Rect[] => {
  const h = (H - gap * (count - 1)) / count;
  return Array.from({ length: count }, (_, i) => ({ x, y: i * (h + gap), w, h }));
};

const midR = (r: Rect) => ({ x: r.x + r.w, y: r.y + r.h / 2 });
const midL = (r: Rect) => ({ x: r.x, y: r.y + r.h / 2 });
const midB = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h });
const midT = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y });

// A slightly loose cubic between two points, for a drawn-by-hand feel.
const curve = (a: { x: number; y: number }, b: { x: number; y: number }, pad = 10) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const horizontal = Math.abs(dx) > Math.abs(dy);
  const ax = horizontal ? a.x + pad : a.x, ay = horizontal ? a.y : a.y + pad;
  const bx = horizontal ? b.x - pad : b.x, by = horizontal ? b.y : b.y - pad;
  const c1 = horizontal ? { x: ax + dx * 0.45, y: ay + dy * 0.05 } : { x: ax + dx * 0.05, y: ay + dy * 0.45 };
  const c2 = horizontal ? { x: bx - dx * 0.35, y: by - dy * 0.1 } : { x: bx - dx * 0.1, y: by - dy * 0.35 };
  return `M ${ax} ${ay} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${bx} ${by}`;
};

export const Collage: React.FC<CollageProps> = ({ width: W, height: H, destinations = {}, arrowColor = T.text }) => {
  const gap = 18;
  const colW = Math.round((W - 2 * 88) / 3); // three columns with 88px arrow lanes between
  const xL = 0, xM = colW + 88, xR = 2 * (colW + 88);

  const entries: Tile[] = col(xL, colW, 3, H, gap).map((rect, i) => ([
    // Zoom in on the login card itself: a whole page at tile size is grey noise.
    { id: 'kampus', src: 'tiles/kampus.png', pos: '50% 24%', zoom: 2.2 },
    { id: 'nova', src: 'tiles/nova.png', pos: '60% 42%', zoom: 1.75 },
    { id: 'studeo', src: 'tiles/studeo.png', pos: '24% 42%', zoom: 1.8 },
  ][i] as Tile & { rect?: Rect })).map((t, i) => ({ ...t, rect: col(xL, colW, 3, H, gap)[i] }));

  const spine: Tile[] = col(xM, colW, 2, H, gap).map((rect, i) => ([
    { id: 'mpass', src: 'tiles/mpass.png', pos: '80% 44%', zoom: 1.45 },
    { id: 'espoo', src: 'tiles/espoo.png', pos: '82% 46%', zoom: 1.3 },
  ][i] as Tile)).map((t, i) => ({ ...t, rect: col(xM, colW, 2, H, gap)[i] }));

  const dests: Tile[] = col(xR, colW, 3, H, gap).map((rect, i) => ([
    { id: 'kampus-d', src: destinations.kampus, label: 'Kampus' },
    { id: 'nova-d', src: destinations.nova, label: 'Nova' },
    { id: 'studeo-d', src: destinations.studeo, label: 'Studeo' },
  ][i] as Tile)).map((t, i) => ({ ...t, rect: col(xR, colW, 3, H, gap)[i] }));

  const paths = [
    ...entries.map((e) => curve(midR(e.rect), midL(spine[0].rect))),
    curve(midB(spine[0].rect), midT(spine[1].rect)),
    ...dests.map((d) => curve(midR(spine[1].rect), midL(d.rect))),
  ];

  const tileStyle = (r: Rect): React.CSSProperties => ({
    position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h,
    borderRadius: 12, overflow: 'hidden', background: '#fff',
    boxShadow: '0 10px 26px rgba(30,20,10,.18), 0 0 0 1px rgba(0,0,0,.05)',
  });

  const Placeholder: React.FC<{ label: string }> = ({ label }) => (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
      background: `linear-gradient(160deg, ${T.surface}, ${T.warm})`, color: T.accentDeep,
      fontWeight: 700, fontSize: 20, letterSpacing: -0.2,
    }}>
      <div style={{ width: 36, height: 36, borderRadius: 999, background: T.accent, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 20 }}>✓</div>
      {label}
    </div>
  );

  return (
    <div style={{ position: 'relative', width: W, height: H }}>
      {[...entries, ...spine, ...dests].map((t) => (
        <div key={t.id} style={tileStyle(t.rect)}>
          {t.src
            ? <Img src={staticFile(t.src)} style={{
                width: '100%', height: '100%', objectFit: 'cover', objectPosition: t.pos ?? 'center', display: 'block',
                // scale around the same focal point the crop uses, so zooming keeps the subject
                transform: `scale(${t.zoom ?? 1})`, transformOrigin: t.pos ?? 'center',
              }} />
            : <Placeholder label={t.label ?? ''} />}
        </div>
      ))}
      <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <marker id="head" viewBox="0 0 10 10" refX="7.5" refY="5" markerWidth="4.2" markerHeight="4.2" orient="auto-start-reverse">
            <path d="M1 1 L9 5 L1 9 z" fill={arrowColor} />
          </marker>
          {/* a whisper of displacement so the strokes read as drawn, not plotted */}
          <filter id="hand" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves={2} seed={7} result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale={2.2} />
          </filter>
        </defs>
        <g fill="none" stroke={arrowColor} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" markerEnd="url(#head)" filter="url(#hand)">
          {paths.map((d, i) => <path key={i} d={d} />)}
        </g>
      </svg>
    </div>
  );
};
