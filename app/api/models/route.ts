import { NextResponse } from "next/server";
import { MODEL_CATALOG, DEFAULT_MODEL } from "@/lib/models";

// GET /api/models — list available chat models with display info
export async function GET() {
  const models = Object.values(MODEL_CATALOG).map((m) => ({
    id: m.id,
    name: m.name,
    contextWindow: m.contextWindow,
    supportsImages: m.supportsImages,
    // Expose per-million-token prices for display; billing uses per-token internally
    inputPricePerMToken: Math.round(m.inputPricePerToken * 1e6 * 1000) / 1000,
    outputPricePerMToken: Math.round(m.outputPricePerToken * 1e6 * 1000) / 1000,
    isDefault: m.id === DEFAULT_MODEL,
  }));

  return NextResponse.json({ models, default: DEFAULT_MODEL });
}
