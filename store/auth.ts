import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  token: string | null;          // Supabase access_token
  refreshToken: string | null;   // Supabase refresh_token
  walletAddress: string | null;
  isAuthenticated: boolean;
  encryptionKey: CryptoKey | null; // non-persistent, derived each session

  setAuth: (accessToken: string, refreshToken: string, walletAddress: string) => void;
  setEncryptionKey: (key: CryptoKey) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      walletAddress: null,
      isAuthenticated: false,
      encryptionKey: null,

      setAuth: (accessToken, refreshToken, walletAddress) =>
        set({ token: accessToken, refreshToken, walletAddress, isAuthenticated: true }),

      setEncryptionKey: (key: CryptoKey) =>
        set({ encryptionKey: key }),

      clearAuth: () =>
        set({ token: null, refreshToken: null, walletAddress: null, isAuthenticated: false, encryptionKey: null }),
    }),
    {
      name: "dellm-auth",
      // CryptoKey cannot be serialized — exclude from persistence
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        walletAddress: state.walletAddress,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
