"use client";

import { useEffect, useRef } from "react";
import { useChatStore } from "@/store/chat";
import { useAuthStore } from "@/store/auth";
import { encryptMessage, decryptMessage } from "@/lib/crypto";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Sparkles, Lock, Loader2 } from "lucide-react";

interface ChatInterfaceProps {
  conversationId: string;
}

export function ChatInterface({ conversationId }: ChatInterfaceProps) {
  const {
    conversations,
    addMessage, appendToLastMessage, setStreaming, isStreaming,
    loadMessages, updateConversationTitle, persistConversation, isLoadingMessages,
  } = useChatStore();
  const { token, encryptionKey } = useAuthStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  const conversation = conversations.find((c) => c.id === conversationId);
  const messages = conversation?.messages ?? [];

  // Load encrypted messages from Supabase when conversation changes
  useEffect(() => {
    if (!token || !encryptionKey) return;
    if (conversation && conversation.messages.length === 0) {
      loadMessages(token, conversationId, (ciphertext, iv) =>
        decryptMessage(encryptionKey, ciphertext, iv)
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, token, encryptionKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (text: string) => {
    if (!token) return;

    // Persist conversation to DB on first message
    if (conversation && !conversation.persisted) {
      try {
        await persistConversation(token, conversationId);
      } catch (e) {
        console.error("Failed to persist conversation:", e);
        // Continue anyway — messages won't be saved to DB but chat still works
      }
    }

    addMessage(conversationId, { role: "user", content: text });
    addMessage(conversationId, { role: "assistant", content: "" });
    setStreaming(true);

    let assistantContent = "";

    try {
      const history = [
        ...messages,
        { role: "user" as const, content: text },
      ].map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok || !res.body) {
        const errBody = await res.text().catch(() => "");
        throw new Error(`Chat request failed (${res.status}): ${errBody}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const { delta } = JSON.parse(data);
              appendToLastMessage(conversationId, delta);
              assistantContent += delta;
            } catch { /* skip malformed */ }
          }
        }
      }
    } catch (e) {
      console.error(e);
      appendToLastMessage(conversationId, "\n\n[錯誤：無法取得回應]");
      assistantContent = "[錯誤：無法取得回應]";
    } finally {
      setStreaming(false);
    }

    // Auto-update conversation title from first message
    if (conversation && conversation.title === "新對話" && token) {
      updateConversationTitle(token, conversationId, text.slice(0, 30));
    }

    // Save encrypted message pair to Supabase
    if (token && encryptionKey && assistantContent) {
      try {
        const [encUser, encAssistant] = await Promise.all([
          encryptMessage(encryptionKey, text),
          encryptMessage(encryptionKey, assistantContent),
        ]);

        await fetch("/api/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            conversationId,
            messages: [
              { role: "user", ciphertext: encUser.ciphertext, iv: encUser.iv },
              { role: "assistant", ciphertext: encAssistant.ciphertext, iv: encAssistant.iv },
            ],
          }),
        });
      } catch (e) {
        console.error("Failed to save encrypted messages:", e);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0F172A]">
      {/* Messages */}
      <ScrollArea className="flex-1 overflow-y-auto py-4">
        {isLoadingMessages ? (
          <div className="flex items-center justify-center h-64 gap-2 text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">載入對話中…</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 border border-violet-500/20">
              <Bot className="h-7 w-7 text-violet-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-300">AI 助理</p>
              <p className="text-xs text-slate-600 mt-1">以 JitoSOL 餘額支付推理費用</p>
              {encryptionKey && (
                <div className="flex items-center justify-center gap-1 mt-2 text-emerald-400/70 text-[10px]">
                  <Lock className="h-3 w-3" />
                  端對端加密已啟用
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-sm mt-2">
              {["解釋 Liquid Staking", "什麼是 JitoSOL?", "DeFi yield 如何計算?"].map((p) => (
                <button
                  key={p}
                  onClick={() => handleSend(p)}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700/50 hover:border-slate-600 bg-slate-800/30 hover:bg-slate-800/60 rounded-full px-3 py-1.5 transition-all duration-150 cursor-pointer"
                >
                  <Sparkles className="h-3 w-3 text-violet-400" />
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}
        <div ref={bottomRef} />
      </ScrollArea>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-[#1E3A5F]/30">
        <ChatInput onSend={handleSend} isStreaming={isStreaming} />
        <div className="flex items-center justify-center gap-1.5 mt-2 text-[10px] text-slate-700">
          {encryptionKey && <Lock className="h-2.5 w-2.5 text-emerald-600" />}
          <span>每次推理扣除 JitoSOL 餘額 · 收益自動累積</span>
        </div>
      </div>
    </div>
  );
}
