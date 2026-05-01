"use client";

import React, { FC, ReactNode, useCallback } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import type { WalletError } from "@solana/wallet-adapter-base";
import "@solana/wallet-adapter-react-ui/styles.css";

// Set NEXT_PUBLIC_SOLANA_RPC_URL in .env to target a specific cluster.
// Default: mainnet-beta (required for real LST swaps via Jupiter).
const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";

interface SolanaProviderProps {
  children: ReactNode;
}

export const SolanaProvider: FC<SolanaProviderProps> = ({ children }) => {
  // autoConnect commonly fails after a browser restart because the wallet
  // requires a user gesture to re-approve. The user can click connect again
  // when they actually need to sign — silence the noise.
  const onError = useCallback((error: WalletError) => {
    if (error.name === "WalletConnectionError") return;
    console.error("[wallet]", error);
  }, []);

  return (
    <ConnectionProvider endpoint={RPC_URL}>
      <WalletProvider wallets={[]} autoConnect onError={onError}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
