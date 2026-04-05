import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { LST_SYMBOL } from "@/lib/jupiter";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const balance = await db.getBalance(auth.walletAddress);

  return NextResponse.json({
    wallet: auth.walletAddress,
    lstLamports: balance.toString(),
    lstSymbol: LST_SYMBOL,
  });
}
