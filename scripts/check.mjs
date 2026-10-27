// Offline checks: art renders server-side, names map to traits, and the API routes build,
// sign and send a FRONGUS-paired launch against a mocked RPC. No network needed.
// usage: npm run check
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const web3 = require('@solana/web3.js');
const { OnlinePumpSdk } = require('@pump-fun/pump-sdk');
const BN = require('bn.js');
const { Keypair, PublicKey, VersionedTransaction, AddressLookupTableAccount } = web3;

let passed = 0;
const ok = (label) => { passed++; console.log('  ok  ' + label); };

/* ---------------------------------------------------------- art + names */
const { renderSVG, CATALOG, sanitizeTraits } = await import('../public/js/frongus-art.js');
const { traitsFromName, suggestTicker, isBlockedName } = await import('../public/js/frongus-names.js');
const { renderPng, validateCoin } = await import('../lib/metadata.js');

assert.ok(renderSVG({}).startsWith('<svg'));
ok('renders the classic Frongus');
const png = renderPng(traitsFromName('King Magyar Frongus').traits, 400);
assert.equal(png.subarray(1, 4).toString(), 'PNG');
ok(`server renders PNG (${png.length} bytes)`);
assert.deepEqual(sanitizeTraits({ head: '<script>', skin: 'gold' }).head, 'none');
ok('unknown trait values are dropped');
assert.equal(traitsFromName('King Frongus').traits.head, 'crown');
assert.equal(traitsFromName('Magyar Frongus').traits.country, 'hu');
assert.equal(suggestTicker('Baby Frongus'), 'BFRONGUS');
ok('names map to traits and tickers');
assert.equal(isBlockedName('Niggus'), true);
assert.equal(isBlockedName('Nigeria Frongus'), false);
assert.throws(() => validateCoin({ name: 'Ching Chongus', symbol: 'CHONG' }), /not allowed/);
ok('blocked names are refused, normal ones pass');
for (const slot of Object.keys(CATALOG)) for (const o of CATALOG[slot]) renderSVG({ [slot]: o.id, country: slot === 'country' ? o.id : 'us' });
ok('every catalogue option renders');

