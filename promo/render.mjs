// Render every still in src/Root.tsx into ../dist/store/<lang>/.
//   node render.mjs            # everything
//   node render.mjs 01-flow    # ids starting with this
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const SHOTS = ['01-flow', 'promo-tile', 'marquee'];
const SIZES = { 'promo-tile': '440x280', marquee: '1400x560' };
const filter = process.argv[2] || '';

for (const lang of ['fi', 'en']) {
  mkdirSync(`../dist/store/${lang}`, { recursive: true });
  for (const shot of SHOTS.filter((s) => s.startsWith(filter))) {
    const out = `../dist/store/${lang}/${shot}-${SIZES[shot] || '1280x800'}.png`;
    const result = spawnSync('npx', ['remotion', 'still', `${shot}-${lang}`, out, '--log=error'], { stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status ?? 1);
    console.log(out);
  }
}
