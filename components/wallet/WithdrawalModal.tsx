"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/store/auth";
import { useBalanceStore, formatLst } from "@/store/balance";
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
import { ArrowUpFromLine, Coins, ExternalLink, TrendingUp } from "lucide-react";
import { NETWORK_LABEL, IS_MAINNET, NETWORK } from "@/lib/network";

type Status = "idle" | "processing" | "done" | "pending_confirm" | "error";

interface WithdrawalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LST_DECIMALS = 9;
const LST_BASE = BigInt(10 ** LST_DECIMALS);

function lamportsToDecimal(lamports: bigint): string {
  const whole = lamports / LST_BASE;
  const frac = lamports % LST_BASE;
  return `${whole}.${frac.toString().padStart(LST_DECIMALS, "0").replace(/0+$/, "") || "0"}`;
}

function decimalToLamports(value: string): bigint | null {
  const m = value.trim().match(/^(\d+)(?:\.(\d{1,9}))?$/);
  if (!m) return null;
  const whole = BigInt(m[1]);
  const fracStr = (m[2] ?? "").padEnd(LST_DECIMALS, "0");
  return whole * LST_BASE + BigInt(fracStr);
}

function explorerUrl(signature: string): string {
  return IS_MAINNET
    ? `https://solscan.io/tx/${signature}`
    : `https://solscan.io/tx/${signature}?cluster=${NETWORK === "testnet" ? "testnet" : "devnet"}`;
}

