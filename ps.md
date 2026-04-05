# DeLLM 專案總結

## 專案概覽

DeLLM 是一個結合 **Solana DeFi** 與 **Claude AI** 的 Web3 聊天平台。
使用者存入 SOL，系統透過 Jupiter 自動換成 JitoSOL（Liquid Staking Token），
賺取約 7–9% 質押收益，再以該餘額支付 AI 推理費用。

**Tech Stack：** Next.js 16.2.1 (App Router) · TypeScript · Zustand · Tailwind CSS v4 · Solana Wallet Adapter · Jupiter Swap v2 · io.net (gpt-oss-120b)

---

## 功能對應表

### 頁面路由

| 路由 | 檔案 | 功能 |
|------|------|------|
| `/` | `app/page.tsx` | 首頁 Landing Page，未登入顯示；已登入自動跳轉 `/chat` |
| `/chat` | `app/chat/page.tsx` | 聊天主頁，未驗證自動跳回首頁；管理多對話切換與標題 |

---

### API Routes（後端）

| 端點 | 檔案 | 功能 |
|------|------|------|
| `POST /api/auth/nonce` | `app/api/auth/nonce/route.ts` | 產生一次性 nonce（5 分鐘有效），防重放攻擊 |
| `POST /api/auth/verify` | `app/api/auth/verify/route.ts` | 驗證 Ed25519 簽名，回傳 base64url 偽 JWT token |
| `GET /api/balance` | `app/api/balance/route.ts` | 查詢使用者 JitoSOL 餘額（需 Bearer token） |
| `POST /api/chat` | `app/api/chat/route.ts` | 呼叫 io.net `openai/gpt-oss-120b`，以 SSE 串流回應（需 Bearer token） |
| `POST /api/deposit/confirm` | `app/api/deposit/confirm/route.ts` | 驗證鏈上 tx → 呼叫 Jupiter swap SOL→JitoSOL → 記錄餘額 |

---

### 元件（Components）

| 元件 | 檔案 | 功能 |
|------|------|------|
| `SolanaProvider` | `components/counter/provider/Solana.tsx` | 全域 Solana 錢包環境（Phantom / Solflare），RPC 由 `NEXT_PUBLIC_SOLANA_RPC_URL` 控制 |
| `WalletAuthButton` | `components/wallet/WalletAuthButton.tsx` | 連接錢包 → 簽名登入 / 登出，呼叫 nonce+verify API |
| `DepositModal` | `components/wallet/DepositModal.tsx` | 儲值彈窗：發送 SOL → 等待確認 → 呼叫 deposit/confirm → 刷新餘額 |
| `Sidebar` | `components/layout/Sidebar.tsx` | 側邊欄：顯示錢包地址、JitoSOL 餘額、對話列表、儲值按鈕 |
| `Header` | `components/layout/Header.tsx` | 頂部列：標題 + WalletAuthButton |
| `ChatInterface` | `components/chat/ChatInterface.tsx` | 聊天核心：送訊息、解析 SSE 串流、即時更新對話 |
| `ChatInput` | `components/chat/ChatInput.tsx` | 訊息輸入框（Shift+Enter 換行，Enter 送出） |
| `MessageBubble` | `components/chat/MessageBubble.tsx` | 單則訊息渲染（user / assistant 樣式區分） |

---

### 狀態管理（Zustand Stores）

| Store | 檔案 | 管理狀態 |
|-------|------|---------|
| `useAuthStore` | `store/auth.ts` | token、walletAddress、isAuthenticated（localStorage 持久化） |
| `useBalanceStore` | `store/balance.ts` | lstLamports、lstSymbol、載入狀態；`formatLst()` 轉換顯示格式 |
| `useChatStore` | `store/chat.ts` | 對話列表、作用中對話 ID、串流狀態；含 CRUD 操作 |

---

### 工具函式（Lib）

| 檔案 | 功能 |
|------|------|
| `lib/auth.ts` | `verifyToken()`：解析並驗證 base64url token 是否過期 |
| `lib/db.ts` | JSON 檔案型 DB（`data/balances.json`）：存取餘額、防重放 tx 記錄 |
| `lib/jupiter.ts` | `swapSolToLST()`：devnet 用 mock swap (0.93:1)；mainnet 呼叫 Jupiter /swap/v2 API |
| `lib/utils.ts` | `cn()`：Tailwind class 合併工具 |
| `utils/jupiter.ts` | （備用/舊版，目前邏輯在 lib/jupiter.ts） |

---

### 環境變數（`.env`）

