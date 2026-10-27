// Turns a coin name into Frongus traits. Known words pick matching gear (King -> crown,
// Magyar -> Hungarian flag paint, Laser -> laser eyes). Everything else is filled in with
// randomness seeded by the name, so the same name always starts from the same Frongus.
import { DEFAULT_TRAITS, SWATCHES, CATALOG, SKINS, hashString, rng, luminance, sanitizeTraits } from './frongus-art.js';
import { FLAGS } from './frongus-flags.js';

/* ------------------------------------------------------------- keywords */
const KEYWORDS = new Map();
const add = (words, traits) => words.split(/\s+/).filter(Boolean).forEach((w) => KEYWORDS.set(w, { ...(KEYWORDS.get(w) || {}), ...traits }));

// colours and materials
add('red scarlet', { skin: 'red' });
add('crimson ruby blood cherry', { skin: 'crimson' });
add('blue', { skin: 'ocean' });
add('navy', { skin: 'navy' });
add('teal turquoise aqua', { skin: 'teal' });
add('mint', { skin: 'mint' });
add('green emerald', { skin: 'green' });
add('lime', { skin: 'lime' });
add('olive', { skin: 'olive' });
add('yellow banana lemon', { skin: 'yellow' });
add('orange tangerine', { skin: 'orange' });
add('pink', { skin: 'pink' });
add('magenta fuchsia hotpink', { skin: 'hotpink' });
add('lavender lilac', { skin: 'lavender' });
add('purple violet grape', { skin: 'purple' });
add('brown chocolate choco mud poop', { skin: 'brown' });
add('tan beige', { skin: 'tan' });
add('white milk', { skin: 'white' });
add('gray grey stone rock', { skin: 'gray' });
add('black dark shadow goth emo', { skin: 'charcoal' });
add('zombie undead frankenstein', { skin: 'zombie', face: 'stitches' });
add('alien ufo martian et', { skin: 'alien', head: 'antenna' });
add('ice icy frozen frost freeze', { skin: 'ice' });
add('gold golden goldie', { skin: 'gold' });
add('silver', { skin: 'silver' });
add('chrome steel metal iron', { skin: 'chrome' });
add('rainbow pride rgb', { skin: 'rainbow' });
add('sunset dusk', { skin: 'sunset' });
add('cotton candyfloss', { skin: 'candy' });
add('fire flame flames lava blaze burn burning inferno hot', { skin: 'fire', bg: 'fire' });
add('galaxy cosmic cosmos nebula astral universe', { skin: 'galaxy', bg: 'space' });
add('frog froggy toad ribbit', { skin: 'green' });
add('whale', { skin: 'ocean', prop: 'coins' });
add('bitcoin btc satoshi sats', { skin: 'orange', prop: 'coins' });
add('eth ethereum', { skin: 'lavender' });
add('doge', { skin: 'tan' });

