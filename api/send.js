// POST /api/send  { tx }  -> { signature }   (signed by the wallet and the new mint)
import { route, json, readBody, rateLimit } from '../lib/http.js';
import { sendSigned } from '../lib/solana.js';

export default route(['POST'], async (req, res) => {
  rateLimit(req, 'send', 120, 10 * 60_000);
  const { tx } = await readBody(req);
  const signature = await sendSigned(tx);
  json(res, 200, { signature });
});
