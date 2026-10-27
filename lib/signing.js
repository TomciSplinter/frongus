// Ties a launch to an image this site rendered: /api/upload signs the metadata URI and
// /api/build only accepts URIs carrying a valid signature.
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { RPC_URL, FRONGUS_MINT } from './config.js';

const SECRET = process.env.SIGNING_SECRET || createHash('sha256').update(`frongus|${RPC_URL}|${FRONGUS_MINT}`).digest('hex');

export function signUri(uri, symbol) {
  return createHmac('sha256', SECRET).update(`${uri}|${symbol}`).digest('base64url');
}
export function verifyUri(uri, symbol, sig) {
  const a = Buffer.from(signUri(uri, symbol));
  const b = Buffer.from(String(sig || ''));
  return a.length === b.length && timingSafeEqual(a, b);
}
