// GET /api/pair  -> how FRONGUS is admitted as the quote mint right now.
import { route, json, UserError } from '../lib/http.js';
import { pairInfo } from '../lib/solana.js';

export default route(['GET'], async (req, res) => {
  try {
    const info = await pairInfo();
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    json(res, 200, { ok: true, ...info });
  } catch (err) {
    if (err instanceof UserError) return json(res, 200, { ok: false, error: err.message });
    throw err;
  }
});
