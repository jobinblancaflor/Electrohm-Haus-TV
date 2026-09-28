// Renders the app icon, Android adaptive-icon foreground and splash mark from the web favicon mark.
// Run with `npm run icons`; outputs are committed.
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const MARK =
  '<rect x="10" y="16" width="44" height="30" rx="6" fill="none" stroke="#ffb547" stroke-width="4"/>' +
  '<path d="M24 54h16" stroke="#ffb547" stroke-width="4" stroke-linecap="round"/>' +
  '<path d="M22 31h5l3-7 4 14 3-7h5" fill="none" stroke="#eeeaf6" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>';

function svg(size, markScale, background) {
  const scale = (size * markScale) / 64;
  const offset = (size - 64 * scale) / 2;
  const fill = background ? `<rect width="${size}" height="${size}" fill="${background}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${fill}<g transform="translate(${offset} ${offset}) scale(${scale})">${MARK}</g></svg>`;
}

const outputs = [
  ['assets/icon.png', svg(1024, 0.8, '#14111F')],
  ['assets/adaptive-icon.png', svg(1024, 0.55)],
  ['assets/splash-icon.png', svg(512, 0.9)],
];

for (const [file, source] of outputs) {
  writeFileSync(new URL(`../${file}`, import.meta.url), new Resvg(source).render().asPng());
  console.log(`Wrote ${file}`);
}
