import { renderSVG, describeTraits, sanitizeTraits, DEFAULT_TRAITS } from './frongus-art.js';
import { traitsFromName, suggestTicker, defaultDescription, isBlockedName } from './frongus-names.js';
import { wallet, shortAddress } from './wallet.js';
import { createEditor } from './editor.js';
import { createLauncher, api } from './launch.js';

const FRONGUS_MINT = '2BJDwUdMbnJhRRfhacFDjrDNhxUWdzE9H6LEND89pump';
const $ = (id) => document.getElementById(id);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const state = {
  name: '',
  shuffle: 0,
  overrides: {},
  tickerTouched: false,
  traits: { ...DEFAULT_TRAITS },
  matches: [],
  balances: null,
  pairOk: true,
};

/* ------------------------------------------------------------ the art */
function computeTraits() {
  const { traits, matches } = traitsFromName(state.name, state.shuffle);
  state.matches = matches;
  state.traits = sanitizeTraits({ ...traits, ...state.overrides });
}

let lastSvg = '';
function draw() {
  computeTraits();
  const svg = renderSVG(state.traits, { uid: 'main', title: state.name ? `${state.name}, a Frongus variant` : 'The original Frongus' });
  if (svg !== lastSvg) {
    const art = $('art');
    art.innerHTML = svg;
    if (!reduceMotion && lastSvg) { art.classList.remove('pop'); void art.offsetWidth; art.classList.add('pop'); }
    lastSvg = svg;
  }
  const fromName = new Set(state.matches.flatMap((m) => m.slots));
  if (fromName.has('country')) ['pattern', 'prop', 'bg'].forEach((s) => fromName.add(s));
  const chips = describeTraits(state.traits);
  $('traits').innerHTML = chips.length
    ? chips.map((c) => `<li class="${fromName.has(c.slot) && !(c.slot in state.overrides) ? 'from-name' : ''}">${escapeHtml(c.text)}</li>`).join('')
    : '<li class="plain">The original Frongus</li>';
  const sym = $('symbol').value.trim().toUpperCase();
  $('artTicker').textContent = sym ? `$${sym}` : '';
  editor.refresh();
}

/* --------------------------------------------------------------- form */
// On phones the name field sits right under the art, so the Frongus stays in view while typing.
const narrow = matchMedia('(max-width: 960px)');
function placeNameField() {
  const field = $('nameField');
  const target = narrow.matches ? $('nameSlot') : $('nameHome');
  if (field.parentElement !== target) target.appendChild(field);
}
narrow.addEventListener('change', placeNameField);
$('name').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('name').blur(); } });

function onName() {
  state.name = $('name').value;
  if (!state.tickerTouched) $('symbol').value = suggestTicker(state.name);
  $('description').placeholder = defaultDescription(state.name) || 'King Frongus is a Frongus variant, paired with $FRONGUS.';
  const blocked = isBlockedName(state.name);
  $('nameHint').textContent = blocked ? 'That name is not allowed here.' : 'Words like King, Laser, Baby or Magyar pick matching gear.';
  $('nameHint').style.color = blocked ? 'var(--bad)' : '';
  hideError();
  draw();
}
$('name').addEventListener('input', onName);
$('symbol').addEventListener('input', () => {
  const el = $('symbol');
  const v = el.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  if (v !== el.value) el.value = v;
  state.tickerTouched = v.length > 0;
  $('artTicker').textContent = v ? `$${v}` : '';
});
$('devBuy').addEventListener('input', () => {
  const el = $('devBuy');
  const v = el.value.replace(/,/g, '.').replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
  if (v !== el.value) el.value = v;
  hideError();
});
$('maxBuy').addEventListener('click', () => {
  if (state.balances) $('devBuy').value = String(Math.floor(state.balances.frongus));
});

$('shuffleBtn').addEventListener('click', () => { state.shuffle++; draw(); });
$('saveBtn').addEventListener('click', savePng);

