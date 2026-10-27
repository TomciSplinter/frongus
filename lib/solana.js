// Everything that talks to Solana and the pump.fun program.
import { createRequire } from 'node:module';
import { RPC_URL, FRONGUS_MINT, PUMP_LOOKUP_TABLE, PRIORITY_FEE_MICROLAMPORTS } from './config.js';
import { UserError } from './http.js';

// The pump SDK's ESM build does not load under plain Node, so the Solana stack is loaded through
// CommonJS. Loading web3.js the same way keeps a single copy of PublicKey/BN shared with the SDK.
const require = createRequire(import.meta.url);
const { Connection, PublicKey, ComputeBudgetProgram, TransactionMessage, VersionedTransaction } = require('@solana/web3.js');
const BN = require('bn.js');
const { TOKEN_2022_PROGRAM_ID } = require('@solana/spl-token');
const { OnlinePumpSdk, PUMP_SDK, PUMP_PROGRAM_ID, getBuyTokenAmountFromSolAmount, getBuyV3TokenAmountFromQuoteAmount } = require('@pump-fun/pump-sdk');

export const FRONGUS = new PublicKey(FRONGUS_MINT);

let conn, onlineSdk;
export const connection = () => (conn ||= new Connection(RPC_URL, { commitment: 'confirmed' }));
const sdk = () => (onlineSdk ||= new OnlinePumpSdk(connection()));

const memo = new Map();
async function cached(key, ttlMs, fn) {
  const hit = memo.get(key);
  if (hit && hit.until > Date.now()) return hit.value;
  const value = await fn();
  memo.set(key, { value, until: Date.now() + ttlMs });
  return value;
}

export function parseKey(value, label) {
  try {
    return new PublicKey(String(value || ''));
  } catch {
    throw new UserError(`${label} is not a valid Solana address.`);
  }
}

/* ------------------------------------------------------------- the pair */
// How FRONGUS is admitted as the quote mint: as a pump coin ("pumpCoin") or, if pump.fun ever
// lists it, through Global / QuoteControl. Cached briefly: the pump-coin path carries live reserves.
export async function resolvePair(ttlMs = 15_000) {
  return cached('pair', ttlMs, async () => {
    try {
      return await sdk().resolveQuoteMint(FRONGUS);
    } catch (err) {
      throw new UserError(explainPairError(err), 409, 'pair_unavailable');
    }
  });
}
function explainPairError(err) {
  const name = err?.name || err?.constructor?.name || '';
  if (/AwaitingMigration/.test(name)) return 'FRONGUS is moving from its bonding curve to PumpSwap right now. Try again in a few minutes.';
  if (/CurveDepth/.test(name)) return 'FRONGUS is itself paired with another pump coin, so pump.fun does not allow pairing with it.';
  if (/NotEligible/.test(name)) return 'pump.fun does not currently allow FRONGUS as a pair.';
  if (/UnsupportedQuoteMint/.test(name)) return 'pump.fun does not recognise FRONGUS as a pump coin.';
  return 'Could not read FRONGUS from pump.fun right now. Try again in a moment.';
}

export async function pairInfo() {
  const q = await resolvePair(30_000);
  return {
    mint: FRONGUS.toBase58(),
    source: q.source,
    decimals: q.decimals,
    depth: q.pumpQuote?.depth ?? null,
    tokenProgram: q.quoteTokenProgram.toBase58(),
  };
}

async function lookupTable() {
  return cached('alt', 10 * 60_000, async () => {
    const res = await connection().getAddressLookupTable(new PublicKey(PUMP_LOOKUP_TABLE));
    return res.value || null;
  }).catch(() => null);
}