| 變數 | 用途 |
|------|------|
| `ANTHROPIC_API_KEY` | Claude API 金鑰（目前程式碼未使用，io.net 取代之） |
| `IO_NET` | io.net API 金鑰，`/api/chat` 實際呼叫的推理服務 |
| `JUPITER` | Jupiter API 金鑰（x-api-key） |
| `PRIVATE_KEY` | Treasury 錢包私鑰（bs58），mainnet swap 時簽名用 |
| `WALLET_ADDRESS` | Treasury 錢包公鑰（後端驗證用） |
| `NEXT_PUBLIC_TREASURY_WALLET` | Treasury 錢包公鑰（前端發送 SOL 用） |
| `SOLANA_NETWORK` | `devnet` / `mainnet-beta`，控制是否 mock swap |
| `SOLANA_RPC_URL` | 後端 RPC |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | 前端 RPC（錢包連線用） |

---

## 核心流程

### 登入流程
1. `WalletAuthButton` 點擊 → 若未連接打開錢包彈窗
2. 已連接 → 呼叫 `POST /api/auth/nonce` 取得 nonce
3. 用錢包私鑰對訊息 `DeLLM Authentication\nWallet: ...\nNonce: ...` 簽名
4. 呼叫 `POST /api/auth/verify` 驗證 Ed25519 簽名
5. 取得 token → 存入 `useAuthStore`（localStorage 持久化）→ 跳轉 `/chat`

### 儲值流程
1. 側邊欄點「儲值」→ `DepositModal` 開啟
2. 輸入 SOL 金額 → 錢包簽名發送 SOL 到 Treasury
3. 等待鏈上確認（`connection.confirmTransaction`）
4. 呼叫 `POST /api/deposit/confirm`（帶 tx signature）
5. 後端驗證：確認 tx 存在、無錯誤、sender 是本人、receiver 是 Treasury
6. Devnet：mock swap (×0.93)；Mainnet：Jupiter API swap → JitoSOL
7. 寫入 `data/balances.json`，前端刷新餘額

### 聊天流程
1. `ChatInput` 輸入送出 → `ChatInterface.handleSend()`
2. 先加入 user 訊息與空的 assistant 訊息到 store
3. `POST /api/chat` 帶完整歷史訊息與 Bearer token
4. 後端呼叫 Claude API（SSE streaming）
5. 前端讀取 ReadableStream，逐 delta 呼叫 `appendToLastMessage()`
6. 串流結束，`isStreaming` 設為 false

---

## 注意事項

### 安全性問題（現況 vs 生產需求）

1. **Token 不安全**：`lib/auth.ts` 產生的 token 只是 base64url(JSON)，沒有簽名，任何人可以偽造。
   - 生產環境應換成真正的 JWT（`jsonwebtoken` + 密鑰簽名）或使用 NextAuth

2. **Nonce 存在 in-memory**：`app/api/auth/nonce/route.ts` 用 `Map` 存 nonce，重啟 server 後所有 nonce 失效，且多實例部署會出錯。
   - 生產環境應換成 Redis 或資料庫

3. **私鑰放在 .env**：`PRIVATE_KEY` 直接在環境變數中，部署時注意不要洩漏（已在 `.gitignore`，但要確認）

4. **DB 是 JSON 檔案**：`lib/db.ts` 寫 `data/balances.json`，重啟不會清空，但無法橫向擴展、無事務保證。
   - 生產環境替換 `lib/db.ts` 即可（介面已定義好）

### 功能限制

5. **沒有扣費邏輯**：聊天時顯示「扣除 JitoSOL 餘額」，但 `/api/chat/route.ts` 實際上沒有扣款，餘額不會減少

6. **JitoSOL 收益不會自動增長**：餘額只在儲值時寫入，沒有定期更新 exchange rate 的機制

7. **對話只在記憶體（Zustand）**：重新整理後對話消失（`useChatStore` 沒有 `persist`）

8. **Devnet 模式**：目前 `.env` 設定為 devnet，Jupiter mock swap 固定 0.93:1 比率，非真實價格

### 環境切換

**切到 Mainnet 真實模式：**
```
SOLANA_NETWORK=mainnet-beta
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

**測試 Devnet 流程：**
1. Phantom / Solflare 切換到 Devnet 網路
2. 到 https://faucet.solana.com airdrop 測試 SOL
3. 連接錢包登入後，側邊欄點「儲值」
4. 儲值成功後查看 `data/balances.json` 確認記錄

### 部署前 Checklist

- [ ] 換成真實 JWT（`lib/auth.ts`）
- [ ] Nonce 改用 Redis（`app/api/auth/nonce/route.ts`）
- [ ] 加入聊天扣費邏輯（`app/api/chat/route.ts`）
- [ ] 換成真實資料庫（`lib/db.ts`）
- [ ] 實作 JitoSOL 收益更新機制
- [ ] 將 `PRIVATE_KEY` 改用 KMS 或 HSM 管理
- [ ] `useChatStore` 加入 `persist` 或後端儲存對話
