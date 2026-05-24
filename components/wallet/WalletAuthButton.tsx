"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { deriveKeyFromSignature } from "@/lib/crypto";
import { saveEncryptionKey, clearEncryptionKey } from "@/lib/encryption-key-store";
import { Wallet, LogOut, ShieldCheck, Plug } from "lucide-react";
import { useState, useRef } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!turnstileSiteKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_TURNSTILE_SITE_KEY env var — refusing to render with always-pass test key"
    );
  }

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

      setStep("signing-auth");
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

      resetTurnstile();

      if (signInError || !data.session) {
        throw new Error(signInError?.message ?? "Supabase 登入失敗");
      }

      setStep("signing-enc");
      const encMessage = new TextEncoder().encode(
        `DeFai Chat Encryption\nWallet: ${walletAddress}`
      );
      const encSigBytes = await signMessage(encMessage);
      const encryptionKey = await deriveKeyFromSignature(encSigBytes);

      const { access_token, refresh_token } = data.session;
      setAuth(access_token, refresh_token, walletAddress);
      setEncryptionKey(encryptionKey);
      await saveEncryptionKey(encryptionKey);
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
    await clearEncryptionKey();
    clearAuth();
    setStep("idle");
    setError(null);
  };

  if (isAuthenticated && !connected) {
    return (
      <div className="flex gap-1.5">
        <Button
          onClick={() => setVisible(true)}
          variant="secondary"
          className="flex-1"
        >
          <Plug data-icon="inline-start" />
          重新連接
        </Button>
        <Button
          onClick={handleDisconnect}
          variant="outline"
          size="icon"
          title="登出"
          aria-label="登出"
        >
          <LogOut />
        </Button>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <Button onClick={handleDisconnect} variant="outline" className="w-full">
        <LogOut data-icon="inline-start" />
        登出錢包
      </Button>
    );
  }

  const stepLabel: Record<Step, string> = {
    idle: connected ? "簽名登入" : "連接錢包",
    "signing-auth": "1/2 簽署登入…",
    "signing-enc": "2/2 簽署加密金鑰…",
    done: "完成",
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-center">
        <Turnstile
          ref={turnstileRef}
          siteKey={turnstileSiteKey}
          onSuccess={(token: string) => {
            turnstileTokenRef.current = token;
            setCaptchaReady(true);
          }}
          onExpire={resetTurnstile}
          onError={resetTurnstile}
          options={{ theme: "dark", size: "normal", refreshExpired: "auto" }}
        />
      </div>

      <Button
        onClick={handleAuth}
        disabled={isLoading || isCaptchaPending}
        aria-busy={isLoading}
        className="w-full"
        size="lg"
      >
        {isLoading || isCaptchaPending ? (
          <Spinner data-icon="inline-start" />
        ) : connected ? (
          <ShieldCheck data-icon="inline-start" />
        ) : (
          <Wallet data-icon="inline-start" />
        )}
        {isCaptchaPending ? "CAPTCHA 驗證中…" : stepLabel[step]}
      </Button>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
