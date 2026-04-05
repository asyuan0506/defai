import { createAdminSupabase } from "./supabase";

/**
 * Verify a Supabase access_token issued by signInWithWeb3.
 * The wallet address is stored in the user's Web3 identity (identity_data.sub).
 */
export async function verifyToken(token: string): Promise<{ walletAddress: string } | null> {
  try {
    const supabase = createAdminSupabase();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;

    // Web3 identity: identity_data.sub holds the wallet address
    const web3Identity = user.identities?.find((i) => i.provider === "web3");
    const rawAddress =
      (web3Identity?.identity_data?.sub as string | undefined) ??
      (user.user_metadata?.wallet_address as string | undefined);

    // Supabase stores Solana addresses as "web3:solana:BASE58ADDRESS" — strip the prefix
    const walletAddress = rawAddress?.includes(":")
      ? rawAddress.split(":").pop()
      : rawAddress;

    if (!walletAddress) return null;
    return { walletAddress };
  } catch {
    return null;
  }
}
