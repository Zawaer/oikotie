// Render the PNG app icons from the SVG sources.
//
// The PNGs are build output, not hand-drawn assets - edit the SVGs and re-run
// this. Chrome and Firefox both want real PNGs in the manifest, so they are
// committed, but they should never be edited directly.
//
//   node scripts/build-icons.mjs

import puppeteer from 'puppeteer-core';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const iconsDir = path.join(rootDir, 'ui', 'icons');

const CHROME_PATH = process.env.CHROME_PATH
    || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// Optical sizing: at 16px the standard tile leaves the mark too small for the
// arc and arrowhead to separate, so that one size comes from the compact cut.
const SIZES = [
    { size: 16, source: 'icon-tile-compact.svg' },
    { size: 32, source: 'icon-tile.svg' },
    { size: 48, source: 'icon-tile.svg' },
    { size: 64, source: 'icon-tile.svg' },
    { size: 96, source: 'icon-tile.svg' },
    { size: 128, source: 'icon-tile.svg' }
];

const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
});

for (const { size, source } of SIZES) {
    const svg = await readFile(path.join(iconsDir, source), 'utf8');
    const sized = svg.replace('width="32" height="32"', `width="${size}" height="${size}"`);

    const page = await browser.newPage();
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    await page.setContent(
        `<html><body style="margin:0;width:${size}px;height:${size}px">${sized}</body></html>`,
        { waitUntil: 'networkidle0' }
    );
    await page.screenshot({
        path: path.join(iconsDir, `icon${size}.png`),
        omitBackground: true,
        clip: { x: 0, y: 0, width: size, height: size }
    });
    await page.close();
    console.log(`icon${size}.png  (${source})`);
}

// Chrome Web Store listing icon. Chrome wants a 128x128 file whose artwork is
// 96x96 inside a 16px transparent border, so it sits at the same visual size
// as other icons in the store grid; a full-bleed tile looks oversized there.
// AMO shows icons full-bleed, so it gets the plain tiles from ui/icons.
{
    const svg = await readFile(path.join(iconsDir, 'icon-tile.svg'), 'utf8');
    const sized = svg.replace('width="32" height="32"', 'width="96" height="96"');
    const storeDir = path.join(rootDir, 'dist', 'store');
    await mkdir(storeDir, { recursive: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 128, height: 128, deviceScaleFactor: 1 });
    await page.setContent(
        `<html><body style="margin:0;width:128px;height:128px;display:flex;align-items:center;justify-content:center">${sized}</body></html>`,
        { waitUntil: 'networkidle0' }
    );
    await page.screenshot({
        path: path.join(storeDir, 'store-icon-chrome-128.png'),
        omitBackground: true,
        clip: { x: 0, y: 0, width: 128, height: 128 }
    });
    await page.close();
    console.log('dist/store/store-icon-chrome-128.png  (96px artwork, 16px padding)');
}

await browser.close();
