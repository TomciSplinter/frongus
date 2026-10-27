// Renders every trait option into an HTML contact sheet for visual review.
// usage: node scripts/contact-sheet.mjs <outDir> [slot,slot,...]
import { writeFileSync, mkdirSync } from 'node:fs';
import { renderSVG, CATALOG, DEFAULT_TRAITS } from '../public/js/frongus-art.js';

const out = process.argv[2] || 'contact';
const only = process.argv[3] ? process.argv[3].split(',') : null;
mkdirSync(out, { recursive: true });

const base = { ...DEFAULT_TRAITS, bgColor: '#E4E4E4' };
const extras = {
  pattern: { country: 'hu' },
  prop: { country: 'br' },
  bg: { country: 'jp', bgColor: '#FFD54D' },
  outfit: { accent: '#3E78C8' },
  head: { accent: '#E0473C' },
};
for (const slot of ['skin', 'pattern', 'head', 'eyes', 'mouth', 'face', 'outfit', 'prop', 'bg', 'country']) {
  if (only && !only.includes(slot)) continue;
  const cells = CATALOG[slot].map((o) => {
    const t = { ...base, ...(extras[slot] || {}) };
    if (slot === 'country') { t.pattern = 'flag'; t.country = o.id; }
    else t[slot] = o.id;
    return `<figure>${renderSVG(t, { size: 240 })}<figcaption>${o.id}</figcaption></figure>`;
  }).join('');
  writeFileSync(`${out}/${slot}.html`, `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#fff;font:14px sans-serif}main{display:grid;grid-template-columns:repeat(6,240px);gap:8px;padding:8px}figure{margin:0}figcaption{text-align:center}</style><main>${cells}</main>`);
  console.log(slot, CATALOG[slot].length);
}
