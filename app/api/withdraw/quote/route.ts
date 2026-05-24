import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getJitoSOLPrice, usdToLamports } from "@/lib/price";

const WITHDRAW_FEE_USD = 0.05;

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  try {
    const jitoSolUsdPrice = await getJitoSOLPrice();
    const feeLamports = usdToLamports(WITHDRAW_FEE_USD, jitoSolUsdPrice);
    return NextResponse.json({
      feeLamports: feeLamports.toString(),
      feeUsd: WITHDRAW_FEE_USD,
      jitoSolUsdPrice,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: `quote failed: ${msg}` }, { status: 502 });
  }
}
