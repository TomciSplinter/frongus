// Validates coin details, renders the Frongus image and uploads image + metadata to IPFS.
import { Resvg } from '@resvg/resvg-js';
import { renderSVG, sanitizeTraits } from '../public/js/frongus-art.js';
import { isBlockedName } from '../public/js/frongus-names.js';
import { PINATA_JWT, IPFS_GATEWAY, SITE_URL } from './config.js';
import { UserError } from './http.js';

const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);

function normalizeUrl(value, kind) {
  let v = clean(value, 200);
  if (!v) return '';
  if (kind === 'twitter' && /^@?[A-Za-z0-9_]{1,15}$/.test(v)) v = `https://x.com/${v.replace('@', '')}`;
  if (kind === 'telegram' && /^@?[A-Za-z0-9_]{4,32}$/.test(v)) v = `https://t.me/${v.replace('@', '')}`;
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  let u;
  try {
    u = new URL(v);
  } catch {
    throw new UserError(`The ${kind === 'twitter' ? 'X' : kind} link is not a valid URL.`);
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new UserError(`The ${kind} link must start with https://`);
  if (kind === 'twitter' && !/(^|\.)(x|twitter)\.com$/i.test(u.hostname)) throw new UserError('The X link must point to x.com.');
  if (kind === 'telegram' && !/(^|\.)(t\.me|telegram\.me)$/i.test(u.hostname)) throw new UserError('The Telegram link must point to t.me.');
  return u.toString();
}

export function validateCoin(body) {
  const name = clean(body.name, 64).replace(/\s+/g, ' ');
  const symbol = clean(body.symbol, 20).replace(/^\$/, '').toUpperCase();
  const description = clean(body.description, 500);
  if (!name) throw new UserError('Give your coin a name.');
  if (name.length > 32) throw new UserError('Names can be at most 32 characters.');
  if (!symbol) throw new UserError('Give your coin a ticker.');
  if (!/^[A-Z0-9]{1,10}$/.test(symbol)) throw new UserError('Tickers use 1 to 10 letters or numbers.');
  if (isBlockedName(name, symbol, description)) throw new UserError('That name or description is not allowed here. Pick something else.', 422, 'blocked_name');
  return {
    name,
    symbol,
    description,
    twitter: normalizeUrl(body.twitter, 'twitter'),
    telegram: normalizeUrl(body.telegram, 'telegram'),
    website: normalizeUrl(body.website, 'website'),
    traits: sanitizeTraits(body.traits || {}),
  };
}

export function renderPng(traits, size = 1000) {
  const svg = renderSVG(traits, { uid: 'launch', size });
  return new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
}

export async function uploadMetadata(coin, png) {
  try {
    return await uploadToPump(coin, png);
  } catch (err) {
    console.warn('pump.fun ipfs upload failed:', err?.message);
    if (!PINATA_JWT) throw new UserError('Uploading the coin image failed. Try again in a moment.', 502, 'upload_failed');
  }
  try {
    return await uploadToPinata(coin, png);
  } catch (err) {
    console.warn('pinata upload failed:', err?.message);
    throw new UserError('Uploading the coin image failed. Try again in a moment.', 502, 'upload_failed');
  }
}

async function uploadToPump(coin, png) {
  const form = new FormData();
  form.append('file', new Blob([png], { type: 'image/png' }), `${coin.symbol.toLowerCase()}.png`);
  form.append('name', coin.name);
  form.append('symbol', coin.symbol);
  form.append('description', coin.description);
  if (coin.twitter) form.append('twitter', coin.twitter);
  if (coin.telegram) form.append('telegram', coin.telegram);
  if (coin.website) form.append('website', coin.website);
  form.append('showName', 'true');
  const res = await fetch('https://pump.fun/api/ipfs', { method: 'POST', body: form, headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(25_000) });
  if (!res.ok) throw new Error(`pump.fun ipfs responded ${res.status}`);
  const data = await res.json();
  if (!data?.metadataUri) throw new Error('pump.fun ipfs returned no metadataUri');
  if (data.metadataUri.length > 200) throw new Error('metadata uri too long');
  return { uri: data.metadataUri, image: data.metadata?.image || null };
}

async function pinFile(blob, filename) {
  const form = new FormData();
  form.append('file', blob, filename);
  form.append('network', 'public');
  const res = await fetch('https://uploads.pinata.cloud/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body: form,
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`pinata responded ${res.status}`);
  const data = await res.json();
  if (!data?.data?.cid) throw new Error('pinata returned no cid');
  return data.data.cid;
}

async function uploadToPinata(coin, png) {
  const imageCid = await pinFile(new Blob([png], { type: 'image/png' }), `${coin.symbol.toLowerCase()}.png`);
  const image = IPFS_GATEWAY + imageCid;
  const meta = {
    name: coin.name,
    symbol: coin.symbol,
    description: coin.description,
    image,
    showName: true,
    createdOn: SITE_URL || 'https://pump.fun',
    ...(coin.twitter && { twitter: coin.twitter }),
    ...(coin.telegram && { telegram: coin.telegram }),
    ...(coin.website && { website: coin.website }),
  };
  const metaCid = await pinFile(new Blob([JSON.stringify(meta)], { type: 'application/json' }), `${coin.symbol.toLowerCase()}.json`);
  return { uri: IPFS_GATEWAY + metaCid, image };
}
