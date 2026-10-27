// GET /api/wallet?owner=...  -> { sol, frongus }
import { route, json, rateLimit } from '../lib/http.js';
import { walletBalances, parseKey } from '../lib/solana.js';

export default route(['GET'], async (req, res) => {
  rateLimit(req, 'wallet', 120, 10 * 60_000);
  const owner = parseKey(new URL(req.url, 'http://x').searchParams.get('owner'), 'Wallet');
  json(res, 200, await walletBalances(owner));
});
