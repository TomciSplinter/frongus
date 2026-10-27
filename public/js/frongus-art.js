// Frongus variant renderer. Pure functions that return SVG strings, so the same code runs
// in the browser (preview) and on the server (the image that gets uploaded at launch).
import { BASE } from './frongus-base.js';
import { FLAGS, FLAG_IDS, flagInBox, starPath } from './frongus-flags.js';

export const INK = '#000';
const SW = 10; // accessory line weight (the body lines are 11.5)
const BODY_SW = 11.5;
const CANVAS = 1000;

/* ------------------------------------------------------------------ utils */
const n1 = (v) => Math.round(v * 10) / 10;
function hexToRgb(h) {
  const x = h.replace('#', '');
  const v = x.length === 3 ? x.split('').map((c) => c + c).join('') : x;
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
}
function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('');
}
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A.map((c, i) => c + (B[i] - c) * t));
}
const lighten = (c, t) => mix(c, '#ffffff', t);
const darken = (c, t) => mix(c, '#000000', t);
export function luminance(c) {
  const [r, g, b] = hexToRgb(c).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
export function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.int = (n) => Math.floor(next() * n);
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  next.chance = (p) => next() < p;
  return next;
}

// ink stroke attributes; an explicit stroke colour in `extra` replaces the default ink
const ink = (sw, extra, round = true) => {
  if (!sw) return '';
  const col = /\sstroke="/.test(extra) ? '' : ` stroke="${INK}"`;
  const width = /\sstroke-width="/.test(extra) ? '' : ` stroke-width="${n1(sw)}"`;
  return `${col}${width}${round && !/stroke-linecap/.test(extra) ? ' stroke-linejoin="round" stroke-linecap="round"' : ''}`;
};
const P = (d, fill = 'none', sw = SW, extra = '') => `<path d="${d}" fill="${fill}"${ink(sw, extra)}${extra}/>`;
const C = (cx, cy, r, fill = 'none', sw = SW, extra = '') =>
  `<circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(r)}" fill="${fill}"${ink(sw, extra, false)}${extra}/>`;
const E = (cx, cy, rx, ry, fill = 'none', sw = SW, extra = '') =>
  `<ellipse cx="${n1(cx)}" cy="${n1(cy)}" rx="${n1(rx)}" ry="${n1(ry)}" fill="${fill}"${ink(sw, extra, false)}${extra}/>`;
const G = (t, inner) => `<g transform="${t}">${inner}</g>`;
const L = (x1, y1, x2, y2, sw = SW, color = INK) =>
  `<path d="M${n1(x1)},${n1(y1)}L${n1(x2)},${n1(y2)}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>`;

function heartPath(cx, cy, s) {
  // heart centred at cx,cy, roughly 2s wide
  return `M${n1(cx)},${n1(cy + s * 0.9)} C${n1(cx - s * 1.5)},${n1(cy)} ${n1(cx - s * 0.9)},${n1(cy - s * 1.15)} ${n1(cx)},${n1(cy - s * 0.4)} C${n1(cx + s * 0.9)},${n1(cy - s * 1.15)} ${n1(cx + s * 1.5)},${n1(cy)} ${n1(cx)},${n1(cy + s * 0.9)} Z`;
}
function sparkle(cx, cy, s, fill = '#fff', sw = 6) {
  const d = `M${cx},${cy - s} Q${cx + s * 0.18},${cy - s * 0.18} ${cx + s},${cy} Q${cx + s * 0.18},${cy + s * 0.18} ${cx},${cy + s} Q${cx - s * 0.18},${cy + s * 0.18} ${cx - s},${cy} Q${cx - s * 0.18},${cy - s * 0.18} ${cx},${cy - s} Z`;
  return P(d, fill, sw);
}

/* -------------------------------------------------------------- palettes */
export const SWATCHES = {
  bg: ['#E4E4E4', '#FFFFFF', '#F7D9D9', '#FCEBB0', '#D2F0DA', '#D3E9F8', '#E5DCF7', '#FFDDBE', '#FF9E9E', '#FFD54D', '#7FD99A', '#6FC2F2', '#B39BF2', '#FF91C8', '#2C2F48', '#14161F', '#0E3B3C', '#3B2D5E'],
  accent: ['#E0473C', '#F39237', '#F5C842', '#5DB36A', '#2FA59B', '#3E78C8', '#7E5BC6', '#E8508E', '#FFFFFF', '#232323'],
};

// skins: fill colour, optional gradient stops, optional sheen
export const SKINS = {
  classic: { label: 'Classic', fill: '#758AA2' },
  sky: { label: 'Sky', fill: '#86B8E8' },
  ocean: { label: 'Ocean', fill: '#3F78C9' },
  navy: { label: 'Navy', fill: '#2E4A7E' },
  teal: { label: 'Teal', fill: '#2FA59B' },
  mint: { label: 'Mint', fill: '#94DEC6' },
  green: { label: 'Green', fill: '#5DB36A' },
  lime: { label: 'Lime', fill: '#A7D957' },
  olive: { label: 'Olive', fill: '#8D9A4C' },
  yellow: { label: 'Yellow', fill: '#F5D04A' },
  orange: { label: 'Orange', fill: '#F39237' },
  red: { label: 'Red', fill: '#E0473C' },
  crimson: { label: 'Crimson', fill: '#B3243B' },
  pink: { label: 'Pink', fill: '#F59EC3' },
  hotpink: { label: 'Hot pink', fill: '#E8508E' },
  lavender: { label: 'Lavender', fill: '#B9A6EA' },
  purple: { label: 'Purple', fill: '#7E5BC6' },
  brown: { label: 'Brown', fill: '#9B6B4A' },
  tan: { label: 'Tan', fill: '#D9B48D' },
  white: { label: 'White', fill: '#F5F5F2' },
  gray: { label: 'Gray', fill: '#A4AAB2' },
  charcoal: { label: 'Charcoal', fill: '#40444D' },
  zombie: { label: 'Zombie', fill: '#93B57A' },
  alien: { label: 'Alien', fill: '#7DE383' },
  ice: { label: 'Ice', fill: '#CFEBF8', grad: ['#EEF9FF', '#A9D8F0'], sheen: true },
  gold: { label: 'Gold', fill: '#F2C043', grad: ['#FFE68A', '#E3A02A'], sheen: true },
  silver: { label: 'Silver', fill: '#C9D0D8', grad: ['#F5F7F9', '#9EA8B3'], sheen: true },
  chrome: { label: 'Chrome', fill: '#B9C3CF', grad: ['#F2F5F8', '#7C8896', '#E9EEF3', '#6D7886'], sheen: true },
  rainbow: { label: 'Rainbow', fill: '#E0473C', grad: ['#FF5E5B', '#FFB347', '#FFE45C', '#7DDB7A', '#5BC0EB', '#9B7BF0'], horizontal: true },
  sunset: { label: 'Sunset', fill: '#F48A5A', grad: ['#FFC36A', '#F06D5C', '#9A4FB0'] },
  candy: { label: 'Cotton candy', fill: '#F7B5D5', grad: ['#FFC4E1', '#B9DDFB'], horizontal: true },
  fire: { label: 'Fire', fill: '#F26B3A', grad: ['#FFD25E', '#F5622F', '#C81D3E'] },
  galaxy: { label: 'Galaxy', fill: '#2A1F5C', grad: ['#3A2A7A', '#1A1640'], stars: true },
};
export const SKIN_IDS = Object.keys(SKINS);

/* ------------------------------------------------------------- catalogue */
// Every slot lists its options in display order. Labels are what people see.
export const CATALOG = {
  skin: SKIN_IDS.map((id) => ({ id, label: SKINS[id].label })),
  pattern: [
    ['none', 'None'], ['spots', 'Spots'], ['polka', 'Polka dots'], ['stripes', 'Stripes'], ['tiger', 'Tiger'],
    ['cow', 'Cow'], ['hearts', 'Hearts'], ['stars', 'Stars'], ['camo', 'Camo'], ['belly', 'Belly'], ['flag', 'Flag paint'],
  ].map(([id, label]) => ({ id, label })),
  head: [
    ['none', 'None'], ['crown', 'Crown'], ['tophat', 'Top hat'], ['cowboy', 'Cowboy hat'], ['wizard', 'Wizard hat'],
    ['witch', 'Witch hat'], ['party', 'Party hat'], ['beanie', 'Beanie'], ['cap', 'Cap'], ['chef', 'Chef hat'],
    ['viking', 'Viking helmet'], ['halo', 'Halo'], ['horns', 'Devil horns'], ['santa', 'Santa hat'], ['pirate', 'Pirate hat'],
    ['propeller', 'Propeller cap'], ['headphones', 'Headphones'], ['antenna', 'Antennae'], ['flower', 'Flower'],
    ['bow', 'Bow'], ['mohawk', 'Mohawk'], ['grad', 'Grad cap'], ['straw', 'Straw hat'], ['bunny', 'Bunny ears'],
    ['cat', 'Cat ears'], ['hardhat', 'Hard hat'], ['headband', 'Headband'], ['sprout', 'Sprout'], ['cone', 'Traffic cone'],
    ['nightcap', 'Nightcap'], ['bubble', 'Space helmet'], ['mini', 'Mini Frongus'],
  ].map(([id, label]) => ({ id, label })),
  eyes: [
    ['normal', 'Normal'], ['big', 'Big pupils'], ['tiny', 'Tiny pupils'], ['side', 'Side-eye'], ['up', 'Looking up'],
    ['sleepy', 'Sleepy'], ['angry', 'Angry'], ['worried', 'Worried'], ['hearts', 'Heart eyes'], ['stars', 'Star eyes'],
    ['dollars', 'Dollar eyes'], ['dead', 'X eyes'], ['spiral', 'Hypnotized'], ['laser', 'Laser eyes'], ['glow', 'Glowing'],
    ['shades', 'Sunglasses'], ['pixel', 'Pixel shades'], ['3d', '3D glasses'], ['nerd', 'Round glasses'],
    ['monocle', 'Monocle'], ['patch', 'Eye patch'],
  ].map(([id, label]) => ({ id, label })),
  mouth: [
    ['line', 'Flat'], ['smile', 'Smile'], ['grin', 'Grin'], ['open', 'Gasp'], ['frown', 'Frown'], ['tongue', 'Tongue'],
    ['teeth', 'Buck teeth'], ['fangs', 'Fangs'], ['mustache', 'Mustache'], ['pacifier', 'Pacifier'], ['gum', 'Bubblegum'],
    ['lollipop', 'Lollipop'], ['rose', 'Rose'], ['pizza', 'Pizza'], ['drool', 'Drool'],
  ].map(([id, label]) => ({ id, label })),
  face: [
    ['none', 'None'], ['blush', 'Blush'], ['freckles', 'Freckles'], ['bandaid', 'Bandage'], ['sweat', 'Sweat'],
    ['tears', 'Tears'], ['stitches', 'Stitches'], ['thirdeye', 'Third eye'], ['scar', 'Scar'],
  ].map(([id, label]) => ({ id, label })),
  outfit: [
    ['none', 'None'], ['chain', 'Gold chain'], ['bowtie', 'Bow tie'], ['tie', 'Necktie'], ['scarf', 'Scarf'],
    ['bandana', 'Bandana'], ['bell', 'Bell collar'], ['medal', 'Medal'], ['cape', 'Cape'], ['bib', 'Bib'],
    ['lei', 'Flower lei'], ['diaper', 'Diaper'],
  ].map(([id, label]) => ({ id, label })),
  prop: [
    ['none', 'None'], ['flag', 'Flag'], ['balloon', 'Balloon'], ['rocket', 'Rocket'], ['coins', 'Coins'],
    ['moneybag', 'Money bag'], ['diamond', 'Diamond'], ['coffee', 'Coffee'], ['burger', 'Burger'], ['trophy', 'Trophy'],
    ['skateboard', 'Skateboard'], ['sparkles', 'Sparkles'],
  ].map(([id, label]) => ({ id, label })),
  bg: [
    ['solid', 'Solid'], ['gradient', 'Gradient'], ['rays', 'Sunburst'], ['dots', 'Dots'], ['checker', 'Checkers'],
    ['stripes', 'Stripes'], ['sky', 'Sky'], ['hill', 'Hill'], ['beach', 'Beach'], ['space', 'Space'], ['moon', 'Night'],
    ['synth', 'Synthwave'], ['candles', 'Green candles'], ['dump', 'Red candles'], ['snow', 'Snow'], ['fire', 'Fire'],
    ['hearts', 'Hearts'], ['money', 'Money'], ['city', 'City'], ['flag', 'Flag'],
  ].map(([id, label]) => ({ id, label })),
  size: [['normal', 'Normal'], ['small', 'Small'], ['big', 'Big']].map(([id, label]) => ({ id, label })),
  country: FLAG_IDS.map((id) => ({ id, label: FLAGS[id].name })),
};