// characters and roles
add('king emperor monarch', { head: 'crown', outfit: 'cape' });
add('queen princess prince royal royalty majesty', { head: 'crown' });
add('wizard mage magic magical sorcerer', { head: 'wizard' });
add('witch witchy spooky halloween pumpkin', { head: 'witch' });
add('pirate captain ahoy matey arr', { head: 'pirate', eyes: 'patch' });
add('cowboy cowgirl western texas sheriff yeehaw rodeo ranch', { head: 'cowboy' });
add('chef cook cooking kitchen baker', { head: 'chef' });
add('viking norse odin thor valhalla', { head: 'viking' });
add('angel holy heaven heavenly saint blessed', { head: 'halo', skin: 'white' });
add('devil demon hell satan evil diablo', { head: 'horns', skin: 'red' });
add('santa christmas xmas claus jolly', { head: 'santa', bg: 'snow' });
add('party birthday bday fiesta celebrate celebration', { head: 'party', bg: 'dots' });
add('baby bebe babi infant toddler newborn', { size: 'small', mouth: 'pacifier' });
add('smol tiny mini lil little junior jr', { size: 'small' });
add('giga mega chonk chonky chungus fat fatty thicc thick chubby huge giant big large jumbo massive', { size: 'big' });
add('ninja shinobi samurai', { head: 'headband' });
add('robot robo bot cyborg android mech droid', { head: 'antenna', skin: 'chrome' });
add('ai gpt agent', { head: 'antenna', eyes: 'glow' });
add('punk rocker rockstar', { head: 'mohawk' });
add('dj music beats rapper rap hiphop', { head: 'headphones', outfit: 'chain' });
add('gamer gaming games esports streamer', { head: 'headphones', eyes: 'glow' });
add('grad graduate phd school student college professor', { head: 'grad', eyes: 'nerd' });
add('nerd geek smart genius brain brainy dev coder developer math science', { eyes: 'nerd' });
add('farmer farm farming hay barn', { head: 'straw' });
add('builder construction worker engineer', { head: 'hardhat' });
add('sleepy sleep sleeping tired nap snooze dream dreamy bedtime', { eyes: 'sleepy', head: 'nightcap' });
add('cool chad sigma alpha based', { eyes: 'shades' });
add('boss ceo business corporate office exec', { outfit: 'tie' });
add('gentleman sir mister mr fancy classy butler posh lord', { head: 'tophat', eyes: 'monocle', outfit: 'bowtie' });
add('vampire dracula vamp', { mouth: 'fangs', outfit: 'cape', accent: '#232323' });
add('astronaut nasa cosmonaut spaceman space', { head: 'bubble', bg: 'space' });
add('superhero hero super', { outfit: 'cape' });
add('clown jester circus', { mouth: 'grin', face: 'blush', head: 'party' });
add('surfer surf beach summer vacation holiday tropical aloha island', { outfit: 'lei', bg: 'beach', eyes: 'shades' });
add('hawaii hawaiian', { outfit: 'lei', bg: 'beach' });
add('detective spy agent007', { head: 'tophat', eyes: 'shades' });

// moods
add('love lover valentine cupid crush kawaii uwu', { eyes: 'hearts', face: 'blush' });
add('cute adorable shy', { face: 'blush' });
add('crazy insane psycho hypno hypnotized dizzy wtf degen', { eyes: 'spiral' });
add('dead rip ded rekt rugged rug dying skull', { eyes: 'dead' });
add('sad cry crying tears depressed depression sorrow', { face: 'tears', mouth: 'frown' });
add('angry mad rage fury grumpy furious', { eyes: 'angry', mouth: 'frown' });
add('happy joy smile smiley joyful glad', { mouth: 'smile' });
add('lol lmao funny haha laugh', { mouth: 'grin' });
add('derp derpy goofy silly dumb dummy', { eyes: 'big', mouth: 'tongue' });
add('shock shocked omg wow surprised scared spooked', { eyes: 'tiny', mouth: 'open' });
add('nervous sweaty sweat anxious stress stressed', { face: 'sweat' });
add('sus suspicious sussy sideeye', { eyes: 'side' });
add('hope hopeful pray praying', { eyes: 'up' });
add('star stars superstar celebrity famous', { eyes: 'stars' });
add('hurt ouch injured bandaid', { face: 'bandaid' });
add('scar scarface', { face: 'scar' });
add('illuminati thirdeye', { face: 'thirdeye' });
add('freckle freckles', { face: 'freckles' });

// animals and costumes
add('bunny rabbit hare easter', { head: 'bunny' });
add('cat kitty kitten neko meow', { head: 'cat' });
add('tiger', { skin: 'orange', pattern: 'tiger' });
add('zebra', { skin: 'white', pattern: 'tiger' });
add('cow moo dairy', { skin: 'white', pattern: 'cow' });
add('leopard cheetah', { skin: 'yellow', pattern: 'spots' });
add('dalmatian spotty spotted spots', { pattern: 'spots' });
add('camo army military soldier', { skin: 'olive', pattern: 'camo' });
add('polka dotty', { pattern: 'polka' });
add('beaver bucky', { mouth: 'teeth' });

