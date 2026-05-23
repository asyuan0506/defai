"use client";

import { useEffect, useRef } from "react";
import { useChatStore } from "@/store/chat";
import { useAuthStore } from "@/store/auth";
import { useBalanceStore } from "@/store/balance";
import { encryptMessage, decryptMessage } from "@/lib/crypto";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { ModelPicker } from "./ModelPicker";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Bot, Sparkles, Lock } from "lucide-react";

interface ChatInterfaceProps {
  conversationId: string;
}

export function ChatInterface({ conversationId }: ChatInterfaceProps) {
  const {
    conversations,
    addMessage,
    appendToLastMessage,
    setStreaming,
    isStreaming,
    loadMessages,
    updateConversationTitle,
    persistConversation,
    setConversationModel,
    isLoadingMessages,
  } = useChatStore();
  const { token, encryptionKey } = useAuthStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  const conversation = conversations.find((c) => c.id === conversationId);
  const messages = conversation?.messages ?? [];

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

    if (conversation && !conversation.persisted) {
      try {
        await persistConversation(token, conversationId);
      } catch (e) {
        console.error("Failed to persist conversation:", e);
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
        body: JSON.stringify({ messages: history, model: conversation?.modelId }),
      });

      if (!res.ok || !res.body) {
        const errBody = await res.text().catch(() => "");
        throw new Error(`Chat request failed (${res.status}): ${errBody}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        // Buffer across chunk boundaries — an SSE event can split mid-line,
        // and JSON.parse on a half-line silently drops the delta.
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break outer;
          try {
            const { delta } = JSON.parse(data);
            if (delta) {
              appendToLastMessage(conversationId, delta);
              assistantContent += delta;
            }
          } catch {
            /* skip malformed */
          }
        }
      }
    } catch (e) {
      console.error(e);
      appendToLastMessage(conversationId, "\n\n[錯誤：無法取得回應]");
      assistantContent = "[錯誤：無法取得回應]";
    } finally {
      setStreaming(false);
      useBalanceStore.getState().fetchBalance(token);
    }

    if (conversation && conversation.title === "新對話" && token) {
      updateConversationTitle(token, conversationId, text.slice(0, 30));
    }

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

  const presets = ["解釋 Liquid Staking", "什麼是 JitoSOL?", "DeFi yield 如何計算?"];

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 overflow-y-auto py-4">
        {isLoadingMessages ? (
          <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground">
            <Spinner />
            <span className="text-sm">載入對話中…</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6">
            <Empty className="border-none">
              <EmptyHeader>
                <EmptyMedia variant="icon" className="bg-primary/15 text-primary size-12">
                  <Bot className="size-6" />
                </EmptyMedia>
                <EmptyTitle>AI 助理</EmptyTitle>
                <EmptyDescription>
                  以 JitoSOL 餘額支付推理費用。
                  {encryptionKey && (
                    <span className="mt-2 inline-flex items-center gap-1 text-ctp-green/80">
                      <Lock className="size-3" />
                      端對端加密已啟用
                    </span>
                  )}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <div className="flex flex-wrap justify-center gap-2">
                  {presets.map((p) => (
                    <Button
                      key={p}
                      variant="outline"
                      size="sm"
                      onClick={() => handleSend(p)}
                    >
                      <Sparkles data-icon="inline-start" className="text-primary" />
                      {p}
                    </Button>
                  ))}
                </div>
              </EmptyContent>
            </Empty>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}
        <div ref={bottomRef} />
      </ScrollArea>

      <div className="border-t border-border px-4 pt-2 pb-4">
        {conversation && (
          <div className="mb-2 flex items-center">
            <ModelPicker
              modelId={conversation.modelId}
              onChange={(id) => setConversationModel(token, conversationId, id)}
              disabled={isStreaming}
            />
          </div>
        )}
        <ChatInput onSend={handleSend} isStreaming={isStreaming} />
        <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
          {encryptionKey && <Lock className="size-2.5 text-ctp-green/70" />}
          <span>每次推理扣除 JitoSOL 餘額 · 收益自動累積</span>
        </div>
      </div>
    </div>
  );
}
