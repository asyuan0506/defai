"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { useChatStore } from "@/store/chat";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Bot, MessageSquarePlus } from "lucide-react";

export default function ChatPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { activeConversationId, createConversation } = useChatStore();

  useEffect(() => {
    if (!isAuthenticated) router.replace("/");
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Header />
        <main className="flex-1 overflow-hidden">
          {activeConversationId ? (
            <ChatInterface conversationId={activeConversationId} />
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <Empty className="max-w-md">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Bot />
                  </EmptyMedia>
                  <EmptyTitle>開始對話</EmptyTitle>
                  <EmptyDescription>
                    選擇側邊欄的對話，或建立一個新對話。AI 推理費用將從你的 JitoSOL
                    餘額扣款。
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button onClick={() => createConversation()}>
                    <MessageSquarePlus data-icon="inline-start" />
                    新建對話
                  </Button>
                </EmptyContent>
              </Empty>
            </div>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
