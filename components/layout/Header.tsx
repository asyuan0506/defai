"use client";

import { WalletAuthButton } from "@/components/wallet/WalletAuthButton";
import { Sparkles } from "lucide-react";

export function Header() {
  return (
    <header className="flex items-center justify-between px-6 h-14 border-b border-[#1E3A5F]/40 bg-[#0D1626]/80 backdrop-blur-sm shrink-0">
      <div className="flex items-center gap-2 text-slate-400">
        <Sparkles className="h-3.5 w-3.5 text-violet-400" />
        <span className="text-sm">Claude AI 聊天助理</span>
      </div>
      <div className="w-36">
        <WalletAuthButton />
      </div>
    </header>
  );
}
