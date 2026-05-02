/**
 * Single source of truth for which Solana cluster the app runs on.
 *
 * NEXT_PUBLIC_SOLANA_NETWORK is the only place network is configured.
 * UI labels, RPC URL default, and Jupiter mock-vs-real all derive from it.
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

export const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? `https://api.${NETWORK}.solana.com`;
