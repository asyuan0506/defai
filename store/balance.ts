import { create } from "zustand";

const LST_DECIMALS = 9;

interface BalanceState {
  // stored as string to avoid bigint serialization issues
  lstLamports: string;
  lstSymbol: string;
  isLoading: boolean;
  fetchBalance: (token: string) => Promise<void>;
  clear: () => void;
}

export const useBalanceStore = create<BalanceState>((set) => ({
  lstLamports: "0",
  lstSymbol: "JitoSOL",
  isLoading: false,

  fetchBalance: async (token: string) => {
    set({ isLoading: true });
    try {
      const res = await fetch("/api/balance", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const { lstLamports, lstSymbol } = await res.json();
      set({ lstLamports: lstLamports ?? "0", lstSymbol: lstSymbol ?? "JitoSOL" });
    } finally {
      set({ isLoading: false });
    }
  },

  clear: () => set({ lstLamports: "0" }),
}));

/** Convert lamport string to human-readable LST amount (e.g. "1.234567890") */
export function formatLst(lamports: string, symbol: string): string {
  const raw = BigInt(lamports);
  const whole = raw / BigInt(10 ** LST_DECIMALS);
  const frac = raw % BigInt(10 ** LST_DECIMALS);
  const fracStr = frac.toString().padStart(LST_DECIMALS, "0").slice(0, 4); // 4 decimal places
  return `${whole}.${fracStr} ${symbol}`;
}