/* ------------------------------------------------------------ mock RPC */
const user = Keypair.generate();
const fakeFeeRecipient = Keypair.generate().publicKey;
const sent = [];
Object.assign(web3.Connection.prototype, {
  async getLatestBlockhash() { return { blockhash: Keypair.generate().publicKey.toBase58(), lastValidBlockHeight: 1000 }; },
  async getAddressLookupTable(key) {
    const addresses = [
      '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P', 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb', 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
      'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', '11111111111111111111111111111111', 'MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e',
    ].map((a) => new PublicKey(a));
    return { value: new AddressLookupTableAccount({ key, state: { deactivationSlot: BigInt('18446744073709551615'), lastExtendedSlot: 0, lastExtendedSlotStartIndex: 0, authority: undefined, addresses } }) };
  },
  async simulateTransaction() { return { value: { err: null, logs: [], unitsConsumed: 210_000 } }; },
  async sendRawTransaction(raw) { sent.push(raw); return 'Sig' + '1'.repeat(80); },
  async getSignatureStatuses() { return { value: [{ confirmationStatus: 'confirmed', err: null }] }; },
  async getBlockHeight() { return 990; },
  async getBalance() { return 250_000_000; },
  async getParsedTokenAccountsByOwner() { return { value: [{ account: { data: { parsed: { info: { tokenAmount: { uiAmountString: '123456.5' } } } } } }] }; },
});
Object.assign(OnlinePumpSdk.prototype, {
  async fetchGlobal() { return { feeRecipient: fakeFeeRecipient, feeRecipients: [], reservedFeeRecipient: fakeFeeRecipient, reservedFeeRecipients: [], isHolderRewardEnabled: true, creatorFeeConfigurable: true, maxConfigurableCreatorFeeBps: new BN(100) }; },
  async fetchFeeConfig() { return {}; },
  async fetchQuoteControl() { return null; },
  async resolveQuoteMint(mint) {
    return { mint, source: 'pumpCoin', decimals: 6, quoteTokenProgram: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'), initialVirtualQuoteReserves: new BN(1), pumpQuote: { depth: 1, curve: {}, accounts: { chain: [] } } };
  },
});

/* ------------------------------------------------------------ API calls */
function call(handler, { method = 'POST', body, query = '' } = {}) {
  return new Promise((resolve) => {
    const headers = {};
    const res = {
      statusCode: 200,
      setHeader: (k, v) => (headers[k.toLowerCase()] = v),
      getHeader: (k) => headers[k.toLowerCase()],
      end: (text) => resolve({ status: res.statusCode, headers, body: JSON.parse(text) }),
    };
    handler({ method, body, url: '/api/x' + query, headers: { 'x-forwarded-for': '1.2.3.4' }, socket: {} }, res);
  });
}
globalThis.fetch = async (url) => {
  assert.equal(String(url), 'https://pump.fun/api/ipfs');
  return { ok: true, json: async () => ({ metadataUri: 'https://ipfs.io/ipfs/bafkreitestmetadata', metadata: { image: 'https://ipfs.io/ipfs/bafkreitestimage' } }) };
};

// web3.js defines getBlockHeight per instance, so patch the shared connection too
const { connection } = await import('../lib/solana.js');
connection().getBlockHeight = async () => 990;

const upload = (await import('../api/upload.js')).default;
const build = (await import('../api/build.js')).default;
const send = (await import('../api/send.js')).default;
const status = (await import('../api/status.js')).default;
const wallet = (await import('../api/wallet.js')).default;

const coin = { name: 'King Frongus', symbol: 'KFRONGUS', description: 'test', twitter: '@frongus', traits: traitsFromName('King Frongus').traits };
const up = await call(upload, { body: coin });
assert.equal(up.status, 200, JSON.stringify(up.body));
assert.ok(up.body.uri && up.body.sig);
ok('upload renders server-side and returns a signed metadata URI');

const blocked = await call(upload, { body: { ...coin, name: 'Niggus' } });
assert.equal(blocked.status, 422);
ok('upload refuses blocked names');

const mint = Keypair.generate();
const unsigned = await call(build, { body: { user: user.publicKey.toBase58(), mint: mint.publicKey.toBase58(), name: coin.name, symbol: coin.symbol, uri: up.body.uri, sig: up.body.sig, devBuy: '0' } });
assert.equal(unsigned.status, 200, JSON.stringify(unsigned.body));
const tx = VersionedTransaction.deserialize(Buffer.from(unsigned.body.tx, 'base64'));
const signers = tx.message.staticAccountKeys.slice(0, tx.message.header.numRequiredSignatures).map((k) => k.toBase58());
assert.deepEqual(signers.sort(), [user.publicKey.toBase58(), mint.publicKey.toBase58()].sort());
assert.ok(tx.message.staticAccountKeys.some((k) => k.toBase58() === '2BJDwUdMbnJhRRfhacFDjrDNhxUWdzE9H6LEND89pump') || tx.message.addressTableLookups.length);
ok(`build returns a v0 create tx paired with FRONGUS (${Buffer.from(unsigned.body.tx, 'base64').length} bytes, ${unsigned.body.units} CU)`);

const forged = await call(build, { body: { user: user.publicKey.toBase58(), mint: mint.publicKey.toBase58(), name: coin.name, symbol: coin.symbol, uri: 'https://example.com/other.json', sig: 'nope', devBuy: '0' } });
assert.equal(forged.status, 400);
ok('build refuses metadata this site did not render');

// wallet signs first, then the page adds the mint signature (same order as the browser)
tx.sign([user]);
tx.sign([mint]);
const out = await call(send, { body: { tx: Buffer.from(tx.serialize()).toString('base64') } });
assert.equal(out.status, 200, JSON.stringify(out.body));
assert.equal(sent.length, 1);
ok('send relays the fully signed launch');

const half = VersionedTransaction.deserialize(Buffer.from(unsigned.body.tx, 'base64'));
half.sign([user]);
const missing = await call(send, { body: { tx: Buffer.from(half.serialize()).toString('base64') } });
assert.equal(missing.status, 400);
ok('send refuses a transaction missing the mint signature');

const st = await call(status, { method: 'GET', query: '?signature=' + out.body.signature });
assert.equal(st.body.status, 'confirmed');
ok('status reports confirmation');

const w = await call(wallet, { method: 'GET', query: '?owner=' + user.publicKey.toBase58() });
assert.equal(w.body.frongus, 123456.5);
assert.equal(w.body.sol, 0.25);
ok('wallet reports SOL and FRONGUS balances');

console.log(`\n${passed} checks passed`);
