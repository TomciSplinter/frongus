// Vercel build step: makes the social preview image URL absolute (X and Telegram need that).
// Uses SITE_URL, or the production domain Vercel exposes at build time.
import { readFileSync, writeFileSync } from 'node:fs';

const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const site = (process.env.SITE_URL || (host ? `https://${host}` : '')).replace(/\/+$/, '');
const file = new URL('../public/index.html', import.meta.url);
const html = readFileSync(file, 'utf8');
if (site) {
  writeFileSync(file, html.replace(/content="\/img\/og\.png"/g, `content="${site}/img/og.png"`).replace('<meta property="og:type"', `<meta property="og:url" content="${site}/">\n  <meta property="og:type"`));
  console.log(`social preview image -> ${site}/img/og.png`);
} else {
  console.log('SITE_URL not set; social preview image stays relative');
}