export const SLOTS = ['skin', 'pattern', 'head', 'eyes', 'mouth', 'face', 'outfit', 'prop', 'bg'];

export const DEFAULT_TRAITS = {
  skin: 'classic', pattern: 'none', head: 'none', eyes: 'normal', mouth: 'line', face: 'none',
  outfit: 'none', prop: 'none', bg: 'solid', bgColor: '#E4E4E4', accent: '#E0473C', size: 'normal', country: 'us',
};

const isColor = (c) => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);
// Keep only known values, so anything that reaches the renderer (or the server) is a real Frongus.
export function sanitizeTraits(t = {}) {
  const out = { ...DEFAULT_TRAITS };
  for (const slot of [...SLOTS, 'size', 'country']) {
    const v = t[slot];
    if (typeof v === 'string' && CATALOG[slot].some((o) => o.id === v)) out[slot] = v;
  }
  if (isColor(t.bgColor)) out.bgColor = t.bgColor.toUpperCase();
  if (isColor(t.accent)) out.accent = t.accent.toUpperCase();
  return out;
}

/* ------------------------------------------------------------ geometry */
const EL = BASE.eyeL, ER = BASE.eyeR;
const HAT_K = 1.32;
const HAT = `translate(505 242) rotate(9) scale(${HAT_K})`;
// scale a drawing up while keeping its ink lines at the standard weight
const thin = (svg, k) => svg.replace(/stroke-width="([\d.]+)"/g, (m, v) => `stroke-width="${n1(v / k)}"`);
const HATG = (inner) => G(HAT, thin(inner, HAT_K));
const SCALED = (t, k, inner) => G(`${t} scale(${k})`, thin(inner, k));
const FRONT = { x: 690, ground: BASE.ground }; // floor spot in front of the face

/* ---------------------------------------------------------- body + skin */
function skinPaint(ctx) {
  const s = SKINS[ctx.t.skin] || SKINS.classic;
  if (!s.grad) return s.fill;
  const id = `${ctx.id}-skin`;
  const stops = s.grad.map((c, i) => `<stop offset="${(i / (s.grad.length - 1)).toFixed(3)}" stop-color="${c}"/>`).join('');
  const dir = s.horizontal ? 'x1="0" y1="0" x2="1" y2="0"' : 'x1="0" y1="0" x2="0.25" y2="1"';
  ctx.defs.push(`<linearGradient id="${id}" ${dir}>${stops}</linearGradient>`);
  return `url(#${id})`;
}

function skinExtras(ctx) {
  const s = SKINS[ctx.t.skin] || SKINS.classic;
  let out = '';
  if (s.stars) {
    const r = rng(hashString(ctx.t.skin + ctx.seed));
    for (let i = 0; i < 26; i++) {
      const x = 90 + r() * 620, y = 230 + r() * 400;
      out += r() < 0.25 ? sparkle(n1(x), n1(y), 10 + r() * 6, '#FFF7C2', 0) : C(x, y, 2 + r() * 3.5, '#fff', 0, ' opacity="0.9"');
    }
    out += E(330, 360, 150, 70, '#C06BE0', 0, ' opacity="0.22"') + E(520, 470, 120, 60, '#5BC0EB', 0, ' opacity="0.18"');
  }
  if (s.sheen) {
    out += P('M210,330 C260,270 340,236 420,228', 'none', 0, ` stroke="#fff" stroke-width="16" stroke-linecap="round" opacity="0.55"`);
    out += P('M190,372 C196,362 202,353 209,344', 'none', 0, ` stroke="#fff" stroke-width="16" stroke-linecap="round" opacity="0.55"`);
  }
  return out;
}

function patternLayer(ctx) {
  const t = ctx.t, base = (SKINS[t.skin] || SKINS.classic).fill;
  const dark = luminance(base) > 0.5 ? darken(base, 0.3) : lighten(base, 0.4);
  const r = rng(hashString('pat' + ctx.seed));
  let s = '';
  switch (t.pattern) {
    case 'spots':
      for (let i = 0; i < 16; i++) s += E(110 + r() * 590, 240 + r() * 360, 16 + r() * 22, 12 + r() * 16, dark, 0);
      return s;
    case 'polka':
      for (let y = 230; y < 650; y += 64) for (let x = 80 + ((y / 64) % 2) * 32; x < 730; x += 64) s += C(x, y, 13, '#ffffff', 0, ' opacity="0.85"');
      return s;
    case 'stripes':
      for (let x = 40; x < 760; x += 70) s += `<rect x="${x}" y="200" width="32" height="460" fill="${dark}" transform="rotate(14 ${x} 430)"/>`;
      return s;
    case 'tiger':
      for (let x = 150; x < 700; x += 62) {
        s += P(`M${x},200 C${x + 18},260 ${x - 14},300 ${x + 6},360 C${x + 16},330 ${x + 30},270 ${x + 22},200 Z`, '#1B1B1B', 0);
        s += P(`M${x - 20},650 C${x - 4},600 ${x - 26},560 ${x - 10},520 C${x + 4},550 ${x + 10},600 ${x + 2},650 Z`, '#1B1B1B', 0);
      }
      return s;
    case 'cow':
      for (let i = 0; i < 7; i++) {
        const cx = 120 + r() * 560, cy = 250 + r() * 330, k = 30 + r() * 30;
        s += P(`M${n1(cx - k)},${n1(cy)} C${n1(cx - k)},${n1(cy - k)} ${n1(cx - k * 0.2)},${n1(cy - k * 1.1)} ${n1(cx + k * 0.4)},${n1(cy - k * 0.8)} C${n1(cx + k * 1.3)},${n1(cy - k * 0.6)} ${n1(cx + k * 1.1)},${n1(cy + k * 0.6)} ${n1(cx + k * 0.3)},${n1(cy + k * 0.8)} C${n1(cx - k * 0.4)},${n1(cy + k * 1.1)} ${n1(cx - k)},${n1(cy + k * 0.6)} ${n1(cx - k)},${n1(cy)} Z`, '#1E1E1E', 0);
      }
      return s;
    case 'hearts':
      for (let y = 250; y < 650; y += 78) for (let x = 100 + ((y / 78) % 2) * 39; x < 720; x += 78) s += P(heartPath(x, y, 14), '#FF6B9A', 0, ' opacity="0.9"');
      return s;
    case 'stars':
      for (let i = 0; i < 18; i++) s += P(starPath(100 + r() * 600, 240 + r() * 380, 16 + r() * 8, 7, 5, -90 + r() * 30), '#FFE45C', 0);
      return s;
    case 'camo': {
      const cols = ['#4B5B33', '#7A8450', '#2F3A22', '#A39A6A'];
      for (let i = 0; i < 30; i++) {
        const cx = 80 + r() * 650, cy = 220 + r() * 430, k = 26 + r() * 30;
        s += P(`M${n1(cx - k)},${n1(cy)} Q${n1(cx - k * 0.5)},${n1(cy - k)} ${n1(cx + k * 0.3)},${n1(cy - k * 0.6)} Q${n1(cx + k * 1.2)},${n1(cy - k * 0.2)} ${n1(cx + k * 0.6)},${n1(cy + k * 0.5)} Q${n1(cx)},${n1(cy + k)} ${n1(cx - k)},${n1(cy)} Z`, cols[i % 4], 0);
      }
      return s;
    }
    case 'belly':
      return P('M150,560 C210,500 330,470 470,480 C540,486 580,500 600,520 L600,680 L120,680 Z', lighten(base, 0.42), 0);
    case 'flag':
      return flagInBox(t.country, 70, 205, 660, 445, 'slice');
    default:
      return '';
  }
}