const editor = createEditor({
  dialog: $('editor'),
  getTraits: () => state.traits,
  setOverrides: (patch) => { Object.assign(state.overrides, patch); draw(); },
  reset: () => { state.overrides = {}; draw(); },
});
$('editBtn').addEventListener('click', () => editor.open());

async function savePng() {
  const svg = renderSVG(state.traits, { uid: 'save', size: 1000 });
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1000;
    canvas.getContext('2d').drawImage(img, 0, 0, 1000, 1000);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${($('symbol').value || 'frongus').toLowerCase()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  } catch {
    toast('Could not save the image in this browser.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* -------------------------------------------------------------- wallet */
function renderWallet() {
  const btn = $('walletBtn');
  if (wallet.connected) {
    btn.textContent = shortAddress(wallet.address);
    btn.classList.replace('btn-ink', 'btn-line');
    btn.setAttribute('aria-expanded', 'false');
    $('walletAddr').textContent = wallet.address;
  } else {
    btn.textContent = 'Connect wallet';
    btn.classList.replace('btn-line', 'btn-ink');
    btn.removeAttribute('aria-expanded');
    $('walletMenu').hidden = true;
    state.balances = null;
    $('maxBuy').hidden = true;
    $('buyHint').innerHTML = 'Paid in FRONGUS. <a href="#pair">Get FRONGUS</a>';
  }
}
async function refreshBalances() {
  if (!wallet.connected) return;
  try {
    state.balances = await api(`/api/wallet?owner=${wallet.address}`);
    const { sol, frongus } = state.balances;
    $('walletBal').textContent = `${fmt(sol, 3)} SOL · ${fmt(frongus, 0)} FRONGUS`;
    $('maxBuy').hidden = !(frongus >= 1);
    $('buyHint').innerHTML = frongus >= 1
      ? `You have ${fmt(frongus, 0)} FRONGUS.`
      : 'You have no FRONGUS yet. <a href="#pair">Get FRONGUS</a>';
  } catch { /* balances are a convenience */ }
}
wallet.onChange(() => { renderWallet(); refreshBalances(); });

$('walletBtn').addEventListener('click', () => {
  if (wallet.connected) {
    const menu = $('walletMenu');
    menu.hidden = !menu.hidden;
    $('walletBtn').setAttribute('aria-expanded', String(!menu.hidden));
  } else {
    pickWallet();
  }
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('.wallet-slot')) $('walletMenu').hidden = true;
});
$('disconnect').addEventListener('click', () => wallet.disconnect());
$('copyAddr').addEventListener('click', () => copy(wallet.address, 'Address copied'));

function stateUrl() {
  const u = new URL(location.href);
  u.hash = '';
  u.search = '';
  if (state.name || Object.keys(state.overrides).length || state.shuffle) {
    const payload = { n: state.name, s: state.shuffle, o: state.overrides, t: state.tickerTouched ? $('symbol').value : undefined };
    u.searchParams.set('v', btoa(unescape(encodeURIComponent(JSON.stringify(payload)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));
  }
  return u.toString();
}
function readStateUrl() {
  const params = new URLSearchParams(location.search);
  const v = params.get('v');
  if (v) {
    try {
      const p = JSON.parse(decodeURIComponent(escape(atob(v.replace(/-/g, '+').replace(/_/g, '/')))));
      $('name').value = String(p.n || '').slice(0, 32);
      state.shuffle = Number.isInteger(p.s) ? p.s : 0;
      state.overrides = p.o && typeof p.o === 'object' ? sanitizeOverrides(p.o) : {};
      if (p.t) { $('symbol').value = String(p.t).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10); state.tickerTouched = true; }
    } catch { /* ignore a broken link */ }
  } else if (params.get('name')) {
    $('name').value = params.get('name').slice(0, 32);
  }
}
function sanitizeOverrides(o) {
  const clean = sanitizeTraits(o);
  return Object.fromEntries(Object.keys(o).filter((k) => k in clean).map((k) => [k, clean[k]]));
}

let afterConnect = null;
function pickWallet(then) {
  afterConnect = then || null;
  const dlg = $('walletPicker');
  const found = wallet.available();
  const here = stateUrl();
  let html = '';
  if (found.length) {
    html = found.map((w) => `<button class="wallet-option" type="button" data-wallet="${w.id}">${w.name}<small>Detected</small></button>`).join('');
    $('walletNote').textContent = '';
  } else if (wallet.isMobile()) {
    html = wallet.all.filter((w) => w.browse).map((w) => `<a class="wallet-option" href="${w.browse(here)}">Open in ${w.name}<small>App</small></a>`).join('');
    $('walletNote').textContent = 'Phone browsers can not talk to wallet apps directly. This opens Frongus inside your wallet, where you can launch.';
  } else {
    html = wallet.all.map((w) => `<a class="wallet-option" href="${w.install}" target="_blank" rel="noopener">Get ${w.name}<small>Install</small></a>`).join('');
    $('walletNote').textContent = 'No Solana wallet found in this browser. Install one, then reload this page.';
  }
  $('walletList').innerHTML = html;
  dlg.showModal();
}
$('walletList').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-wallet]');
  if (!b) return;
  try {
    await wallet.connect(b.dataset.wallet);
    $('walletPicker').close();
    const next = afterConnect;
    afterConnect = null;
    next?.();
  } catch (err) {
    $('walletNote').textContent = err.message;
  }
});
document.querySelectorAll('dialog [data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
document.querySelectorAll('dialog.sheet').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d && d.id !== 'launchSheet') d.close(); }));

