import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { verifyToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { getJitoSOLPrice, usdToLamports } from "@/lib/price";
import { sendJitoSolToUser, isBroadcastError, TREASURY_SOL_BUFFER } from "@/lib/withdraw";
import { IS_MAINNET, RPC_URL } from "@/lib/network";

const TREASURY = process.env.NEXT_PUBLIC_TREASURY_WALLET!;
const WITHDRAW_FEE_USD = 0.05;
// Sanity upper bound — reject obviously absurd amounts to bound a compromised
// JWT's blast radius. 10_000 SOL worth of JitoSOL at any realistic rate is
// far beyond legitimate user-facing withdrawals.
const MAX_LST_LAMPORTS = BigInt(10_000) * BigInt(LAMPORTS_PER_SOL);
// Dust floor — Jupiter / SPL transfers can fail or accrue silly rounding on
// tiny amounts. 10_000 lamports = 0.00001 JitoSOL.
const MIN_LST_LAMPORTS = BigInt(10_000);

function parsePositiveBigInt(value: unknown): bigint | null {
  if (typeof value !== "string" || value.length === 0) return null;
  try {
    const n = BigInt(value);
    return n > 0n ? n : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const lstLamports = parsePositiveBigInt(body?.lstLamports);
  const requestId = typeof body?.requestId === "string" ? body.requestId.trim() : "";

  if (!lstLamports) {
    return NextResponse.json({ error: "Invalid lstLamports" }, { status: 400 });
  }
  if (!requestId) {
    return NextResponse.json({ error: "Missing requestId" }, { status: 400 });
  }
  if (lstLamports > MAX_LST_LAMPORTS) {
    return NextResponse.json({ error: "Amount exceeds per-request maximum" }, { status: 400 });
  }
  if (lstLamports < MIN_LST_LAMPORTS) {
    return NextResponse.json({ error: "Amount below minimum (0.00001 JitoSOL)" }, { status: 400 });
  }

  // ── 1. Quote the fee in JitoSOL lamports ──────────────────────────────
  let feeLamports: bigint;
  try {
    const price = await getJitoSOLPrice();
    feeLamports = usdToLamports(WITHDRAW_FEE_USD, price);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: `Price quote failed: ${msg}` }, { status: 502 });
  }

  const totalLamports = lstLamports + feeLamports;

  // ── 2. Claim the (wallet, requestId) idempotency slot ─────────────────
  const claim = await db.createWithdrawalRequest(
    auth.walletAddress,
    requestId,
    lstLamports,
    feeLamports
  );

  if (!claim.created) {
    const existing = claim.existing;
    switch (existing.status) {
      case "done":
      case "pending_confirm":
        return NextResponse.json({
          success: true,
          withdrawSignature: existing.transfer_sig,
          lstLamports: existing.lst_lamports,
          feeLamports: existing.fee_lamports,
          mocked: existing.mocked,
          status: existing.status,
          replayed: true,
        });
      case "pending":
      case "needs_reconcile":
        return NextResponse.json(
          { error: "Withdrawal already in progress or pending review", status: existing.status },
          { status: 409 }
        );
      case "insufficient":
      case "reverted":
        return NextResponse.json(
          { error: "Previous attempt failed — please submit a new withdrawal", status: existing.status },
          { status: 400 }
        );
    }
  }

  const id = claim.id;

  // ── 3. Atomically deduct (amount + fee) from user's balance ───────────
  const deducted = await db.deductBalance(auth.walletAddress, totalLamports);
  if (!deducted) {
    await db.updateWithdrawalStatus(id, { status: "insufficient" });
    return NextResponse.json(
      { error: "Insufficient balance (including 0.05 USDT fee)" },
      { status: 400 }
    );
  }

  // ── 4. Pre-flight treasury checks (mainnet only) ──────────────────────
  // On devnet the mock path uses real SOL transfers from treasury, so the
  // SOL float check is also useful there.
  if (TREASURY) {
    try {
      const connection = new Connection(RPC_URL, "confirmed");
      const treasurySolBalance = BigInt(
        await connection.getBalance(new PublicKey(TREASURY), "confirmed")
      );
      if (treasurySolBalance < TREASURY_SOL_BUFFER) {
        await db.addBalance(auth.walletAddress, totalLamports);
        await db.updateWithdrawalStatus(id, {
          status: "reverted",
          error: "Treasury SOL float below buffer",
        });
        return NextResponse.json(
          { error: "Service temporarily unavailable — please retry later" },
          { status: 503 }
        );
      }
    } catch (e: unknown) {
      // Connection failure pre-broadcast — safe to revert.
      await db.addBalance(auth.walletAddress, totalLamports);
      const msg = e instanceof Error ? e.message : "unknown";
      await db.updateWithdrawalStatus(id, {
        status: "reverted",
        error: `Pre-flight failed: ${msg}`,
      });
      return NextResponse.json({ error: `Pre-flight failed: ${msg}` }, { status: 502 });
    }
  }

  // ── 5. Execute the transfer ───────────────────────────────────────────
  try {
    const { signature, mocked } = await sendJitoSolToUser(auth.walletAddress, lstLamports);
    await db.updateWithdrawalStatus(id, {
      status: "done",
      transfer_sig: signature,
      mocked,
    });
    return NextResponse.json({
      success: true,
      withdrawSignature: signature,
      lstLamports: lstLamports.toString(),
      feeLamports: feeLamports.toString(),
      mocked,
      status: "done",
    });
  } catch (e: unknown) {
    if (isBroadcastError(e)) {
      // TX has been broadcast — DO NOT revert the balance (treasury already
      // moved assets, or may yet land). Mark for manual reconcile.
      const msg = e.message ?? "unknown";
      console.error("CRITICAL_WITHDRAW_RECONCILE", {
        id,
        wallet: auth.walletAddress,
        lstLamports: lstLamports.toString(),
        feeLamports: feeLamports.toString(),
        requestId,
        signature: e.signature,
        error: msg,
      });
      // confirmTransaction timeout is the most common shape — still return 200
      // with status pending_confirm so the client can show "TX submitted".
      const isTimeout = /confirm|timeout|timed out|expir/i.test(msg);
      const status = isTimeout ? "pending_confirm" : "needs_reconcile";
      await db.updateWithdrawalStatus(id, {
        status,
        transfer_sig: e.signature,
        error: msg,
      });
      if (isTimeout) {
        return NextResponse.json({
          success: true,
          withdrawSignature: e.signature,
          lstLamports: lstLamports.toString(),
          feeLamports: feeLamports.toString(),
          mocked: !IS_MAINNET,
          status: "pending_confirm",
        });
      }
      return NextResponse.json(
        { error: "Withdrawal encountered an issue — please contact support", status },
        { status: 500 }
      );
    }

    // Pre-broadcast failure — safe to revert.
    const msg = e instanceof Error ? e.message : "unknown";
    await db.addBalance(auth.walletAddress, totalLamports);
    await db.updateWithdrawalStatus(id, {
      status: "reverted",
      error: msg,
    });
    return NextResponse.json({ error: `Withdrawal failed: ${msg}` }, { status: 500 });
  }
}
