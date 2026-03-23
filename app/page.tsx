"use client";

import Image from "next/image";
import { useWallet } from "@solana/wallet-adapter-react";
import dynamic from "next/dynamic";

// 動態匯入 WalletMultiButton，避免在 Next.js Server-Side Rendering (SSR) 時發生錯誤
const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
  { ssr: false }
);

export default function Home() {
  const { connected, publicKey } = useWallet();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 font-sans dark:bg-black p-8">
      <main className="flex flex-col items-center gap-8 rounded-2xl bg-white p-12 shadow-xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        <h1 className="text-4xl font-bold tracking-tight text-black dark:text-zinc-50">
          我的 Solana 應用
        </h1>

        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          點擊下方按鈕連接您的 Phantom 錢包
        </p>

        {/* 這是 Solana 官方提供的錢包連接按鈕 */}
        <WalletMultiButton />

        {connected && publicKey && (
          <div className="mt-6 p-4 rounded-lg bg-green-50 text-green-800 border border-green-200 break-all w-full text-center">
            <p className="font-semibold">✅ 錢包已連線！</p>
            <p className="mt-2 text-sm">地址: {publicKey.toString()}</p>
          </div>
        )}
      </main>
    </div>
  );
}
