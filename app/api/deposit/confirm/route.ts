import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { verifyToken } from "@/lib/auth";
import { swapSolToLST } from "@/lib/jupiter";
import { db } from "@/lib/db";

const TREASURY = process.env.NEXT_PUBLIC_TREASURY_WALLET!;
const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const body = await req.json();
  const { signature } = body as { signature?: string };
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  // Reject replays
  if (await db.hasProcessed(signature)) {
    return NextResponse.json({ error: "Transaction already processed" }, { status: 409 });
  }

  const connection = new Connection(RPC_URL, "confirmed");

  const tx = await connection.getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) return NextResponse.json({ error: "Transaction not found or not confirmed yet" }, { status: 404 });
  if (tx.meta?.err) return NextResponse.json({ error: "Transaction failed on-chain" }, { status: 400 });

  const accountKeys = tx.transaction.message.getAccountKeys
    ? tx.transaction.message.getAccountKeys().staticAccountKeys
    : (tx.transaction.message as any).accountKeys as PublicKey[];

  const treasuryIdx = accountKeys.findIndex((k: PublicKey) => k.toBase58() === TREASURY);
  if (treasuryIdx === -1) {
    return NextResponse.json({ error: "Treasury wallet not found in transaction" }, { status: 400 });
  }

  const senderIdx = accountKeys.findIndex((k: PublicKey) => k.toBase58() === auth.walletAddress);
  if (senderIdx === -1) {
    return NextResponse.json({ error: "Sender does not match authenticated wallet" }, { status: 403 });
  }

  const pre = tx.meta!.preBalances[treasuryIdx];
  const post = tx.meta!.postBalances[treasuryIdx];
  const receivedLamports = BigInt(post - pre);

  if (receivedLamports <= 0n) {
    return NextResponse.json({ error: "No SOL received by treasury" }, { status: 400 });
  }

  // Mark before swap to prevent race-condition double-swap
  await db.markProcessed(signature, auth.walletAddress);

  let swapResult;
  try {
    swapResult = await swapSolToLST(receivedLamports);
  } catch (e: any) {
    console.error("Jupiter swap failed:", e);
    // Unmark so the user can retry — safe because the race-condition window
    // closed when markProcessed succeeded above.
    await db.unmarkProcessed(signature);
    return NextResponse.json({ error: `Swap failed: ${e?.message ?? "unknown"}` }, { status: 502 });
  }

  await db.addBalance(auth.walletAddress, swapResult.outputLamports);

  return NextResponse.json({
    success: true,
    depositSignature: signature,
    swapSignature: swapResult.signature,
    receivedSolLamports: receivedLamports.toString(),
    lstLamports: swapResult.outputLamports.toString(),
    mocked: swapResult.mocked,
  });
}