// gear and things
add('flower blossom bloom garden spring petal', { head: 'flower' });
add('bow girl girly lady miss', { head: 'bow' });
add('sprout plant grow growing leaf seed', { head: 'sprout' });
add('cone traffic', { head: 'cone' });
add('stack stacked tower double twin twins duo', { head: 'mini' });
add('helmet', { head: 'bubble' });
add('hat tophat', { head: 'tophat' });
add('crown', { head: 'crown' });
add('beanie', { head: 'beanie' });
add('cap', { head: 'cap' });
add('balloon float floaty', { prop: 'balloon' });
add('rocket launch launching', { prop: 'rocket' });
add('moon mooning lunar', { bg: 'moon' });
add('mars', { skin: 'red', bg: 'space' });
add('rich money cash dollar dollars bank banker million millions billion billionaire millionaire wealthy wealth paid', { eyes: 'dollars', outfit: 'chain', prop: 'moneybag' });
add('diamond diamonds hodl gem gems jewel', { prop: 'diamond' });
add('trophy winner win champ champion goat', { prop: 'trophy', outfit: 'medal' });
add('medal hero', { outfit: 'medal' });
add('skate skater skateboard', { prop: 'skateboard' });
add('gm morning coffee latte espresso caffeine', { prop: 'coffee' });
add('burger hamburger cheeseburger fries fastfood', { prop: 'burger' });
add('pizza', { mouth: 'pizza' });
add('candy lolli lollipop sweets sugar', { mouth: 'lollipop' });
add('gum bubble bubblegum', { mouth: 'gum' });
add('rose romantic romance', { mouth: 'rose' });
add('mustache stache moustache', { mouth: 'mustache' });
add('drool hungry', { mouth: 'drool' });
add('pacifier binky', { mouth: 'pacifier' });
add('tongue blep', { mouth: 'tongue' });
add('chain chains bling drip iced', { outfit: 'chain' });
add('bowtie', { outfit: 'bowtie' });
add('tie suit', { outfit: 'tie' });
add('scarf', { outfit: 'scarf' });
add('bandana bandit outlaw', { outfit: 'bandana' });
add('bell cowbell', { outfit: 'bell' });
add('cape', { outfit: 'cape' });
add('bib', { outfit: 'bib' });
add('lei', { outfit: 'lei' });
add('diaper nappy', { outfit: 'diaper' });
add('sparkle sparkles shiny shine glitter', { prop: 'sparkles' });
add('flag', { prop: 'flag' });
add('monocle', { eyes: 'monocle' });
add('glasses specs', { eyes: 'nerd' });
add('shades sunglasses', { eyes: 'shades' });
add('3d', { eyes: '3d' });
add('pixel pixels 8bit', { eyes: 'pixel' });
add('patch', { eyes: 'patch' });
add('glow glowing neon', { eyes: 'glow' });
add('laser lasers', { eyes: 'laser' });

// market moods and places
add('bull bullish pump pumping send sending green', { bg: 'candles' });
add('bear bearish dump dumping crash', { bg: 'dump' });
add('sol solana', { bg: 'synth' });
add('synth synthwave retro vapor vaporwave 80s outrun', { bg: 'synth' });
add('city urban downtown nyc', { bg: 'city' });
add('snow snowy winter', { bg: 'snow' });
add('heart hearts', { bg: 'hearts' });
add('hill grass field meadow nature outside', { bg: 'hill' });
add('sky cloud clouds cloudy fly flying', { bg: 'sky' });
add('sun sunny sunshine', { bg: 'rays', bgColor: '#FFD54D', eyes: 'shades' });
add('night midnight', { bg: 'moon' });

// countries
for (const [code, f] of Object.entries(FLAGS)) add(f.words.join(' '), { country: code, nationality: true });

