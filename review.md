# DeFai — Mainnet 上線前 Review (2026-05-24)

目前在 `Testnet` branch，`.env.local` 仍指向 devnet。本份 review 涵蓋：
1. **Mainnet 上線整備** — 哪些是 blocker、哪些可帶上線
2. **Deprecated API 審查** — `@solana/web3.js` / Next 16 / React 19 / Supabase v2
3. **Withdraw 流程 review**（自上版以來新增的程式碼）

排序依嚴重度。已在本次 commit 修掉的項目列在最後一節。

---

## 🔴 Blocker（不解決會在 Mainnet 出事）

### B1. RPC fallback 仍可能落到公開端點

`lib/network.ts:39-40` — 已將 server 與 client RPC 拆成兩把（`SOLANA_RPC_URL` 與 `NEXT_PUBLIC_SOLANA_RPC_URL`），server 端會優先用 Helius。但若 mainnet 時兩者都沒設，依舊會 fallback 到 `https://api.mainnet-beta.solana.com` — 該端點的 rate limit 約每秒幾次，`getTransaction` 與 `confirmTransaction` 會大量失敗。

**修法**：在 `lib/network.ts` 加 guard：
```ts
if (IS_MAINNET && !SERVER_RPC && typeof window === "undefined") {
  throw new Error("Mainnet requires SOLANA_RPC_URL (server-side Helius/QuickNode/Triton)");
}
```
另外 production 環境的 Helius / QuickNode / Triton API key 要在 Vercel encrypted env 中設好。

### B2. Treasury 私鑰直接存在 env

`lib/jupiter.ts:70-73`、`lib/withdraw.ts:50-54` 都從 `process.env.TREASURY_WALLET_PRIVATE_KEY` 載入。Mainnet 上這把鑰匙 = 所有用戶存款的單點故障。

**最低限度**：
- 確認 `.env.local` 已在 `.gitignore`（commit 前自己 grep 一次）
- Production 用 Vercel encrypted env vars 或同等加密 secrets manager
- Testnet / Production key **絕對不要共用**

**進階**：把 Jupiter swap / SPL transfer 切到 remote signer（AWS KMS、HashiCorp Vault、Turnkey），讓私鑰永遠不出 HSM。

### B3. Treasury JitoSOL 餘額沒有前置檢查

Mainnet 的 withdraw 走 `lib/withdraw.ts:106` 的 `createTransferInstruction(treasuryAta, userAta, ..., lstLamports)` — 前提是 `treasuryAta` 已存在且有足夠 JitoSOL。

目前 `app/api/withdraw/route.ts:114-144` 的 pre-flight 只檢查 treasury **SOL** float，沒檢 JitoSOL。treasury JitoSOL 不足時 tx 在 `sendTransaction` 階段 fail，雖然 `pre-broadcast failure` 會 revert balance，但會給用戶看 5xx。

**修法**：在 pre-flight 加一段
```ts
const treasuryAta = getAssociatedTokenAddressSync(LST_MINT_PUBKEY, treasuryPubkey);
const ataBalance = await connection.getTokenAccountBalance(treasuryAta);
if (BigInt(ataBalance.value.amount) < lstLamports) {
  // revert + 503
}
```

### B4. Turnstile production site key 與 secret 必須切換

`components/wallet/WalletAuthButton.tsx:31-36` 已在 env 缺失時 throw（好）。但需確認：
- Cloudflare 後台簽發的 site key 綁的是 **production domain**（testnet key 在 production 呼叫會回 invalid）
- Secret key（server side 驗 token 用的，搜搜看是否有走 `/cdn-cgi/turnstile/verify`）也要對應切換

---

## 🟠 High（影響可靠性 / 經濟模型）

### H1. Treasury SOL float buffer 太小

`lib/withdraw.ts:34` — `TREASURY_SOL_BUFFER = 0.003 SOL`。一個新 ATA rent 是 0.00204 SOL，buffer 只夠開 1 個 ATA + 一點 tx fee。並發提款很容易擊穿。

**修法**：拉到 ~0.05 SOL，並在 ops 端加監控（treasury SOL balance < 0.1 SOL → alert）。

### H2. 並發 ATA 建立 race

`lib/withdraw.ts:93-103` — 先 `getAccountInfo(userAta)` 判斷要不要 createATA。同一個用戶並發兩筆提款時，兩筆 tx 都加 createATA → 第二筆會 `AccountAlreadyInitialized` fail。

