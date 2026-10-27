// The launch flow: upload art -> build -> wallet signs -> page adds the mint signature ->
// send -> confirm (re-sending until it lands) -> optional first buy.
import { renderSVG } from './frongus-art.js';
import { wallet, loadWeb3 } from './wallet.js';

export async function api(path, body, method = body ? 'POST' : 'GET') {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) throw new Error(data?.error || `The server answered ${res.status}. Try again in a moment.`);
  return data;
}

const toB64 = (bytes) => { let s = ''; bytes.forEach((b) => (s += String.fromCharCode(b))); return btoa(s); };
const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const STEPS = {
  art: ['Upload your Frongus', 'Image and details go to IPFS.'],
  sign: ['Approve in your wallet', 'Check the coin name, then approve.'],
  confirm: ['Waiting for Solana', 'Usually takes a few seconds.'],
  buy: ['Approve your first buy', 'Your coin is live. One more approval buys your bag.'],
  live: ['Live on pump.fun', ''],
};

export function createLauncher({ dialog, onLaunched }) {
  const $ = (id) => dialog.querySelector('#' + id);
  const progress = $('progress'), errorEl = $('launchError'), doneBox = $('doneBox');
  const retryBtn = $('launchRetry'), anotherBtn = $('launchAnother'), closeBtn = $('launchClose');
  let job = null; // state kept between retries
  let busy = false;

  closeBtn.addEventListener('click', () => dialog.close());
  anotherBtn.addEventListener('click', () => { dialog.close(); job = null; window.scrollTo({ top: 0, behavior: 'smooth' }); document.getElementById('name')?.focus(); });
  retryBtn.addEventListener('click', () => run());
  dialog.addEventListener('cancel', (e) => { if (busy) e.preventDefault(); });
  $('copyMint').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('doneMint').textContent); $('copyMint').textContent = 'Copied'; } catch { /* clipboard blocked */ }
  });

  function setSteps(keys) {
    progress.innerHTML = keys.map((k) => `<li data-step="${k}" data-state="pending"><span class="dot" aria-hidden="true"></span><span>${STEPS[k][0]}${STEPS[k][1] ? `<small>${STEPS[k][1]}</small>` : ''}</span></li>`).join('');
  }
  function step(key, state, note) {
    const li = progress.querySelector(`[data-step="${key}"]`);
    if (!li) return;
    li.dataset.state = state;
    if (note) li.querySelector('small') ? (li.querySelector('small').textContent = note) : li.lastElementChild.insertAdjacentHTML('beforeend', `<small>${note}</small>`);
  }

  async function confirm(signature, raw, lastValidBlockHeight) {
    const started = Date.now();
    let lastSend = Date.now();
    for (;;) {
      await sleep(1500);
      const st = await api(`/api/status?signature=${encodeURIComponent(signature)}`).catch(() => null);
      if (st) {
        if (st.status === 'failed') throw new Error(st.error || 'The transaction failed on Solana.');
        if (st.status === 'confirmed' || st.status === 'finalized') return;
        if (st.blockHeight > lastValidBlockHeight) throw new Error('The transaction expired before it landed. Nothing was spent. Press Try again.');
      }
      if (Date.now() - lastSend > 4000) {
        api('/api/send', { tx: toB64(raw) }).catch(() => {});
        lastSend = Date.now();
      }
      if (Date.now() - started > 120_000) throw new Error('Solana is slow to confirm right now. Check your wallet activity before trying again.');
    }
  }

  async function signAndSend(web3, b64, extraSigner) {
    const tx = web3.VersionedTransaction.deserialize(fromB64(b64));
    // the wallet signs first (it may adjust the transaction); the mint signs the final message
    const signed = await wallet.signTransaction(tx);
    if (extraSigner) signed.sign([extraSigner]);
    const raw = signed.serialize();
    const { signature } = await api('/api/send', { tx: toB64(raw) });
    return { signature, raw };
  }

  async function run() {
    if (busy || !job) return;
    busy = true;
    errorEl.hidden = true;
    retryBtn.hidden = true;
    closeBtn.hidden = true;
    let current = 'art';
    try {
      const web3 = await loadWeb3();
      const { coin } = job;

      if (!job.upload) {
        step('art', 'active');
        job.upload = await api('/api/upload', { ...coin, traits: job.traits });
      }
      step('art', 'done');

      if (!job.created) {
        current = 'sign';
        step('sign', 'active');
        job.mint = web3.Keypair.generate();
        const built = await api('/api/build', {
          user: wallet.address, mint: job.mint.publicKey.toBase58(), name: coin.name, symbol: coin.symbol,
          uri: job.upload.uri, sig: job.upload.sig, devBuy: job.devBuy, creatorFeeBps: job.creatorFeeBps, holderReward: job.holderReward,
        });
        if (built.notes?.length) step('sign', 'active', built.notes.join(' '));
        job.firstBuyLater = !!built.firstBuyLater && Number(job.devBuy) > 0;
        if (job.firstBuyLater && !progress.querySelector('[data-step="buy"]')) {
          progress.querySelector('[data-step="live"]').insertAdjacentHTML('beforebegin', `<li data-step="buy" data-state="pending"><span class="dot" aria-hidden="true"></span><span>${STEPS.buy[0]}<small>${STEPS.buy[1]}</small></span></li>`);
        }
        const { signature, raw } = await signAndSend(web3, built.tx, job.mint);
        step('sign', 'done');
        current = 'confirm';
        step('confirm', 'active');
        await confirm(signature, raw, built.lastValidBlockHeight);
        job.created = { mint: job.mint.publicKey.toBase58(), signature };
        step('confirm', 'done');
        onLaunched?.({ ...job.created, name: coin.name, symbol: coin.symbol, traits: job.traits });
      }

      if (job.firstBuyLater && !job.bought) {
        current = 'buy';
        step('buy', 'active');
        try {
          // the new coin can take a moment to show up on every RPC node
          let fb;
          for (let attempt = 0; ; attempt++) {
            try {
              fb = await api('/api/firstbuy', { user: wallet.address, mint: job.created.mint, devBuy: job.devBuy });
              break;
            } catch (err) {
              if (attempt >= 5 || !/not on pump\.fun yet/.test(err.message)) throw err;
              await sleep(1500);
            }
          }
          const { signature, raw } = await signAndSend(web3, fb.tx);
          await confirm(signature, raw, fb.lastValidBlockHeight);
          job.bought = true;
          step('buy', 'done');
        } catch (err) {
          // the coin is live either way; a missed first buy can be done on pump.fun
          step('buy', 'error', `${err.message} You can buy on pump.fun instead.`);
          job.bought = true;
        }
      }

      step('live', 'done');
      showDone(job.created.mint);
    } catch (err) {
      step(current, 'error');
      errorEl.textContent = err.message || 'Something went wrong.';
      errorEl.hidden = false;
      retryBtn.hidden = false;
      closeBtn.hidden = false;
    } finally {
      busy = false;
    }
  }

  function showDone(mint) {
    const { coin } = job;
    $('launchTitle').textContent = `$${coin.symbol} is live`;
    $('doneMint').textContent = mint;
    $('copyMint').textContent = 'Copy';
    $('donePump').href = `https://pump.fun/coin/${mint}`;
    const text = `I just launched $${coin.symbol}, a Frongus variant paired with $FRONGUS.`;
    $('doneShare').href = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(`https://pump.fun/coin/${mint}`)}`;
    doneBox.hidden = false;
    anotherBtn.hidden = false;
    closeBtn.hidden = false;
  }

  return {
    start(params) {
      job = { ...params, upload: null, created: null, bought: false };
      $('launchTitle').textContent = `Launching $${params.coin.symbol}`;
      $('launchArt').innerHTML = renderSVG(params.traits, { size: 132 });
      doneBox.hidden = true;
      anotherBtn.hidden = true;
      errorEl.hidden = true;
      setSteps(['art', 'sign', 'confirm', 'live']);
      dialog.showModal();
      run();
    },
  };
}
