import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { MODEL_CATALOG, DEFAULT_MODEL } from "@/lib/models";
import { getJitoSOLPrice, usdToLamports } from "@/lib/price";
import { db } from "@/lib/db";

const IO_NET_BASE = process.env.IO_NET_BASE;

/** Per-request pre-deduct ceiling, in tokens. Both input and output are
 *  reserved at this amount; the refund path returns the unused portion once
 *  io.net reports the real usage. 1M is well above any realistic single-turn
 *  consumption, so the refund will almost always cover most of the pre-deduct. */
const PREDEDUCT_CEILING_TOKENS = 1_000_000;

/** Fallback charge when usage is missing (client cancel, network error, no
 *  final SSE chunk). Equivalent to ~one short paragraph of output at the
 *  model's outputPricePerToken — small but non-zero so cancelling mid-stream
 *  isn't a free-chat exploit. */
const FALLBACK_OUTPUT_TOKENS = 512;

export async function POST(req: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userOrNull = await verifyToken(authHeader.slice(7));
  if (!userOrNull) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
  const user = userOrNull; // non-null binding — survives closure capture

  const { messages, model: requestedModel } = await req.json();
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "Invalid messages" }, { status: 400 });
  }

  const modelId: string = requestedModel ?? DEFAULT_MODEL;
  const modelInfo = MODEL_CATALOG[modelId];
  if (!modelInfo) {
    return NextResponse.json({ error: `Unknown model: ${modelId}` }, { status: 400 });
  }

  const apiKey = process.env.IO_NET_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing IO_NET_KEY" }, { status: 500 });
  }

  // ── Pre-deduct billing ────────────────────────────────────────────────
  // Reserve the per-model worst-case ceiling (1M input + 1M output tokens).
  // The deduct_balance RPC takes a row lock, so concurrent requests serialize
  // and can't collectively overdraw. The number of in-flight chats a single
  // user can sustain is therefore `floor(balance / (1M+1M-token-cost))` — a
  // hard cap that prevents the "spawn N parallel chats" exploit.
  // The same jitoSOLPrice is reused for the post-settle refund to avoid price
  // fluctuation creating inconsistencies within a single request.
  let jitoSOLPrice: number;
  try {
    jitoSOLPrice = await getJitoSOLPrice();
  } catch (e: any) {
    return NextResponse.json({ error: `Price fetch failed: ${e?.message}` }, { status: 503 });
  }

  const maxCostUSD =
    PREDEDUCT_CEILING_TOKENS * modelInfo.inputPricePerToken +
    PREDEDUCT_CEILING_TOKENS * modelInfo.outputPricePerToken;
  const maxCostLamports = usdToLamports(maxCostUSD, jitoSOLPrice);

  const sufficient = await db.deductBalance(user.walletAddress, maxCostLamports);
  if (!sufficient) {
    return NextResponse.json({ error: "Insufficient balance" }, { status: 402 });
  }

  // ── Call io.net ───────────────────────────────────────────────────────
  let upstream: Response;
  try {
    upstream = await fetch(`${IO_NET_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        stream: true,
        stream_options: { include_usage: true }, // ask for token usage in final chunk
        messages: [
          ...messages.map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          })),
        ],
      }),
    });
  } catch (e: any) {
    // Network error before any data received — full refund
    await db.addBalance(user.walletAddress, maxCostLamports).catch(console.error);
    return NextResponse.json({ error: `io.net unreachable: ${e?.message}` }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    await db.addBalance(user.walletAddress, maxCostLamports).catch(console.error);
    const errText = await upstream.text().catch(() => "unknown");
    return NextResponse.json(
      { error: `io.net error ${upstream.status}: ${errText}` },
      { status: upstream.status }
    );
  }

  // ── Transform + stream ────────────────────────────────────────────────
  const encoder = new TextEncoder();
  const upstreamReader = upstream.body.getReader();
  const decoder = new TextDecoder();

  // Captured from the final SSE chunk when stream_options.include_usage is honoured
  let usageCapture: { prompt_tokens: number; completion_tokens: number } | null = null;
  let settled = false;

  /**
   * Run exactly once per request — both `finally` (normal end / upstream error)
   * and `cancel()` (client disconnect) call this. The `settled` flag guards
   * against double-refund if both paths fire.
   */
  function settle(streamErrored: boolean) {
    if (settled) return;
    settled = true;

    if (streamErrored || !usageCapture) {
      // No reliable usage (client cancel, upstream error, missing final chunk).
      // Don't refund everything — otherwise cancelling mid-stream after reading
      // some output would be free. Charge a flat fallback minimum equivalent
      // to FALLBACK_OUTPUT_TOKENS at the model's outputPrice.
      const fallbackCostUSD = FALLBACK_OUTPUT_TOKENS * modelInfo.outputPricePerToken;
      const rawFallbackLamports = usdToLamports(fallbackCostUSD, jitoSOLPrice);
      const fallbackLamports =
        rawFallbackLamports > maxCostLamports ? maxCostLamports : rawFallbackLamports;
      const refund = maxCostLamports - fallbackLamports;
      if (refund > 0n) {
        db.addBalance(user.walletAddress, refund).catch(console.error);
      }
      return;
    }

    // Sanity: io.net should always report >0 tokens on a successful stream.
    // Treat 0/0 as suspicious and refund the full pre-deduct rather than
    // letting the user pay nothing.
    const totalTokens = usageCapture.prompt_tokens + usageCapture.completion_tokens;
    if (totalTokens <= 0) {
      db.addBalance(user.walletAddress, maxCostLamports).catch(console.error);
      return;
    }

    const actualCostUSD =
      usageCapture.prompt_tokens * modelInfo.inputPricePerToken +
      usageCapture.completion_tokens * modelInfo.outputPricePerToken;
    const rawLamports = usdToLamports(actualCostUSD, jitoSOLPrice);

    // Clamp the bill to the pre-deducted ceiling. Without this clamp, a
    // bogus / inflated `usage` from upstream would silently overcharge —
    // but we already debited maxCostLamports, so the user's worst case
    // must be exactly that, never more.
    const actualLamports = rawLamports > maxCostLamports ? maxCostLamports : rawLamports;
    const refund = maxCostLamports - actualLamports;
    if (refund > 0n) {
      db.addBalance(user.walletAddress, refund).catch(console.error);
    }
  }

  const readable = new ReadableStream({
    async start(controller) {
      let buffer = "";
      let streamErrored = false;

      try {
        outer: while (true) {
          const { done, value } = await upstreamReader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();

            if (raw === "[DONE]") {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              break outer;
            }

            try {
              const json = JSON.parse(raw);
              if (json.usage) usageCapture = json.usage;
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
              }
            } catch {
              // skip malformed chunks
            }
          }
        }
      } catch {
        streamErrored = true;
      } finally {
        try { controller.close(); } catch { /* already closed */ }
        settle(streamErrored);
      }
    },
    cancel() {
      upstreamReader.cancel();
      // Client disconnected mid-stream — refund whatever wasn't already settled.
      // Without this, a fast disconnect (before `start` reaches `finally`)
      // would leave the pre-deduct un-refunded.
      settle(true);
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
