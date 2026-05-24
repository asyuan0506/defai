import { Keypair, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { IS_MAINNET, NETWORK } from "./network";

const BASE = "https://api.jup.ag";

// Wrapped SOL
const SOL_MINT = "So11111111111111111111111111111111111111112";
// JitoSOL (mainnet only)
export const LST_MINT = "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn";
export const LST_SYMBOL = "JitoSOL";

// On devnet/testnet there is no real JitoSOL, so we simulate the swap.
// 1 SOL ≈ 0.78 JitoSOL (approximate exchange rate for simulation).
const MOCK_RATE = 0.78;

export { IS_MAINNET };

async function jupiterFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const apiKey = process.env.JUPITER;
  if (!apiKey) throw new Error("Missing JUPITER env var");

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "x-api-key": apiKey,
      ...init?.headers,
    },
  });

  if (res.status === 429) {
    throw Object.assign(new Error("Jupiter rate limited"), {
      code: "RATE_LIMITED",
      retryAfter: Number(res.headers.get("Retry-After")) || 10,
    });
  }
  if (!res.ok) {
    const raw = await res.text();
    let body: Record<string, unknown> = { message: raw || `HTTP_${res.status}` };
    try { body = raw ? JSON.parse(raw) : body; } catch { /* keep text */ }
    throw Object.assign(new Error(`Jupiter ${res.status}`), body);
  }
  return res.json() as Promise<T>;
}

export interface SwapResult {
  signature: string;
  inputLamports: bigint;
  outputLamports: bigint;
  mocked: boolean;
}

/** Mock swap for devnet/testnet — simulates a SOL→JitoSOL rate without hitting mainnet. */
function mockSwap(lamports: bigint): SwapResult {
  const outputLamports = BigInt(Math.floor(Number(lamports) * MOCK_RATE));
  return {
    signature: `mock_${Date.now()}`,
    inputLamports: lamports,
    outputLamports,
    mocked: true,
  };
}

export async function swapSolToLST(lamports: bigint): Promise<SwapResult> {
  if (!IS_MAINNET) {
    console.log(`[jupiter] Non-mainnet (${NETWORK}): using mock swap`);
    return mockSwap(lamports);
  }

  const treasurySecret = process.env.TREASURY_WALLET_PRIVATE_KEY;
  if (!treasurySecret) throw new Error("Missing TREASURY_WALLET_PRIVATE_KEY env var");

  const treasury = Keypair.fromSecretKey(bs58.decode(treasurySecret));

  // 1. Get order
  // slippageBps caps how far Jupiter is allowed to underdeliver vs the quoted
  // route. 50bps (0.5%) is a sensible default for JitoSOL — a deep-liquidity
  // LST — and bounds the worst-case credit the user can receive on a single
  // deposit. Tighten if you start seeing route rejections; loosen for less
  // liquid pairs.
  const params = new URLSearchParams({
    inputMint: SOL_MINT,
    outputMint: LST_MINT,
    amount: lamports.toString(),
    taker: treasury.publicKey.toBase58(),
    slippageBps: "50",
  });

  const order = await jupiterFetch<{
    transaction: string | null;
    requestId: string;
    error?: string;
  }>(`/swap/v2/order?${params}`);

  if (order.error || !order.transaction) {
    throw new Error(`Jupiter order error: ${order.error ?? "no transaction returned"}`);
  }

  // 2. Sign
  const tx = VersionedTransaction.deserialize(Buffer.from(order.transaction, "base64"));
  tx.sign([treasury]);
  const signedTx = Buffer.from(tx.serialize()).toString("base64");

  // 3. Execute (Jupiter submits the tx; no Connection needed)
  const result = await jupiterFetch<{
    status: string;
    signature: string;
    code: number;
    inputAmountResult?: string;
    outputAmountResult?: string;
    error?: string;
  }>("/swap/v2/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signedTransaction: signedTx, requestId: order.requestId }),
  });

  if (result.status !== "Success") {
    throw Object.assign(new Error(`Swap failed: ${result.error ?? "unknown"}`), {
      code: result.code,
    });
  }

  // Refuse to credit a 0-LST swap to the user's balance — that would mean
  // their SOL was taken but no JitoSOL produced.
  if (!result.outputAmountResult || result.outputAmountResult === "0") {
    throw new Error(
      `Swap returned no output amount (signature: ${result.signature}) — refusing to credit 0 LST`
    );
  }

  return {
    signature: result.signature,
    inputLamports: BigInt(result.inputAmountResult ?? lamports.toString()),
    outputLamports: BigInt(result.outputAmountResult),
    mocked: false,
  };
}
