// Trait editor: one tab per slot, each option shown on the current Frongus.
import { renderSVG, CATALOG, SWATCHES } from './frongus-art.js';
import { FLAGS } from './frongus-flags.js';

const TABS = [
  ['skin', 'Skin'], ['pattern', 'Pattern'], ['head', 'Hat'], ['eyes', 'Eyes'], ['mouth', 'Mouth'],
  ['face', 'Face'], ['outfit', 'Outfit'], ['prop', 'Prop'], ['bg', 'Background'], ['country', 'Flag'],
];
const ACCENT_SLOTS = new Set(['head', 'outfit', 'eyes', 'prop']);
const BG_WITH_COLOR = new Set(['solid', 'gradient', 'rays', 'dots', 'checker', 'stripes', 'hearts']);

export function createEditor({ dialog, getTraits, setOverrides, reset }) {
  const $ = (id) => dialog.querySelector('#' + id);
  const tabsEl = $('editorTabs'), optionsEl = $('editorOptions'), extraEl = $('editorExtra'), previewEl = $('editorPreview');
  let active = 'skin';
  let renderToken = 0;

  tabsEl.innerHTML = TABS.map(([id, label]) =>
    `<button class="tab" role="tab" type="button" data-tab="${id}" aria-selected="${id === active}">${label}</button>`).join('');
  tabsEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    active = b.dataset.tab;
    tabsEl.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x.dataset.tab === active)));
    optionsEl.scrollTop = 0;
    draw();
  });

  optionsEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    if (!b) return;
    const id = b.dataset.id;
    const t = getTraits();
    if (active === 'country') {
      const patch = { country: id };
      if (t.pattern !== 'flag' && t.prop !== 'flag' && t.bg !== 'flag') patch.pattern = 'flag';
      setOverrides(patch);
    } else {
      setOverrides({ [active]: id });
    }
    draw();
  });

  extraEl.addEventListener('click', (e) => {
    const s = e.target.closest('[data-color]');
    if (s) { setOverrides({ [s.dataset.key]: s.dataset.color }); draw(); }
    const z = e.target.closest('[data-size]');
    if (z) { setOverrides({ size: z.dataset.size }); draw(); }
  });
  extraEl.addEventListener('change', (e) => {
    if (e.target.matches('select[data-country]')) { setOverrides({ country: e.target.value }); draw(); }
  });

  $('editorClose').addEventListener('click', () => dialog.close());
  $('editorDone').addEventListener('click', () => dialog.close());
  $('editorReset').addEventListener('click', () => { reset(); draw(); });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

  function swatchRow(label, key, colors, current) {
    return `<span class="label">${label}</span><div class="swatches" role="radiogroup" aria-label="${label}">` +
      colors.map((c) => `<button type="button" class="swatch" role="radio" aria-checked="${c.toUpperCase() === (current || '').toUpperCase()}" aria-label="${c}" data-key="${key}" data-color="${c}" style="background:${c}"></button>`).join('') + '</div>';
  }
  function countrySelect(current) {
    const opts = Object.entries(FLAGS).sort((a, b) => a[1].name.localeCompare(b[1].name))
      .map(([code, f]) => `<option value="${code}"${code === current ? ' selected' : ''}>${f.name}</option>`).join('');
    return `<span class="label">Country</span><select data-country aria-label="Country">${opts}</select>`;
  }

  function drawExtra(t) {
    let html = '';
    if (active === 'skin') {
      html = `<span class="label">Size</span><div class="swatches">` +
        [['small', 'Small'], ['normal', 'Normal'], ['big', 'Big']].map(([id, l]) =>
          `<button type="button" class="tab" data-size="${id}" aria-pressed="${t.size === id}" aria-selected="${t.size === id}">${l}</button>`).join('') + '</div>';
    }
    if (ACCENT_SLOTS.has(active)) html = swatchRow('Gear color', 'accent', SWATCHES.accent, t.accent);
    if (active === 'bg' && BG_WITH_COLOR.has(t.bg)) html = swatchRow('Color', 'bgColor', SWATCHES.bg, t.bgColor);
    if ((active === 'pattern' && t.pattern === 'flag') || (active === 'prop' && t.prop === 'flag') || (active === 'bg' && t.bg === 'flag')) {
      html += countrySelect(t.country);
    }
    extraEl.innerHTML = html;
  }

  function draw() {
    const t = getTraits();
    previewEl.innerHTML = renderSVG(t, { title: 'Preview' });
    drawExtra(t);
    const list = CATALOG[active];
    const current = active === 'country' ? t.country : t[active];
    const token = ++renderToken;
    const scroll = optionsEl.scrollTop;
    optionsEl.innerHTML = list.map((o) =>
      `<button type="button" class="option" role="radio" aria-checked="${o.id === current}" data-id="${o.id}"><span class="thumb"></span><span>${o.label}</span></button>`).join('');
    optionsEl.scrollTop = scroll;
    const thumbs = [...optionsEl.querySelectorAll('.thumb')];
    // draw thumbnails in small batches so the dialog stays responsive
    let i = 0;
    const step = () => {
      if (token !== renderToken) return;
      const end = Math.min(i + 8, list.length);
      for (; i < end; i++) {
        const o = list[i];
        const tt = active === 'country'
          ? { ...t, country: o.id, pattern: t.pattern === 'flag' || (t.prop !== 'flag' && t.bg !== 'flag') ? 'flag' : t.pattern }
          : { ...t, [active]: o.id };
        thumbs[i].innerHTML = renderSVG(tt, { size: 160 });
      }
      if (i < list.length) requestAnimationFrame(step);
    };
    step();
  }

  return {
    open(tab) {
      if (tab) active = tab;
      tabsEl.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x.dataset.tab === active)));
      dialog.showModal();
      draw();
    },
    refresh: () => dialog.open && draw(),
  };
}
