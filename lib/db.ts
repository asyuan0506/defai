/**
 * Database layer — backed by Supabase Postgres.
 * All functions are async. Only use server-side (API routes).
 */
import { createAdminSupabase } from "./supabase";

export const db = {
  async getBalance(wallet: string): Promise<bigint> {
    const supabase = createAdminSupabase();
    const { data } = await supabase
      .from("balances")
      .select("lst_lamports")
      .eq("wallet_address", wallet)
      .maybeSingle();
    return BigInt(data?.lst_lamports ?? 0);
  },

  async addBalance(wallet: string, lstLamports: bigint): Promise<void> {
    const supabase = createAdminSupabase();
    const { error } = await supabase.rpc("add_balance", {
      p_wallet: wallet,
      p_amount: lstLamports.toString(),
    });
    if (error) throw new Error(`addBalance failed: ${error.message}`);
  },

  async hasProcessed(signature: string): Promise<boolean> {
    const supabase = createAdminSupabase();
    const { data } = await supabase
      .from("processed_signatures")
      .select("signature")
      .eq("signature", signature)
      .maybeSingle();
    return !!data;
  },

  async deductBalance(wallet: string, lstLamports: bigint): Promise<boolean> {
    const supabase = createAdminSupabase();
    const { data, error } = await supabase.rpc("deduct_balance", {
      p_wallet: wallet,
      p_amount: lstLamports.toString(),
    });
    if (error) throw new Error(`deductBalance failed: ${error.message}`);
    return data as boolean;
  },

  /**
   * Atomically claim a signature for processing. Returns true if this caller
   * won the race (row inserted), false if the signature was already marked
   * by another in-flight or prior request. Caller MUST abort the credit flow
   * when this returns false — otherwise the same deposit can be credited twice.
   */
  async markProcessed(signature: string, wallet: string): Promise<boolean> {
    const supabase = createAdminSupabase();
    const { error } = await supabase
      .from("processed_signatures")
      .insert({ signature, wallet_address: wallet });
    if (!error) return true;
    if (error.code === "23505") return false; // Key constraint violation (Duplicate key)
    throw new Error(`markProcessed failed: ${error.message}`);
  },

  async unmarkProcessed(signature: string): Promise<void> {
    const supabase = createAdminSupabase();
    await supabase.from("processed_signatures").delete().eq("signature", signature);
  },

  /**
   * Insert a new withdrawal row in 'pending' state. Returns { created: true }
   * if this caller won the (wallet, request_id) UNIQUE race; { created: false,
   * existing } if a prior request already claimed it. Caller MUST treat
   * created=false as "look up prior result and respond accordingly".
   */
  async createWithdrawalRequest(
    wallet: string,
    requestId: string,
    lstLamports: bigint,
    feeLamports: bigint
  ): Promise<{ created: true; id: string } | { created: false; existing: WithdrawalRow }> {
    const supabase = createAdminSupabase();
    const { data, error } = await supabase
      .from("withdrawals")
      .insert({
        request_id: requestId,
        wallet_address: wallet,
        lst_lamports: lstLamports.toString(),
        fee_lamports: feeLamports.toString(),
        status: "pending",
      })
      .select("id")
      .single();

    if (!error && data) return { created: true, id: data.id as string };

    if (error?.code === "23505") {
      const { data: existing, error: lookupErr } = await supabase
        .from("withdrawals")
        .select("*")
        .eq("wallet_address", wallet)
        .eq("request_id", requestId)
        .single();
      if (lookupErr || !existing) {
        throw new Error(`createWithdrawalRequest lookup failed: ${lookupErr?.message ?? "no row"}`);
      }
      return { created: false, existing: existing as WithdrawalRow };
    }

    throw new Error(`createWithdrawalRequest failed: ${error?.message ?? "unknown"}`);
  },

  async updateWithdrawalStatus(
    id: string,
    patch: {
      status: WithdrawalStatus;
      transfer_sig?: string;
      mocked?: boolean;
      error?: string;
    }
  ): Promise<void> {
    const supabase = createAdminSupabase();
    const { error } = await supabase
      .from("withdrawals")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(`updateWithdrawalStatus failed: ${error.message}`);
  },
};

export type WithdrawalStatus =
  | "pending"
  | "insufficient"
  | "reverted"
  | "pending_confirm"
  | "needs_reconcile"
  | "done";

export interface WithdrawalRow {
  id: string;
  request_id: string;
  wallet_address: string;
  lst_lamports: string;
  fee_lamports: string;
  transfer_sig: string | null;
  status: WithdrawalStatus;
  mocked: boolean;
  error: string | null;
  created_at: string;
  updated_at: string;
}