**修法**：改用 `createAssociatedTokenAccountIdempotentInstruction`（`@solana/spl-token` 0.4.x 已支援）— 該指令重複呼叫不會 fail，可徹底消除 race。

### H3. processed_signatures 無清理機制

`supabase/schema.sql:26-30` — 每筆 deposit 永久占用一列。Mainnet 上長期會膨脹。

**修法**：30 天後 archive，或加 `created_at` partial index + 排程清理。

### H4. Jupiter swap 缺乏 sanity check

`lib/jupiter.ts:120-124` 已正確 throw 在 `outputAmountResult` 為空 / 0（F7 已修）。但仍可再加：拿到 `outputAmountResult` 後，與當下 `getJitoSOLPrice()` 比對，若偏差 > 5% 則 throw + unmark signature。預防 Jupiter 報價異常或路徑被操弄。

### H5. encryption salt 沒有版本欄位

`lib/crypto.ts` 寫死 `ENC_SALT = "defai-enc-v1"`，messages 表沒 `enc_version` 欄位 → 未來想 rotate HKDF 算法 / salt 都無法漸進升級。Mainnet 上線前加 column（NULL = v1）成本最低。

---

## 🟡 Medium（程式碼健康 / 資安強化）

### M1. `POST /api/conversations` 接受 client-side ID

`app/api/conversations/route.ts:50` — `const id = clientId ?? generateId();`。雖然 PK conflict 會擋跨用戶覆寫，但可枚舉 ID 偵測 conversation 存在性。

**修法**：完全 server 端生 UUID。

### M2. E2E key 依賴 deterministic wallet signature

`lib/crypto.ts` — 同錢包對同 message 必須產出同 signature 才能解密歷史訊息。
- Phantom / Solflare：deterministic ✅
- 部分硬體錢包 / 不同 firmware：不保證 ❌

**修法**：UI 警告硬體錢包使用者「歷史訊息可能無法解密」，或加 key escrow 選項（wrapped key 上傳）。

### M3. 所有表 RLS disabled

`supabase/schema.sql:112-116` — 所有 table `DISABLE ROW LEVEL SECURITY`。雖然程式碼只用 service_role，但 defense-in-depth 應該 `ENABLE + CREATE POLICY USING (false)`，這樣即使有人不小心用 anon key 連也讀不到。

### M4. 重複的 `verifyToken` 樣板

`/api/balance`, `/api/chat`, `/api/conversations`, `/api/messages`, `/api/withdraw`, `/api/withdraw/quote`, `/api/deposit/confirm` — 7 個 route handler 開頭都在重寫
```ts
const token = req.headers.get("authorization")?.replace("Bearer ", "");
if (!token) return ...;
const auth = await verifyToken(token);
if (!auth) return ...;
```
抽成 `withAuth(handler)` HOF，省 ~40 行重複。

### M5. `messages.ciphertext` / `iv` 用 TEXT 存 base64

`supabase/schema.sql:51-52` — 浪費 ~33% 空間，且 SQL LIKE / index 在 base64 上無意義。改 `BYTEA` 直接存 binary，client 端 base64 編解碼成本不變。

### M6. env 命名不一致

混用 `JUPITER`、`IO_NET_KEY`、`IO_NET_BASE`、`TREASURY_WALLET_PRIVATE_KEY`、`NEXT_PUBLIC_TREASURY_WALLET`、`SOLANA_RPC_URL` 等。建議統一：
- `JUPITER` → `JUPITER_API_KEY`
- `IO_NET_KEY` → `IO_NET_API_KEY`
- `IO_NET_BASE` → `IO_NET_API_BASE`

Mainnet 切換 secrets 是改這個的好時機。

### M7. Pre-deduct ceiling 1M tokens 的副作用

`app/api/chat/route.ts:13` — `PREDEDUCT_CEILING_TOKENS = 1_000_000`。一筆 chat reserve 的金額遠超實際用量 → 平行多筆 chat 會撞 insufficient balance。設計上是反濫用 cap，但要在 UI 顯示「最多可平行 N 筆 chat（依當前餘額）」或調低 ceiling。

### M8. WithdrawalModal `requestId` 行為

`components/wallet/WithdrawalModal.tsx:82, 92, 98, 174` — 在 mount、modal close、成功送出後都會 mint 新 UUID。同一 modal 內按重試會 reuse（OK），但模態關掉再打開就是新 request（也 OK，符合「新一次嘗試」直覺）。**行為正確**，但要在文件記下這個 contract。

