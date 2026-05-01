"use client";

import { useEffect, useState } from "react";
import { useChatStore } from "@/store/chat";
import { useAuthStore } from "@/store/auth";
import { useBalanceStore, formatLst } from "@/store/balance";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuSkeleton,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DepositModal } from "@/components/wallet/DepositModal";
import {
  MessageSquarePlus,
  Trash2,
  MessageSquare,
  ArrowDownToLine,
  TrendingUp,
} from "lucide-react";

export function AppSidebar() {
  const {
    conversations,
    activeConversationId,
    isLoadingConversations,
    createConversation,
    setActiveConversation,
    deleteConversation,
    loadConversations,
  } = useChatStore();
  const { walletAddress, token } = useAuthStore();
  const { lstLamports, lstSymbol, isLoading: balanceLoading, fetchBalance } =
    useBalanceStore();
  const [showDeposit, setShowDeposit] = useState(false);

  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}`
    : null;

  useEffect(() => {
    if (token) {
      fetchBalance(token);
      loadConversations(token);
    }
  }, [token, fetchBalance, loadConversations]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!token) return;
    await deleteConversation(token, id);
  };

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center justify-between gap-2 px-2 py-1 group-data-[collapsible=icon]:px-0">
            <span className="font-display font-bold text-xl tracking-tight text-sidebar-foreground group-data-[collapsible=icon]:hidden">
              De<span className="text-primary">Fai</span>
            </span>
            {shortAddress && (
              <Badge
                variant="secondary"
                className="font-mono text-[10px] group-data-[collapsible=icon]:hidden"
              >
                {shortAddress}
              </Badge>
            )}
          </div>
        </SidebarHeader>

        <SidebarContent>
          {/* Balance card */}
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <SidebarGroupContent>
              <Card size="sm">
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <TrendingUp className="size-3.5 text-primary" />
                      <span className="text-xs font-medium">帳戶餘額</span>
                    </div>
                    <span className="text-[10px] text-primary/60 font-mono">
                      JitoSOL
                    </span>
                  </div>

                  {balanceLoading ? (
                    <Skeleton className="h-5 w-24" />
                  ) : (
                    <p className="font-mono font-semibold text-foreground text-base truncate">
                      {formatLst(lstLamports, lstSymbol)}
                    </p>
                  )}

                  <Button
                    size="sm"
                    onClick={() => setShowDeposit(true)}
                    className="w-full"
                  >
                    <ArrowDownToLine data-icon="inline-start" />
                    儲值
                  </Button>
                </CardContent>
              </Card>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator />

          {/* New conversation */}
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => createConversation()}
                    tooltip="新對話"
                  >
                    <MessageSquarePlus />
                    <span>新對話</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Conversations list */}
          <SidebarGroup className="flex-1 overflow-hidden">
            <SidebarGroupLabel>對話記錄</SidebarGroupLabel>
            <SidebarGroupContent className="overflow-y-auto">
              {isLoadingConversations ? (
                <SidebarMenu>
                  <SidebarMenuSkeleton showIcon />
                  <SidebarMenuSkeleton showIcon />
                  <SidebarMenuSkeleton showIcon />
                </SidebarMenu>
              ) : conversations.length === 0 ? (
                <div className="flex items-center justify-center py-4 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                  尚無對話記錄
                </div>
              ) : (
                <SidebarMenu>
                  {conversations.map((conv) => (
                    <SidebarMenuItem key={conv.id}>
                      <SidebarMenuButton
                        isActive={conv.id === activeConversationId}
                        onClick={() => setActiveConversation(conv.id)}
                        tooltip={conv.title}
                      >
                        <MessageSquare />
                        <span>{conv.title}</span>
                      </SidebarMenuButton>
                      <SidebarMenuAction
                        showOnHover
                        onClick={(e) => handleDelete(e, conv.id)}
                        aria-label="刪除對話"
                      >
                        <Trash2 className="text-muted-foreground hover:text-destructive" />
                      </SidebarMenuAction>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      {showDeposit && <DepositModal open={showDeposit} onOpenChange={setShowDeposit} />}
    </>
  );
}
