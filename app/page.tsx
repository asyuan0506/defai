"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { WalletAuthButton } from "@/components/wallet/WalletAuthButton";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  Zap, TrendingUp, Shield, Coins, Lock, Bot,
  ArrowRight, Code2, Sparkles, Database,
} from "lucide-react";

const features = [
  {
    icon: Coins,
    title: "存入 SOL，賺取質押收益",
    desc: "連接錢包，SOL 自動透過 Jupiter 換成 JitoSOL，享有約 7–9% APY 的 staking 收益，餘額持續增長。",
    color: "text-amber-400",
    bg: "bg-amber-400/10 border-amber-400/20",
    glow: "rgba(245,158,11,0.15)",
  },
  {
    icon: Bot,
    title: "以收益支付 AI 模型費用",
    desc: "用 JitoSOL 餘額直接支付 LLM 推理費用，無需信用卡或法幣。DeFi 收益讓 AI 使用近乎免費。",
    color: "text-violet-400",
    bg: "bg-violet-400/10 border-violet-400/20",
    glow: "rgba(139,92,246,0.15)",
  },
  {
    icon: Lock,
    title: "端對端加密對話",
    desc: "所有聊天訊息在上傳前以 AES-256-GCM 加密，金鑰僅存於你的裝置。伺服器永遠無法讀取對話內容。",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10 border-emerald-400/20",
    glow: "rgba(16,185,129,0.15)",
  },
  {
    icon: Database,
    title: "去中心化身份驗證",
    desc: "以 Solana Ed25519 簽名取代密碼。無需帳號、無需 KYC，錢包即是你的身分。",
    color: "text-sky-400",
    bg: "bg-sky-400/10 border-sky-400/20",
    glow: "rgba(56,189,248,0.15)",
  },
];

const steps = [
  {
    num: "01",
    icon: Coins,
    title: "連接並存入 SOL",
    desc: "連接 Phantom / Backpack 等 Solana 錢包，存入任意數量的 SOL。",
    color: "text-amber-400",
    border: "border-amber-400/20",
  },
  {
    num: "02",
    icon: TrendingUp,
    title: "自動賺取 JitoSOL 收益",
    desc: "Jupiter 自動將 SOL swap 成 JitoSOL，持續累積 7–9% APY staking 收益。",
    color: "text-emerald-400",
    border: "border-emerald-400/20",
  },
  {
    num: "03",
    icon: Zap,
    title: "對話，消耗收益",
    desc: "每次 AI 推理從 JitoSOL 餘額扣款。訊息加密存儲，隱私有保障。",
    color: "text-violet-400",
    border: "border-violet-400/20",
  },
];

const stats = [
  { value: "~8.2%", label: "質押 APY", sub: "JitoSOL" },
  { value: "< 1s", label: "驗證延遲", sub: "Ed25519" },
  { value: "256-bit", label: "加密強度", sub: "AES-GCM" },
  { value: "0", label: "密碼", sub: "純錢包登入" },
];

