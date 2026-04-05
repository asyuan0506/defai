import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/supabase";

function generateId() {
  return crypto.randomUUID();
}

// GET /api/messages?conversationId=<id> — load encrypted messages for a conversation
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const conversationId = req.nextUrl.searchParams.get("conversationId");
  if (!conversationId) return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });

  const supabase = createAdminSupabase();

  // Ensure the conversation belongs to this wallet
  const { data: conv } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("wallet_address", auth.walletAddress)
    .maybeSingle();

  if (!conv) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("messages")
    .select("id, role, ciphertext, iv, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data ?? [] });
}

// POST /api/messages — save an encrypted message pair (user + assistant)
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const { conversationId, messages } = (await req.json()) as {
    conversationId: string;
    messages: Array<{ role: "user" | "assistant"; ciphertext: string; iv: string }>;
  };

  if (!conversationId || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabase = createAdminSupabase();

  // Ownership check
  const { data: conv } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("wallet_address", auth.walletAddress)
    .maybeSingle();

  if (!conv) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  const rows = messages.map((m) => ({
    id: generateId(),
    conversation_id: conversationId,
    role: m.role,
    ciphertext: m.ciphertext,
    iv: m.iv,
  }));

  const { error } = await supabase.from("messages").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, count: rows.length }, { status: 201 });
}
