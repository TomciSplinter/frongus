// GET /api/status?signature=...  -> { status: pending | processed | confirmed | finalized | failed, blockHeight, error? }
import { route, json, rateLimit, UserError } from '../lib/http.js';
import { signatureStatus } from '../lib/solana.js';

export default route(['GET'], async (req, res) => {
  rateLimit(req, 'status', 400, 10 * 60_000);
  const sig = new URL(req.url, 'http://x').searchParams.get('signature') || '';
  if (!/^[1-9A-HJ-NP-Za-km-z]{60,100}$/.test(sig)) throw new UserError('Missing transaction signature.');
  json(res, 200, await signatureStatus(sig));
});
