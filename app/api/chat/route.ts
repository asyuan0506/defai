import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { MODEL_CATALOG, DEFAULT_MODEL } from "@/lib/models";
import { getJitoSOLPrice, usdToLamports } from "@/lib/price";
import { db } from "@/lib/db";

const IO_NET_BASE = process.env.IO_NET_BASE;

/**
 * Token estimator — needed because io.net charges per token but pre-deduct
 * happens before we have a real count. ASCII text averages ~3.5 chars/token,
 * but CJK characters are typically 1–1.5 tokens *each*. A naive `chars / 3.5`
 * underestimates Chinese/Japanese input by 4–5×, letting low-balance users
 * effectively run inference for free.
 */
function estimateTokens(text: string): number {
  let cjk = 0;
  let other = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (
      (code >= 0x3040 && code <= 0x30ff) || // Hiragana, Katakana
      (code >= 0x3400 && code <= 0x4dbf) || // CJK Ext A
      (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified
      (code >= 0xac00 && code <= 0xd7af) || // Hangul syllables
      (code >= 0xf900 && code <= 0xfaff) || // CJK Compatibility
      (code >= 0x20000 && code <= 0x2ffff)  // CJK Ext B–F
    ) {
      cjk++;
    } else {
      other++;
    }
  }
  return Math.ceil(cjk * 1.2 + other / 3.5);
}

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
  // Estimate: input tokens from char count + worst-case output tokens.
  // The same jitoSOLPrice is reused for the post-refund to avoid price
  // fluctuation creating inconsistencies within a single request.
  let jitoSOLPrice: number;
  try {
    jitoSOLPrice = await getJitoSOLPrice();
  } catch (e: any) {
    return NextResponse.json({ error: `Price fetch failed: ${e?.message}` }, { status: 503 });
  }

  const estimatedInputTokens = messages.reduce(
    (acc: number, m: { content: string }) => acc + estimateTokens(m.content ?? ""),
    0
  );
  const maxCostUSD =
    estimatedInputTokens * modelInfo.inputPricePerToken +
    modelInfo.estimatedMaxOutputTokens * modelInfo.outputPricePerToken;
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
          {
            role: "system",
            content:
              "You are Decentralize LLM, a helpful AI assistant on a Web3 platform. Be helpful, concise, and friendly.",
          },
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
      // No reliable usage data — refund the full pre-deduct.
      db.addBalance(user.walletAddress, maxCostLamports).catch(console.error);
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