function body(ctx) {
  const clip = `${ctx.id}-body`;
  ctx.defs.push(`<clipPath id="${clip}"><path d="${BASE.fill}"/></clipPath>`);
  let s = `<path d="${BASE.fill}" fill="${skinPaint(ctx)}"/>`;
  const extra = skinExtras(ctx) + patternLayer(ctx) + faceUnder(ctx);
  if (extra) s += `<g clip-path="url(#${clip})">${extra}</g>`;
  s += BASE.lines.map((d) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${BODY_SW}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  return s;
}

// a tiny standalone Frongus (used for the "mini" hat and the logo)
export function miniFrongus(fill = '#758AA2') {
  const eye = (e) => `<ellipse cx="${e.cx}" cy="${e.cy}" rx="${e.rx}" ry="${e.ry}" transform="rotate(${e.rot} ${e.cx} ${e.cy})" fill="#fff" stroke="${INK}" stroke-width="10"/><circle cx="${e.px}" cy="${e.py}" r="${e.pr}" fill="${INK}"/>`;
  return `<path d="${BASE.fill}" fill="${fill}"/>` +
    BASE.lines.map((d) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${BODY_SW}" stroke-linecap="round"/>`).join('') +
    `<path d="${BASE.mouth}" fill="none" stroke="${INK}" stroke-width="${BODY_SW}" stroke-linecap="round"/>` + eye(EL) + eye(ER);
}

/* ------------------------------------------------------------------ eyes */
function eyeWhite(e, fill = '#fff') {
  return `<ellipse cx="${e.cx}" cy="${e.cy}" rx="${e.rx}" ry="${e.ry}" transform="rotate(${e.rot} ${e.cx} ${e.cy})" fill="${fill}" stroke="${INK}" stroke-width="10"/>`;
}
function eyeClip(ctx, e, key) {
  const id = `${ctx.id}-eye${key}`;
  ctx.defs.push(`<clipPath id="${id}"><ellipse cx="${e.cx}" cy="${e.cy}" rx="${e.rx - 4}" ry="${e.ry - 4}" transform="rotate(${e.rot} ${e.cx} ${e.cy})"/></clipPath>`);
  return id;
}

function eyes(ctx) {
  const t = ctx.t;
  const skin = (SKINS[t.skin] || SKINS.classic).fill;
  const both = (fn) => fn(EL, 'L') + fn(ER, 'R');
  const pupil = (e, dx = 0, dy = 0, k = 1) => C(e.px + dx, e.py + dy, e.pr * k, INK, 0);
  const inside = (e, key, inner) => `<g clip-path="url(#${eyeClip(ctx, e, key)})">${inner}</g>`;
  let s = both((e) => eyeWhite(e));
  switch (t.eyes) {
    case 'big':
      s += both((e, k) => inside(e, k, C(e.cx + 6, e.cy + 5, e.rx * 0.78, INK, 0) + C(e.cx - 6, e.cy - 10, e.rx * 0.2, '#fff', 0) + C(e.cx + 14, e.cy + 16, e.rx * 0.09, '#fff', 0)));
      break;
    case 'tiny':
      s += both((e) => C(e.cx, e.cy, e.pr * 0.36, INK, 0));
      break;
    case 'side':
      s += both((e, k) => inside(e, k, pupil(e, -(e.px - e.cx) - e.rx * 0.48, 0)));
      break;
    case 'up':
      s += both((e, k) => inside(e, k, C(e.cx + 4, e.cy - e.ry * 0.42, e.pr, INK, 0)));
      break;
    case 'sleepy':
      s += both((e, k) => inside(e, k, pupil(e, -4, 10) +
        `<rect x="${e.cx - e.rx - 10}" y="${e.cy - e.ry - 10}" width="${e.rx * 2 + 20}" height="${e.ry + 12}" fill="${skin}"/>`) +
        P(`M${e.cx - e.rx},${e.cy + 2} Q${e.cx},${e.cy + 12} ${e.cx + e.rx},${e.cy + 2}`, 'none', 9));
      break;
    case 'angry':
      s += both((e, k) => inside(e, k, pupil(e, -2, 6)));
      s += L(312, 352, 418, 382, 15) + L(626, 318, 705, 340, 15);
      break;
    case 'worried':
      s += both((e, k) => inside(e, k, pupil(e, -6, 2)));
      s += L(318, 372, 412, 352, 13) + L(632, 336, 702, 316, 13);
      break;
    case 'hearts':
      s += both((e) => P(heartPath(e.cx + 4, e.cy + 2, e.rx * 0.5), '#E8364F', 7));
      break;
    case 'stars':
      s += both((e) => P(starPath(e.cx + 3, e.cy + 2, e.rx * 0.74, e.rx * 0.32), '#FFD43B', 6));
      break;
    case 'dollars':
      s += both((e) => {
        const x = e.cx + 2, y = e.cy + 2, k = e.ry / 46;
        return P(`M${x + 16 * k},${y - 20 * k} C${x + 8 * k},${y - 30 * k} ${x - 20 * k},${y - 28 * k} ${x - 18 * k},${y - 12 * k} C${x - 16 * k},${y + 2 * k} ${x + 18 * k},${y - 2 * k} ${x + 18 * k},${y + 14 * k} C${x + 18 * k},${y + 30 * k} ${x - 12 * k},${y + 32 * k} ${x - 20 * k},${y + 20 * k}`, 'none', 9 * k, ' stroke="#1E8E3E"') +
          L(x, y - 38 * k, x, y + 38 * k, 8 * k, '#1E8E3E');
      });
      break;
    case 'dead':
      s += both((e) => {
        const k = e.rx * 0.48;
        return L(e.cx - k, e.cy - k, e.cx + k, e.cy + k, 11) + L(e.cx + k, e.cy - k, e.cx - k, e.cy + k, 11);
      });
      break;
    case 'spiral':
      s += both((e) => {
        let d = '';
        for (let i = 0; i <= 64; i++) {
          const a = i * 0.36, rr = 2 + i * (e.rx * 0.78) / 64;
          d += (i ? 'L' : 'M') + n1(e.cx + rr * Math.cos(a)) + ',' + n1(e.cy + rr * Math.sin(a));
        }
        return P(d, 'none', 6);
      });
      break;
    case 'laser':
      s += both((e) => C(e.px, e.py, e.pr, '#E5141B', 0) + C(e.px + 4, e.py - 2, e.pr * 0.45, '#FFE3E3', 0));
      break;
    case 'glow':
      s += both((e) => C(e.px, e.py, e.pr * 1.25, ctx.t.accent, 0, ' opacity="0.35"') + C(e.px, e.py, e.pr * 0.9, ctx.t.accent, 0) + C(e.px - 6, e.py - 7, e.pr * 0.28, '#fff', 0));
      break;
    default:
      s += both((e) => pupil(e));
  }
  return s;
}

function eyewear(ctx) {
  const t = ctx.t;
  switch (t.eyes) {
    case 'shades': {
      const lensL = 'M300,388 C300,372 314,366 330,366 L420,368 C440,368 450,380 446,398 C440,438 418,468 376,470 C330,470 304,438 300,388 Z';
      const lensR = 'M624,362 C624,350 634,344 648,344 L710,344 C724,344 732,354 730,368 C726,404 708,426 678,428 C644,428 626,400 624,362 Z';
      return P('M446,382 Q536,350 626,362', 'none', 13) + P('M302,382 L238,362', 'none', 11) +
        P(lensL, '#151515', 10) + P(lensR, '#151515', 10) +
        P('M322,392 L352,382', 'none', 0, ' stroke="#fff" stroke-width="9" stroke-linecap="round" opacity="0.8"') +
        P('M644,366 L668,358', 'none', 0, ' stroke="#fff" stroke-width="8" stroke-linecap="round" opacity="0.8"');
    }
    case 'pixel': {
      const u = 14, x0 = -98, y0 = -52;
      const span = [
        null,
        [0, 11, 22, 34], [0, 11, 22, 34], [0, 11, 22, 34], [0, 11, 22, 34],
        [1, 10, 23, 33], [2, 9, 24, 32], [3, 8, 25, 31],
      ];
      let px = '';
      for (let row = 0; row < span.length; row++) for (let c = -5; c <= 34; c++) {
        let on;
        if (row === 0) on = true;
        else if (row === 1 && c > 11 && c < 22) on = true;
        else { const [a, b, d, e] = span[row]; on = (c >= a && c <= b) || (c >= d && c <= e); }
        if (row > 0 && c < 0) on = false;
        if (!on) continue;
        const glint = (row === 2 && (c === 2 || c === 3 || c === 24 || c === 25)) || (row === 3 && (c === 3 || c === 4 || c === 25 || c === 26));
        px += `<rect x="${x0 + c * u}" y="${y0 + row * u}" width="${u + 0.6}" height="${u + 0.6}" fill="${glint ? '#fff' : '#000'}"/>`;
      }
      return G(`translate(${EL.cx} ${EL.cy}) rotate(-8.2)`, px);
    }
    case '3d': {
      const lensL = 'M300,386 C300,372 312,366 328,366 L424,368 C442,368 450,378 448,394 L442,446 C440,462 428,470 410,470 L338,470 C318,470 304,458 302,440 Z';
      const lensR = 'M622,360 C622,348 632,342 646,342 L712,342 C726,342 734,350 732,364 L726,410 C724,424 714,430 700,430 L654,430 C638,430 626,420 624,404 Z';
      return P('M448,380 Q536,348 622,358', 'none', 22, '') + P('M448,380 Q536,348 622,358', 'none', 0, ' stroke="#fff" stroke-width="10" stroke-linecap="round"') +
        P(lensL, '#F2F2F2', 10) + P(lensR, '#F2F2F2', 10) +
        P('M318,384 L432,386 L428,440 C426,452 418,456 406,456 L340,456 C326,456 318,448 318,436 Z', '#E63946', 6, ' fill-opacity="0.85"') +
        P('M640,360 L716,360 L712,404 C710,414 704,418 694,418 L660,418 C648,418 642,410 642,400 Z', '#29B6E8', 6, ' fill-opacity="0.85"');
    }
    case 'nerd':
      return P('M430,404 Q520,356 620,368', 'none', 11) + P('M313,404 L246,376', 'none', 10) +
        C(EL.cx, EL.cy, 64, '#ffffff', 11, ' fill-opacity="0.16"') + E(ER.cx, ER.cy, 52, 57, '#ffffff', 11, ' fill-opacity="0.16"') +
        `<rect x="514" y="364" width="22" height="20" rx="3" fill="#fff" stroke="${INK}" stroke-width="5" transform="rotate(-14 525 374)"/>`;
    case 'monocle':
      return P('M640,432 C620,480 640,520 610,560', 'none', 0, ' stroke="#C9971C" stroke-width="5" stroke-dasharray="2 9" stroke-linecap="round"') +
        E(ER.cx, ER.cy, 52, 57, '#ffffff', 0, ' fill-opacity="0.12"') +
        E(ER.cx, ER.cy, 52, 57, 'none', 0, ' stroke="#000" stroke-width="20"') + E(ER.cx, ER.cy, 52, 57, 'none', 0, ' stroke="#E8B530" stroke-width="10"');
    case 'patch':
      return P('M640,356 L470,268', 'none', 9) + P('M712,396 C740,330 600,300 470,268', 'none', 0) +
        E(ER.cx + 2, ER.cy, 46, 50, '#151515', 10);
    default:
      return '';
  }
}

function lasers(ctx) {
  if (ctx.t.eyes !== 'laser') return '';
  const beam = (x, y, x2, y2, w) => {
    const ang = Math.atan2(y2 - y, x2 - x), nx = -Math.sin(ang), ny = Math.cos(ang);
    const a = `${n1(x + nx * w * 0.25)},${n1(y + ny * w * 0.25)}`, b = `${n1(x2 + nx * w)},${n1(y2 + ny * w)}`;
    const c = `${n1(x2 - nx * w)},${n1(y2 - ny * w)}`, d = `${n1(x - nx * w * 0.25)},${n1(y - ny * w * 0.25)}`;
    return `<path d="M${a}L${b}L${c}L${d}Z" fill="#FF1E2D" opacity="0.88"/>` +
      `<path d="M${x},${y}L${x2},${y2}" stroke="#FFE7E7" stroke-width="${w * 0.45}" stroke-linecap="round"/>`;
  };
  const glow = (x, y, x2, y2, w) => `<path d="M${x},${y}L${x2},${y2}" stroke="#FF2A2A" stroke-width="${w}" stroke-linecap="round" opacity="0.28"/>`;
  return glow(EL.px, EL.py, 930, 250, 90) + glow(ER.px, ER.py, 930, 238, 80) +
    beam(EL.px, EL.py, 930, 250, 44) + beam(ER.px, ER.py, 930, 238, 38) +
    C(EL.px, EL.py, 34, '#FF2A2A', 0, ' opacity="0.5"') + C(ER.px, ER.py, 32, '#FF2A2A', 0, ' opacity="0.5"') +
    C(EL.px, EL.py, 20, '#FFFFFF', 0) + C(ER.px, ER.py, 18, '#FFFFFF', 0);
}

/* ----------------------------------------------------------------- mouth */
// scale a drawing around a point, keeping ink lines at the standard weight
const AROUND = (x, y, k, inner) => G(`translate(${x} ${y}) scale(${k}) translate(${-x} ${-y})`, thin(inner, k));
const MOUTH_LINE = `<path d="${BASE.mouth}" fill="none" stroke="${INK}" stroke-width="${BODY_SW}" stroke-linecap="round"/>`;
// drawn before the eyes
function mouth(ctx) {
  switch (ctx.t.mouth) {
    case 'smile':
      return P('M455,442 Q540,496 618,420', 'none', BODY_SW);
    case 'grin':
      return P('M452,440 Q540,436 620,418 Q604,506 520,500 Q468,494 452,440 Z', '#3B0A14', 10) +
        P('M462,446 Q540,442 610,426 L604,448 Q540,460 470,462 Z', '#fff', 0) +
        P('M496,490 Q530,468 574,478 Q562,500 520,500 Z', '#F27D93', 0) +
        P('M452,440 Q540,436 620,418 Q604,506 520,500 Q468,494 452,440 Z', 'none', 10);
    case 'open':
      return E(566, 452, 36, 42, '#3B0A14', 10) + E(570, 474, 20, 12, '#F27D93', 0);
    case 'frown':
      return P('M455,458 Q536,402 618,438', 'none', BODY_SW);
    case 'tongue':
      return AROUND(580, 436, 1.3, P('M556,436 C552,476 566,498 586,496 C606,494 612,470 604,430 Z', '#F27D93', 9) + P('M580,442 L583,478', 'none', 6)) + MOUTH_LINE;
    case 'teeth':
      return `<rect x="548" y="430" width="32" height="42" rx="5" fill="#fff" stroke="${INK}" stroke-width="8" transform="rotate(-8 564 450)"/>` +
        `<rect x="580" y="426" width="32" height="42" rx="5" fill="#fff" stroke="${INK}" stroke-width="8" transform="rotate(-8 596 446)"/>` + MOUTH_LINE;
    case 'fangs':
      return P('M494,444 L506,492 L522,441 Z', '#fff', 7) + P('M574,434 L587,482 L602,431 Z', '#fff', 7) + MOUTH_LINE;
    case 'mustache':
      return MOUTH_LINE + AROUND(550, 416, 1.45, P('M540,420 C520,394 486,394 470,410 C462,420 470,432 480,428 C470,416 490,406 506,414 C520,420 530,428 540,428 C552,426 562,414 580,404 C600,394 628,398 632,412 C636,424 624,428 618,420 C624,410 606,406 592,414 C574,424 556,430 540,428 Z', '#3A2516', 8));
    case 'drool':
      return MOUTH_LINE + AROUND(610, 432, 1.5, P('M604,432 C602,456 596,472 600,486 C604,500 620,498 620,484 C620,470 612,456 612,430 Z', '#9ED8F5', 6));
    case 'pacifier': case 'gum': case 'lollipop': case 'rose': case 'pizza':
      return MOUTH_LINE;
    default:
      return MOUTH_LINE;
  }
}
// things held in the mouth sit in front of the face, so they draw after the eyes
function mouthOver(ctx) {
  switch (ctx.t.mouth) {
    case 'pacifier':
      return G('rotate(-18 632 448)', E(632, 448, 20, 56, '#7FC8F8', 10) + E(614, 448, 10, 18, '#F2F2F2', 7)) +
        C(676, 462, 26, 'none', 0, ' stroke="#000" stroke-width="24"') + C(676, 462, 26, 'none', 0, ' stroke="#F7A1C4" stroke-width="12"');
    case 'gum':
      return C(676, 462, 62, '#FF8DC0', 10) + P('M640,430 Q654,414 676,410', 'none', 0, ' stroke="#fff" stroke-width="11" stroke-linecap="round" opacity="0.85"');
    case 'lollipop':
      return P('M604,436 L718,500', 'none', 0, ' stroke="#000" stroke-width="22" stroke-linecap="round"') + P('M604,436 L718,500', 'none', 0, ' stroke="#fff" stroke-width="11" stroke-linecap="round"') +
        C(748, 516, 52, '#FF6FA5', 10) + P('M748,516 m-7,0 a7,7 0 1,1 14,0 a14,14 0 1,1 -28,0 a21,21 0 1,1 42,0 a28,28 0 1,1 -56,0', 'none', 0, ' stroke="#fff" stroke-width="7"');
    case 'rose':
      return P('M470,448 C560,444 640,452 712,452', 'none', 0, ' stroke="#000" stroke-width="18" stroke-linecap="round"') +
        P('M470,448 C560,444 640,452 712,452', 'none', 0, ' stroke="#3E9A4D" stroke-width="8" stroke-linecap="round"') +
        P('M540,446 C530,420 552,404 572,424 C556,428 548,436 540,446 Z', '#4DB35E', 7) +
        C(744, 452, 38, '#E0283E', 10) + P('M726,452 C732,434 758,436 758,454 C752,470 732,470 730,456', 'none', 7) + P('M712,440 Q744,422 772,440', 'none', 7);
    case 'pizza':
      return AROUND(600, 440, 1.25, P('M598,438 L716,416 L668,530 Z', '#F6C453', 9) + P('M598,438 L716,416 L712,432 L604,452 Z', '#D9822B', 7) +
        C(664, 462, 11, '#D9342B', 5) + C(684, 486, 9, '#D9342B', 5) + C(642, 448, 7, '#D9342B', 5));
    default:
      return '';
  }
}

/* ---------------------------------------------------------------- face */
function faceUnder(ctx) {
  // painted on the skin (clipped to the body)
  switch (ctx.t.face) {
    case 'blush':
      return E(392, 504, 46, 21, '#FF6F9E', 0, ' opacity="0.62"') + E(616, 468, 32, 15, '#FF6F9E', 0, ' opacity="0.62"');
    case 'freckles': {
      let s = '';
      [[418, 490], [442, 502], [460, 484], [430, 518], [588, 460], [608, 474], [572, 476], [452, 520]].forEach(([x, y]) => (s += C(x, y, 7, darken((SKINS[ctx.t.skin] || SKINS.classic).fill, 0.5), 0)));
      return s;
    }
    default:
      return '';
  }
}
function faceOver(ctx) {
  switch (ctx.t.face) {
    case 'bandaid':
      return G('rotate(-28 330 300)', `<rect x="270" y="280" width="120" height="40" rx="18" fill="#F2C9A0" stroke="${INK}" stroke-width="8"/><rect x="312" y="284" width="36" height="32" rx="6" fill="#E3A87A"/>` +
        C(320, 292, 2.5, '#B97F55', 0) + C(338, 292, 2.5, '#B97F55', 0) + C(320, 308, 2.5, '#B97F55', 0) + C(338, 308, 2.5, '#B97F55', 0));
    case 'sweat':
      return AROUND(596, 280, 1.7, P('M590,250 C578,274 572,290 586,300 C600,308 612,296 606,280 C602,270 596,262 590,250 Z', '#9ED8F5', 7) +
        P('M586,286 Q584,276 590,268', 'none', 0, ' stroke="#fff" stroke-width="5" stroke-linecap="round"'));
    case 'tears':
      return P('M352,478 C348,500 360,520 350,548 C344,566 364,572 368,556 C374,534 362,508 370,480 Z', '#7CC8F2', 7) +
        P('M668,428 C664,446 676,462 668,486 C664,500 682,504 686,490 C690,470 678,450 684,428 Z', '#7CC8F2', 7);
    case 'stitches':
      return P('M292,330 Q360,292 440,286', 'none', 8) +
        [[312, 316], [340, 302], [370, 293], [400, 288], [428, 286]].map(([x, y]) => L(x - 8, y - 14, x + 8, y + 14, 7)).join('');
    case 'thirdeye':
      return E(520, 300, 32, 34, '#fff', 9) + C(528, 306, 18, INK, 0);
    case 'scar':
      return P('M312,350 L428,494', 'none', 0, ' stroke="#000" stroke-width="24" stroke-linecap="round"') +
        P('M312,350 L428,494', 'none', 0, ' stroke="#F28C8C" stroke-width="12" stroke-linecap="round"') +
        L(326, 392, 354, 370, 8) + L(352, 424, 380, 402, 8) + L(378, 456, 406, 434, 8);
    default:
      return '';
  }
}

/* --------------------------------------------------------------- outfit */
const CHAIN = 'M318,468 C360,520 420,548 480,542 C520,538 548,520 566,494';
function outfitBack(ctx) {
  if (ctx.t.outfit !== 'cape') return '';
  const c = ctx.t.accent === '#FFFFFF' || ctx.t.accent === '#232323' ? '#C8102E' : ctx.t.accent;
  return P('M466,226 C390,196 290,206 206,254 C120,304 64,394 44,500 C34,556 26,604 14,650 C52,632 82,660 112,640 C142,662 170,636 200,650 C230,664 252,640 282,650 L330,420 Z', c, 10) +
    P('M170,300 C126,370 98,460 82,620 M246,262 C214,340 196,450 188,630', 'none', 0, ` stroke="${darken(c, 0.25)}" stroke-width="10" stroke-linecap="round"`);
}
function outfit(ctx) {
  const t = ctx.t, a = t.accent;
  switch (t.outfit) {
    case 'chain': {
      let links = '';
      for (let i = 0; i <= 22; i++) {
        const u = i / 22;
        // cubic bezier point along CHAIN
        const x = (1 - u) ** 3 * 318 + 3 * (1 - u) ** 2 * u * 360 + 3 * (1 - u) * u * u * 420 + u ** 3 * 480;
        const y = (1 - u) ** 3 * 468 + 3 * (1 - u) ** 2 * u * 520 + 3 * (1 - u) * u * u * 548 + u ** 3 * 542;
        links += E(x, y, 9, 6.5, '#F6C945', 5, ` transform="rotate(${i % 2 ? 40 : -20} ${n1(x)} ${n1(y)})"`);
      }
      links += P('M480,542 C520,538 548,520 566,494', 'none', 0, ' stroke="#000" stroke-width="18" stroke-linecap="round"') +
        P('M480,542 C520,538 548,520 566,494', 'none', 0, ' stroke="#F6C945" stroke-width="9" stroke-dasharray="9 5" stroke-linecap="round"');
      return links + C(478, 568, 30, '#F6C945', 9) + P('M486,556 C478,548 464,552 466,562 C468,572 490,568 490,580 C490,590 474,592 468,584', 'none', 6) + L(478, 546, 478, 592, 5);
    }
    case 'bowtie': {
      const c = a;
      return AROUND(520, 506, 1.4, G('rotate(-24 520 506)', P('M520,506 L470,476 C460,470 452,476 452,486 L452,526 C452,536 460,542 470,536 Z', c, 9) +
        P('M520,506 L570,476 C580,470 588,476 588,486 L588,526 C588,536 580,542 570,536 Z', c, 9) +
        `<rect x="506" y="490" width="28" height="32" rx="7" fill="${darken(c, 0.2)}" stroke="${INK}" stroke-width="9"/>`));
    }
    case 'tie': {
      const c = a;
      return AROUND(522, 500, 1.3, P('M500,498 L540,488 L548,512 L534,522 Z', darken(c, 0.15), 8) +
        P('M534,522 L548,512 L572,600 L548,632 L520,606 Z', c, 9) + P('M524,560 L560,546 M528,584 L566,570', 'none', 0, ` stroke="${darken(c, 0.3)}" stroke-width="7"`));
    }
    case 'scarf': {
      const cols = FLAGS[t.country] && ctx.scarfFlag ? FLAGS[t.country].colors : [a, '#FFFFFF'];
      const id = `${ctx.id}-scarf`;
      let stripes = '';
      for (let i = 0; i < 14; i++) stripes += `<rect x="${i * 24}" y="0" width="24" height="60" fill="${cols[i % cols.length]}"/>`;
      ctx.defs.push(`<pattern id="${id}" patternUnits="userSpaceOnUse" width="${24 * cols.length}" height="60" patternTransform="rotate(70)">${stripes}</pattern>`);
      return P('M300,452 C360,520 470,536 576,486 L592,520 C470,580 350,560 284,486 Z', `url(#${id})`, 10) +
        P('M520,520 L560,512 L586,640 L540,648 Z', `url(#${id})`, 10) + P('M546,646 L540,666 M560,644 L558,664 M574,642 L578,662', 'none', 6);
    }
    case 'bandana': {
      const c = a;
      let dots = '';
      [[488, 520], [520, 548], [552, 512], [508, 498], [540, 584], [470, 500]].forEach(([x, y]) => (dots += C(x, y, 5, '#fff', 0)));
      return P('M430,496 C500,520 560,506 620,470 C600,540 560,590 520,620 C490,580 456,540 430,496 Z', c, 10) + dots;
    }
    case 'bell':
      return P('M330,470 C390,530 480,548 572,500', 'none', 0, ' stroke="#000" stroke-width="30" stroke-linecap="round"') +
        P('M330,470 C390,530 480,548 572,500', 'none', 0, ` stroke="${a}" stroke-width="18" stroke-linecap="round"`) +
        P('M452,548 C452,528 466,516 482,516 C498,516 512,528 512,548 L518,566 L446,566 Z', '#F6C945', 9) + C(482, 572, 7, INK, 0) + L(460, 548, 504, 548, 5);
    case 'medal':
      return P('M430,480 L476,570 L500,566 L470,474 Z', '#3E78C8', 8) + P('M560,470 L506,566 L486,560 L526,464 Z', '#E0473C', 8) +
        C(492, 594, 36, '#F6C945', 10) + P(starPath(492, 594, 20, 8.5), '#E3A02A', 5);
    case 'cape':
      return C(458, 236, 18, '#F6C945', 9) + C(458, 236, 6, '#E3A02A', 0);
    case 'bib':
      return P('M436,490 C470,524 540,524 592,482 C610,540 590,600 520,606 C460,610 430,560 436,490 Z', '#FFFFFF', 10) +
        P('M452,512 C486,540 540,540 584,506', 'none', 0, ` stroke="${a}" stroke-width="8" stroke-dasharray="1 16" stroke-linecap="round"`) +
        P(heartPath(518, 566, 14), a === '#FFFFFF' ? '#E8508E' : a, 6);
    case 'lei': {
      const cols = ['#FF5E8A', '#FFD43B', '#FF8C42', '#B07CFF', '#4CC9F0'];
      let s = '';
      for (let i = 0; i <= 13; i++) {
        const u = i / 13;
        const x = (1 - u) ** 3 * 318 + 3 * (1 - u) ** 2 * u * 360 + 3 * (1 - u) * u * u * 470 + u ** 3 * 572;
        const y = (1 - u) ** 3 * 468 + 3 * (1 - u) ** 2 * u * 530 + 3 * (1 - u) * u * u * 560 + u ** 3 * 492;
        s += P(starPath(x, y, 19, 11, 5, i * 17), cols[i % cols.length], 6) + C(x, y, 5, '#FFF3B0', 0);
      }
      return s;
    }
    case 'diaper':
      return P('M82,520 C120,500 220,494 320,508 C324,548 316,580 300,600 C250,612 200,610 170,600 C130,604 92,596 86,584 C80,560 80,540 82,520 Z', '#FFFFFF', 10) +
        P('M120,522 C170,512 240,510 300,520', 'none', 0, ' stroke="#9ED8F5" stroke-width="8" stroke-linecap="round" stroke-dasharray="2 14"') +
        `<rect x="282" y="510" width="34" height="24" rx="6" fill="#9ED8F5" stroke="${INK}" stroke-width="7"/>`;
    default:
      return '';
  }
}

/* ----------------------------------------------------------------- head */
function head(ctx) {
  const t = ctx.t, a = t.accent;
  const dark = '#262626';
  switch (t.head) {
    case 'crown':
      return HATG(P('M-82,0 L-92,-104 L-46,-56 L0,-128 L46,-56 L92,-104 L82,0 Z', '#F6C945', 10) +
        P('M-84,-30 L84,-30 L82,0 L-82,0 Z', '#E3A02A', 9) +
        C(-50, -15, 9, '#E0283E', 6) + C(0, -15, 10, '#3E78C8', 6) + C(50, -15, 9, '#2FA36B', 6) +
        C(-92, -108, 11, '#F6C945', 8) + C(0, -132, 12, '#F6C945', 8) + C(92, -108, 11, '#F6C945', 8) +
        P('M-60,-70 L-56,-44', 'none', 0, ' stroke="#fff" stroke-width="7" stroke-linecap="round" opacity="0.7"'));
    case 'tophat':
      return HATG(P('M-62,-6 L-58,-170 C-58,-178 58,-178 58,-170 L62,-6 Z', dark, 10) +
        `<rect x="-62" y="-48" width="124" height="30" fill="${a}" stroke="${INK}" stroke-width="9"/>` +
        E(0, -4, 108, 18, dark, 10) + P('M-40,-160 L-40,-70', 'none', 0, ' stroke="#555" stroke-width="10" stroke-linecap="round"'));
    case 'cowboy':
      return HATG(P('M-68,-6 C-74,-60 -62,-112 -26,-112 C-10,-112 -6,-94 0,-94 C6,-94 10,-112 26,-112 C62,-112 74,-60 68,-6 Z', '#A86A3D', 10) +
        P('M-68,-34 C-30,-26 30,-26 68,-34 L68,-14 C30,-6 -30,-6 -68,-14 Z', '#5B3A21', 8) +
        P('M-150,-46 C-140,-6 -90,10 0,10 C90,10 140,-6 150,-46 C130,-22 80,-12 0,-12 C-80,-12 -130,-22 -150,-46 Z', '#B87745', 10));
    case 'wizard':
      return HATG(P('M-82,-6 L-20,-190 C-12,-214 14,-232 48,-226 C26,-212 18,-196 22,-176 L82,-6 Z', '#5B3FB0', 10) +
        E(0, -6, 118, 22, '#4A2F96', 10) + P(starPath(-20, -80, 18, 7.5), '#FFD43B', 5) + P(starPath(26, -130, 13, 5.5), '#FFD43B', 5) +
        C(30, -52, 6, '#FFD43B', 0) + C(-44, -40, 5, '#FFD43B', 0));
    case 'witch':
      return HATG(P('M-74,-8 L-14,-170 C-8,-196 30,-220 70,-206 C40,-196 26,-176 20,-160 L74,-8 Z', '#262626', 10) +
        `<path d="M-68,-28 L68,-28 L72,-8 L-72,-8 Z" fill="#7E5BC6" stroke="${INK}" stroke-width="8"/>` + E(0, -6, 134, 20, '#262626', 10) +
        `<rect x="-12" y="-36" width="24" height="24" fill="#F6C945" stroke="${INK}" stroke-width="6"/>`);
    case 'party': {
      const id = `${ctx.id}-party`;
      ctx.defs.push(`<clipPath id="${id}"><path d="M-62,-4 L0,-170 L62,-4 Z"/></clipPath>`);
      let st = '';
      for (let i = -6; i < 6; i++) st += `<rect x="${i * 34}" y="-220" width="17" height="260" fill="${i % 2 ? '#FFD43B' : '#4CC9F0'}" transform="rotate(-28)"/>`;
      return HATG(`<path d="M-62,-4 L0,-170 L62,-4 Z" fill="${a}"/>` + `<g clip-path="url(#${id})">${st}</g>` +
        P('M-62,-4 L0,-170 L62,-4 Z', 'none', 10) + C(0, -176, 20, '#FF5E8A', 9) + P('M-62,-4 Q0,10 62,-4', 'none', 8));
    }
    case 'beanie':
      return HATG(P('M-84,-8 C-86,-82 -46,-118 0,-118 C46,-118 86,-82 84,-8 Z', a, 10) +
        P('M-74,-30 L-74,-100 M-38,-30 L-40,-114 M0,-30 L0,-118 M38,-30 L40,-114 M74,-30 L74,-100', 'none', 0, ` stroke="${darken(a, 0.18)}" stroke-width="6"`) +
        `<rect x="-90" y="-38" width="180" height="40" rx="14" fill="${darken(a, 0.12)}" stroke="${INK}" stroke-width="10"/>` +
        C(0, -126, 26, lighten(a, 0.55), 10));
    case 'cap':
      return HATG(P('M-78,-6 C-80,-74 -42,-102 0,-102 C42,-102 80,-74 78,-6 Z', a, 10) +
        P('M58,-18 C100,-24 150,-18 168,0 C140,10 100,10 60,4 Z', darken(a, 0.15), 10) +
        P('M0,-102 L0,-10', 'none', 6) + C(0, -104, 9, darken(a, 0.2), 7) +
        `<rect x="-30" y="-70" width="44" height="30" rx="6" fill="#fff" stroke="${INK}" stroke-width="6"/>`);
    case 'chef':
      return HATG(C(-46, -82, 46, INK, 0) + C(0, -112, 56, INK, 0) + C(46, -82, 46, INK, 0) + `<rect x="-68" y="-62" width="136" height="70" fill="${INK}"/>` +
        C(-46, -82, 40, '#fff', 0) + C(0, -112, 50, '#fff', 0) + C(46, -82, 40, '#fff', 0) +
        `<rect x="-62" y="-60" width="124" height="62" fill="#fff"/>` + `<rect x="-66" y="-42" width="132" height="44" rx="6" fill="#fff" stroke="${INK}" stroke-width="10"/>` +
        P('M-30,-90 Q-24,-60 -30,-46 M14,-110 Q20,-80 14,-46', 'none', 0, ' stroke="#D9D9D9" stroke-width="7" stroke-linecap="round"'));
    case 'viking':
      return HATG(P('M-70,-30 C-110,-50 -132,-96 -122,-150 C-104,-120 -84,-98 -52,-80 Z', '#F5EBD3', 10) +
        P('M70,-30 C110,-50 132,-96 122,-150 C104,-120 84,-98 52,-80 Z', '#F5EBD3', 10) +
        P('M-84,-4 C-86,-80 -44,-112 0,-112 C44,-112 86,-80 84,-4 Z', '#A7B1BD', 10) +
        `<rect x="-90" y="-30" width="180" height="32" rx="8" fill="#8C6239" stroke="${INK}" stroke-width="9"/>` +
        C(-60, -14, 5, '#F6C945', 0) + C(-20, -14, 5, '#F6C945', 0) + C(20, -14, 5, '#F6C945', 0) + C(60, -14, 5, '#F6C945', 0) +
        P('M0,-112 L0,-32', 'none', 8) + P('M-50,-86 Q-40,-96 -26,-100', 'none', 0, ' stroke="#fff" stroke-width="8" stroke-linecap="round" opacity="0.7"'));
    case 'halo':
      return HATG(E(0, -78, 82, 22, 'none', 0, ' stroke="#FFF3A6" stroke-width="40" opacity="0.45"') +
        E(0, -78, 82, 22, 'none', 0, ' stroke="#000" stroke-width="26"') + E(0, -78, 82, 22, 'none', 0, ' stroke="#FFD84D" stroke-width="13"'));
    case 'horns':
      return HATG(P('M-70,4 C-82,-40 -72,-80 -38,-108 C-48,-70 -36,-36 -22,4 Z', '#D7263D', 10) +
        P('M30,4 C26,-38 44,-80 86,-100 C66,-66 70,-30 80,4 Z', '#D7263D', 10));
    case 'santa':
      return HATG(P('M-80,-12 C-74,-100 -10,-150 54,-140 C96,-132 128,-96 140,-40 C118,-80 88,-96 60,-90 C70,-60 76,-36 80,-12 Z', '#D62839', 10) +
        C(146, -32, 24, '#FFFFFF', 10) + `<rect x="-94" y="-34" width="188" height="40" rx="20" fill="#FFFFFF" stroke="${INK}" stroke-width="10"/>`);
    case 'pirate':
      return HATG(P('M-128,-14 C-108,-36 -96,-110 0,-120 C96,-110 108,-36 128,-14 C70,4 -70,4 -128,-14 Z', '#262626', 10) +
        P('M-112,-22 C-60,-8 60,-8 112,-22', 'none', 0, ' stroke="#E3B341" stroke-width="7" stroke-linecap="round"') +
        C(0, -70, 20, '#fff', 0) + `<rect x="-11" y="-58" width="22" height="13" rx="3" fill="#fff"/>` + C(-7, -72, 5, '#262626', 0) + C(7, -72, 5, '#262626', 0) +
        L(-30, -40, 30, -20, 7, '#fff') + L(30, -40, -30, -20, 7, '#fff'));
    case 'propeller': {
      const q = ['#E0473C', '#F5C842', '#3E78C8', '#5DB36A'];
      return HATG(P('M-82,-6 C-82,-80 -44,-110 0,-110 L0,-6 Z', q[0], 0) + P('M0,-110 C44,-110 82,-80 82,-6 L0,-6 Z', q[1], 0) +
        P('M-82,-6 C-82,-80 -44,-110 0,-110 C44,-110 82,-80 82,-6 Z', 'none', 10) + P('M0,-110 L0,-6', 'none', 7) +
        L(0, -110, 0, -138, 9) + P('M0,-142 C-30,-158 -78,-154 -84,-142 C-78,-130 -30,-130 0,-142 Z', q[2], 8) +
        P('M0,-142 C30,-128 78,-130 84,-142 C78,-154 30,-158 0,-142 Z', q[3], 8) + C(0, -142, 9, '#262626', 0));
    }
    case 'headphones':
      return SCALED('translate(470 250) rotate(-2)', 1.22, P('M-108,40 C-122,-80 -60,-132 0,-132 C60,-132 122,-80 108,40', 'none', 0, ' stroke="#000" stroke-width="34" stroke-linecap="round"') +
        P('M-108,40 C-122,-80 -60,-132 0,-132 C60,-132 122,-80 108,40', 'none', 0, ` stroke="${a}" stroke-width="18" stroke-linecap="round"`) +
        `<rect x="-140" y="10" width="54" height="84" rx="22" fill="#262626" stroke="${INK}" stroke-width="10"/>` +
        `<rect x="86" y="10" width="54" height="84" rx="22" fill="#262626" stroke="${INK}" stroke-width="10"/>` +
        `<rect x="-126" y="26" width="18" height="52" rx="8" fill="${a}"/><rect x="108" y="26" width="18" height="52" rx="8" fill="${a}"/>`);
    case 'antenna':
      return P('M470,226 C462,180 440,150 426,122', 'none', 9) + P('M548,232 C556,184 572,150 592,120', 'none', 9) +
        C(424, 114, 18, '#FF5E5B', 9) + C(594, 112, 18, '#FF5E5B', 9) + C(418, 108, 5, '#fff', 0) + C(588, 106, 5, '#fff', 0);
    case 'flower':
      return SCALED('translate(566 236) rotate(14)', 1.3, P('M0,0 C-4,-24 4,-44 0,-60', 'none', 9) +
        [0, 72, 144, 216, 288].map((r) => E(0, -96, 22, 30, a === '#FFFFFF' ? '#FF8FC7' : a, 9, ` transform="rotate(${r} 0 -68)"`)).join('') +
        C(0, -68, 18, '#FFD43B', 9) + P('M0,-20 C18,-34 38,-30 44,-18 C30,-8 14,-10 0,-20 Z', '#4DB35E', 7));
    case 'bow': {
      const c = a === '#FFFFFF' ? '#FF8FC7' : a;
      return SCALED('translate(548 240) rotate(16)', 1.3, P('M0,-22 C-30,-70 -96,-62 -84,-20 C-76,10 -30,4 0,-12 Z', c, 10) +
        P('M0,-22 C30,-70 96,-62 84,-20 C76,10 30,4 0,-12 Z', c, 10) + C(0, -16, 18, darken(c, 0.18), 10) +
        P('M-60,-44 C-48,-36 -36,-28 -24,-22 M60,-44 C48,-36 36,-28 24,-22', 'none', 0, ` stroke="${darken(c, 0.25)}" stroke-width="6" stroke-linecap="round"`));
    }
    case 'mohawk': {
      const c = a === '#FFFFFF' ? '#E8508E' : a;
      let spikes = '';
      const top = [[330, 240], [372, 228], [414, 220], [456, 217], [498, 218], [540, 224], [580, 236], [616, 254]];
      top.forEach(([x, y], i) => {
        if (i === top.length - 1) return;
        const [x2, y2] = top[i + 1];
        const mx = (x + x2) / 2, my = (y + y2) / 2;
        spikes += `L${n1(mx - 6)},${n1(my - 92 + Math.abs(i - 3.5) * 9)}L${x2},${y2}`;
      });
      return P(`M${top[0][0]},${top[0][1] + 10}L${top[0][0]},${top[0][1]}${spikes}L${top[top.length - 1][0]},${top[top.length - 1][1] + 12}Z`, c, 10);
    }
    case 'grad':
      return HATG(P('M-64,-6 C-66,-50 -40,-64 0,-64 C40,-64 66,-50 64,-6 Z', '#262626', 10) +
        P('M0,-110 L130,-78 L0,-46 L-130,-78 Z', '#262626', 10) + C(0, -78, 8, '#F5C842', 0) +
        P('M0,-78 C40,-72 90,-70 104,-58 L104,-10', 'none', 0, ' stroke="#F5C842" stroke-width="7" stroke-linecap="round"') +
        `<rect x="94" y="-16" width="20" height="36" rx="5" fill="#F5C842" stroke="${INK}" stroke-width="6"/>`);
    case 'straw':
      return HATG(E(0, -10, 160, 30, '#F2D07A', 10) + P('M-74,-14 C-76,-70 -40,-96 0,-96 C40,-96 76,-70 74,-14 Z', '#F2D07A', 10) +
        P('M-74,-30 C-30,-22 30,-22 74,-30 L74,-14 C30,-6 -30,-6 -74,-14 Z', a, 8) +
        P('M-130,-6 L-110,-12 M-90,4 L-70,-4 M80,-4 L100,4 M118,-10 L138,-4', 'none', 0, ' stroke="#C9A24A" stroke-width="5" stroke-linecap="round"'));
    case 'bunny':
      return HATG(P('M-70,-6 C-110,-90 -110,-190 -76,-222 C-44,-196 -30,-100 -30,-6 Z', '#F5F5F2', 10) + P('M-66,-30 C-90,-100 -90,-170 -74,-192 C-58,-170 -50,-100 -46,-30 Z', '#FFB3CD', 0) +
        P('M26,-6 C30,-100 50,-196 92,-214 C114,-170 90,-90 64,-6 Z', '#F5F5F2', 10) + P('M38,-30 C46,-100 62,-166 86,-186 C96,-150 80,-90 58,-30 Z', '#FFB3CD', 0));
    case 'cat': {
      const c = (SKINS[t.skin] || SKINS.classic).fill;
      return HATG(P('M-96,8 L-86,-112 L-10,-26 Z', c, 10) + P('M-78,-10 L-72,-70 L-34,-26 Z', '#FFB3CD', 0) +
        P('M14,-22 L92,-112 L104,10 Z', c, 10) + P('M36,-22 L78,-70 L84,-10 Z', '#FFB3CD', 0));
    }
    case 'hardhat':
      return HATG(P('M-82,-8 C-84,-84 -44,-116 0,-116 C44,-116 84,-84 82,-8 Z', '#F5C21B', 10) +
        P('M-104,-10 L104,-10 C108,-10 110,8 104,8 L-104,8 C-110,8 -108,-10 -104,-10 Z', '#F5C21B', 10) +
        P('M-18,-114 L-18,-16 L18,-16 L18,-114', 'none', 8) + P('M-50,-84 Q-40,-96 -28,-100', 'none', 0, ' stroke="#fff" stroke-width="8" stroke-linecap="round" opacity="0.7"'));
    case 'headband': {
      const c = a === '#FFFFFF' ? '#E0473C' : a;
      return P('M282,330 C380,280 520,272 676,330', 'none', 0, ' stroke="#000" stroke-width="54" stroke-linecap="butt"') +
        P('M286,330 C380,282 520,274 672,330', 'none', 0, ` stroke="${c}" stroke-width="36" stroke-linecap="butt"`) +
        P('M282,320 C250,300 220,290 186,296 C210,312 230,330 262,338 Z', c, 9) + P('M282,336 C250,346 226,368 196,380 C232,384 260,370 280,350 Z', c, 9) +
        `<rect x="452" y="282" width="56" height="34" rx="6" fill="#D9D9D9" stroke="${INK}" stroke-width="7" transform="rotate(-4 480 299)"/>`;
    }
    case 'sprout':
      return SCALED('translate(500 226) rotate(6)', 1.35, P('M0,0 C2,-30 -2,-50 0,-70', 'none', 9) +
        P('M0,-60 C-20,-90 -70,-96 -80,-70 C-56,-50 -24,-50 0,-60 Z', '#5DBB63', 9) +
        P('M0,-66 C18,-100 70,-112 84,-84 C62,-60 26,-58 0,-66 Z', '#7BD16F', 9));
    case 'cone':
      return HATG(P('M-74,-4 L-26,-176 L26,-176 L74,-4 Z', '#FF7A1A', 10) +
        P('M-54,-74 L54,-74 L46,-104 L-46,-104 Z', '#FFFFFF', 0) + P('M-36,-136 L36,-136 L30,-158 L-30,-158 Z', '#FFFFFF', 0) +
        P('M-74,-4 L-26,-176 L26,-176 L74,-4 Z', 'none', 10) + `<rect x="-96" y="-14" width="192" height="22" rx="6" fill="#FF7A1A" stroke="${INK}" stroke-width="10"/>`);
    case 'nightcap':
      return HATG(P('M-82,-10 C-86,-90 -30,-150 40,-158 C100,-164 170,-120 200,-30 C160,-92 110,-110 70,-100 C76,-60 80,-36 82,-10 Z', '#3E5BA9', 10) +
        P(starPath(-10, -90, 14, 6), '#FFD43B', 4) + P(starPath(70, -130, 10, 4.5), '#FFD43B', 4) + C(30, -60, 5, '#FFD43B', 0) +
        C(204, -24, 24, '#F5F5F2', 10) + `<rect x="-94" y="-32" width="188" height="38" rx="18" fill="#F5F5F2" stroke="${INK}" stroke-width="10"/>`);
    case 'bubble':
      return E(400, 418, 372, 272, '#BFE7FF', 0, ' opacity="0.2"') + E(400, 418, 372, 272, 'none', 11) +
        E(400, 418, 360, 260, 'none', 0, ' stroke="#fff" stroke-width="6" opacity="0.55"') +
        P('M150,250 C210,196 300,166 390,160', 'none', 0, ' stroke="#fff" stroke-width="20" stroke-linecap="round" opacity="0.85"') +
        P('M104,312 L118,292', 'none', 0, ' stroke="#fff" stroke-width="20" stroke-linecap="round" opacity="0.85"') +
        L(400, 146, 400, 92, 10) + C(400, 82, 16, '#FF5E5B', 9);
    case 'mini': {
      const f = (SKINS[t.skin] || SKINS.classic).fill;
      return G('translate(352 46) scale(0.42)', thin(miniFrongus(f), 0.42 / 0.75));
    }
    default:
      return '';
  }
}

/* ------------------------------------------------------------------ props */
function propBack(ctx) {
  const t = ctx.t, a = t.accent;
  switch (t.prop) {
    case 'flag': {
      const id = `${ctx.id}-flagclip`;
      const wave = 'M292,16 C246,2 196,34 146,20 C118,12 100,18 82,24 L82,158 C100,152 118,146 146,154 C196,168 246,136 292,150 Z';
      ctx.defs.push(`<clipPath id="${id}"><path d="${wave}"/></clipPath>`);
      return L(298, 286, 292, 6, 22) + L(298, 286, 292, 6, 10, '#B8B8B8') +
        `<g clip-path="url(#${id})">${flagInBox(t.country, 82, 2, 210, 168, 'stretch')}</g>` + P(wave, 'none', 9) + C(292, 2, 12, '#F6C945', 8);
    }
    case 'balloon': {
      const c = a === '#FFFFFF' ? '#E0473C' : a;
      return P('M262,270 C230,230 250,190 218,160 C196,140 206,120 196,104', 'none', 5) +
        P('M196,104 C130,104 104,50 104,8 C104,-44 146,-74 196,-74 C246,-74 288,-44 288,8 C288,50 262,104 196,104 Z', c, 10) +
        P('M186,104 L206,104 L200,118 L192,118 Z', c, 6) + P('M146,-28 C156,-46 172,-54 188,-56', 'none', 0, ' stroke="#fff" stroke-width="10" stroke-linecap="round" opacity="0.6"');
    }
    default:
      return '';
  }
}
function propFront(ctx) {
  const t = ctx.t;
  const gx = FRONT.x, gy = FRONT.ground;
  const big = ['coins', 'moneybag', 'coffee', 'burger', 'trophy'].includes(t.prop);
  const art = propFrontArt(ctx, gx, gy);
  return big ? AROUND(gx, gy, 1.38, art) : art;
}
function propFrontArt(ctx, gx, gy) {
  const t = ctx.t;
  switch (t.prop) {
    case 'coins': {
      let s = '';
      s += E(gx - 74, gy - 8, 40, 12, '#E3A02A', 8) + E(gx - 74, gy - 16, 40, 12, '#F6C945', 8);
      for (let i = 0; i < 4; i++) s += E(gx, gy - 8 - i * 20, 44, 13, '#E3A02A', 8) + E(gx, gy - 16 - i * 20, 44, 13, '#F6C945', 8);
      return s + P(`M${gx - 6},${gy - 92} l0,-6 M${gx - 14},${gy - 86} q6,-10 16,-4`, 'none', 0);
    }
    case 'moneybag':
      return P(`M${gx - 44},${gy} C${gx - 74},${gy - 6} ${gx - 76},${gy - 80} ${gx - 20},${gy - 104} L${gx - 32},${gy - 128} C${gx - 10},${gy - 138} ${gx + 10},${gy - 138} ${gx + 32},${gy - 128} L${gx + 20},${gy - 104} C${gx + 76},${gy - 80} ${gx + 74},${gy - 6} ${gx + 44},${gy} Z`, '#C59A5B', 10) +
        P(`M${gx - 24},${gy - 104} L${gx + 24},${gy - 104}`, 'none', 9) +
        P(`M${gx + 14},${gy - 74} C${gx + 6},${gy - 82} ${gx - 18},${gy - 80} ${gx - 16},${gy - 66} C${gx - 14},${gy - 52} ${gx + 16},${gy - 56} ${gx + 16},${gy - 40} C${gx + 16},${gy - 26} ${gx - 10},${gy - 24} ${gx - 18},${gy - 34}`, 'none', 8, ' stroke="#2E6B2F"') +
        L(gx - 1, gy - 90, gx - 1, gy - 18, 7, '#2E6B2F');
    case 'diamond':
      return SCALED('translate(706 176)', 1.35, P('M-50,-24 L-28,-50 L28,-50 L50,-24 L0,40 Z', '#9FE3FF', 10) +
        P('M-50,-24 L50,-24 M-28,-50 L-12,-24 L0,40 L12,-24 L28,-50', 'none', 6) +
        P('M-30,-38 L-20,-28', 'none', 0, ' stroke="#fff" stroke-width="8" stroke-linecap="round"')) +
        sparkle(790, 96, 24, '#fff', 6) + sparkle(622, 112, 15, '#fff', 5);
    case 'coffee':
      return P(`M${gx - 40},${gy - 96} L${gx + 40},${gy - 96} L${gx + 32},${gy} L${gx - 32},${gy} Z`, '#FFFFFF', 10) +
        P(`M${gx - 36},${gy - 70} L${gx + 36},${gy - 70} L${gx + 32},${gy - 28} L${gx - 32},${gy - 28} Z`, '#8C5A3B', 0) +
        P(`M${gx + 38},${gy - 80} C${gx + 74},${gy - 82} ${gx + 74},${gy - 30} ${gx + 34},${gy - 34}`, 'none', 9) +
        `<rect x="${gx - 46}" y="${gy - 112}" width="92" height="18" rx="7" fill="#5B3A21" stroke="${INK}" stroke-width="8"/>` +
        P(`M${gx - 12},${gy - 130} C${gx - 24},${gy - 146} ${gx},${gy - 156} ${gx - 12},${gy - 174} M${gx + 14},${gy - 128} C${gx + 2},${gy - 144} ${gx + 26},${gy - 154} ${gx + 14},${gy - 172}`, 'none', 0, ' stroke="#9AA3AD" stroke-width="7" stroke-linecap="round"');
    case 'burger':
      return P(`M${gx - 60},${gy - 70} C${gx - 60},${gy - 130} ${gx + 60},${gy - 130} ${gx + 60},${gy - 70} Z`, '#E9A44C', 9) +
        C(gx - 20, gy - 100, 3.5, '#FFF2C7', 0) + C(gx + 10, gy - 108, 3.5, '#FFF2C7', 0) + C(gx + 30, gy - 90, 3.5, '#FFF2C7', 0) +
        P(`M${gx - 66},${gy - 66} L${gx + 66},${gy - 66} L${gx + 56},${gy - 52} L${gx + 36},${gy - 60} L${gx + 14},${gy - 50} L${gx - 8},${gy - 60} L${gx - 30},${gy - 50} L${gx - 50},${gy - 60} Z`, '#6CC24A', 7) +
        `<rect x="${gx - 62}" y="${gy - 56}" width="124" height="22" rx="10" fill="#7A3E22" stroke="${INK}" stroke-width="8"/>` +
        P(`M${gx - 64},${gy - 36} L${gx + 64},${gy - 36} L${gx + 48},${gy - 22} L${gx - 40},${gy - 24} Z`, '#FFD23F', 7) +
        P(`M${gx - 58},${gy - 30} C${gx - 58},${gy} ${gx + 58},${gy} ${gx + 58},${gy - 30} Z`, '#E9A44C', 9);
    case 'trophy':
      return P(`M${gx - 50},${gy - 150} L${gx + 50},${gy - 150} C${gx + 50},${gy - 90} ${gx + 24},${gy - 70} ${gx},${gy - 66} C${gx - 24},${gy - 70} ${gx - 50},${gy - 90} ${gx - 50},${gy - 150} Z`, '#F6C945', 10) +
        P(`M${gx - 50},${gy - 136} C${gx - 86},${gy - 136} ${gx - 84},${gy - 92} ${gx - 40},${gy - 92} M${gx + 50},${gy - 136} C${gx + 86},${gy - 136} ${gx + 84},${gy - 92} ${gx + 40},${gy - 92}`, 'none', 9) +
        P(`M${gx - 12},${gy - 68} L${gx + 12},${gy - 68} L${gx + 16},${gy - 34} L${gx - 16},${gy - 34} Z`, '#E3A02A', 8) +
        `<rect x="${gx - 44}" y="${gy - 36}" width="88" height="34" rx="6" fill="#5B3A21" stroke="${INK}" stroke-width="9"/>` +
        P(starPath(gx, gy - 116, 20, 8.5), '#FFF2B3', 5);
    case 'skateboard':
      return P('M60,652 L560,652 C584,652 590,672 568,676 L52,676 C30,672 36,652 60,652 Z', ctx.t.accent === '#FFFFFF' ? '#E0473C' : ctx.t.accent, 10) +
        C(130, 694, 20, '#F5F5F2', 9) + C(490, 694, 20, '#F5F5F2', 9) + C(130, 694, 6, '#999', 0) + C(490, 694, 6, '#999', 0);
    case 'rocket':
      return SCALED('translate(742 150) rotate(38)', 1.3, P('M0,-90 C30,-60 34,0 26,40 L-26,40 C-34,0 -30,-60 0,-90 Z', '#F5F5F2', 10) +
        P('M-26,10 L-54,52 L-26,40 Z M26,10 L54,52 L26,40 Z', '#E0473C', 9) + C(0, -24, 14, '#6FC2F2', 9) +
        P('M-18,44 C-16,80 0,104 0,104 C0,104 16,80 18,44 Z', '#FFB000', 8) + P('M-8,46 C-8,66 0,80 0,80 C0,80 8,66 8,46 Z', '#FF5E3A', 0));
    default:
      return '';
  }
}
function overlay(ctx) {
  if (ctx.t.prop !== 'sparkles') return '';
  return sparkle(150, 210, 34, '#FFF5B8', 7) + sparkle(860, 280, 28, '#FFF5B8', 7) + sparkle(820, 760, 22, '#FFF5B8', 6) +
    sparkle(120, 620, 20, '#FFF5B8', 6) + sparkle(690, 150, 16, '#FFF5B8', 5);
}

/* ------------------------------------------------------------ backgrounds */
function background(ctx) {
  const t = ctx.t, c = t.bgColor || '#E4E4E4';
  const W = CANVAS, r = rng(hashString('bg' + ctx.seed));
  const rect = (fill, extra = '') => `<rect width="${W}" height="${W}" fill="${fill}"${extra}/>`;
  const grad = (id, stops, vertical = true) => {
    ctx.defs.push(`<linearGradient id="${ctx.id}-${id}" x1="0" y1="0" x2="${vertical ? 0 : 1}" y2="${vertical ? 1 : 0}">${stops.map((s, i) => `<stop offset="${(i / (stops.length - 1)).toFixed(3)}" stop-color="${s}"/>`).join('')}</linearGradient>`);
    return `url(#${ctx.id}-${id})`;
  };
  const light = luminance(c) > 0.45;
  const alt = light ? darken(c, 0.08) : lighten(c, 0.1);
  switch (t.bg) {
    case 'gradient':
      return rect(grad('g', [lighten(c, 0.45), c, darken(c, 0.12)]));
    case 'rays': {
      let s = rect(c);
      for (let i = 0; i < 24; i += 2) {
        const a1 = (i * 15 * Math.PI) / 180, a2 = ((i + 1) * 15 * Math.PI) / 180;
        s += `<path d="M500,560 L${n1(500 + 1200 * Math.cos(a1))},${n1(560 + 1200 * Math.sin(a1))} L${n1(500 + 1200 * Math.cos(a2))},${n1(560 + 1200 * Math.sin(a2))} Z" fill="${alt}"/>`;
      }
      return s;
    }
    case 'dots': {
      let s = rect(c);
      const dot = light ? darken(c, 0.16) : lighten(c, 0.18);
      for (let y = 40; y < W; y += 90) for (let x = 40 + ((y - 40) / 90 % 2) * 45; x < W + 40; x += 90) s += C(x, y, 16, dot, 0);
      return s;
    }
    case 'checker': {
      let s = rect(c);
      for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) if ((x + y) % 2) s += `<rect x="${x * 100}" y="${y * 100}" width="100" height="100" fill="${alt}"/>`;
      return s;
    }
    case 'stripes': {
      let s = rect(c);
      for (let x = -2000; x < 2000; x += 120) s += `<rect x="${x}" y="-2000" width="60" height="4000" fill="${alt}" transform="rotate(35 500 500)"/>`;
      return s;
    }
    case 'sky': {
      let s = rect(grad('sky', ['#7EC8F7', '#CDEBFF']));
      const cloud = (x, y, k) => G(`translate(${x} ${y}) scale(${k})`, P('M-80,20 C-110,20 -110,-20 -80,-22 C-80,-60 -20,-70 0,-40 C20,-74 90,-60 80,-20 C110,-20 110,20 80,20 Z', '#FFFFFF', 0));
      return s + cloud(180, 180, 1.1) + cloud(800, 120, 0.8) + cloud(860, 520, 0.7) + cloud(110, 560, 0.6);
    }
    case 'hill':
      return rect(grad('hs', ['#8FD3FF', '#E6F6FF'])) + C(830, 150, 60, '#FFE27A', 0) +
        P('M-20,760 C200,640 520,650 1020,740 L1020,1020 L-20,1020 Z', '#7BC67A', 0) +
        P('M-20,840 C300,780 700,790 1020,860 L1020,1020 L-20,1020 Z', '#5FAE5E', 0) +
        [[150, 860], [270, 900], [760, 880], [860, 930], [420, 950]].map(([x, y]) => C(x, y, 7, '#FFFFFF', 0) + C(x, y, 3, '#FFD43B', 0)).join('');
    case 'beach':
      return rect(grad('bs', ['#7FD0FF', '#D9F3FF'])) + C(800, 170, 70, '#FFE27A', 0) +
        `<rect y="610" width="1000" height="120" fill="#2E9FD8"/>` + P('M0,640 Q60,628 120,640 T240,640 T360,640 T480,640 T600,640 T720,640 T840,640 T960,640 T1080,640', 'none', 0, ' stroke="#BFEAFF" stroke-width="6"') +
        P('M-20,760 C300,700 700,710 1020,760 L1020,1020 L-20,1020 Z', '#F4D894', 0);
    case 'space': {
      let s = rect(grad('sp', ['#0B0F2E', '#1D1450']));
      for (let i = 0; i < 70; i++) s += C(r() * W, r() * W, 1 + r() * 2.6, '#FFFFFF', 0, ` opacity="${(0.4 + r() * 0.6).toFixed(2)}"`);
      s += C(160, 170, 70, '#F49A5B', 8) + E(160, 170, 120, 22, 'none', 0, ' stroke="#F6D28B" stroke-width="10" transform="rotate(-18 160 170)"') +
        sparkle(840, 160, 20, '#FFFFFF', 0) + sparkle(900, 600, 14, '#FFFFFF', 0);
      return s;
    }
    case 'moon': {
      let s = rect(grad('mn', ['#141A3C', '#3B3F7A']));
      for (let i = 0; i < 50; i++) s += C(r() * W, r() * 700, 1 + r() * 2.2, '#FFFFFF', 0, ` opacity="${(0.4 + r() * 0.6).toFixed(2)}"`);
      return s + C(790, 200, 110, '#F7F0C6', 10) + C(750, 170, 18, '#E4D99E', 0) + C(820, 250, 24, '#E4D99E', 0) + C(830, 160, 10, '#E4D99E', 0);
    }
    case 'synth': {
      let s = rect(grad('sy', ['#1B0B3A', '#5B1C7A', '#FF4FA0']));
      const sunId = `${ctx.id}-sun`;
      ctx.defs.push(`<linearGradient id="${sunId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE45C"/><stop offset="1" stop-color="#FF4F8B"/></linearGradient>`);
      s += C(500, 520, 230, `url(#${sunId})`, 0);
      for (let i = 0; i < 6; i++) s += `<rect x="260" y="${560 + i * 30}" width="480" height="${6 + i * 2}" fill="#5B1C7A"/>`;
      s += `<rect y="720" width="1000" height="280" fill="#1B0B3A"/>`;
      for (let i = 0; i <= 20; i++) s += L(500, 720, -1500 + i * 200, 1000, 3, '#FF4FA0');
      for (let i = 0; i < 7; i++) s += L(0, 730 + i * i * 7, 1000, 730 + i * i * 7, 3, '#FF4FA0');
      return s;
    }
    case 'candles':
    case 'dump': {
      const up = t.bg === 'candles';
      let s = rect(light ? '#F2F5F2' : '#10141A');
      for (let i = 0; i < 9; i++) s += L(0, 120 + i * 110, 1000, 120 + i * 110, 2, light ? '#DDE3DD' : '#1E242C');
      const col = up ? '#22B573' : '#E5484D';
      for (let i = 0; i < 12; i++) {
        const x = 40 + i * 82;
        const mid = up ? 860 - i * 62 : 140 + i * 62;
        const h = 60 + r() * 70;
        s += L(x, mid - h * 0.9, x, mid + h * 0.9, 4, col) + `<rect x="${x - 18}" y="${n1(mid - h / 2)}" width="36" height="${n1(h)}" rx="3" fill="${col}"/>`;
      }
      return s;
    }
    case 'snow': {
      let s = rect(grad('sn', ['#9DB8D9', '#E3EEF9']));
      for (let i = 0; i < 60; i++) s += C(r() * W, r() * W, 3 + r() * 6, '#FFFFFF', 0, ' opacity="0.9"');
      return s + P('M-20,800 C260,760 700,770 1020,820 L1020,1020 L-20,1020 Z', '#FFFFFF', 0);
    }
    case 'fire': {
      let s = rect(grad('fi', ['#2A0A0A', '#7A1414']));
      for (let i = 0; i < 9; i++) {
        const x = i * 125 - 20, h = 260 + r() * 220;
        s += P(`M${x - 80},1000 C${x - 90},${1000 - h * 0.5} ${x - 10},${1000 - h * 0.6} ${x},${1000 - h} C${x + 20},${1000 - h * 0.6} ${x + 90},${1000 - h * 0.5} ${x + 80},1000 Z`, '#F25C1F', 0) +
          P(`M${x - 46},1000 C${x - 50},${1000 - h * 0.35} ${x - 6},${1000 - h * 0.4} ${x},${1000 - h * 0.66} C${x + 12},${1000 - h * 0.4} ${x + 50},${1000 - h * 0.35} ${x + 46},1000 Z`, '#FFC23A', 0);
      }
      return s;
    }
    case 'hearts': {
      let s = rect(c === '#E4E4E4' ? '#FFD6E5' : c);
      for (let y = 60; y < W; y += 120) for (let x = 60 + ((y - 60) / 120 % 2) * 60; x < W; x += 120) s += P(heartPath(x, y, 20), '#FF8FB8', 0, ' opacity="0.8"');
      return s;
    }
    case 'money': {
      let s = rect('#CFE9C6');
      for (let i = 0; i < 16; i++) {
        const x = r() * W, y = r() * W, a = r() * 360;
        s += G(`translate(${n1(x)} ${n1(y)}) rotate(${n1(a)})`, `<rect x="-60" y="-30" width="120" height="60" rx="6" fill="#8FCB7E" stroke="#4E8F45" stroke-width="5"/>` + C(0, 0, 16, 'none', 0, ' stroke="#4E8F45" stroke-width="5"'));
      }
      return s;
    }
    case 'city': {
      let s = rect(grad('ct', ['#1A1F3D', '#4B3F7A', '#E07A8E']));
      let x = -10;
      while (x < W) {
        const w = 60 + r() * 70, h = 160 + r() * 280;
        s += `<rect x="${n1(x)}" y="${n1(1000 - h)}" width="${n1(w)}" height="${n1(h)}" fill="#151831"/>`;
        for (let wy = 1000 - h + 20; wy < 990; wy += 34) for (let wx = x + 12; wx < x + w - 14; wx += 24) if (r() < 0.45) s += `<rect x="${n1(wx)}" y="${n1(wy)}" width="10" height="14" fill="#FFD66B" opacity="0.85"/>`;
        x += w + 6;
      }
      return s;
    }
    case 'flag':
      return flagInBox(t.country, 0, 0, W, W, 'slice') + rect('#FFFFFF', ' opacity="0.12"');
    default:
      return rect(c);
  }
}

/* ----------------------------------------------------------------- render */
let uidCounter = 0;
export function renderSVG(input, opts = {}) {
  const t = sanitizeTraits(input);
  const id = opts.uid || `f${(++uidCounter).toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  const ctx = { t, id, defs: [], seed: opts.seed || '' };
  const scale = t.size === 'small' ? 1.0 : t.size === 'big' ? 1.3 : 1.18;
  const tx = 500 - 396.5 * scale;
  const groundY = t.prop === 'skateboard' ? 830 : 870;
  const ty = groundY - BASE.ground * scale;
  const shadowY = t.prop === 'skateboard' ? 712 : BASE.ground + 4;
  const fg = [
    propBack(ctx),
    outfitBack(ctx),
    E(400, shadowY, 300, 16, '#000', 0, ' opacity="0.13"'),
    body(ctx),
    faceOver(ctx),
    mouth(ctx),
    eyes(ctx),
    mouthOver(ctx),
    outfit(ctx),
    eyewear(ctx),
    head(ctx),
    propFront(ctx),
    lasers(ctx),
  ].join('');
  // opts.background === false leaves the canvas transparent (for compositing several Frongus)
  const bg = opts.background === false ? '' : background(ctx);
  const size = opts.size || CANVAS;
  const inner = `${bg}<g transform="translate(${n1(tx)} ${n1(ty)}) scale(${scale})">${fg}</g>${overlay(ctx)}`;
  const defs = ctx.defs.length ? `<defs>${ctx.defs.join('')}</defs>` : '';
  const a11y = opts.title ? `<title>${escapeXml(opts.title)}</title>` : '';
  // Element opacity becomes fill/stroke opacity: same look, and it avoids offscreen layers
  // (cheaper in browsers, and the server-side rasterizer has an edge case with them).
  const content = `${defs}${inner}`.replace(/ opacity="([\d.]+)"/g, ' fill-opacity="$1" stroke-opacity="$1"');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}" width="${size}" height="${size}" overflow="hidden"${opts.title ? ' role="img"' : ' aria-hidden="true"'}>${a11y}${content}</svg>`;
}

export function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

// Human-readable list of what makes this Frongus different from the original.
export function describeTraits(input) {
  const t = sanitizeTraits(input);
  const label = (slot, id) => (CATALOG[slot].find((o) => o.id === id) || {}).label;
  const out = [];
  if (t.skin !== 'classic') out.push({ slot: 'skin', text: `${label('skin', t.skin)} skin` });
  if (t.pattern !== 'none') out.push({ slot: 'pattern', text: t.pattern === 'flag' ? `${FLAGS[t.country].name} paint` : label('pattern', t.pattern) });
  if (t.head !== 'none') out.push({ slot: 'head', text: label('head', t.head) });
  if (t.eyes !== 'normal') out.push({ slot: 'eyes', text: label('eyes', t.eyes) });
  if (t.mouth !== 'line') out.push({ slot: 'mouth', text: label('mouth', t.mouth) });
  if (t.face !== 'none') out.push({ slot: 'face', text: label('face', t.face) });
  if (t.outfit !== 'none') out.push({ slot: 'outfit', text: label('outfit', t.outfit) });
  if (t.prop !== 'none') out.push({ slot: 'prop', text: t.prop === 'flag' ? `${FLAGS[t.country].name} flag` : label('prop', t.prop) });
  if (!(t.bg === 'solid' && t.bgColor === '#E4E4E4')) out.push({ slot: 'bg', text: t.bg === 'flag' ? `${FLAGS[t.country].name} backdrop` : `${label('bg', t.bg)} background` });
  if (t.size !== 'normal') out.push({ slot: 'size', text: t.size === 'small' ? 'Small' : 'Big' });
  return out;
}