export function WithdrawalModal({ open, onOpenChange }: WithdrawalModalProps) {
  const { token } = useAuthStore();
  const { lstLamports: balanceStr, lstSymbol, fetchBalance } = useBalanceStore();

  const balance = useMemo(() => {
    try { return BigInt(balanceStr); } catch { return 0n; }
  }, [balanceStr]);

  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [signature, setSignature] = useState("");
  const [feeLamports, setFeeLamports] = useState<bigint | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [requestId, setRequestId] = useState<string>("");

  const isLoading = status === "processing";
  const withdrawable = feeLamports !== null && balance > feeLamports ? balance - feeLamports : 0n;

  const reset = () => {
    setAmount("");
    setStatus("idle");
    setError("");
    setSignature("");
    setRequestId(crypto.randomUUID());
  };

  // Fetch the quote when the modal opens; reset state on close.
  useEffect(() => {
    if (!open) return;
    setRequestId(crypto.randomUUID());
    setQuoteError("");
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/withdraw/quote", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setQuoteError(data.error ?? "Quote unavailable");
          return;
        }
        setFeeLamports(BigInt(data.feeLamports));
      } catch (e: unknown) {
        if (!cancelled) setQuoteError(e instanceof Error ? e.message : "Quote unavailable");
      }
    })();
    return () => { cancelled = true; };
  }, [open, token]);

  const handleClose = (next: boolean) => {
    if (!next && !isLoading) {
      setAmount("");
      setStatus("idle");
      setError("");
      setSignature("");
    }
    onOpenChange(next);
  };

  const setAmountFromPercent = (pct: number) => {
    if (withdrawable === 0n) return;
    const lamports = (withdrawable * BigInt(Math.round(pct * 100))) / 100n;
    setAmount(lamportsToDecimal(lamports));
  };

  const handleWithdraw = async () => {
    if (!token) return;
    if (feeLamports === null) return;

    const lamports = decimalToLamports(amount);
    if (!lamports || lamports <= 0n) {
      setError("請輸入有效金額");
      setStatus("error");
      return;
    }
    if (lamports + feeLamports > balance) {
      setError("餘額不足（含 0.05 USDT 手續費）");
      setStatus("error");
      return;
    }

    setStatus("processing");
    setError("");
    setSignature("");

    try {
      const res = await fetch("/api/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          lstLamports: lamports.toString(),
          requestId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // If server says the prior attempt is in a terminal-failed state,
        // mint a new requestId so the next click starts fresh.
        if (data?.status === "insufficient" || data?.status === "reverted") {
          setRequestId(crypto.randomUUID());
        }
        throw new Error(data?.error ?? "Withdrawal failed");
      }

      setSignature(data.withdrawSignature ?? "");
      await fetchBalance(token);
      if (data.status === "pending_confirm") {
        setStatus("pending_confirm");
        toast.message("提款已送出", { description: "鏈上確認中，請稍後重新整理" });
      } else {
        setStatus("done");
        toast.success("提款成功", {
          description: `${IS_MAINNET ? "JitoSOL" : "SOL（測試網模擬）"} 已轉入您的錢包`,
        });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      setStatus("error");
    }
  };

  const userAmount = decimalToLamports(amount);
  const totalDeduct =
    userAmount !== null && feeLamports !== null ? userAmount + feeLamports : null;

  const submitDisabled =
    isLoading ||
    feeLamports === null ||
    userAmount === null ||
    userAmount <= 0n ||
    (totalDeduct !== null && totalDeduct > balance);

  const quickPercents: { label: string; pct: number }[] = [
    { label: "25%", pct: 0.25 },
    { label: "50%", pct: 0.5 },
    { label: "75%", pct: 0.75 },
    { label: "MAX", pct: 1 },
  ];

  const isTerminal = status === "done" || status === "pending_confirm";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
              <ArrowUpFromLine className="size-4 text-primary" />
            </div>
            <div className="flex flex-col gap-0.5">
              <DialogTitle>提款</DialogTitle>
              <DialogDescription>
                {IS_MAINNET
                  ? "JitoSOL 直接轉入您已驗證的錢包"
                  : "測試網模擬：以 SOL 形式送回您的錢包"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isTerminal ? (
          <Empty className="border-none">
            <EmptyHeader>
              <EmptyMedia
                variant="icon"
                className={`size-12 ${
                  status === "done"
                    ? "bg-ctp-green/15 text-ctp-green"
                    : "bg-ctp-yellow/15 text-ctp-yellow"
                }`}
              >
                <TrendingUp className="size-6" />
              </EmptyMedia>
              <EmptyTitle>
                {status === "done" ? "提款成功" : "提款已送出"}
              </EmptyTitle>
              <EmptyDescription>
                {status === "done"
                  ? IS_MAINNET
                    ? "JitoSOL 已轉入您的錢包"
                    : "SOL（測試網模擬）已轉入您的錢包"
                  : "鏈上確認中 — 可至下方連結追蹤狀態"}
              </EmptyDescription>
            </EmptyHeader>
            {signature && (
              <EmptyContent>
                <Button asChild variant="outline" size="sm">
                  <a href={explorerUrl(signature)} target="_blank" rel="noopener noreferrer">
                    查看交易
                    <ExternalLink data-icon="inline-end" />
                  </a>
                </Button>
              </EmptyContent>
            )}
          </Empty>
        ) : (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="withdraw-amount">
                金額 (JitoSOL)
                <span className="ml-auto text-xs text-muted-foreground font-normal">
                  餘額：{formatLst(balanceStr, lstSymbol)}
                </span>
              </FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <Coins className="text-primary" />
                </InputGroupAddon>
                <InputGroupInput
                  id="withdraw-amount"
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.1"
                  disabled={isLoading || feeLamports === null}
                  className="font-mono"
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>JitoSOL</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
              <ToggleGroup
                type="single"
                value=""
                onValueChange={(v) => {
                  const p = quickPercents.find((q) => q.label === v);
                  if (p) setAmountFromPercent(p.pct);
                }}
                spacing={1}
                size="sm"
                variant="outline"
                disabled={isLoading || feeLamports === null || withdrawable === 0n}
                className="w-full *:flex-1"
              >
                {quickPercents.map((q) => (
                  <ToggleGroupItem key={q.label} value={q.label} className="font-mono text-xs">
                    {q.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>

            <Field>
              <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">您將收到</span>
                  <span className="font-mono text-foreground">
                    {userAmount !== null && userAmount > 0n
                      ? IS_MAINNET
                        ? `${lamportsToDecimal(userAmount)} JitoSOL`
                        : `${lamportsToDecimal(userAmount)} JitoSOL (≈ ${(Number(userAmount) / 1e9 / 0.78).toFixed(6)} SOL 模擬)`
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">手續費</span>
                  <span className="font-mono text-foreground">
                    {feeLamports !== null
                      ? `${lamportsToDecimal(feeLamports)} JitoSOL ≈ $0.05 USDT`
                      : quoteError
                        ? "報價失敗"
                        : "載入中…"}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border/50 pt-1 mt-1">
                  <span className="text-muted-foreground">總扣除</span>
                  <span className="font-mono text-primary">
                    {totalDeduct !== null
                      ? `${lamportsToDecimal(totalDeduct)} JitoSOL`
                      : "—"}
                  </span>
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
                <AlertTitle>處理中…</AlertTitle>
                <AlertDescription>請勿關閉此視窗。</AlertDescription>
              </Alert>
            )}

            {status === "error" && error && (
              <Alert variant="destructive">
                <AlertTitle>提款失敗</AlertTitle>
                <AlertDescription className="break-all">{error}</AlertDescription>
              </Alert>
            )}

            {quoteError && !isLoading && (
              <Alert variant="destructive">
                <AlertTitle>無法取得手續費報價</AlertTitle>
                <AlertDescription className="break-all">{quoteError}</AlertDescription>
              </Alert>
            )}

            {isLoading && (
              <Badge variant="secondary" className="self-start">
                處理中…
              </Badge>
            )}
          </FieldGroup>
        )}

        {!isTerminal && (
          <DialogFooter>
            <Button variant="outline" onClick={() => handleClose(false)} disabled={isLoading}>
              取消
            </Button>
            <Button onClick={handleWithdraw} disabled={submitDisabled}>
              {isLoading && <Spinner data-icon="inline-start" />}
              {status === "error" ? "重試" : "確認提款"}
            </Button>
          </DialogFooter>
        )}

        {isTerminal && (
          <DialogFooter>
            <Button
              onClick={() => {
                reset();
                handleClose(false);
              }}
              className="w-full"
            >
              關閉
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
