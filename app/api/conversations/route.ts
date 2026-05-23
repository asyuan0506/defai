import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/supabase";
import { MODEL_CATALOG } from "@/lib/models";

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
    .select("id, title, model_id, created_at")
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

  const { title, id: clientId, modelId } = (await req.json().catch(() => ({}))) as {
    title?: string;
    id?: string;
    modelId?: string;
  };

  // Validate modelId against the catalog; reject unknown IDs rather than silently
  // falling back to default, so the client and DB stay in sync.
  if (modelId !== undefined && !MODEL_CATALOG[modelId]) {
    return NextResponse.json({ error: `Unknown model: ${modelId}` }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  const id = clientId ?? generateId();
  const insertPayload: Record<string, unknown> = {
    id,
    wallet_address: auth.walletAddress,
    title: title ?? "新對話",
  };
  if (modelId) insertPayload.model_id = modelId;

  const { data, error } = await supabase
    .from("conversations")
    .insert(insertPayload)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversation: data }, { status: 201 });
}

// PATCH /api/conversations — update title and/or modelId
export async function PATCH(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await verifyToken(token);
  if (!auth) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const { id, title, modelId } = (await req.json()) as {
    id: string;
    title?: string;
    modelId?: string;
  };
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  if (title === undefined && modelId === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }
  if (modelId !== undefined && !MODEL_CATALOG[modelId]) {
    return NextResponse.json({ error: `Unknown model: ${modelId}` }, { status: 400 });
  }

  const updatePayload: Record<string, unknown> = {};
  if (title !== undefined) updatePayload.title = title;
  if (modelId !== undefined) updatePayload.model_id = modelId;

  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from("conversations")
    .update(updatePayload)
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