---

## 🟢 Low（風格、文件、測試）

- **L1. `components/counter/provider/Solana.tsx`** — 為什麼放在 `counter` 下？應該是 `components/providers/Solana.tsx`。Counter 命名是 vestigial。
- **L2. `app/page.tsx:12`** unused imports（`Zap`, `Lock`）。
- **L3. `ChatInterface.tsx`** eslint-disable exhaustive-deps — 靠 lint 而非邏輯保證很脆。
- **L4. 沒有測試** — 對會處理錢的應用建議至少：
  - `app/api/chat/route.ts` 的 `settle()` 單元測試（fake io.net stream → 驗證 deduct / refund 算術）
  - `app/api/withdraw/route.ts` 的 broadcast-error 分支測試
  - `lib/jupiter.ts` mock vs real path
- **L5. 中英文混用 / i18n** — UI 中文 + commit 英文 + Toaster 中文 + system prompt 英文。若有 i18n 計畫趁早集中字串。
- **L6. DepositModal Solscan link hardcoded mainnet**（`DepositModal.tsx:182`）— testnet 上會連到錯誤 cluster。Mainnet 上線後變成正解。可參考 `WithdrawalModal.tsx:63-65` 的 cluster-aware 寫法。

---

## Deprecated API 審查（@solana/web3.js v1.98.4）

### ✅ 本次已修：`confirmTransaction(signature, commitment)` 單參形式

該 overload 在 `@solana/web3.js` v1.30+ 起 deprecated，**不檢查 blockhash 過期** → 網路擁塞時會 hang 到 RPC timeout（可達 60s）而非 fast-fail。

修法（共 3 處）：先 `getLatestBlockhash` 拿 `{blockhash, lastValidBlockHeight}`，build tx 時設給 `recentBlockhash` + `feePayer`，confirm 時用 strategy-object 形式：

```ts
const latest = await connection.getLatestBlockhash("confirmed");

const tx = new Transaction({
  recentBlockhash: latest.blockhash,
  feePayer: signer,
}).add(/* ... */);

const sig = await connection.sendTransaction(tx, [signer]);

await connection.confirmTransaction(
  { signature: sig, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
  "confirmed"
);
```

已套用到：
- `lib/withdraw.ts`（mock + mainnet 兩條 path）
- `components/wallet/DepositModal.tsx`

### 其他 deprecated / 過時 pattern 的掃描結果

| API | 出現？ | 行動 |
|---|---|---|
| `getRecentBlockhash()` | ❌ | — |
| `clusterApiUrl()` | ❌ | — |
| `sendAndConfirmRawTransaction()` | ❌ | — |
| 單參 `confirmTransaction(sig, commitment)` | ✅ 3 處 | **已修** |
| Legacy `new Transaction()`（非 v0）| ✅ 多處 | **不必修**。SystemProgram.transfer / SPL transfer 不需要 ALT，legacy tx 完全足夠；升 `VersionedTransaction` 是大規模改動且無實質收益 |
| `VersionedTransaction.deserialize` + `.sign([])`（Jupiter）| ✅ 正確使用 | — |
| `supabase.auth.getUser(token)`（`lib/auth.ts:10`）| ✅ | **不 deprecated**（v2.101.1 current API） |
| Next.js 16 / React 19 deprecated | ❌ 沒掃到 | — |

**結論**：legacy `Transaction` 對你們的 use case 完全安全可繼續用；只有單參 `confirmTransaction` 有實際運行風險，本次已修。

---

## Withdraw 流程 review（新增程式碼）

整體架構合理：
- ✅ Idempotency 用 `(wallet, request_id)` UNIQUE constraint
- ✅ Balance 先 deduct 再 broadcast，broadcast 後失敗用 `isBroadcastError` 標記為 `pending_confirm` / `needs_reconcile` 不退款（避免 double-spend）
- ✅ Pre-broadcast failure 安全 revert balance
- ✅ Status FSM 清楚（`pending` → `done` / `insufficient` / `reverted` / `pending_confirm` / `needs_reconcile`）
- ✅ `CRITICAL_WITHDRAW_RECONCILE` log 給人工接手用

需強化（見 B3, H1, H2 上方）：
- Treasury JitoSOL 餘額預檢
- SOL float buffer 拉高 + 監控
- 並發 ATA race 用 idempotent instruction 消除

