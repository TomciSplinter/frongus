// Builds the favicon and touch icon from the traced Frongus.
// usage: node scripts/make-assets.mjs
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { BASE } from '../public/js/frongus-base.js';

const K = 2.4; // heavier ink so the mark holds up at 16-32px
const eye = (e) => `<ellipse cx="${e.cx}" cy="${e.cy}" rx="${e.rx}" ry="${e.ry}" transform="rotate(${e.rot} ${e.cx} ${e.cy})" fill="#fff" stroke="#000" stroke-width="${10 * K}"/>` +
  `<circle cx="${e.px}" cy="${e.py}" r="${e.pr * 1.05}" fill="#000"/>`;
const frongus = (fill) => `<path d="${BASE.fill}" fill="${fill}"/>` +
  BASE.lines.map((d) => `<path d="${d}" fill="none" stroke="#000" stroke-width="${11.5 * K}" stroke-linecap="round" stroke-linejoin="round"/>`).join('') +
  `<path d="${BASE.mouth}" fill="none" stroke="#000" stroke-width="${11.5 * K}" stroke-linecap="round"/>` + eye(BASE.eyeL) + eye(BASE.eyeR);

const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="40 74 716 716">${frongus('#758AA2')}</svg>`;
writeFileSync('public/img/favicon.svg', mark);

const touch = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 900"><rect width="900" height="900" fill="#E4E4E4"/><g transform="translate(70 135) scale(0.96)">${frongus('#758AA2')}</g></svg>`;
writeFileSync('public/img/apple-touch-icon.png', new Resvg(touch, { fitTo: { mode: 'width', value: 180 } }).render().asPng());
writeFileSync('public/img/icon-512.png', new Resvg(touch, { fitTo: { mode: 'width', value: 512 } }).render().asPng());
console.log('assets written');
