import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const manifestsDir = path.join(rootDir, 'manifests');
const distDir = path.join(rootDir, 'dist');

const targets = {
  chrome: 'chrome.json',
  firefox: 'firefox.json'
};

const args = process.argv.slice(2);
const requested = args.length > 0 ? args : ['chrome', 'firefox'];

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(base, override) {
  if (!isObject(base) || !isObject(override)) {
    return override;
  }

  const output = { ...base };
  for (const [key, value] of Object.entries(override)) {
    output[key] = key in output ? deepMerge(output[key], value) : value;
  }
  return output;
}

async function readJson(jsonPath) {
  const content = await readFile(jsonPath, 'utf8');
  return JSON.parse(content);
}

async function buildTarget(target) {
  if (!targets[target]) {
    throw new Error(`Unknown target: ${target}. Use chrome or firefox.`);
  }

  const baseManifest = await readJson(path.join(manifestsDir, 'base.json'));
  const overrideManifest = await readJson(path.join(manifestsDir, targets[target]));
  const mergedManifest = deepMerge(baseManifest, overrideManifest);

  if (target === 'firefox') {
    // Firefox in this setup expects background scripts instead of MV3 service worker.
    mergedManifest.background = {
      scripts: ['background.js']
    };
  }

  const outDir = path.join(distDir, target);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const ignoredTopLevel = new Set([
    '.git',
    'dist',
    'manifests',
    'node_modules',
    'tests',
    'package.json',
    'package-lock.json',
    'school_names.json'
  ]);
  const rootEntries = await readdir(rootDir, { withFileTypes: true });

  for (const entry of rootEntries) {
    if (ignoredTopLevel.has(entry.name)) continue;
    // Design exports and other archives dropped in the repo root are working
    // material, not part of the extension - shipping them just bloats the
    // uploaded package.
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.zip')) continue;

    const source = path.join(rootDir, entry.name);
    const destination = path.join(outDir, entry.name);
    await cp(source, destination, { recursive: true });
  }

  // Everything the extension itself runs is .js; every build/dev tool in
  // scripts/ is .mjs. Stripping by extension means a new tool cannot quietly
  // end up shipped inside the package, which is what happened to build-icons.
  const shippedScripts = await readdir(path.join(outDir, 'scripts'));
  for (const name of shippedScripts) {
    if (name.endsWith('.mjs')) {
      await rm(path.join(outDir, 'scripts', name), { force: true });
    }
  }

  const outputManifestPath = path.join(outDir, 'manifest.json');
  await writeFile(outputManifestPath, `${JSON.stringify(mergedManifest, null, 2)}\n`, 'utf8');

  console.log(`Built ${target} extension in ${path.relative(rootDir, outDir)}`);
}

async function run() {
  await mkdir(distDir, { recursive: true });
  for (const target of requested) {
    await buildTarget(target);
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