// words matched only as whole words (avoid "escape" -> cape, "blockchain" -> chain, ...)
const WHOLE_WORD_ONLY = new Set([
  'king', 'star', 'stars', 'rose', 'cape', 'bell', 'chain', 'rich', 'pump', 'cap', 'hat', 'tie', 'win', 'bow', 'cat',
  'moon', 'sun', 'red', 'hot', 'ice', 'mad', 'sad', 'sus', 'rug', 'gum', 'lei', 'bib', 'cow', 'moo', 'arr', 'leaf',
  'seed', 'miss', 'lady', 'girl', 'lord', 'hero', 'super', 'rock', 'stone', 'dark', 'iron', 'metal', 'gray', 'grey',
  'white', 'black', 'blue', 'pink', 'gold', 'mint', 'lime', 'tan', 'mud', 'milk', 'sugar', 'float', 'launch', 'paid',
  'bank', 'cash', 'send', 'green', 'bear', 'bull', 'fly', 'sky', 'field', 'hill', 'night', 'snow', 'heart', 'hearts',
  'spring', 'stack', 'tower', 'double', 'flag', 'patch', 'glow', 'dev', 'math', 'smart', 'cool', 'based', 'alpha',
  'boss', 'office', 'fancy', 'posh', 'spot', 'spots', 'hope', 'pray', 'joy', 'glad', 'wow', 'omg', 'scar', 'hurt',
  'grow', 'plant', 'cone', 'hare', 'goat', 'champ', 'gem', 'gems', 'hold', 'drip', 'iced', 'suit', 'shine', 'beats',
  'rap', 'mage', 'cook', 'farm', 'hay', 'barn', 'bed', 'nap', 'dream', 'lunar', 'mars', 'agent', 'bot', 'mech',
  'war', 'elf', 'tiny', 'mini', 'lil', 'big', 'fat', 'huge', 'large', 'giant', 'thick', 'baby', 'babi', 'bebe',
  'magic', 'witch', 'evil', 'hell', 'holy', 'saint', 'angel', 'dead', 'ded', 'rip', 'rekt', 'cry', 'tears', 'pain',
  'joy', 'laugh', 'lol', 'dumb', 'silly', 'nervous', 'sweat', 'shock', 'island', 'surf', 'beach', 'summer', 'bunny',
  'kitty', 'neko', 'tiger', 'zebra', 'camo', 'army', 'polka', 'bloom', 'blossom', 'petal', 'helmet', 'crown', 'beanie',
  'balloon', 'rocket', 'money', 'dollar', 'diamond', 'trophy', 'medal', 'skate', 'coffee', 'latte', 'burger', 'fries',
  'pizza', 'candy', 'lolli', 'bubble', 'drool', 'tongue', 'blep', 'chains', 'bling', 'scarf', 'bandit', 'diaper',
  'shiny', 'sparkle', 'glasses', 'specs', 'shades', 'pixel', 'neon', 'laser', 'lasers', 'city', 'urban', 'clouds',
  'cloud', 'sunny', 'retro', 'vapor', 'synth', 'whale', 'doge', 'frog', 'toad', 'eth', 'btc', 'sats', 'sol',
]);
const FILLER = /fwongus|frongus|frongi|frong|fwong/g;
const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'on', 'in', 'my', 'your', 'coin', 'token', 'inu', 'gus', 'is', 'to', 'for', 'with']);

