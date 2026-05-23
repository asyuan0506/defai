import { create } from "zustand";
import { DEFAULT_MODEL, MODEL_CATALOG } from "@/lib/models";
import { useModelStore } from "./model";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  modelId: string;
  messages: Message[];
  createdAt: number;
  /** false = local only, not yet written to DB */
  persisted: boolean;
}

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  isStreaming: boolean;
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;

  loadConversations: (token: string) => Promise<void>;
  loadMessages: (token: string, conversationId: string, decryptFn: (c: string, iv: string) => Promise<string>) => Promise<void>;

  /** Create a local-only conversation. Does NOT call the API. */
  createConversation: (modelId?: string) => string;
  /** Persist a local conversation to DB. Throws on failure. */
  persistConversation: (token: string, conversationId: string) => Promise<void>;

  setActiveConversation: (id: string) => void;

  addMessage: (conversationId: string, message: Omit<Message, "id" | "timestamp">) => string;
  appendToLastMessage: (conversationId: string, delta: string) => void;
  setStreaming: (value: boolean) => void;

  deleteConversation: (token: string, id: string) => Promise<void>;
  updateConversationTitle: (token: string, id: string, title: string) => Promise<void>;
  setConversationModel: (token: string | null, id: string, modelId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  isStreaming: false,
  isLoadingConversations: false,
  isLoadingMessages: false,

  loadConversations: async (token) => {
    set({ isLoadingConversations: true });
    try {
      const res = await fetch("/api/conversations", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const { conversations } = await res.json();
      const mapped: Conversation[] = conversations.map((c: any) => ({
        id: c.id,
        title: c.title,
        modelId: MODEL_CATALOG[c.model_id] ? c.model_id : DEFAULT_MODEL,
        messages: [],
        createdAt: new Date(c.created_at).getTime(),
        persisted: true,
      }));
      set((s) => {
        // Keep any local-only (unpersisted) conversations the user already created
        const localOnly = s.conversations.filter((c) => !c.persisted);
        return { conversations: [...localOnly, ...mapped] };
      });
    } finally {
      set({ isLoadingConversations: false });
    }
  },

  loadMessages: async (token, conversationId, decryptFn) => {
    set({ isLoadingMessages: true });
    try {
      const res = await fetch(`/api/messages?conversationId=${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const { messages: rows } = await res.json();

      const decrypted: Message[] = await Promise.all(
        rows.map(async (r: any) => {
          let content = "[加密訊息]";
          try { content = await decryptFn(r.ciphertext, r.iv); } catch { /* key mismatch */ }
          return {
            id: r.id,
            role: r.role as "user" | "assistant",
            content,
            timestamp: new Date(r.created_at).getTime(),
          };
        })
      );

      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === conversationId ? { ...c, messages: decrypted } : c
        ),
      }));
    } finally {
      set({ isLoadingMessages: false });
    }
  },

  createConversation: (modelId) => {
    const id = crypto.randomUUID();
    // Seed new conversation with the user's last-used model so they don't
    // have to re-pick after every "New chat" click.
    const resolvedModelId =
      modelId && MODEL_CATALOG[modelId]
        ? modelId
        : useModelStore.getState().lastUsedModelId;
    const conv: Conversation = {
      id,
      title: "新對話",
      modelId: resolvedModelId,
      messages: [],
      createdAt: Date.now(),
      persisted: false,
    };
    set((s) => ({ conversations: [conv, ...s.conversations], activeConversationId: id }));
    return id;
  },

  persistConversation: async (token, conversationId) => {
    const conv = get().conversations.find((c) => c.id === conversationId);
    if (!conv || conv.persisted) return;

    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: conv.id, title: conv.title, modelId: conv.modelId }),
    });
    if (!res.ok) throw new Error("Failed to persist conversation");

    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId ? { ...c, persisted: true } : c
      ),
    }));
  },

  setActiveConversation: (id) => set({ activeConversationId: id }),

  addMessage: (conversationId, message) => {
    const id = crypto.randomUUID();
    const fullMessage: Message = { ...message, id, timestamp: Date.now() };
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId ? { ...c, messages: [...c.messages, fullMessage] } : c
      ),
    }));
    return id;
  },

  appendToLastMessage: (conversationId, delta) => {
    set((s) => ({
      conversations: s.conversations.map((c) => {
        if (c.id !== conversationId) return c;
        const messages = [...c.messages];
        const last = messages[messages.length - 1];
        if (last && last.role === "assistant") {
          messages[messages.length - 1] = { ...last, content: last.content + delta };
        }
        return { ...c, messages };
      }),
    }));
  },

  setStreaming: (value) => set({ isStreaming: value }),

  deleteConversation: async (token, id) => {
    const conv = get().conversations.find((c) => c.id === id);
    // Only call API if conversation exists in DB
    if (conv?.persisted) {
      await fetch(`/api/conversations?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    set((s) => {
      const remaining = s.conversations.filter((c) => c.id !== id);
      return {
        conversations: remaining,
        activeConversationId:
          s.activeConversationId === id ? (remaining[0]?.id ?? null) : s.activeConversationId,
      };
    });
  },

  updateConversationTitle: async (token, id, title) => {
    const conv = get().conversations.find((c) => c.id === id);
    if (conv?.persisted) {
      await fetch("/api/conversations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, title }),
      });
    }
    set((s) => ({
      conversations: s.conversations.map((c) => (c.id === id ? { ...c, title } : c)),
    }));
  },

  setConversationModel: async (token, id, modelId) => {
    if (!MODEL_CATALOG[modelId]) return;

    // Optimistic local update first — picker should feel instant even before
    // the PATCH round-trips.
    set((s) => ({
      conversations: s.conversations.map((c) => (c.id === id ? { ...c, modelId } : c)),
    }));
    // Remember as the default for future new conversations.
    useModelStore.getState().setLastUsedModel(modelId);

    const conv = get().conversations.find((c) => c.id === id);
    if (conv?.persisted && token) {
      await fetch("/api/conversations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, modelId }),
      });
    }
  },
}));
