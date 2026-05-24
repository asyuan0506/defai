const JITOSOL_MINT = "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn";
// Short TTL keeps the deducted lamports tightly tied to spot jitoSOL/USD, so
// the platform doesn't eat the loss if jitoSOL drops mid-window. Adds ~150–
// 300ms to most chat requests (Jupiter round-trip), which is dwarfed by the
// inference stream itself.
const CACHE_TTL_MS = 5 * 1000; // 5 seconds

let cache: { usd: number; expiresAt: number } | null = null;

/**
 * Returns the current JitoSOL price in USD.
 * Cached for 5 seconds to avoid hitting Jupiter on every chat request.
 * Server-side only.
 */
export async function getJitoSOLPrice(): Promise<number> {
  if (cache && Date.now() < cache.expiresAt) return cache.usd;

  const apiKey = process.env.JUPITER;
  const res = await fetch(`https://api.jup.ag/price/v3?ids=${JITOSOL_MINT}`, {
    headers: apiKey ? { "x-api-key": apiKey } : {},
    next: { revalidate: 0 }, // disable Next.js fetch cache — we manage TTL ourselves
  });

  if (!res.ok) throw new Error(`Jupiter price API returned ${res.status}`);

  const data = await res.json();
  const price = Number(data?.[JITOSOL_MINT]?.usdPrice);
  if (!price || isNaN(price)) throw new Error("Invalid JitoSOL price response");

  cache = { usd: price, expiresAt: Date.now() + CACHE_TTL_MS };
  return price;
}

/** Convert a USD amount to JitoSOL lamports (1 JitoSOL = 1e9 lamports). */
export function usdToLamports(usd: number, jitoSOLPrice: number): bigint {
  return BigInt(Math.ceil((usd / jitoSOLPrice) * 1e9));
}
