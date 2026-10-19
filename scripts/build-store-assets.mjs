// Render the store listing images with the Remotion project in promo/:
// the login-flow screenshot, the promo tile and the marquee, in Finnish and
// English, into dist/store/{fi,en}/.
//
// The flow is built from the page captures in promo/public/tiles/. Refresh
// the login pages with build-promo-tiles.mjs when a service restyles them;
// tiles/dashboard.png, the signed-in Kampus page the flow ends on, needs a
// real account and is captured by hand.
//
//   node scripts/build-store-assets.mjs
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const promo = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'promo');
if (!existsSync(path.join(promo, 'node_modules'))) {
  console.error('promo/node_modules is missing: run `npm install` in promo/ first.');
  process.exit(1);
}
const result = spawnSync('npm', ['run', 'render'], { cwd: promo, stdio: 'inherit' });
process.exit(result.status ?? 1);
