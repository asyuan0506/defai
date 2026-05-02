"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { WalletAuthButton } from "@/components/wallet/WalletAuthButton";
import { useWallet } from "@solana/wallet-adapter-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, Code2, Sparkles } from "lucide-react";
import { NETWORK_LABEL, IS_MAINNET } from "@/lib/network";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { publicKey } = useWallet();

  useEffect(() => {
    if (isAuthenticated) router.replace("/chat");
  }, [isAuthenticated, router]);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-primary-foreground focus:font-medium"
      >
        Skip to main content
      </a>

      <div className="min-h-screen bg-background relative flex flex-col overflow-hidden">
        {/* ── Ambient glow ─────────────────────────────────────────── */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[600px] rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 size-[400px] rounded-full bg-ctp-mauve/5 blur-3xl" />
        </div>

        {/* ── Nav ─────────────────────────────────────────────────── */}
        <nav className="relative z-20 max-w-6xl w-full mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
              <Sparkles aria-hidden="true" className="size-4 text-primary" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-foreground">
              De<span className="text-primary">Fai</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="outline" className="gap-1.5">
              <span
                aria-hidden="true"
                className={`size-1.5 rounded-full pulse-dot ${IS_MAINNET ? "bg-primary" : "bg-ctp-green"}`}
              />
              {NETWORK_LABEL}
            </Badge>
            <Button asChild variant="ghost" size="icon-sm" aria-label="GitHub 原始碼">
              <a href="https://github.com" target="_blank" rel="noopener noreferrer">
                <Code2 aria-hidden="true" />
              </a>
            </Button>
          </div>
        </nav>

        {/* ── Auth ────────────────────────────────────────────────── */}
        <main
          id="main"
          className="relative z-10 flex-1 flex items-center justify-center px-6 py-12"
        >
          <div className="w-full max-w-md">
            <Card className="shadow-xl shadow-primary/5">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/30">
                    <Shield aria-hidden="true" className="size-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">進入 DeFai</CardTitle>
                    <CardDescription>連接你的 Solana 錢包</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {publicKey && (
                  <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2">
                    <span aria-hidden="true" className="size-2 rounded-full bg-ctp-green shrink-0" />
                    <span className="font-mono text-[11px] text-muted-foreground truncate">
                      {publicKey.toString()}
                    </span>
                  </div>
                )}
                <WalletAuthButton />
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </>
  );
}
