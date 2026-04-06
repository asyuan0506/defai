"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { deriveKeyFromSignature } from "@/lib/crypto";
import { Wallet, LogOut, Loader2, ShieldCheck } from "lucide-react";
import { useState, useRef } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

type Step = "idle" | "signing-auth" | "signing-enc" | "done";

export function WalletAuthButton() {
  const wallet = useWallet();
  const { connected, publicKey, signMessage, disconnect } = wallet;
  const { setVisible } = useWalletModal();
  const { isAuthenticated, setAuth, setEncryptionKey, clearAuth } = useAuthStore();

  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [captchaReady, setCaptchaReady] = useState(false);

  const turnstileRef = useRef<TurnstileInstance>(null);
  const turnstileTokenRef = useRef<string | null>(null);

  const isLoading = step !== "idle" && step !== "done";
  const isCaptchaPending = !captchaReady && !isLoading;

  const resetTurnstile = () => {
    turnstileTokenRef.current = null;
    setCaptchaReady(false);
    turnstileRef.current?.reset();
  };

  const handleAuth = async () => {
    if (!connected || !publicKey || !signMessage) {
      setVisible(true);
      return;
    }

    setError(null);
    const walletAddress = publicKey.toString();

    try {
      const captchaToken = turnstileTokenRef.current;
      if (!captchaToken) throw new Error("CAPTCHA 尚未完成，請稍候再試");

      // 1. Wallet popup #1 — Supabase SIWS (Sign-In-With-Solana) flow
      setStep("signing-auth");
      // Adapter: Supabase expects (...inputs) => Promise<Output | Output[]>
      // but wallet-adapter provides (input?) => Promise<Output>. Cast via unknown.
      const walletAdapter = wallet.signIn
        ? {
            ...wallet,
            signIn: (...inputs: unknown[]) =>
              wallet.signIn!(inputs[0] as Parameters<typeof wallet.signIn>[0]) as Promise<unknown>,
          }
        : wallet;
      const { data, error: signInError } = await supabase.auth.signInWithWeb3({
        chain: "solana",
        statement: "Login DeFai",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        wallet: walletAdapter as any,
        options: { captchaToken },
      });

      // Token is single-use — reset immediately after use
      resetTurnstile();

      if (signInError || !data.session) {
        throw new Error(signInError?.message ?? "Supabase 登入失敗");
      }

      // 2. Wallet popup #2 — sign fixed message to derive encryption key
      //    This key is deterministic per wallet — same wallet, same key, forever.
      setStep("signing-enc");
      const encMessage = new TextEncoder().encode(
        `DeFai Chat Encryption\nWallet: ${walletAddress}`
      );
      const encSigBytes = await signMessage(encMessage);
      const encryptionKey = await deriveKeyFromSignature(encSigBytes);

      const { access_token, refresh_token } = data.session;
      setAuth(access_token, refresh_token, walletAddress);
      setEncryptionKey(encryptionKey);
      setStep("done");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "發生錯誤，請重試";
      setError(msg);
      resetTurnstile();
      setStep("idle");
    }
  };

  const handleDisconnect = async () => {
    await supabase.auth.signOut();
    disconnect();
    clearAuth();
    setStep("idle");
    setError(null);
  };

  if (isAuthenticated) {
    return (
      <button
        onClick={handleDisconnect}
        className="flex items-center justify-center gap-2 w-full rounded-xl border border-slate-700/60 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 hover:text-white px-4 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer"
      >
        <LogOut className="h-4 w-4" />
        登出錢包
      </button>
    );
  }

  const stepLabel: Record<Step, string> = {
    idle: connected ? "簽名登入" : "連接錢包",
    "signing-auth": "1/2 簽署登入…",
    "signing-enc": "2/2 簽署加密金鑰…",
    done: "完成",
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-center">
        <Turnstile
          ref={turnstileRef}
          siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "1x00000000000000000000AA"}
          onSuccess={(token: string) => { turnstileTokenRef.current = token; setCaptchaReady(true); }}
          onExpire={resetTurnstile}
          onError={resetTurnstile}
          options={{ theme: "dark", size: "normal", refreshExpired: "auto" }}
        />
      </div>

      <button
        onClick={handleAuth}
        disabled={isLoading || isCaptchaPending}
        aria-busy={isLoading}
        className="flex items-center justify-center gap-2 w-full rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-900 font-semibold px-4 py-2.5 text-sm transition-all duration-200 cursor-pointer glow-gold"
      >
        {isLoading || isCaptchaPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : connected ? (
          <ShieldCheck className="h-4 w-4" />
        ) : (
          <Wallet className="h-4 w-4" />
        )}
        {isCaptchaPending ? "CAPTCHA 驗證中…" : stepLabel[step]}
      </button>

      {error && (
        <p role="alert" className="text-xs text-red-400 text-center rounded-lg bg-red-400/5 border border-red-400/10 px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
