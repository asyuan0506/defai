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

  async markProcessed(signature: string, wallet: string): Promise<void> {
    const supabase = createAdminSupabase();
    const { error } = await supabase
      .from("processed_signatures")
      .insert({ signature, wallet_address: wallet });
    if (error && error.code !== "23505") {
      // 23505 = unique_violation — already processed, that's fine
      throw new Error(`markProcessed failed: ${error.message}`);
    }
  },

  async unmarkProcessed(signature: string): Promise<void> {
    const supabase = createAdminSupabase();
    await supabase.from("processed_signatures").delete().eq("signature", signature);
  },
};
