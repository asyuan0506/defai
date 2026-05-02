"use client";

import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  SystemProgram,
  PublicKey,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { useAuthStore } from "@/store/auth";
import { useBalanceStore } from "@/store/balance";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Coins, ExternalLink, TrendingUp, ArrowDownToLine } from "lucide-react";
import { NETWORK_LABEL, IS_MAINNET } from "@/lib/network";

const TREASURY = process.env.NEXT_PUBLIC_TREASURY_WALLET!;

type Status = "idle" | "sending" | "confirming" | "swapping" | "done" | "error";

interface DepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DepositModal({ open, onOpenChange }: DepositModalProps) {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  const { token } = useAuthStore();
  const { fetchBalance } = useBalanceStore();

  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [swapSig, setSwapSig] = useState("");

  const isLoading =
    status === "sending" || status === "confirming" || status === "swapping";

  const reset = () => {
    setAmount("");
    setStatus("idle");
    setError("");
    setSwapSig("");
  };

  const handleClose = (next: boolean) => {
    if (!next && !isLoading) {
      reset();
    }
    onOpenChange(next);
  };

  const handleDeposit = async () => {
    if (!token || !TREASURY) return;
    if (!publicKey) {
      setVisible(true);
      return;
    }
    const sol = parseFloat(amount);
    if (isNaN(sol) || sol <= 0) return;

    setStatus("sending");
    setError("");
    setSwapSig("");

    try {
      const lamports = Math.floor(sol * LAMPORTS_PER_SOL);

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(TREASURY),
          lamports,
        })
      );

      const signature = await sendTransaction(tx, connection);
      setStatus("confirming");

      await connection.confirmTransaction(signature, "confirmed");
      setStatus("swapping");

      const res = await fetch("/api/deposit/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ signature }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Deposit confirmation failed");

      setSwapSig(data.mocked ? "" : (data.swapSignature ?? ""));
      await fetchBalance(token);
      setStatus("done");
      toast.success("儲值成功", {
        description: "SOL 已 swap 成 JitoSOL 並記入帳戶",
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      setStatus("error");
    }
  };

  const statusLabel: Record<Status, string> = {
    idle: "確認儲值",
    sending: "等待簽名…",
    confirming: "鏈上確認中…",
    swapping: "Jupiter Swap 中…",
    done: "完成",
    error: "重試",
  };

  const quickAmounts = ["0.1", "0.5", "1", "5"];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
              <ArrowDownToLine className="size-4 text-primary" />
            </div>
            <div className="flex flex-col gap-0.5">
              <DialogTitle>儲值</DialogTitle>
              <DialogDescription>
                SOL → JitoSOL via Jupiter
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {status === "done" ? (
          <Empty className="border-none">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="bg-ctp-green/15 text-ctp-green size-12">
                <TrendingUp className="size-6" />
              </EmptyMedia>
              <EmptyTitle>儲值成功</EmptyTitle>
              <EmptyDescription>
                SOL 已 swap 成 JitoSOL 並記入帳戶
              </EmptyDescription>
            </EmptyHeader>
            {swapSig && (
              <EmptyContent>
                <Button asChild variant="outline" size="sm">
                  <a
                    href={`https://solscan.io/tx/${swapSig}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    查看 Swap 交易
                    <ExternalLink data-icon="inline-end" />
                  </a>
                </Button>
              </EmptyContent>
            )}
          </Empty>
        ) : (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="deposit-amount">金額 (SOL)</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <Coins className="text-primary" />
                </InputGroupAddon>
                <InputGroupInput
                  id="deposit-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.1"
                  disabled={isLoading}
                  className="font-mono"
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>SOL</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
              <ToggleGroup
                type="single"
                value={amount}
                onValueChange={(v) => v && setAmount(v)}
                spacing={1}
                size="sm"
                variant="outline"
                disabled={isLoading}
                className="w-full *:flex-1"
              >
                {quickAmounts.map((q) => (
                  <ToggleGroupItem key={q} value={q} className="font-mono text-xs">
                    {q}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>

            <Field>
              <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">協議</span>
                  <span className="text-foreground">Jupiter Swap v2</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">輸出</span>
                  <span className="text-primary">JitoSOL (~0.93x)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">網路</span>
                  <span className={IS_MAINNET ? "text-primary" : "text-ctp-green"}>
                    {NETWORK_LABEL}
                    {!IS_MAINNET && " (測試)"}
                  </span>
                </div>
              </div>
            </Field>

            {isLoading && (
              <Alert>
                <Spinner />
                <AlertTitle>{statusLabel[status]}</AlertTitle>
                <AlertDescription>請勿關閉此視窗。</AlertDescription>
              </Alert>
            )}

            {status === "error" && error && (
              <Alert variant="destructive">
                <AlertTitle>儲值失敗</AlertTitle>
                <AlertDescription className="break-all">{error}</AlertDescription>
              </Alert>
            )}

            {status === "sending" || status === "confirming" || status === "swapping" ? (
              <Badge variant="secondary" className="self-start">
                {statusLabel[status]}
              </Badge>
            ) : null}
          </FieldGroup>
        )}

        {status !== "done" && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={isLoading}
            >
              取消
            </Button>
            <Button
              onClick={handleDeposit}
              disabled={
                isLoading ||
                (!!publicKey && (!amount || parseFloat(amount) <= 0))
              }
            >
              {isLoading && <Spinner data-icon="inline-start" />}
              {!isLoading && !publicKey ? "連接錢包" : statusLabel[status]}
            </Button>
          </DialogFooter>
        )}

        {status === "done" && (
          <DialogFooter>
            <Button onClick={() => handleClose(false)} className="w-full">
              關閉
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