/* -------------------------------------------------------------- launch */
const launcher = createLauncher({
  dialog: $('launchSheet'),
  onLaunched: (coin) => { saveLaunch(coin); renderMine(); setTimeout(refreshBalances, 1500); },
});

$('launchForm').addEventListener('submit', (e) => {
  e.preventDefault();
  hideError();
  const name = $('name').value.trim().replace(/\s+/g, ' ');
  const symbol = $('symbol').value.trim().toUpperCase();
  const devBuy = $('devBuy').value.trim() || '0';
  if (!name) return showError('Give your coin a name.', 'name');
  if (name.length > 32) return showError('Names can be at most 32 characters.', 'name');
  if (!/^[A-Z0-9]{1,10}$/.test(symbol)) return showError('Tickers use 1 to 10 letters or numbers.', 'symbol');
  if (isBlockedName(name, symbol, $('description').value)) return showError('That name or description is not allowed here. Pick something else.', 'name');
  if (!/^\d*\.?\d*$/.test(devBuy) || !Number.isFinite(Number(devBuy))) return showError('First buy must be a number.', 'devBuy');
  if (document.documentElement.dataset.preview === '1') return showError('This is a preview. Launching works once the site is deployed.');
  if (!state.pairOk) return showError($('pairNotice').textContent || 'Launching is paused right now.');
  if (!wallet.connected) return pickWallet(() => $('launchForm').requestSubmit());
  if (state.balances) {
    if (state.balances.sol < 0.025) return showError(`Your wallet has ${fmt(state.balances.sol, 3)} SOL. Launching needs about 0.03 SOL.`);
    if (Number(devBuy) > state.balances.frongus) return showError(`You have ${fmt(state.balances.frongus, 0)} FRONGUS. Lower the first buy or set it to 0.`, 'devBuy');
  }
  const website = $('website').value.trim() || location.origin;
  launcher.start({
    coin: {
      name,
      symbol,
      description: $('description').value.trim() || defaultDescription(name),
      twitter: $('twitter').value.trim(),
      telegram: $('telegram').value.trim(),
      website,
    },
    traits: { ...state.traits },
    devBuy,
    creatorFeeBps: Number(new FormData($('launchForm')).get('creatorFeeBps') || 0),
    holderReward: $('holderReward').checked,
  });
});

