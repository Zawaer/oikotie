import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { fontFamily } from './font';
import { Mark } from './Mark';
import { Collage } from './Collage';
import { T } from './theme';

export type ShotProps = {
  /** Two lines; the second gets the signal highlighter. */
  headline: [string, string];
  sub: string;
  /** Show the Oikotie lockup above the headline (off when the headline is the name). */
  lockup?: boolean;
  /** What the tablet shows: the login-flow collage, or one capture from public/. */
  screen: { kind: 'collage'; popup?: string } | { kind: 'image'; src: string; pos?: string; zoom?: number };
};

// 1280x800 store screenshot: copy on the left, a tilted tablet on the right.
// Composed after the original hand-made listing image.
export const Shot: React.FC<ShotProps> = ({ headline, sub, lockup = true, screen }) => {
  const screenW = 690, screenH = 460, bezel = 16;
  const deviceW = screenW + bezel * 2, deviceH = screenH + bezel * 2;

  return (
    <AbsoluteFill style={{ fontFamily, color: T.text, background: 'linear-gradient(180deg, #d6e5dc 0%, #e9f0eb 52%, #f6f8f5 100%)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 64, top: 0, bottom: 0, width: 480, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {lockup && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 26, fontWeight: 800, letterSpacing: '-0.035em', marginBottom: 34 }}>
            <Mark size={40} /> <span>Oikotie</span>
          </div>
        )}
        <h1 style={{ margin: 0, fontSize: 64, lineHeight: 1.1, fontWeight: 800, letterSpacing: '-0.045em' }}>
          {headline[0]}
          <br />
          <span style={{ background: T.signal, padding: '0 0.12em', margin: '0 -0.12em', borderRadius: '0.1em', boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' }}>
            {headline[1]}
          </span>
        </h1>
        <p style={{ margin: '28px 0 0', fontSize: 23, lineHeight: 1.4, color: T.muted, fontWeight: 500, maxWidth: 440 }}>{sub}</p>
      </div>

      <div style={{ position: 'absolute', left: 512, top: 156, width: deviceW, height: deviceH, perspective: 2200, perspectiveOrigin: '30% 40%' }}>
        <div style={{
          position: 'absolute', inset: 0, transformStyle: 'preserve-3d',
          transform: 'rotateX(22deg) rotateY(-16deg) rotateZ(7deg)',
        }}>
          {/* the tablet's edge: a darker plate a few px behind the face */}
          <div style={{ position: 'absolute', inset: 0, borderRadius: 34, background: '#c4cec8', transform: 'translateZ(-16px)', boxShadow: '30px 60px 90px rgba(15,46,39,.30)' }} />
          <div style={{ position: 'absolute', inset: 0, borderRadius: 34, background: '#fbfcfa', padding: bezel, boxShadow: 'inset 0 0 0 1px rgba(15,46,39,.08)' }}>
            <div style={{ width: screenW, height: screenH, borderRadius: 20, overflow: 'hidden', background: T.page }}>
              {screen.kind === 'collage'
                ? <Collage width={screenW} height={screenH} popup={screen.popup} />
                : <Img src={staticFile(screen.src)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: screen.pos ?? '50% 0%', display: 'block', transform: `scale(${screen.zoom ?? 1})`, transformOrigin: screen.pos ?? '50% 0%' }} />}
            </div>
          </div>
        </div>
      </div>

    </AbsoluteFill>
  );
};