export default function Home() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { publicKey } = useWallet();

  useEffect(() => {
    if (isAuthenticated) router.replace("/chat");
  }, [isAuthenticated, router]);

  return (
    <div className="min-h-screen bg-[#080E1A] relative overflow-x-hidden">

      {/* ── Ambient background ──────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        {/* Top center glow */}
        <div className="absolute -top-60 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-amber-500/6 blur-3xl" />
        {/* Left purple */}
        <div className="absolute top-1/3 -left-48 w-[600px] h-[600px] rounded-full bg-violet-600/5 blur-3xl" />
        {/* Bottom right */}
        <div className="absolute -bottom-20 right-0 w-[500px] h-[500px] rounded-full bg-amber-500/4 blur-3xl" />
        {/* Grid dots overlay */}
        <div className="absolute inset-0 grid-dots opacity-40" />
      </div>

      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav className="relative z-20 max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-400/30 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-amber-400" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-white">
            De<span className="text-gradient-gold">LLM</span>
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-400 border border-slate-700/60 rounded-full px-3 py-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
            Devnet
          </div>
          <a
            href="https://github.com"
            aria-label="GitHub"
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            <Code2 className="h-5 w-5" />
          </a>
        </div>
      </nav>

      <div className="relative z-10 max-w-6xl mx-auto px-6">

        {/* ── Hero ────────────────────────────────────────────────── */}
        <section className="pt-16 pb-24 flex flex-col lg:flex-row items-center gap-16">

          {/* Left: copy */}
          <div className="flex-1 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-amber-400/20 bg-amber-400/5 text-amber-400 text-xs font-medium mb-8">
              <Shield className="h-3.5 w-3.5" />
              Solana · Ed25519 驗證 · 端對端加密
            </div>

            <h1 className="font-display font-bold text-5xl md:text-6xl lg:text-7xl leading-[1.05] tracking-tight mb-6">
              <span className="text-white">Stake.</span>{" "}
              <span className="text-white">Earn.</span>{" "}
              <br />
              <span className="text-gradient-hero">Chat Privately.</span>
            </h1>

            <p className="text-slate-400 text-lg leading-relaxed max-w-lg mb-8 mx-auto lg:mx-0">
              存入 SOL，透過 JitoSOL 賺取質押收益，再以收益支付
              AI 對話費用。所有訊息以 AES-256-GCM 加密後才存入資料庫。
            </p>

            {/* Mini stats row */}
            <div className="flex flex-wrap gap-3 justify-center lg:justify-start mb-10">
              {stats.map(({ value, label, sub }) => (
                <div
                  key={label}
                  className="glass-card rounded-xl px-4 py-3 text-center min-w-[90px]"
                >
                  <p className="font-display font-bold text-white text-base leading-none mb-0.5">
                    {value}
                  </p>
                  <p className="text-[10px] text-slate-500">{label}</p>
                  <p className="text-[10px] text-amber-400/60 font-mono">{sub}</p>
                </div>
              ))}
            </div>

            <a href="#how-it-works" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
              了解運作原理
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          {/* Right: auth card */}
          <div className="w-full max-w-sm lg:max-w-[360px] flex-shrink-0">
            <div className="glass-card-bright rounded-2xl p-7 border border-slate-700/40 shadow-[0_0_60px_rgba(139,92,246,0.08)]">
              {/* Card header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-400/20 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-violet-400" />
                </div>
                <div>
                  <p className="font-display font-semibold text-white text-sm">進入 DeLLM</p>
                  <p className="text-xs text-slate-500">連接你的 Solana 錢包</p>
                </div>
              </div>

              {/* Wallet address display */}
              {publicKey && (
                <div className="flex items-center gap-2 bg-slate-800/50 border border-slate-700/40 rounded-lg px-3 py-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  <span className="font-mono text-[11px] text-slate-400 truncate">
                    {publicKey.toString()}
                  </span>
                </div>
              )}

              <WalletAuthButton />

              {/* Security notes */}
              <div className="mt-5 space-y-2">
                {[
                  { icon: Shield, text: "Ed25519 簽名驗證，無需密碼" },
                  { icon: Lock,   text: "聊天內容端對端加密 (AES-256-GCM)" },
                  { icon: Zap,    text: "Cloudflare Turnstile 防機器人保護" },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-2 text-xs text-slate-500">
                    <Icon className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                    {text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Features grid ─────────────────────────────────────── */}
        <section className="pb-24">
          <div className="text-center mb-12">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-widest mb-3">
              核心功能
            </p>
            <h2 className="font-display font-bold text-3xl text-white">
              DeFi × AI × 隱私
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map(({ icon: Icon, title, desc, color, bg, glow }) => (
              <div
                key={title}
                className={`glass-card rounded-2xl p-6 border ${bg} transition-all duration-300 hover:shadow-[0_0_32px_var(--feature-glow)]`}
                style={{ "--feature-glow": glow } as React.CSSProperties}
              >
                <div className={`feature-icon ${bg} mb-4`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <h3 className="font-display font-semibold text-white text-sm mb-2">{title}</h3>
                <p className="text-slate-400 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────── */}
        <section id="how-it-works" className="pb-24">
          <div className="text-center mb-12">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-widest mb-3">
              How it works
            </p>
            <h2 className="font-display font-bold text-3xl text-white">
              三步驟開始
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 relative">
            {/* Connecting line (desktop) */}
            <div className="hidden md:block absolute top-8 left-[calc(33.33%+1rem)] right-[calc(33.33%+1rem)] h-px bg-gradient-to-r from-amber-400/20 via-emerald-400/20 to-violet-400/20" />

            {steps.map(({ num, icon: Icon, title, desc, color, border }) => (
              <div key={num} className="relative">
                <div className={`glass-card rounded-2xl p-7 border ${border} h-full`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-xl bg-slate-800/60 border ${border} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`h-5 w-5 ${color}`} />
                    </div>
                    <span className={`font-mono text-xs font-bold ${color} opacity-50`}>{num}</span>
                  </div>
                  <h3 className="font-display font-semibold text-white text-base mb-2">{title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Security section ──────────────────────────────────── */}
        <section className="pb-24">
          <div className="glass-card rounded-2xl p-8 border border-emerald-400/10 bg-emerald-500/3">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex-shrink-0 float-slow">
                <div className="w-20 h-20 rounded-2xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center">
                  <Lock className="h-10 w-10 text-emerald-400" />
                </div>
              </div>
              <div className="flex-1 text-center md:text-left">
                <h2 className="font-display font-bold text-2xl text-white mb-3">
                  你的對話，只有你能讀
                </h2>
                <p className="text-slate-400 text-sm leading-relaxed mb-4 max-w-2xl">
                  登入時你的錢包會簽署一段固定訊息，我們用這個簽名透過 HKDF 推導出一把 AES-256-GCM 金鑰，
                  僅存在你的瀏覽器記憶體中。每則訊息在傳送前都以隨機 IV 加密，
                  伺服器資料庫只儲存密文——即使資料庫外洩，也無法讀取任何對話內容。
                </p>
                <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                  {["AES-256-GCM", "HKDF-SHA-256", "隨機 IV", "金鑰不離裝置"].map((tag) => (
                    <span
                      key={tag}
                      className="text-xs font-mono text-emerald-400/70 bg-emerald-400/5 border border-emerald-400/15 rounded-full px-2.5 py-1"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Footer ────────────────────────────────────────────── */}
        <footer className="pb-10 border-t border-slate-800/60 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-display font-bold text-lg text-white opacity-40">
            De<span className="text-gradient-gold">LLM</span>
          </span>
          <p className="text-xs text-slate-600 text-center">
            Solana · Jupiter · Supabase · Cloudflare Turnstile · AES-256-GCM
          </p>
          <p className="text-xs text-slate-700">Devnet · 僅供測試</p>
        </footer>
      </div>
    </div>
  );
}