/* -------------------------------------------------------------- launch */
// Builds the unsigned create (+ optional first buy in FRONGUS) transaction. The browser keeps
// the new mint's secret key: the wallet signs first, then the page adds the mint signature.
export async function buildLaunchTx({ user, mint, name, symbol, uri, devBuy = 0, creatorFeeBps = 0, holderReward = false }) {
  const online = sdk();
  const [global, feeConfig, quote, alt] = await Promise.all([online.fetchGlobal(), online.fetchFeeConfig(), resolvePair(), lookupTable()]);
  const notes = [];

  let feeBps;
  if (creatorFeeBps > 0) {
    const max = global.maxConfigurableCreatorFeeBps ? Number(global.maxConfigurableCreatorFeeBps.toString()) : 0;
    if (global.creatorFeeConfigurable && creatorFeeBps <= max) feeBps = new BN(creatorFeeBps);
    else notes.push('pump.fun is not accepting custom creator fees right now, so the standard rate applies.');
  }
  if (holderReward && !global.isHolderRewardEnabled) {
    throw new UserError('Holder rewards are switched off on pump.fun right now. Turn the option off to launch.', 409, 'holder_rewards_off');
  }

  const quoteControl = quote.source === 'quoteControl' ? await online.fetchQuoteControl() : null;
  const common = {
    mint, name, symbol, uri, creator: user, user, mayhemMode: false,
    quoteMint: FRONGUS, quoteTokenProgram: quote.quoteTokenProgram,
    creatorFeeBps: feeBps, holderReward: !!holderReward, pumpQuote: quote.pumpQuote?.accounts,
  };

  const quoteAmount = toBaseUnits(devBuy, quote.decimals);
  const wantsBuy = quoteAmount.gtn(0);
  const createOnly = [await PUMP_SDK.createV2Instruction(common)];
  let withBuy = null;
  if (wantsBuy) {
    try {
      const amount = getBuyTokenAmountFromSolAmount({
        global, feeConfig, mintSupply: null, bondingCurve: null, amount: quoteAmount,
        quoteMint: FRONGUS, quoteControl, creatorFeeBps: feeBps, pumpQuote: quote.pumpQuote?.curve,
      });
      if (amount.lten(0)) throw new UserError('That first buy is too small to get any tokens. Raise it or set it to 0.');
      withBuy = await PUMP_SDK.createV2AndBuyV2Instructions({ global, ...common, amount, quoteAmount, slippage: 10 });
    } catch (err) {
      if (err instanceof UserError) throw err;
      console.warn('create + buy could not be quoted, the buy will follow the launch:', err?.message);
    }
  }

  const conn = connection();
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
  const compile = makeCompiler(user, blockhash, alt);

  // Create + first buy in one transaction when it fits and passes a test run. Otherwise launch
  // now and send the first buy right after (the coin exists by then, so it can be quoted exactly).
  if (withBuy && fits(compile, withBuy)) {
    try {
      const done = await simulateAndFinalize(conn, compile, withBuy);
      return { ...done, blockhash, lastValidBlockHeight, firstBuyLater: false, notes };
    } catch (err) {
      if (err instanceof UserError && /enough (SOL|FRONGUS)|no SOL/.test(err.message)) throw err;
      console.warn('create + buy failed its test run, the buy will follow the launch:', err?.message);
    }
  }
  if (!fits(compile, createOnly)) {
    throw new UserError('Could not fit the launch into one transaction. Try a shorter name.', 400, 'tx_too_large');
  }
  const done = await simulateAndFinalize(conn, compile, createOnly);
  return { ...done, blockhash, lastValidBlockHeight, firstBuyLater: wantsBuy, notes };
}

// First buy for a coin that already exists (used when create + buy did not fit together).
export async function buildFirstBuyTx({ user, mint, devBuy }) {
  const online = sdk();
  const [global, feeConfig, quote, alt, state] = await Promise.all([
    online.fetchGlobal(), online.fetchFeeConfig(), resolvePair(60_000), lookupTable(),
    online.fetchBuyState(mint, user, TOKEN_2022_PROGRAM_ID, FRONGUS).catch(() => null),
  ]);
  if (!state) throw new UserError('That coin is not on pump.fun yet. Wait a few seconds and try again.', 409, 'curve_missing');
  if (!state.quoteMint.equals(FRONGUS)) throw new UserError('That coin is not paired with FRONGUS.');
  const quoteAmount = toBaseUnits(devBuy, quote.decimals);
  if (!quoteAmount.gtn(0)) throw new UserError('Enter how much FRONGUS to spend.');
  const amount = getBuyV3TokenAmountFromQuoteAmount({
    global, feeConfig, mintSupply: state.bondingCurve.tokenTotalSupply, bondingCurve: state.bondingCurve,
    amount: quoteAmount, curveBaseTokenBalance: state.curveBaseTokenBalance, quoteTransferFee: state.quoteTransferFee,
  });
  if (amount.lten(0)) throw new UserError('That buy is too small to get any tokens.');
  const ixs = await PUMP_SDK.buyExactQuoteInV3Instructions({
    bondingCurve: state.bondingCurve, associatedUserAccountInfo: state.associatedUserAccountInfo, mint, user,
    amount, quoteAmount, slippage: 10, tokenProgram: TOKEN_2022_PROGRAM_ID, quoteTokenProgram: state.quoteTokenProgram,
  });
  const conn = connection();
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
  const compile = makeCompiler(user, blockhash, alt);
  if (!fits(compile, ixs)) throw new UserError('Could not build the buy. Buy on pump.fun instead.', 400, 'tx_too_large');
  const done = await simulateAndFinalize(conn, compile, ixs);
  return { ...done, blockhash, lastValidBlockHeight };
}

function makeCompiler(user, blockhash, alt) {
  const price = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: PRIORITY_FEE_MICROLAMPORTS });
  return (ixs, units) => new VersionedTransaction(new TransactionMessage({
    payerKey: user,
    recentBlockhash: blockhash,
    instructions: [ComputeBudgetProgram.setComputeUnitLimit({ units }), price, ...ixs],
  }).compileToV0Message(alt ? [alt] : []));
}
function fits(compile, ixs) {
  try {
    compile(ixs, 1_200_000).serialize();
    return true;
  } catch {
    return false;
  }
}
// Test run before the wallet opens, so problems show up as a clear message instead of a failed
// transaction; then size the compute budget to what the run actually used.
async function simulateAndFinalize(conn, compile, ixs) {
  const draft = compile(ixs, 1_200_000);
  const sim = await conn.simulateTransaction(draft, { sigVerify: false, replaceRecentBlockhash: true, commitment: 'confirmed' });
  if (sim.value.err) throw new UserError(explainFailure(sim.value.err, sim.value.logs), 400, 'simulation_failed');
  const units = Math.min(1_400_000, Math.ceil((sim.value.unitsConsumed || 600_000) * 1.2) + 20_000);
  const tx = compile(ixs, units);
  return {
    tx: Buffer.from(tx.serialize()).toString('base64'),
    units,
    priorityFeeLamports: Math.ceil((units * PRIORITY_FEE_MICROLAMPORTS) / 1e6),
  };
}