export function normalize(name) {
  return String(name || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2').replace(/(\d)([A-Za-z])/g, '$1 $2')
    .toLowerCase();
}

export function tokenize(name) {
  const raw = normalize(name).split(/[^a-z0-9]+/).filter(Boolean);
  const out = [];
  for (const tok of raw) {
    // "babyfrongus" -> "baby", "frongusking" -> "king"
    tok.split(FILLER).filter(Boolean).forEach((p) => { if (!STOP.has(p)) out.push(p); });
  }
  // "3 d" -> "3d", "8 bit" -> "8bit", "80 s" -> "80s"
  const merged = [];
  for (let i = 0; i < out.length; i++) {
    const a = out[i], b = out[i + 1];
    if (b && /^\d+$/.test(a) && /^(d|bit|s)$/.test(b)) { merged.push(a + b); i++; } else merged.push(a);
  }
  return merged;
}

function matchKeywords(tokens) {
  const hits = [];
  tokens.forEach((tok, i) => {
    if (KEYWORDS.has(tok)) { hits.push({ i, word: tok, t: KEYWORDS.get(tok) }); return; }
    if (tok.length < 5) return;
    // longest keyword found inside a longer word ("wizardfrog" -> wizard)
    let best = null;
    for (const [w, t] of KEYWORDS) {
      if (w.length < 4 || WHOLE_WORD_ONLY.has(w) || !tok.includes(w)) continue;
      if (!best || w.length > best.word.length) best = { i, word: w, t };
    }
    if (best) hits.push(best);
  });
  return hits;
}

/* --------------------------------------------------------------- random */
const POOL = {
  skin: CATALOG.skin.map((o) => o.id).filter((id) => id !== 'classic'),
  pattern: ['spots', 'polka', 'stripes', 'tiger', 'cow', 'hearts', 'stars', 'camo', 'belly'],
  head: CATALOG.head.map((o) => o.id).filter((id) => id !== 'none'),
  eyes: CATALOG.eyes.map((o) => o.id).filter((id) => id !== 'normal'),
  mouth: CATALOG.mouth.map((o) => o.id).filter((id) => id !== 'line'),
  face: CATALOG.face.map((o) => o.id).filter((id) => id !== 'none'),
  outfit: CATALOG.outfit.map((o) => o.id).filter((id) => !['none', 'diaper'].includes(id)),
  prop: CATALOG.prop.map((o) => o.id).filter((id) => !['none', 'flag'].includes(id)),
};
const BG_WEIGHTS = { solid: 4, gradient: 3, rays: 4, dots: 2, checker: 1, stripes: 1, sky: 1.5, hill: 1.5, beach: 1, space: 1.5, moon: 1, synth: 1, candles: 1.5, hearts: 0.7, money: 0.7, city: 1, snow: 0.5, fire: 0.5 };
function weighted(r, weights) {
  const entries = Object.entries(weights);
  let x = r() * entries.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of entries) { if ((x -= w) <= 0) return k; }
  return entries[0][0];
}
function pickBgColor(r, skinId) {
  const skinL = luminance((SKINS[skinId] || SKINS.classic).fill);
  const choices = SWATCHES.bg.filter((c) => c !== '#E4E4E4');
  for (let i = 0; i < 8; i++) {
    const c = r.pick(choices);
    if (Math.abs(luminance(c) - skinL) > 0.14) return c;
  }
  return skinL > 0.4 ? '#2C2F48' : '#FCEBB0';
}

/* ----------------------------------------------------------------- main */
export function traitsFromName(name, shuffle = 0) {
  const tokens = tokenize(name);
  if (!tokens.length && !shuffle) return { traits: { ...DEFAULT_TRAITS }, matches: [], tokens };
  const seed = hashString(tokens.join(' ') + '|' + shuffle);
  const r = rng(seed);
  const hits = matchKeywords(tokens);
  const t = {};
  const matches = [];
  for (const h of hits) {
    const used = [];
    for (const [slot, value] of Object.entries(h.t)) {
      if (slot === 'nationality') continue;
      if (t[slot] === undefined) { t[slot] = value; used.push(slot); }
    }
    if (used.length) matches.push({ word: h.word, slots: used });
  }

  // nationality: flag paint most of the time, sometimes a flag on a pole or a flag backdrop
  if (t.country) {
    const roll = r();
    if (roll < 0.62 && !t.pattern) t.pattern = 'flag';
    else if (roll < 0.84 && !t.prop) { t.prop = 'flag'; if (!t.bg) { t.bg = 'solid'; } }
    else if (!t.bg) t.bg = 'flag';
    else if (!t.pattern) t.pattern = 'flag';
  }

  const themed = hits.length > 0;
  const p = themed
    ? { skin: 0.22, pattern: 0.05, head: 0.18, eyes: 0.14, mouth: 0.1, face: 0.06, outfit: 0.1, prop: 0.06 }
    : { skin: 0.72, pattern: 0.14, head: 0.6, eyes: 0.42, mouth: 0.3, face: 0.15, outfit: 0.26, prop: 0.16 };
  const defaults = { skin: 'classic', pattern: 'none', head: 'none', eyes: 'normal', mouth: 'line', face: 'none', outfit: 'none', prop: 'none' };
  for (const slot of Object.keys(defaults)) {
    if (t[slot] !== undefined) continue;
    t[slot] = r.chance(p[slot]) ? r.pick(POOL[slot]) : defaults[slot];
  }
  // a flag prop needs a country
  if (t.prop === 'flag' && !t.country) t.country = r.pick(Object.keys(FLAGS));
  if (!t.bg) t.bg = weighted(r, BG_WEIGHTS);
  if (!t.bgColor) t.bgColor = pickBgColor(r, t.skin);
  if (!t.accent) t.accent = r.pick(SWATCHES.accent.filter((c) => c !== '#FFFFFF'));
  if (!t.size) t.size = 'normal';
  if (!t.country) t.country = 'us';
  // keep things readable: no busy pattern under flag paint, no diaper without a baby
  if (t.pattern === 'flag' && t.skin !== 'classic' && !matches.some((m) => m.slots.includes('skin'))) t.skin = 'classic';
  return { traits: sanitizeTraits(t), matches, tokens };
}