`needs_reconcile` 狀態目前**沒有自動處理機制** — 上 mainnet 前應該建一個簡單的 admin tool / runbook，能：
1. 列出所有 `needs_reconcile` / `pending_confirm` 紀錄
2. 對應 signature 查 on-chain 狀態
3. 確認後手動標記為 `done` 或退款

---

## Pre-launch Checklist

切換 mainnet 前逐項打勾：

### Env / Secrets
- [ ] `.env.local` 確認沒被 commit（`git ls-files | grep .env`）
- [ ] Production Vercel env 設定：`NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta`
- [ ] `SOLANA_RPC_URL` = Helius / QuickNode / Triton mainnet endpoint（**server-only**，不要加 NEXT_PUBLIC_ 前綴）
- [ ] `NEXT_PUBLIC_SOLANA_RPC_URL` = 公開 mainnet 端點 或 Helius referrer-restricted key
- [ ] `TREASURY_WALLET_PRIVATE_KEY` = production treasury（**與 testnet key 不同**）
- [ ] `NEXT_PUBLIC_TREASURY_WALLET` = 對應 public address
- [ ] `JUPITER`（API key）= production tier
- [ ] `IO_NET_KEY`, `IO_NET_BASE` = production
- [ ] `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + Turnstile secret = production domain key
- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` = production Supabase 專案
- [ ] Turnstile dashboard：production domain 加 allowlist

### Treasury 預資金
- [ ] Treasury 預存 ≥ 0.1 SOL（rent + tx fee buffer）
- [ ] Treasury 預存足夠 JitoSOL 應付初期提款（建議至少 10 JitoSOL）
- [ ] Treasury ATA 已建立（沒有的話第一次 swap 才會建，會佔用 0.00204 SOL rent）

### Infra
- [ ] Supabase production 跑過 `supabase/schema.sql`
- [ ] 確認 `add_balance` / `deduct_balance` RPC 在 production DB 已建立
- [ ] Vercel deploy preview 在 mainnet env 試跑一輪 deposit + withdraw（小額，1 SOL 以下）

### 監控（基本款）
- [ ] Vercel logs alert：`CRITICAL_WITHDRAW_RECONCILE` 出現就通知 ops
- [ ] Treasury SOL balance < 0.1 SOL → alert
- [ ] Treasury JitoSOL balance < 5 → alert
- [ ] processed_signatures row count 增長異常 → alert

### 回退方案
- [ ] Vercel rollback runbook：可一鍵切回 testnet build
- [ ] DB snapshot / point-in-time recovery 確認 enabled
- [ ] Treasury 私鑰 cold backup（離線、地理分散）

---

## 自上一份 review 後已修復（從本版移除）

| 舊編號 | 內容 | 修復處 |
|---|---|---|
| F1 | Turnstile 用 always-pass 測試 key fallback | `WalletAuthButton.tsx:31-36` 改成 env 缺失即 throw |
| F2 | Solana RPC 預設指向公開 mainnet 端點 | `lib/network.ts` 統一 env 派生 + 本次再拆 server/client |
| F3 | 三個地方各自決定網路 | 全部從 `IS_MAINNET` / `NETWORK_LABEL` / `RPC_URL` 派生 |
| F4 | SSE client parser 沒跨 chunk buffer | `ChatInterface.tsx:107-109` 已正確處理 `{ stream: true }` + `lines.pop()` |
| F5 | chat billing settlement 在 cancel 路徑不會跑 | `chat/route.ts:124-167, 216` 抽成 `settle()` + `settled` flag |
| F6 | Refund 沒做 sanity check | `chat/route.ts:147-162` 加 clamp 與 totalTokens<=0 全退 |
| F7 | Jupiter `outputAmountResult` fallback 0 | `jupiter.ts:120-124` 改 throw |
| F8 | Token 估算對 CJK 過低 | 改採 1M token ceiling pre-deduct + 實際 usage refund，CJK 比例不再是 attack surface |
| F16 | system prompt 寫舊名「Decentralize LLM」 | 已移除（目前不發送 system prompt） |

本次新增修復：
- **D1** `confirmTransaction` 單參形式 → strategy-object（`lib/withdraw.ts` x2, `DepositModal.tsx` x1）
- **D2** RPC URL 拆分 server (`SOLANA_RPC_URL`) vs client (`NEXT_PUBLIC_SOLANA_RPC_URL`)；Helius key 不再有機會洩漏到 client bundle
- **D3** Jupiter swap 加 `slippageBps=50`（0.5%）
