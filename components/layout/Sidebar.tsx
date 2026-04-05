"use client";

import { useEffect, useState } from "react";
import { useChatStore } from "@/store/chat";
import { useAuthStore } from "@/store/auth";
import { useBalanceStore, formatLst } from "@/store/balance";
import {
  MessageSquarePlus, Trash2, MessageSquare,
  ArrowDownToLine, TrendingUp, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DepositModal } from "@/components/wallet/DepositModal";

export function Sidebar() {
  const {
    conversations, activeConversationId, isLoadingConversations,
    createConversation, setActiveConversation, deleteConversation, loadConversations,
  } = useChatStore();
  const { walletAddress, token } = useAuthStore();
  const { lstLamports, lstSymbol, isLoading: balanceLoading, fetchBalance } = useBalanceStore();
  const [showDeposit, setShowDeposit] = useState(false);

  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}`
    : null;

  useEffect(() => {
    if (token) {
      fetchBalance(token);
      loadConversations(token);
    }
  }, [token, fetchBalance, loadConversations]);

  const handleCreate = () => {
    createConversation();
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!token) return;
    await deleteConversation(token, id);
  };

  return (
    <>
      <aside className="flex flex-col w-64 shrink-0 h-full bg-[#0D1626] border-r border-[#1E3A5F]/50">
        {/* Brand header */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-[#1E3A5F]/40">
          <span className="font-display font-bold text-xl tracking-tight text-white">
            De<span className="text-gradient-gold">LLM</span>
          </span>
          {shortAddress && (
            <span className="font-mono text-[10px] text-slate-500 bg-slate-800/60 border border-slate-700/40 rounded-full px-2 py-0.5">
              {shortAddress}
            </span>
          )}
        </div>

        {/* Balance card */}
        <div className="mx-3 mt-4">
          <div className="rounded-xl border border-amber-400/15 bg-amber-500/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-xs text-slate-400 font-medium">帳戶餘額</span>
              </div>
              <span className="text-[10px] text-amber-400/50 font-mono">JitoSOL</span>
            </div>

            <p className="font-mono font-semibold text-white text-base truncate mb-3">
              {balanceLoading ? (
                <span className="text-slate-600 text-sm animate-pulse">載入中…</span>
              ) : (
                formatLst(lstLamports, lstSymbol)
              )}
            </p>

            <button
              onClick={() => setShowDeposit(true)}
              className="flex items-center justify-center gap-1.5 w-full rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-xs px-3 py-2 transition-all duration-200 cursor-pointer glow-gold"
            >
              <ArrowDownToLine className="h-3.5 w-3.5" />
              儲值
            </button>
          </div>
        </div>

        {/* New chat button */}
        <div className="px-3 py-3">
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 w-full rounded-lg border border-slate-700/50 bg-slate-800/30 hover:bg-slate-700/40 text-slate-300 hover:text-white px-3 py-2 text-sm font-medium transition-all duration-200 cursor-pointer"
          >
            <MessageSquarePlus className="h-4 w-4" />
            新對話
          </button>
        </div>

        {/* Conversations list */}
        <nav className="flex-1 overflow-y-auto px-2 space-y-0.5 pb-4">
          {isLoadingConversations ? (
            <div className="flex items-center justify-center mt-6 gap-2 text-slate-600">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="text-xs">載入對話…</span>
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-xs text-slate-600 text-center mt-4 px-3">尚無對話記錄</p>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  "group flex items-center gap-2 rounded-lg px-3 py-2.5 cursor-pointer text-sm transition-all duration-150",
                  conv.id === activeConversationId
                    ? "bg-violet-500/10 border border-violet-500/20 text-violet-300"
                    : "hover:bg-slate-800/40 text-slate-400 hover:text-slate-200 border border-transparent"
                )}
                onClick={() => setActiveConversation(conv.id)}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
                <span className="flex-1 truncate text-xs">{conv.title}</span>
                <button
                  onClick={(e) => handleDelete(e, conv.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:text-red-400 cursor-pointer"
                  aria-label="刪除對話"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))
          )}
        </nav>
      </aside>

      {showDeposit && <DepositModal onClose={() => setShowDeposit(false)} />}
    </>
  );
}
