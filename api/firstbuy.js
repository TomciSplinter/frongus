// POST /api/firstbuy  { user, mint, devBuy }  -> unsigned buy transaction (FRONGUS in, new coin out).
// Used right after a launch when create + first buy did not fit in one transaction.
import { route, json, readBody, rateLimit, UserError } from '../lib/http.js';
import { buildFirstBuyTx, parseKey } from '../lib/solana.js';
import { MAX_DEV_BUY } from '../lib/config.js';

export default route(['POST'], async (req, res) => {
  rateLimit(req, 'firstbuy', 30, 10 * 60_000);
  const b = await readBody(req);
  const user = parseKey(b.user, 'Your wallet');
  const mint = parseKey(b.mint, 'The coin address');
  const devBuy = String(b.devBuy ?? '').trim();
  const n = Number(devBuy);
  if (!Number.isFinite(n) || n <= 0 || n > MAX_DEV_BUY) throw new UserError('Enter how much FRONGUS to spend.');
  json(res, 200, await buildFirstBuyTx({ user, mint, devBuy }));
});