function toBaseUnits(value, decimals) {
  const s = String(value ?? '0').trim();
  if (!/^\d*(\.\d*)?$/.test(s)) throw new UserError('First buy must be a number.');
  const [whole, frac = ''] = s.split('.');
  return new BN((whole || '0') + frac.padEnd(decimals, '0').slice(0, decimals));
}

/* ---------------------------------------------------------------- send */
export async function sendSigned(base64) {
  let raw, tx;
  try {
    raw = Buffer.from(String(base64 || ''), 'base64');
    tx = VersionedTransaction.deserialize(raw);
  } catch {
    throw new UserError('That is not a valid transaction.');
  }
  const keys = tx.message.staticAccountKeys.map((k) => k.toBase58());
  if (!keys.includes(PUMP_PROGRAM_ID.toBase58())) throw new UserError('Only Frongus launches can be sent from here.');
  if (tx.signatures.some((sig) => sig.every((b) => b === 0))) throw new UserError('The transaction is missing a signature. Approve it in your wallet and try again.');
  return connection().sendRawTransaction(raw, { skipPreflight: true, maxRetries: 2 });
}

export async function signatureStatus(signature) {
  const conn = connection();
  const [{ value }, blockHeight] = await Promise.all([
    conn.getSignatureStatuses([signature], { searchTransactionHistory: false }),
    conn.getBlockHeight('confirmed'),
  ]);
  const s = value[0];
  if (!s) return { status: 'pending', blockHeight };
  if (s.err) {
    let logs = [];
    try {
      const t = await conn.getTransaction(signature, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' });
      logs = t?.meta?.logMessages || [];
    } catch { /* logs are optional */ }
    return { status: 'failed', error: explainFailure(s.err, logs), blockHeight };
  }
  return { status: s.confirmationStatus || 'processed', blockHeight };
}

/* -------------------------------------------------------------- wallet */
export async function walletBalances(owner) {
  const conn = connection();
  const [lamports, accounts] = await Promise.all([
    conn.getBalance(owner, 'confirmed'),
    conn.getParsedTokenAccountsByOwner(owner, { mint: FRONGUS }, 'confirmed'),
  ]);
  const frongus = accounts.value.reduce((sum, a) => sum + Number(a.account.data.parsed?.info?.tokenAmount?.uiAmountString || 0), 0);
  return { sol: lamports / 1e9, frongus };
}

/* -------------------------------------------------------------- errors */
const PUMP_ERRORS = {
  6002: 'FRONGUS moved in price while you were launching. Try again.',
  6063: 'pump.fun does not recognise FRONGUS as a pair right now.',
  6071: 'Mayhem mode can not be used with a FRONGUS pair.',
  6077: 'pump.fun is not accepting custom creator fees right now. Choose the standard fee.',
  6078: 'That creator fee is outside the range pump.fun allows. Choose a lower one.',
  6084: 'Holder rewards are switched off on pump.fun right now. Turn the option off to launch.',
  6100: 'pump.fun does not currently allow FRONGUS as a pair.',
  6104: 'pump.fun can not price a new coin against FRONGUS at its current price. Try again later.',
  6105: 'FRONGUS is itself paired with another pump coin, so it can not be used as a pair.',
  6107: 'FRONGUS is moving from its bonding curve to PumpSwap right now. Try again in a few minutes.',
};
export function explainFailure(err, logs = []) {
  const text = (logs || []).join('\n');
  const custom = err?.InstructionError?.[1]?.Custom;
  if (typeof custom === 'number' && PUMP_ERRORS[custom]) return PUMP_ERRORS[custom];
  if (/insufficient lamports|InsufficientFundsForRent|insufficient funds for rent/i.test(text + JSON.stringify(err))) {
    return 'Your wallet does not have enough SOL. A launch needs about 0.03 SOL for rent and fees.';
  }
  if (/Error: insufficient funds/i.test(text) || custom === 1) {
    return 'Your wallet does not have enough FRONGUS for that first buy. Lower it or set it to 0.';
  }
  if (err === 'AccountNotFound' || /AccountNotFound/.test(JSON.stringify(err))) {
    return 'Your wallet has no SOL yet. Add about 0.03 SOL to launch.';
  }
  if (/already in use/i.test(text)) return 'That coin address is already taken. Press Launch again to get a fresh one.';
  if (/BlockhashNotFound/.test(JSON.stringify(err))) return 'The transaction expired before it was sent. Press Launch again.';
  return 'pump.fun rejected the launch in a test run. Check your balance and try again.';
}
