"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { useChatStore } from "@/store/chat";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { MessageSquarePlus } from "lucide-react";

export default function ChatPage() {
  const router = useRouter();
  const { isAuthenticated, token } = useAuthStore();
  const { activeConversationId, createConversation } = useChatStore();

  useEffect(() => {
    if (!isAuthenticated) router.replace("/");
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-[#0F172A]">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0">
        <Header />

        <main className="flex-1 overflow-hidden">
          {activeConversationId ? (
            <ChatInterface conversationId={activeConversationId} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-5">
              <div className="text-center">
                <p className="font-display font-semibold text-slate-300 text-base mb-1">開始對話</p>
                <p className="text-xs text-slate-600">選擇側邊欄的對話，或建立新對話</p>
              </div>
              <button
                onClick={() => createConversation()}
                className="flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white px-5 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer shadow-[0_0_16px_rgba(139,92,246,0.3)]"
              >
                <MessageSquarePlus className="h-4 w-4" />
                新建對話
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
