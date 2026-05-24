/**
 * Single source of truth for which Solana cluster the app runs on.
 *
 * NEXT_PUBLIC_SOLANA_NETWORK is the only place network is configured.
 * UI labels, RPC URL default, and Jupiter mock-vs-real all derive from it.
 *
 * RPC URLs are split into two:
 *   - SOLANA_RPC_URL         (server-only)  — picks SOLANA_RPC_URL first (e.g. Helius
 *                                       with API key). Never bundled into client.
 *   - NEXT_PUBLIC_SOLANA_RPC_URL  (browser-safe) — only ever reads NEXT_PUBLIC_SOLANA_RPC_URL.
 *                                       Use a public endpoint or a key with
 *                                       referrer/origin restrictions here.
 */

type Cluster = "mainnet-beta" | "devnet" | "testnet";

const RAW = (process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "mainnet-beta") as Cluster;

if (RAW !== "mainnet-beta" && RAW !== "devnet" && RAW !== "testnet") {
  throw new Error(
    `Invalid NEXT_PUBLIC_SOLANA_NETWORK: "${RAW}" (expected mainnet-beta | devnet | testnet)`
  );
}

export const NETWORK: Cluster = RAW;
export const IS_MAINNET = NETWORK === "mainnet-beta";

export const NETWORK_LABEL =
  NETWORK === "mainnet-beta" ? "Mainnet" : NETWORK === "devnet" ? "Devnet" : "Testnet";

// On the client bundle, Next.js replaces `process.env.SOLANA_RPC_URL` with
// `undefined` (only NEXT_PUBLIC_* vars are inlined into client JS), so the
// Helius key never reaches the browser even though this module is shared.
const SERVER_RPC = process.env.SOLANA_RPC_URL;
const PUBLIC_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
const FALLBACK_RPC = `https://api.${NETWORK}.solana.com`;

export const RPC_URL = SERVER_RPC ?? PUBLIC_RPC ?? FALLBACK_RPC;
export const PUBLIC_RPC_URL = PUBLIC_RPC ?? FALLBACK_RPC;
