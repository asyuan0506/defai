/**
 * Withdrawal helper — server-side transfer of JitoSOL from treasury to user.
 *
 * Mainnet: SPL transfer of LST, creating user's ATA in the same TX if needed.
 * Devnet/testnet: mock — transfer real devnet SOL from treasury using MOCK_RATE
 * reciprocal (since JitoSOL doesn't exist outside mainnet).
 *
 * Errors thrown after broadcasting (sendTransaction has returned) are tagged
 * with { broadcast: true, signature } so the route handler can avoid a
 * double-spend revert.
 */
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
} from "@solana/spl-token";
import bs58 from "bs58";
import { IS_MAINNET, RPC_URL } from "./network";
import { LST_MINT } from "./jupiter";

const MOCK_RATE = 0.78;
const LST_MINT_PUBKEY = new PublicKey(LST_MINT);

// Estimated worst-case treasury SOL needed to satisfy one withdrawal:
// ATA rent (~0.00204 SOL) + base tx fee (5000 lamports) + buffer.
export const TREASURY_SOL_BUFFER = BigInt(Math.ceil(0.003 * LAMPORTS_PER_SOL));

export interface BroadcastError extends Error {
  broadcast: true;
  signature: string;
}

export function isBroadcastError(e: unknown): e is BroadcastError {
  return e instanceof Error && (e as Partial<BroadcastError>).broadcast === true;
}

export interface WithdrawResult {
  signature: string;
  mocked: boolean;
}

function loadTreasury(): Keypair {
  const secret = process.env.TREASURY_WALLET_PRIVATE_KEY;
  if (!secret) throw new Error("Missing TREASURY_WALLET_PRIVATE_KEY env var");
  return Keypair.fromSecretKey(bs58.decode(secret));
}

export async function sendJitoSolToUser(
  wallet: string,
  lstLamports: bigint
): Promise<WithdrawResult> {
  const connection = new Connection(RPC_URL, "confirmed");
  const treasury = loadTreasury();
  const userPubkey = new PublicKey(wallet);

  if (!IS_MAINNET) {
    // Mock path — JitoSOL doesn't exist on devnet/testnet. Treasury sends real
    // SOL equivalent so the user gets *something* observable on-chain.
    const solLamports = BigInt(Math.floor(Number(lstLamports) / MOCK_RATE));
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: treasury.publicKey,
        toPubkey: userPubkey,
        lamports: solLamports,
      })
    );
    const sig = await connection.sendTransaction(tx, [treasury]);
    try {
      await connection.confirmTransaction(sig, "confirmed");
    } catch (e) {
      throw Object.assign(
        e instanceof Error ? e : new Error(String(e)),
        { broadcast: true, signature: sig }
      ) as BroadcastError;
    }
    return { signature: sig, mocked: true };
  }

  // Mainnet path — real SPL transfer of JitoSOL.
  const treasuryAta = getAssociatedTokenAddressSync(LST_MINT_PUBKEY, treasury.publicKey);
  const userAta = getAssociatedTokenAddressSync(LST_MINT_PUBKEY, userPubkey);

  const tx = new Transaction();

  const userAtaInfo = await connection.getAccountInfo(userAta);
  if (!userAtaInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        treasury.publicKey,
        userAta,
        userPubkey,
        LST_MINT_PUBKEY
      )
    );
  }

  tx.add(
    createTransferInstruction(treasuryAta, userAta, treasury.publicKey, lstLamports)
  );

  // sendTransaction can throw before or after broadcast. Anything thrown here
  // is "before broadcast" — safe to revert. Once we have a signature back,
  // mark any subsequent failure as broadcast=true so the caller doesn't
  // re-credit the user (treasury already moved assets on-chain).
  const signature = await connection.sendTransaction(tx, [treasury]);

  try {
    await connection.confirmTransaction(signature, "confirmed");
  } catch (e) {
    throw Object.assign(
      e instanceof Error ? e : new Error(String(e)),
      { broadcast: true, signature }
    ) as BroadcastError;
  }

  return { signature, mocked: false };
}
