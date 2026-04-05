import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/supabase";

function generateId() {
  return crypto.randomUUID();
}

// GET /api/conversations — list all conversations for the authenticated wallet
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, created_at")
    .eq("wallet_address", auth.walletAddress)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversations: data ?? [] });
}

// POST /api/conversations — create a new conversation
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const { title, id: clientId } = (await req.json().catch(() => ({}))) as { title?: string; id?: string };

  const supabase = createAdminSupabase();
  const id = clientId ?? generateId();
  const { data, error } = await supabase
    .from("conversations")
    .insert({ id, wallet_address: auth.walletAddress, title: title ?? "新對話" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversation: data }, { status: 201 });
}

// PATCH /api/conversations — update title
export async function PATCH(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const { id, title } = (await req.json()) as { id: string; title: string };
  if (!id || !title) return NextResponse.json({ error: "Missing id or title" }, { status: 400 });

  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from("conversations")
    .update({ title })
    .eq("id", id)
    .eq("wallet_address", auth.walletAddress);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE /api/conversations?id=<id>
export async function DELETE(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", id)
    .eq("wallet_address", auth.walletAddress);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
