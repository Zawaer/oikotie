import { access, mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const releasesDir = path.join(rootDir, 'dist', 'releases');

const targets = {
  chrome: { distDir: path.join(rootDir, 'dist', 'chrome') },
  firefox: { distDir: path.join(rootDir, 'dist', 'firefox') }
};

// Derive the zip name from the manifest rather than hardcoding it, so renaming
// the extension does not quietly keep shipping files under the old name.
function toFileSlug(name) {
  return String(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'extension';
}

function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit'
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function readManifest(manifestPath) {
  const manifestText = await readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestText);
  if (!manifest.version) {
    throw new Error(`${path.relative(rootDir, manifestPath)} is missing a version field`);
  }
  if (!manifest.name) {
    throw new Error(`${path.relative(rootDir, manifestPath)} is missing a name field`);
  }
  return manifest;
}

async function ensureDirExists(dirPath) {
  try {
    await access(dirPath);
  } catch (error) {
    throw new Error(`Missing ${path.relative(rootDir, dirPath)}. Run "node scripts/build-variants.mjs" first.`);
  }
}

async function packageTarget(target) {
  const config = targets[target];
  if (!config) {
    throw new Error(`Unknown target: ${target}. Use chrome or firefox.`);
  }

  await ensureDirExists(config.distDir);

  const manifestPath = path.join(config.distDir, 'manifest.json');
  const manifest = await readManifest(manifestPath);
  const slug = toFileSlug(manifest.name);
  const outputZip = path.join(releasesDir, `${slug}-${target}-v${manifest.version}.zip`);

  await mkdir(releasesDir, { recursive: true });
  await rm(outputZip, { force: true });

  // -X strips extra macOS metadata and avoids __MACOSX / AppleDouble files.
  await runCommand('zip', ['-r', '-X', outputZip, '.', '-x', '*/.*', '.*', '__MACOSX/*'], config.distDir);
  console.log(`Created ${path.relative(rootDir, outputZip)}`);
}

async function main() {
  const requested = process.argv.slice(2);
  const selectedTargets = requested.length > 0 ? requested : ['chrome', 'firefox'];

  for (const target of selectedTargets) {
    await packageTarget(target);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});