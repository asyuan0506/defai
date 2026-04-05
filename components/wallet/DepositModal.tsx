"use client";

import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import {
  SystemProgram,
  PublicKey,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { useAuthStore } from "@/store/auth";
import { useBalanceStore } from "@/store/balance";
import { Loader2, ArrowDownToLine, ExternalLink, X, TrendingUp, Coins } from "lucide-react";

const TREASURY = process.env.NEXT_PUBLIC_TREASURY_WALLET!;

type Status = "idle" | "sending" | "confirming" | "swapping" | "done" | "error";

export function DepositModal({ onClose }: { onClose: () => void }) {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const { token } = useAuthStore();
  const { fetchBalance } = useBalanceStore();

  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [swapSig, setSwapSig] = useState("");

  const isLoading = status === "sending" || status === "confirming" || status === "swapping";

  const handleDeposit = async () => {
    if (!publicKey || !token || !TREASURY) return;
    const sol = parseFloat(amount);
    if (isNaN(sol) || sol <= 0) return;

    setStatus("sending");
    setError("");
    setSwapSig("");

    try {
      const lamports = Math.floor(sol * LAMPORTS_PER_SOL);

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(TREASURY),
          lamports,
        })
      );

      const signature = await sendTransaction(tx, connection);
      setStatus("confirming");

      await connection.confirmTransaction(signature, "confirmed");
      setStatus("swapping");

      const res = await fetch("/api/deposit/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ signature }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Deposit confirmation failed");

      setSwapSig(data.mocked ? "" : (data.swapSignature ?? ""));
      await fetchBalance(token);
      setStatus("done");
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
      setStatus("error");
    }
  };

  const statusLabel: Record<Status, string> = {
    idle: "確認儲值",
    sending: "等待簽名…",
    confirming: "鏈上確認中…",
    swapping: "Jupiter Swap 中…",
    done: "完成",
    error: "重試",
  };

  const quickAmounts = ["0.1", "0.5", "1", "5"];

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="glass-card rounded-2xl p-6 w-full max-w-sm border border-amber-400/15 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-400/10 border border-amber-400/20">
              <ArrowDownToLine className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-white text-base">儲值</h2>
              <p className="text-xs text-slate-500">SOL → JitoSOL via Jupiter</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer p-1"
            aria-label="關閉"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {status === "done" ? (
          /* Success state */
          <div className="text-center py-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400/10 border border-emerald-400/20 mx-auto mb-4">
              <TrendingUp className="h-7 w-7 text-emerald-400" />
            </div>
            <p className="font-display font-semibold text-white text-lg mb-1">儲值成功！</p>
            <p className="text-slate-400 text-sm mb-4">SOL 已 swap 成 JitoSOL 並記入帳戶</p>
            {swapSig && (
              <a
                href={`https://solscan.io/tx/${swapSig}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-amber-400/70 hover:text-amber-400 transition-colors"
              >
                查看 Swap 交易 <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <button
              onClick={onClose}
              className="mt-5 w-full rounded-xl border border-slate-700/50 bg-slate-800/40 hover:bg-slate-700/40 text-slate-300 hover:text-white px-4 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer"
            >
              關閉
            </button>
          </div>
        ) : (
          <>
            {/* Amount input */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-400 mb-2">
                金額 (SOL)
              </label>
              <div className="relative">
                <Coins className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-400/60" />
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.1"
                  disabled={isLoading}
                  className="w-full bg-[#172035] border border-[#1E3A5F]/60 focus:border-amber-400/40 rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-slate-600 focus:outline-none transition-all duration-200 disabled:opacity-50 text-sm font-mono"
                />
              </div>
              {/* Quick amounts */}
              <div className="flex gap-1.5 mt-2">
                {quickAmounts.map((q) => (
                  <button
                    key={q}
                    onClick={() => setAmount(q)}
                    disabled={isLoading}
                    className="flex-1 text-[11px] font-mono rounded-lg border border-slate-700/40 bg-slate-800/30 hover:border-amber-400/30 hover:text-amber-400 text-slate-500 py-1.5 transition-all duration-150 cursor-pointer disabled:opacity-40"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Info */}
            <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 px-3 py-2.5 mb-4 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">協議</span>
                <span className="text-slate-300">Jupiter Swap v2</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">輸出</span>
                <span className="text-amber-400/80">JitoSOL (~0.93x)</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">網路</span>
                <span className="text-emerald-400/80">Devnet (測試)</span>
              </div>
            </div>

            {/* Loading status */}
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-violet-400 mb-3 rounded-lg bg-violet-500/5 border border-violet-500/10 px-3 py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                <span className="text-xs">{statusLabel[status]}</span>
              </div>
            )}

            {/* Error */}
            {status === "error" && error && (
              <p className="text-red-400 text-xs mb-3 rounded-lg bg-red-400/5 border border-red-400/10 px-3 py-2 break-all">
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 rounded-xl border border-slate-700/50 bg-slate-800/40 hover:bg-slate-700/40 disabled:opacity-40 text-slate-400 hover:text-white px-4 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
              >
                取消
              </button>
              <button
                onClick={handleDeposit}
                disabled={!amount || parseFloat(amount) <= 0 || isLoading}
                className="flex-1 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-900 font-semibold px-4 py-2.5 text-sm transition-all duration-200 cursor-pointer glow-gold flex items-center justify-center gap-1.5"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  statusLabel[status]
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
