import { continueRender, delayRender, staticFile } from 'remotion';

// The brand face, from the same woff2 the extension bundles (ui/fonts).
export const fontFamily = 'Oikotie Grotesk';

if (typeof document !== 'undefined') {
  const handle = delayRender('Loading Oikotie Grotesk');
  const face = new FontFace(fontFamily, `url(${staticFile('fonts/schibsted-grotesk.woff2')}) format("woff2")`, {
    weight: '400 900',
  });
  face
    .load()
    .then((loaded) => {
      document.fonts.add(loaded);
      continueRender(handle);
    })
    .catch((error) => {
      console.error(error);
      continueRender(handle);
    });
}
