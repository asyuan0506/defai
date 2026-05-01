"use client";

import { WalletAuthButton } from "@/components/wallet/WalletAuthButton";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Sparkles } from "lucide-react";

export function Header() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card/50 px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-5" />
      <div className="flex items-center gap-2 text-muted-foreground">
        <Sparkles className="size-3.5 text-primary" />
        <span className="text-sm">AI Chatbot</span>
      </div>
      <div className="ml-auto w-40">
        <WalletAuthButton />
      </div>
    </header>
  );
}