function showError(msg, field) {
  $('formError').textContent = msg;
  $('formError').hidden = false;
  if (field) $(field).focus();
}
function hideError() { $('formError').hidden = true; }

/* ------------------------------------------------------------- gallery */
const EXAMPLES = ['King Frongus', 'Magyar Frongus', 'Laser Frongus', 'Baby Frongus', 'Astronaut Frongus', 'Rich Frongus',
  'Wizard Frongus', 'Pirate Frongus', 'Sleepy Frongus', 'Gold Frongus', 'Brasil Frongus', 'Party Frongus'];
function renderGallery() {
  $('galleryGrid').innerHTML = EXAMPLES.map((n, i) => {
    const t = traitsFromName(n).traits;
    const what = describeTraits(t).slice(0, 2).map((c) => c.text).join(', ');
    return `<button class="variant" type="button" data-name="${n}"><span class="thumb">${renderSVG(t, { uid: 'g' + i, size: 320 })}</span><b>${n}</b><small>${escapeHtml(what)}</small></button>`;
  }).join('');
}
$('galleryGrid').addEventListener('click', (e) => {
  const b = e.target.closest('[data-name]');
  if (!b) return;
  $('name').value = b.dataset.name;
  state.shuffle = 0;
  state.overrides = {};
  state.tickerTouched = false;
  onName();
  $('studio').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  setTimeout(() => $('name').focus({ preventScroll: true }), reduceMotion ? 0 : 450);
});

/* ---------------------------------------------------------------- pair */
$('pairArt').innerHTML = renderSVG(DEFAULT_TRAITS, { uid: 'pair' });
$('copyCa').addEventListener('click', () => copy(FRONGUS_MINT, 'Contract address copied'));
async function checkPair() {
  try {
    const p = await api('/api/pair');
    state.pairOk = !!p.ok;
    if (p.ok) {
      $('pairStatus').textContent = 'Pairing with FRONGUS is live on pump.fun.';
      $('pairNotice').hidden = true;
    } else {
      $('pairStatus').textContent = p.error;
      $('pairNotice').textContent = `Launching is paused: ${p.error}`;
      $('pairNotice').hidden = false;
    }
  } catch {
    // no API (static preview) or a hiccup: leave launching enabled, the build step re-checks
  }
}

/* -------------------------------------------------------- your launches */
function loadLaunches() { try { return JSON.parse(localStorage.getItem('frongus.launches') || '[]'); } catch { return []; } }
function saveLaunch(c) {
  const list = loadLaunches().filter((x) => x.mint !== c.mint);
  list.unshift({ mint: c.mint, name: c.name, symbol: c.symbol, traits: c.traits, at: Date.now() });
  try { localStorage.setItem('frongus.launches', JSON.stringify(list.slice(0, 50))); } catch { /* storage is optional */ }
}
function renderMine() {
  const list = loadLaunches();
  $('mine').hidden = !list.length;
  $('mineList').innerHTML = list.map((c, i) => `<li>
      <span class="mini">${renderSVG(c.traits, { uid: 'm' + i, size: 56 })}</span>
      <span><b>${escapeHtml(c.name)} · $${escapeHtml(c.symbol)}</b><small>${c.mint}</small></span>
      <a class="btn btn-line btn-sm" href="https://pump.fun/coin/${c.mint}" target="_blank" rel="noopener">pump.fun</a>
    </li>`).join('');
}

/* ------------------------------------------------------------- helpers */
function fmt(n, digits) { return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 }); }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2200);
}
async function copy(text, msg) {
  try { await navigator.clipboard.writeText(text); toast(msg); } catch { toast('Copy failed. Select the text instead.'); }
}

/* ---------------------------------------------------------------- boot */
placeNameField();
readStateUrl();
onName();
renderGallery();
renderMine();
renderWallet();
checkPair();
wallet.reconnect();
