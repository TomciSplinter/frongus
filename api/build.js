// POST /api/build  { user, mint, name, symbol, uri, sig, devBuy, creatorFeeBps, holderReward }
// Returns an unsigned v0 transaction: create the coin paired with FRONGUS (+ optional first buy).
import { route, json, readBody, rateLimit, UserError } from '../lib/http.js';
import { buildLaunchTx, parseKey } from '../lib/solana.js';
import { validateCoin } from '../lib/metadata.js';
import { verifyUri } from '../lib/signing.js';
import { MAX_DEV_BUY } from '../lib/config.js';

const FEE_OPTIONS = [0, 5, 25, 50, 100];

export default route(['POST'], async (req, res) => {
  rateLimit(req, 'build', 40, 10 * 60_000);
  const b = await readBody(req);
  const user = parseKey(b.user, 'Your wallet');
  const mint = parseKey(b.mint, 'The coin address');
  if (user.equals(mint)) throw new UserError('The coin address can not be your wallet address.');
  const { name, symbol } = validateCoin({ name: b.name, symbol: b.symbol });
  const uri = String(b.uri || '');
  if (!/^https:\/\/\S+$/.test(uri) || uri.length > 200 || !verifyUri(uri, symbol, b.sig)) {
    throw new UserError('Upload your Frongus image first, then launch.', 400, 'missing_upload');
  }
  const devBuy = String(b.devBuy ?? '0').trim() || '0';
  const n = Number(devBuy);
  if (!Number.isFinite(n) || n < 0 || n > MAX_DEV_BUY) {
    throw new UserError(`First buy must be between 0 and ${MAX_DEV_BUY.toLocaleString('en-US')} FRONGUS.`);
  }
  const creatorFeeBps = FEE_OPTIONS.includes(Number(b.creatorFeeBps)) ? Number(b.creatorFeeBps) : 0;
  const result = await buildLaunchTx({ user, mint, name, symbol, uri, devBuy, creatorFeeBps, holderReward: b.holderReward === true });
  json(res, 200, result);
});
