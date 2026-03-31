CREATE TABLE IF NOT EXISTS Users (
    wallet_address VARCHAR PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_status VARCHAR DEFAULT 'active' CHECK (user_status IN ('active', 'suspended', 'banned'))
);

CREATE TABLE IF NOT EXISTS Balances (
    wallet_address VARCHAR REFERENCES Users(wallet_address) PRIMARY KEY,
    usd_credits DECIMAL(14, 4) DEFAULT 0.0000,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Transactions (
    tx_hash VARCHAR PRIMARY KEY,
    wallet_address VARCHAR REFERENCES Users(wallet_address),
    tx_type VARCHAR CHECK (tx_type IN ('deposit', 'withdrawal', 'exchange')),
    sol_amount DECIMAL(20, 9),      -- 支援 Solana 精度到 9 位小數
    exchange_rate DECIMAL(10, 4),   -- 匯率通常留 4 位小數
    system_credits DECIMAL(14, 4),  
    tx_status VARCHAR CHECK (tx_status IN ('pending', 'success', 'failed')),            
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ChatLogs (
    log_id VARCHAR PRIMARY KEY,
    wallet_address VARCHAR REFERENCES Users(wallet_address),
    user_message TEXT,
    bot_response TEXT,
    credits_used DECIMAL(14, 4),   
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

--建立index以提升查詢效率
CREATE INDEX idx_transactions_wallet ON Transactions(wallet_address);
CREATE INDEX idx_chatlogs_wallet ON ChatLogs(wallet_address);