// Solana wallet connection (Phantom, Solflare, Backpack) through their injected providers.
// On a phone without a wallet browser, people are offered a link that opens this site inside
// their wallet app, where the provider is available.

const WALLETS = [
  {
    id: 'phantom',
    name: 'Phantom',
    provider: () => (window.phantom?.solana?.isPhantom ? window.phantom.solana : window.solana?.isPhantom ? window.solana : null),
    browse: (url) => `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(location.origin)}`,
    install: 'https://phantom.com/download',
  },
  {
    id: 'solflare',
    name: 'Solflare',
    provider: () => (window.solflare?.isSolflare ? window.solflare : null),
    browse: (url) => `https://solflare.com/ul/v1/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(location.origin)}`,
    install: 'https://solflare.com/download',
  },
  {
    id: 'backpack',
    name: 'Backpack',
    provider: () => (window.backpack?.isBackpack ? window.backpack : null),
    browse: null,
    install: 'https://backpack.app/downloads',
  },
];

const listeners = new Set();
export const wallet = {
  id: null,
  provider: null,
  address: null,
  get connected() { return !!this.address; },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  available() { return WALLETS.filter((w) => w.provider()); },
  all: WALLETS,
  isMobile: () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent),

  async connect(id) {
    const w = WALLETS.find((x) => x.id === id);
    const provider = w?.provider();
    if (!provider) throw new Error(`${w ? w.name : 'That wallet'} is not available in this browser.`);
    try {
      const res = await provider.connect();
      const key = res?.publicKey || provider.publicKey;
      if (!key) throw new Error('No account was shared.');
      setConnected(w.id, provider, key.toString());
      try { localStorage.setItem('frongus.wallet', w.id); } catch { /* storage is optional */ }
      watch(provider);
    } catch (err) {
      throw new Error(userRejected(err) ? 'You closed the wallet request.' : (err?.message || 'Could not connect the wallet.'));
    }
  },

  async reconnect() {
    let id;
    try { id = localStorage.getItem('frongus.wallet'); } catch { return; }
    const w = WALLETS.find((x) => x.id === id);
    const provider = w?.provider();
    if (!provider) return;
    try {
      // only reconnects silently when the site is already trusted by the wallet
      const res = w.id === 'phantom' ? await provider.connect({ onlyIfTrusted: true }) : null;
      const key = res?.publicKey || (provider.isConnected ? provider.publicKey : null);
      if (key) { setConnected(w.id, provider, key.toString()); watch(provider); }
    } catch { /* not trusted yet: stay disconnected */ }
  },

  async disconnect() {
    try { await this.provider?.disconnect?.(); } catch { /* ignore */ }
    try { localStorage.removeItem('frongus.wallet'); } catch { /* ignore */ }
    setConnected(null, null, null);
  },

  async signTransaction(tx) {
    if (!this.provider) throw new Error('Connect a wallet first.');
    try {
      return await this.provider.signTransaction(tx);
    } catch (err) {
      throw new Error(userRejected(err) ? 'You closed the wallet request. Nothing was sent.' : (err?.message || 'The wallet could not sign the transaction.'));
    }
  },
};

function setConnected(id, provider, address) {
  wallet.id = id;
  wallet.provider = provider;
  wallet.address = address;
  listeners.forEach((fn) => fn(wallet));
}
const watched = new WeakSet();
function watch(provider) {
  if (watched.has(provider) || typeof provider.on !== 'function') return;
  watched.add(provider);
  provider.on('accountChanged', (key) => {
    if (key) setConnected(wallet.id, provider, key.toString());
    else wallet.disconnect();
  });
  provider.on('disconnect', () => setConnected(null, null, null));
}
function userRejected(err) {
  return err?.code === 4001 || /reject|declin|cancel|denied|closed/i.test(err?.message || '');
}

// web3.js is only needed to build and sign transactions, so it loads when someone launches.
let web3Promise;
export function loadWeb3() {
  if (window.solanaWeb3) return Promise.resolve(window.solanaWeb3);
  web3Promise ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = '/js/vendor/solana-web3.min.js';
    s.onload = () => (window.solanaWeb3 ? resolve(window.solanaWeb3) : reject(new Error('Could not load the Solana library.')));
    s.onerror = () => { web3Promise = null; reject(new Error('Could not load the Solana library. Check your connection.')); };
    document.head.appendChild(s);
  });
  return web3Promise;
}

export const shortAddress = (a) => (a ? `${a.slice(0, 4)}…${a.slice(-4)}` : '');
