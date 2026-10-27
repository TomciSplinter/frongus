// National flags, drawn in a 300 x 200 box. Used for body paint, scarves, flags on poles
// and backgrounds. Flags are drawn as simplified shapes (no text, no fine heraldry).

const r = (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
const H = (...c) => c.map((col, i) => r(0, (200 / c.length) * i, 300, 200 / c.length + 0.5, col)).join('');
const V = (...c) => c.map((col, i) => r((300 / c.length) * i, 0, 300 / c.length + 0.5, 200, col)).join('');

export function starPath(cx, cy, ro, ri, n = 5, rot = -90) {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const a = ((rot + (i * 180) / n) * Math.PI) / 180;
    const rr = i % 2 ? ri : ro;
    d += (i ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(1) + ',' + (cy + rr * Math.sin(a)).toFixed(1);
  }
  return d + 'Z';
}
const star = (cx, cy, ro, c, rot = -90) => `<path d="${starPath(cx, cy, ro, ro * 0.4, 5, rot)}" fill="${c}"/>`;
const nordic = (bg, cross, inner) =>
  r(0, 0, 300, 200, bg) + r(80, 0, 50, 200, cross) + r(0, 75, 300, 50, cross) +
  (inner ? r(93, 0, 24, 200, inner) + r(0, 88, 300, 24, inner) : '');
const circle = (cx, cy, rr, c) => `<circle cx="${cx}" cy="${cy}" r="${rr}" fill="${c}"/>`;
const crescent = (cx, cy, rr, c, bg, off = 0.28) =>
  circle(cx, cy, rr, c) + circle(cx + rr * off, cy, rr * 0.8, bg);

const unionJack = (w = 300, h = 200) => {
  // simplified Union Jack scaled to w x h
  const sx = w / 300, sy = h / 200;
  return `<g transform="scale(${sx} ${sy})">${r(0, 0, 300, 200, '#012169')}` +
    `<path d="M0,0L300,200M300,0L0,200" stroke="#fff" stroke-width="40"/>` +
    `<path d="M0,0L300,200M300,0L0,200" stroke="#C8102E" stroke-width="13"/>` +
    `<path d="M150,0V200M0,100H300" stroke="#fff" stroke-width="66"/>` +
    `<path d="M150,0V200M0,100H300" stroke="#C8102E" stroke-width="40"/></g>`;
};

const usa = () => {
  let s = '';
  for (let i = 0; i < 13; i++) s += r(0, (200 / 13) * i, 300, 200 / 13 + 0.4, i % 2 ? '#fff' : '#B22234');
  s += r(0, 0, 130, (200 / 13) * 7, '#3C3B6E');
  for (let row = 0; row < 5; row++) for (let col = 0; col < 6; col++) {
    s += star(12 + col * 21 + (row % 2) * 10, 12 + row * 20, 6.5, '#fff');
  }
  return s;
};

const maple = (cx, cy, k, c) =>
  `<path transform="translate(${cx} ${cy}) scale(${k})" fill="${c}" d="M0,-50 L9,-32 L20,-37 L16,-10 L33,-27 L37,-19 L50,-22 L44,-4 L52,1 L26,22 L30,32 L5,28 L5,50 L-5,50 L-5,28 L-30,32 L-26,22 L-52,1 L-44,-4 L-50,-22 L-37,-19 L-33,-27 L-16,-10 L-20,-37 L-9,-32 Z"/>`;

const chakra = (cx, cy, rr) => {
  let s = `<circle cx="${cx}" cy="${cy}" r="${rr}" fill="none" stroke="#06038D" stroke-width="4"/>`;
  for (let i = 0; i < 24; i++) {
    const a = (i * 15 * Math.PI) / 180;
    s += `<line x1="${cx}" y1="${cy}" x2="${(cx + rr * Math.cos(a)).toFixed(1)}" y2="${(cy + rr * Math.sin(a)).toFixed(1)}" stroke="#06038D" stroke-width="1.6"/>`;
  }
  return s + circle(cx, cy, 5, '#06038D');
};

// words: lowercase name tokens that select the flag
export const FLAGS = {
  us: { name: 'United States', words: ['usa', 'america', 'american', 'murica', 'merica', 'yankee', 'patriot', 'freedom'], draw: usa, colors: ['#B22234', '#FFFFFF', '#3C3B6E'] },
  gb: { name: 'United Kingdom', words: ['uk', 'britain', 'british', 'brit', 'london', 'gb'], draw: () => unionJack(), colors: ['#012169', '#FFFFFF', '#C8102E'] },
  en: { name: 'England', words: ['england', 'english'], draw: () => r(0, 0, 300, 200, '#fff') + r(125, 0, 50, 200, '#CE1124') + r(0, 75, 300, 50, '#CE1124'), colors: ['#FFFFFF', '#CE1124'] },
  sc: { name: 'Scotland', words: ['scotland', 'scottish', 'scot'], draw: () => r(0, 0, 300, 200, '#0065BD') + `<path d="M0,0L300,200M300,0L0,200" stroke="#fff" stroke-width="34"/>`, colors: ['#0065BD', '#FFFFFF'] },
  ie: { name: 'Ireland', words: ['ireland', 'irish', 'eire'], draw: () => V('#169B62', '#FFFFFF', '#FF883E'), colors: ['#169B62', '#FFFFFF', '#FF883E'] },
  fr: { name: 'France', words: ['france', 'french', 'paris', 'francais'], draw: () => V('#0055A4', '#FFFFFF', '#EF4135'), colors: ['#0055A4', '#FFFFFF', '#EF4135'] },
  de: { name: 'Germany', words: ['germany', 'german', 'deutsch', 'deutschland', 'berlin'], draw: () => H('#000000', '#DD0000', '#FFCE00'), colors: ['#000000', '#DD0000', '#FFCE00'] },
  it: { name: 'Italy', words: ['italy', 'italian', 'italia', 'roma', 'rome'], draw: () => V('#009246', '#FFFFFF', '#CE2B37'), colors: ['#009246', '#FFFFFF', '#CE2B37'] },
  es: { name: 'Spain', words: ['spain', 'spanish', 'espana', 'madrid'], draw: () => r(0, 0, 300, 200, '#AA151B') + r(0, 50, 300, 100, '#F1BF00'), colors: ['#AA151B', '#F1BF00'] },
  pt: { name: 'Portugal', words: ['portugal', 'portuguese', 'lisbon'], draw: () => r(0, 0, 120, 200, '#006600') + r(120, 0, 180, 200, '#FF0000') + circle(120, 100, 36, '#FFE900') + circle(120, 100, 22, '#FF0000') + circle(120, 100, 14, '#fff'), colors: ['#006600', '#FF0000', '#FFE900'] },
  nl: { name: 'Netherlands', words: ['netherlands', 'dutch', 'holland', 'amsterdam'], draw: () => H('#AE1C28', '#FFFFFF', '#21468B'), colors: ['#AE1C28', '#FFFFFF', '#21468B'] },
  be: { name: 'Belgium', words: ['belgium', 'belgian', 'belgique'], draw: () => V('#000000', '#FDDA24', '#EF3340'), colors: ['#000000', '#FDDA24', '#EF3340'] },
  ch: { name: 'Switzerland', words: ['swiss', 'switzerland', 'zurich'], draw: () => r(0, 0, 300, 200, '#DA291C') + r(132, 50, 36, 100, '#fff') + r(100, 82, 100, 36, '#fff'), colors: ['#DA291C', '#FFFFFF'] },
  at: { name: 'Austria', words: ['austria', 'austrian', 'vienna', 'osterreich'], draw: () => H('#ED2939', '#FFFFFF', '#ED2939'), colors: ['#ED2939', '#FFFFFF'] },
  se: { name: 'Sweden', words: ['sweden', 'swedish', 'sverige', 'swede'], draw: () => nordic('#006AA7', '#FECC00'), colors: ['#006AA7', '#FECC00'] },
  no: { name: 'Norway', words: ['norway', 'norwegian', 'norge'], draw: () => nordic('#BA0C2F', '#FFFFFF', '#00205B'), colors: ['#BA0C2F', '#FFFFFF', '#00205B'] },
  dk: { name: 'Denmark', words: ['denmark', 'danish', 'dansk'], draw: () => nordic('#C8102E', '#FFFFFF'), colors: ['#C8102E', '#FFFFFF'] },
  fi: { name: 'Finland', words: ['finland', 'finnish', 'suomi'], draw: () => nordic('#FFFFFF', '#002F6C'), colors: ['#FFFFFF', '#002F6C'] },
  pl: { name: 'Poland', words: ['poland', 'polish', 'polska', 'polski'], draw: () => H('#FFFFFF', '#DC143C'), colors: ['#FFFFFF', '#DC143C'] },
  hu: { name: 'Hungary', words: ['hungary', 'hungarian', 'magyar', 'magyarorszag', 'budapest'], draw: () => H('#CD2A3E', '#FFFFFF', '#436F4D'), colors: ['#CD2A3E', '#FFFFFF', '#436F4D'] },
  cz: { name: 'Czechia', words: ['czech', 'czechia', 'prague'], draw: () => r(0, 0, 300, 100, '#fff') + r(0, 100, 300, 100, '#D7141A') + `<path d="M0,0L150,100L0,200Z" fill="#11457E"/>`, colors: ['#FFFFFF', '#D7141A', '#11457E'] },
  sk: { name: 'Slovakia', words: ['slovakia', 'slovak'], draw: () => H('#FFFFFF', '#0B4EA2', '#EE1C25'), colors: ['#FFFFFF', '#0B4EA2', '#EE1C25'] },
  ro: { name: 'Romania', words: ['romania', 'romanian'], draw: () => V('#002B7F', '#FCD116', '#CE1126'), colors: ['#002B7F', '#FCD116', '#CE1126'] },
  bg: { name: 'Bulgaria', words: ['bulgaria', 'bulgarian'], draw: () => H('#FFFFFF', '#00966E', '#D62612'), colors: ['#FFFFFF', '#00966E', '#D62612'] },
  hr: { name: 'Croatia', words: ['croatia', 'croatian', 'hrvatska'], draw: () => {
    let s = H('#FF0000', '#FFFFFF', '#171796');
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) s += r(125 + i * 10, 62 + j * 13, 10, 13, (i + j) % 2 ? '#fff' : '#FF0000');
    return s;
  }, colors: ['#FF0000', '#FFFFFF', '#171796'] },
  rs: { name: 'Serbia', words: ['serbia', 'serbian', 'srbija'], draw: () => H('#C6363C', '#0C4076', '#FFFFFF'), colors: ['#C6363C', '#0C4076', '#FFFFFF'] },
  gr: { name: 'Greece', words: ['greece', 'greek', 'hellas', 'athens'], draw: () => {
    let s = '';
    for (let i = 0; i < 9; i++) s += r(0, (200 / 9) * i, 300, 200 / 9 + 0.4, i % 2 ? '#fff' : '#0D5EAF');
    return s + r(0, 0, 111, 111, '#0D5EAF') + r(44, 0, 23, 111, '#fff') + r(0, 44, 111, 23, '#fff');
  }, colors: ['#0D5EAF', '#FFFFFF'] },
  tr: { name: 'Turkiye', words: ['turkiye', 'turkish', 'istanbul'], draw: () => r(0, 0, 300, 200, '#E30A17') + crescent(110, 100, 50, '#fff', '#E30A17', 0.25) + star(170, 100, 22, '#fff', 0), colors: ['#E30A17', '#FFFFFF'] },
  ua: { name: 'Ukraine', words: ['ukraine', 'ukrainian', 'kyiv'], draw: () => H('#0057B7', '#FFD700'), colors: ['#0057B7', '#FFD700'] },
  ru: { name: 'Russia', words: ['russia', 'russian', 'moscow'], draw: () => H('#FFFFFF', '#0039A6', '#D52B1E'), colors: ['#FFFFFF', '#0039A6', '#D52B1E'] },
  ee: { name: 'Estonia', words: ['estonia', 'estonian'], draw: () => H('#0072CE', '#000000', '#FFFFFF'), colors: ['#0072CE', '#000000', '#FFFFFF'] },
  lv: { name: 'Latvia', words: ['latvia', 'latvian'], draw: () => r(0, 0, 300, 200, '#9E3039') + r(0, 80, 300, 40, '#fff'), colors: ['#9E3039', '#FFFFFF'] },
  lt: { name: 'Lithuania', words: ['lithuania', 'lithuanian'], draw: () => H('#FDB913', '#006A44', '#C1272D'), colors: ['#FDB913', '#006A44', '#C1272D'] },
  jp: { name: 'Japan', words: ['japan', 'japanese', 'nippon', 'tokyo', 'nihon'], draw: () => r(0, 0, 300, 200, '#fff') + circle(150, 100, 60, '#BC002D'), colors: ['#FFFFFF', '#BC002D'] },
  cn: { name: 'China', words: ['china', 'chinese', 'beijing', 'zhongguo'], draw: () => r(0, 0, 300, 200, '#DE2910') + star(50, 50, 30, '#FFDE00') + star(100, 20, 10, '#FFDE00', -60) + star(120, 40, 10, '#FFDE00', -80) + star(120, 70, 10, '#FFDE00', -100) + star(100, 90, 10, '#FFDE00', -120), colors: ['#DE2910', '#FFDE00'] },
  kr: { name: 'South Korea', words: ['korea', 'korean', 'seoul', 'hanguk'], draw: () => {
    let s = r(0, 0, 300, 200, '#fff');
    s += `<path d="M110,100 A40,40 0 0 1 190,100 A20,20 0 0 1 150,100 A20,20 0 0 0 110,100Z" fill="#CD2E3A" transform="rotate(34 150 100)"/>`;
    s += `<path d="M110,100 A40,40 0 0 0 190,100 A20,20 0 0 1 150,100 A20,20 0 0 0 110,100Z" fill="#0047A0" transform="rotate(34 150 100)"/>`;
    const bars = (x, y, a) => `<g transform="translate(${x} ${y}) rotate(${a})">${r(-22, -16, 44, 7, '#000')}${r(-22, -4, 44, 7, '#000')}${r(-22, 8, 44, 7, '#000')}</g>`;
    return s + bars(62, 46, -56) + bars(238, 154, -56) + bars(238, 46, 56) + bars(62, 154, 56);
  }, colors: ['#FFFFFF', '#CD2E3A', '#0047A0'] },
  vn: { name: 'Vietnam', words: ['vietnam', 'vietnamese', 'saigon', 'hanoi'], draw: () => r(0, 0, 300, 200, '#DA251D') + star(150, 100, 58, '#FFFF00'), colors: ['#DA251D', '#FFFF00'] },
  th: { name: 'Thailand', words: ['thailand', 'thai', 'bangkok'], draw: () => r(0, 0, 300, 200, '#A51931') + r(0, 33, 300, 134, '#F4F5F8') + r(0, 67, 300, 66, '#2D2A4A'), colors: ['#A51931', '#F4F5F8', '#2D2A4A'] },
  ph: { name: 'Philippines', words: ['philippines', 'filipino', 'pinoy', 'manila'], draw: () => r(0, 0, 300, 100, '#0038A8') + r(0, 100, 300, 100, '#CE1126') + `<path d="M0,0L173,100L0,200Z" fill="#fff"/>` + circle(58, 100, 20, '#FCD116') + star(18, 30, 9, '#FCD116') + star(18, 170, 9, '#FCD116') + star(140, 100, 9, '#FCD116'), colors: ['#0038A8', '#CE1126', '#FFFFFF', '#FCD116'] },
  id: { name: 'Indonesia', words: ['indonesia', 'indonesian', 'jakarta', 'bali'], draw: () => H('#FF0000', '#FFFFFF'), colors: ['#FF0000', '#FFFFFF'] },
  in: { name: 'India', words: ['india', 'indian', 'bharat', 'mumbai', 'delhi'], draw: () => H('#FF9933', '#FFFFFF', '#138808') + chakra(150, 100, 28), colors: ['#FF9933', '#FFFFFF', '#138808'] },
  pk: { name: 'Pakistan', words: ['pakistan', 'pakistani'], draw: () => r(0, 0, 300, 200, '#01411C') + r(0, 0, 75, 200, '#fff') + crescent(190, 100, 52, '#fff', '#01411C', 0.3) + star(218, 74, 16, '#fff', -45), colors: ['#01411C', '#FFFFFF'] },
  il: { name: 'Israel', words: ['israel', 'israeli'], draw: () => r(0, 0, 300, 200, '#fff') + r(0, 22, 300, 28, '#0038B8') + r(0, 150, 300, 28, '#0038B8') + `<path d="M150,62L183,119H117Z M150,138L183,81H117Z" fill="none" stroke="#0038B8" stroke-width="7"/>`, colors: ['#FFFFFF', '#0038B8'] },
  ps: { name: 'Palestine', words: ['palestine', 'palestinian'], draw: () => H('#000000', '#FFFFFF', '#007A3D') + `<path d="M0,0L130,100L0,200Z" fill="#CE1126"/>`, colors: ['#000000', '#FFFFFF', '#007A3D', '#CE1126'] },
  ae: { name: 'UAE', words: ['uae', 'emirates', 'dubai', 'emirati'], draw: () => H('#00732F', '#FFFFFF', '#000000') + r(0, 0, 75, 200, '#FF0000'), colors: ['#00732F', '#FFFFFF', '#000000', '#FF0000'] },
  eg: { name: 'Egypt', words: ['egypt', 'egyptian', 'cairo'], draw: () => H('#CE1126', '#FFFFFF', '#000000') + circle(150, 100, 18, '#C09300'), colors: ['#CE1126', '#FFFFFF', '#000000'] },
  ma: { name: 'Morocco', words: ['morocco', 'moroccan'], draw: () => r(0, 0, 300, 200, '#C1272D') + `<path d="${starPath(150, 100, 48, 18.3)}" fill="none" stroke="#006233" stroke-width="7" stroke-linejoin="miter"/>`, colors: ['#C1272D', '#006233'] },
  ng: { name: 'Nigeria', words: ['nigeria', 'nigerian', 'naija', 'lagos'], draw: () => V('#008751', '#FFFFFF', '#008751'), colors: ['#008751', '#FFFFFF'] },
  gh: { name: 'Ghana', words: ['ghana', 'ghanaian', 'accra'], draw: () => H('#CE1126', '#FCD116', '#006B3F') + star(150, 100, 30, '#000'), colors: ['#CE1126', '#FCD116', '#006B3F'] },
  ke: { name: 'Kenya', words: ['kenya', 'kenyan', 'nairobi'], draw: () => H('#000000', '#BB0000', '#006600') + r(0, 62, 300, 9, '#fff') + r(0, 129, 300, 9, '#fff') + `<ellipse cx="150" cy="100" rx="26" ry="58" fill="#BB0000" stroke="#000" stroke-width="5"/>`, colors: ['#000000', '#BB0000', '#006600'] },
  za: { name: 'South Africa', words: ['southafrica', 'safrica', 'mzansi', 'johannesburg'], draw: () =>
    r(0, 0, 300, 100, '#E03C31') + r(0, 100, 300, 100, '#001489') +
    `<path d="M0,0L130,100L0,200" fill="none" stroke="#fff" stroke-width="66"/><path d="M130,100H300" stroke="#fff" stroke-width="66"/>` +
    `<path d="M0,0L130,100L0,200" fill="none" stroke="#007749" stroke-width="40"/><path d="M130,100H300" stroke="#007749" stroke-width="40"/>` +
    `<path d="M0,28L94,100L0,172Z" fill="#FFB81C"/><path d="M0,46L70,100L0,154Z" fill="#000"/>`, colors: ['#E03C31', '#001489', '#007749', '#FFB81C'] },
  br: { name: 'Brazil', words: ['brazil', 'brasil', 'brazilian', 'rio'], draw: () => r(0, 0, 300, 200, '#009C3B') + `<path d="M150,22L276,100L150,178L24,100Z" fill="#FFDF00"/>` + circle(150, 100, 46, '#002776') + `<path d="M106,90 Q150,80 194,108" stroke="#fff" stroke-width="7" fill="none"/>`, colors: ['#009C3B', '#FFDF00', '#002776'] },
  ar: { name: 'Argentina', words: ['argentina', 'argentine', 'argentinian', 'buenosaires'], draw: () => H('#74ACDF', '#FFFFFF', '#74ACDF') + circle(150, 100, 17, '#F6B40E'), colors: ['#74ACDF', '#FFFFFF', '#F6B40E'] },
  mx: { name: 'Mexico', words: ['mexico', 'mexican', 'mexicano'], draw: () => V('#006847', '#FFFFFF', '#CE1126') + circle(150, 100, 22, '#8C5A2B') + `<path d="M128,112 Q150,130 172,112" stroke="#006847" stroke-width="6" fill="none"/>`, colors: ['#006847', '#FFFFFF', '#CE1126'] },
  co: { name: 'Colombia', words: ['colombia', 'colombian', 'bogota'], draw: () => r(0, 0, 300, 100, '#FCD116') + r(0, 100, 300, 50, '#003893') + r(0, 150, 300, 50, '#CE1126'), colors: ['#FCD116', '#003893', '#CE1126'] },
  cl: { name: 'Chile', words: ['chile', 'chilean', 'santiago'], draw: () => r(0, 0, 300, 100, '#fff') + r(0, 100, 300, 100, '#D52B1E') + r(0, 0, 100, 100, '#0039A6') + star(50, 50, 22, '#fff'), colors: ['#FFFFFF', '#D52B1E', '#0039A6'] },
  pe: { name: 'Peru', words: ['peru', 'peruvian', 'lima'], draw: () => V('#D91023', '#FFFFFF', '#D91023'), colors: ['#D91023', '#FFFFFF'] },
  jm: { name: 'Jamaica', words: ['jamaica', 'jamaican', 'kingston'], draw: () => r(0, 0, 300, 200, '#009B3A') + `<path d="M0,0L150,100L0,200Z M300,0L150,100L300,200Z" fill="#000"/>` + `<path d="M0,0L300,200M300,0L0,200" stroke="#FED100" stroke-width="30"/>`, colors: ['#009B3A', '#000000', '#FED100'] },
  ca: { name: 'Canada', words: ['canada', 'canadian', 'toronto', 'canuck'], draw: () => r(0, 0, 300, 200, '#fff') + r(0, 0, 75, 200, '#D80621') + r(225, 0, 75, 200, '#D80621') + maple(150, 104, 1.15, '#D80621'), colors: ['#D80621', '#FFFFFF'] },
  au: { name: 'Australia', words: ['australia', 'australian', 'aussie', 'sydney'], draw: () => r(0, 0, 300, 200, '#012169') + unionJack(150, 100) + star(75, 150, 18, '#fff', -90) + star(225, 160, 10, '#fff') + star(200, 100, 10, '#fff') + star(250, 60, 10, '#fff') + star(225, 30, 10, '#fff'), colors: ['#012169', '#FFFFFF', '#E4002B'] },
  nz: { name: 'New Zealand', words: ['zealand', 'kiwi', 'nz', 'aotearoa'], draw: () => r(0, 0, 300, 200, '#012169') + unionJack(150, 100) + star(225, 165, 11, '#C8102E') + star(200, 100, 10, '#C8102E') + star(255, 85, 10, '#C8102E') + star(225, 40, 11, '#C8102E'), colors: ['#012169', '#C8102E', '#FFFFFF'] },
};

export const FLAG_IDS = Object.keys(FLAGS);

// Render a flag into an arbitrary rectangle (x, y, w, h). mode 'slice' covers the box (crops),
// 'stretch' fills it exactly.
export function flagInBox(code, x, y, w, h, mode = 'slice') {
  const f = FLAGS[code];
  if (!f) return '';
  if (mode === 'stretch') {
    return `<g transform="translate(${x} ${y}) scale(${w / 300} ${h / 200})">${f.draw()}</g>`;
  }
  const k = Math.max(w / 300, h / 200);
  const ox = x + (w - 300 * k) / 2, oy = y + (h - 200 * k) / 2;
  return `<g transform="translate(${ox.toFixed(1)} ${oy.toFixed(1)}) scale(${k.toFixed(4)})">${f.draw()}</g>`;
}
