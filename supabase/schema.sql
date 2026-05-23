-- DeFai Supabase Schema
-- Run this in the Supabase SQL Editor to set up all tables.

-- ── Balances ─────────────────────────────────────────────────────────
-- Replaces data/balances.json  (lst_lamports stored as TEXT to avoid bigint overflow)
CREATE TABLE IF NOT EXISTS balances (
  wallet_address TEXT    PRIMARY KEY,
  lst_lamports   NUMERIC NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Atomic increment via RPC (avoids read-modify-write race)
CREATE OR REPLACE FUNCTION add_balance(p_wallet TEXT, p_amount NUMERIC)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO balances (wallet_address, lst_lamports, updated_at)
  VALUES (p_wallet, p_amount, NOW())
  ON CONFLICT (wallet_address) DO UPDATE
    SET lst_lamports = balances.lst_lamports + EXCLUDED.lst_lamports,
        updated_at   = NOW();
END;
$$;

-- ── Processed Signatures ─────────────────────────────────────────────
-- Replaces processedSignatures[] in data/balances.json
CREATE TABLE IF NOT EXISTS processed_signatures (
  signature      TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Conversations ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id             TEXT    PRIMARY KEY,
  wallet_address TEXT    NOT NULL,
  title          TEXT    NOT NULL DEFAULT '新對話',
  model_id       TEXT    NOT NULL DEFAULT 'openai/gpt-oss-120b',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_wallet
  ON conversations (wallet_address, created_at DESC);

-- ── Messages (encrypted) ─────────────────────────────────────────────
-- ciphertext and iv are base64-encoded AES-256-GCM output from the client.
-- The server never has access to the plaintext.
CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  ciphertext      TEXT NOT NULL,
  iv              TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conv
  ON messages (conversation_id, created_at ASC);

-- ── Atomic deduct (with row-lock to prevent race conditions) ─────────
-- Returns TRUE if deduction succeeded, FALSE if balance is insufficient.
CREATE OR REPLACE FUNCTION deduct_balance(p_wallet TEXT, p_amount NUMERIC)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE
  current_balance NUMERIC;
BEGIN
  SELECT lst_lamports INTO current_balance
  FROM balances WHERE wallet_address = p_wallet
  FOR UPDATE; -- row-level lock prevents concurrent overdraft

  IF current_balance IS NULL OR current_balance < p_amount THEN
    RETURN false;
  END IF;

  UPDATE balances
  SET lst_lamports = lst_lamports - p_amount, updated_at = NOW()
  WHERE wallet_address = p_wallet;

  RETURN true;
END;
$$;

-- ── Row-Level Security ───────────────────────────────────────────────
-- All access is via the service_role key (server-side), so RLS is disabled.
-- Enable + add policies if you switch to client-side Supabase queries.
ALTER TABLE balances             DISABLE ROW LEVEL SECURITY;
ALTER TABLE processed_signatures DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversations        DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages             DISABLE ROW LEVEL SECURITY;
