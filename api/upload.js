// POST /api/upload  { name, symbol, description, twitter, telegram, website, traits }
// Renders the Frongus from its traits (the browser never sends an image) and uploads
// image + metadata to IPFS. Returns { uri, image, sig }.
import { route, json, readBody, rateLimit } from '../lib/http.js';
import { validateCoin, renderPng, uploadMetadata } from '../lib/metadata.js';
import { signUri } from '../lib/signing.js';

export default route(['POST'], async (req, res) => {
  rateLimit(req, 'upload', 15, 10 * 60_000);
  const coin = validateCoin(await readBody(req));
  const png = renderPng(coin.traits);
  const { uri, image } = await uploadMetadata(coin, png);
  json(res, 200, { uri, image, sig: signUri(uri, coin.symbol) });
});