/* ----------------------------------------------------------- ticker etc. */
export function suggestTicker(name) {
  const words = normalize(name).replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/)
    .flatMap((w) => w.split(/(fwongus|frongus)/)).filter((w) => w && w !== 'the');
  if (!words.length) return '';
  const joined = words.join('').toUpperCase();
  if (joined.length <= 10) return joined;
  const last = words[words.length - 1].toUpperCase();
  const initials = words.slice(0, -1).map((w) => w[0].toUpperCase()).join('');
  if ((initials + last).length <= 10) return initials + last;
  if (words[0].length <= 10) return words[0].toUpperCase();
  return joined.slice(0, 10);
}

export function defaultDescription(name) {
  const n = String(name || '').trim();
  return n ? `${n} is a Frongus variant, paired with $FRONGUS.` : '';
}

/* ------------------------------------------------------------ blocklist */
// Names containing slurs or hate symbols can't be launched here. Stored encoded so the
// source stays readable; decode with atob to review or edit the list.
const dec = (b64) => (typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('utf8')).split(',');
const BLOCK_SUBSTR = dec('bmlnZyxuaWdsZXQsY2hpbmssY2hpbmdjaG9uZyxraWtlLHdldGJhY2ssYmVhbmVyLGdvb2ssZmFnZ290LHRyYW5ueSxyZXRhcmQsdG93ZWxoZWFkLHJhZ2hlYWQsamlnYWJvbyxwb3JjaG1vbmtleSxoaXRsZXIsbmF6aSxwZWRvcGhpbGUsa2tr');
const BLOCK_WORD = dec('ZmFnLGZhZ3Msc3BpYyxzcGljcyxjb29uLGNvb25zLHBha2kscGFraXMsamFwLGphcHMscmFwZSxyYXBlcixyYXBpc3QscGVkbyxuaWcsaGVpbA==');
const BLOCK_RAW = dec('MTQ4OA==');
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i', '|': 'i' };

export function isBlockedName(...texts) {
  for (const text of texts) {
    const raw = String(text || '').toLowerCase();
    if (BLOCK_RAW.some((w) => raw.replace(/\s+/g, '').includes(w))) return true;
    const clean = raw.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[0134578@$!|]/g, (c) => LEET[c] || c);
    const joined = clean.replace(/[^a-z]+/g, '');
    const variants = [joined, joined.replace(/([aeiou])\1+/g, '$1')];
    if (variants.some((v) => BLOCK_SUBSTR.some((w) => v.includes(w)))) return true;
    const words = clean.split(/[^a-z]+/).flatMap((w) => w.split(FILLER)).filter(Boolean);
    if (words.some((w) => BLOCK_WORD.includes(w))) return true;
  }
  return false;
}
