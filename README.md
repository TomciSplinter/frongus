# Frongus launchpad

A website where anyone can name a coin, get a one-of-one Frongus picture for it, and launch it on
pump.fun **paired with $FRONGUS** (`2BJDwUdMbnJhRRfhacFDjrDNhxUWdzE9H6LEND89pump`).

- Every picture is the original Frongus with traits on top: 33 skins, 10 patterns, 31 hats,
  21 eye styles, 15 mouths, 8 face details, 11 outfits, 11 props, 20 backgrounds and 61 flags.
- The coin name picks matching traits (King → crown and cape, Magyar → Hungarian flag paint,
  Baby → small with a pacifier, Laser → laser eyes, …). Unknown names get a random look that is
  always the same for the same name. People can shuffle or pick every trait by hand.
- Launches use pump.fun's own program through the official `@pump-fun/pump-sdk` (custom pairs:
  a new coin quoted in an existing pump coin). Creator fees and the first buy are in FRONGUS.
- The image that gets launched is rendered on the server from the chosen traits, so only real
  Frongus variants can launch from this site.
- Names containing slurs or hate symbols are refused (see `public/js/frongus-names.js`).
  Nationality variants use flags, never ethnic caricatures.

## Deploy on Vercel (about 10 minutes)

1. **Get an RPC URL.** Make a free account at [helius.dev](https://www.helius.dev) (or QuickNode,
   Triton…) and copy your **mainnet** RPC URL. The public Solana RPC blocks sending transactions,
   so this is required.
2. **Put this folder on GitHub.** Create a new repository and upload everything in this folder
   (not `node_modules`).
3. **Import it in Vercel.** Go to [vercel.com/new](https://vercel.com/new), pick the repository,
   leave the framework preset on **Other**, and deploy.
4. **Add environment variables** in Vercel → Project → Settings → Environment Variables:

   | Name | Required | Value |
   | --- | --- | --- |
   | `SOLANA_RPC_URL` | yes | your mainnet RPC URL from step 1 |
   | `SIGNING_SECRET` | yes | any long random string (keeps launches tied to images this site rendered) |
   | `SITE_URL` | recommended | `https://your-domain` |
   | `PINATA_JWT` | optional | a [Pinata](https://pinata.cloud) JWT; used to host images if pump.fun's upload endpoint is down |
   | `PRIORITY_FEE_MICROLAMPORTS` | optional | priority fee per compute unit, default `150000` (≈0.00008 SOL per launch) |
   | `MAX_DEV_BUY` | optional | largest first buy accepted, in FRONGUS, default `50000000` |
   | `FRONGUS_MINT` | optional | only if you ever pair with a different coin |
   | `PUMP_LOOKUP_TABLE` | optional | pump.fun's address lookup table, default `Hyif6eWb8x88RVrvjPfabsgRYnwkVnyByEXTVTXbUcyP` |

   Then redeploy (Deployments → ⋯ → Redeploy) so the variables take effect.
5. **Connect your domain.** Vercel → Project → Settings → Domains → add your domain, then set the
   DNS records Vercel shows you at the registrar where you bought it.
6. **Do a small test launch** from a wallet holding ~0.05 SOL with the first buy set to 0. Check the
   coin on pump.fun, then try one with a small first buy.

## How a launch works

1. `POST /api/upload` — validates the name and links, renders the Frongus PNG from its traits
   (`@resvg/resvg-js`), uploads image + metadata to IPFS (pump.fun's endpoint, Pinata as fallback)
   and returns the metadata URI with an HMAC signature.
2. The browser makes a fresh keypair for the new coin's address. The secret never leaves the page.
3. `POST /api/build` — checks the signature, resolves FRONGUS as the quote coin
   (`OnlinePumpSdk.resolveQuoteMint`, which handles both its bonding curve and its PumpSwap pool),
   builds `create_v2` (plus the first buy when it fits in one transaction, using pump.fun's lookup
   table), test-runs it, and returns the unsigned transaction.
4. The wallet signs first, then the page adds the coin-address signature, and `POST /api/send`
   relays it. The page polls `GET /api/status` and re-sends until it confirms or expires.
5. If the launch plus first buy can't share a transaction, the coin launches first and
   `POST /api/firstbuy` builds the buy right after (one more wallet approval).

`GET /api/pair` reports whether pump.fun currently accepts FRONGUS as a pair (for example it pauses
while FRONGUS migrates from its curve to PumpSwap); the launch button pauses with a clear message.

## Files

```
public/                 the website (static)
  index.html, css/      page and styles (Archivo font, self-hosted, SIL OFL)
  js/frongus-base.js    the traced Frongus (body, lines, eyes)
  js/frongus-art.js     all traits and the SVG renderer (shared with the server)
  js/frongus-names.js   name → traits keywords, tickers, blocklist
  js/frongus-flags.js   the flags
  js/app.js, editor.js, launch.js, wallet.js   page logic
api/                    Vercel serverless functions
lib/                    server code: Solana + pump.fun, metadata upload, config
scripts/                checks and tools
```

## Making changes

- **New name keywords:** add a line in `public/js/frongus-names.js`, e.g.
  `add('samurai ronin', { head: 'headband', eyes: 'angry' });`
- **New traits:** add a case to the matching function in `public/js/frongus-art.js` and an entry in
  `CATALOG`. Review everything with `npm run contact-sheet`, which writes one HTML page per slot.
- **Checks:** `npm install && npm run check` runs offline tests: every trait renders server-side,
  names map to traits, and the API builds, signs and relays a launch against a mocked RPC.

## Good to know

- Coin addresses are random. Addresses ending in `pump` come from pump.fun's own servers.
- pump.fun only allows pairing with coins that are themselves paired with SOL or USDC and are not in
  mayhem mode. FRONGUS qualifies today; if that changes, `/api/pair` will say why.
- This code talks to mainnet. It was tested offline against the pump.fun SDK (4.3.1) and a mocked
  RPC, so do the small test launch in step 6 before announcing the site.
- Memecoins are risky. Keep the disclaimer in the footer.
