import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { MODEL_CATALOG, DEFAULT_MODEL } from "@/lib/models";
import { getJitoSOLPrice, usdToLamports } from "@/lib/price";
import { db } from "@/lib/db";

const IO_NET_BASE = process.env.IO_NET_BASE;

export async function POST(req: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await verifyToken(authHeader.slice(7));
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

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
    (acc: number, m: { content: string }) => acc + Math.ceil((m.content?.length ?? 0) / 3.5),
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

        // ── Billing settlement (post-refund) ──────────────────────────
        if (streamErrored || !usageCapture) {
          // No reliable usage data — refund the full pre-deduct.
          // A partial response that errored mid-way is not charged.
          db.addBalance(user.walletAddress, maxCostLamports).catch(console.error);
        } else {
          const actualCostUSD =
            usageCapture.prompt_tokens * modelInfo.inputPricePerToken +
            usageCapture.completion_tokens * modelInfo.outputPricePerToken;
          const actualLamports = usdToLamports(actualCostUSD, jitoSOLPrice);
          const refund = maxCostLamports - actualLamports;
          if (refund > 0n) {
            db.addBalance(user.walletAddress, refund).catch(console.error);
          }
        }
      }
    },
    cancel() {
      upstreamReader.cancel();
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
