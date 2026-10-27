// Server configuration. Everything can be overridden with environment variables in Vercel.
export const FRONGUS_MINT = process.env.FRONGUS_MINT || '2BJDwUdMbnJhRRfhacFDjrDNhxUWdzE9H6LEND89pump';

// RPC endpoint (Helius, QuickNode, Triton...). The public mainnet endpoint rate-limits hard
// and blocks sendTransaction, so set this in production.
export const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

// pump.fun's address lookup table: keeps create + first buy inside one transaction.
export const PUMP_LOOKUP_TABLE = process.env.PUMP_LOOKUP_TABLE || 'Hyif6eWb8x88RVrvjPfabsgRYnwkVnyByEXTVTXbUcyP';

// Priority fee in micro-lamports per compute unit (150k ~ 0.00008 SOL for a launch).
export const PRIORITY_FEE_MICROLAMPORTS = Number(process.env.PRIORITY_FEE_MICROLAMPORTS || 150000);

// Optional: Pinata JWT, used to host the image + metadata if pump.fun's upload endpoint fails.
export const PINATA_JWT = process.env.PINATA_JWT || '';
export const IPFS_GATEWAY = (process.env.IPFS_GATEWAY || 'https://ipfs.io/ipfs/').replace(/\/?$/, '/');

// Public site URL used as the default "website" link on launched coins.
export const SITE_URL = process.env.SITE_URL || '';

// Largest first buy accepted, in FRONGUS (protects people from typos like 1000000 instead of 1000).
export const MAX_DEV_BUY = Number(process.env.MAX_DEV_BUY || 50_000_000);
