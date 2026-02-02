-- Clawfundr Database Schema
-- SQLite database for storing wallet data, transactions, balances, and policies

-- Wallets table: Store wallet addresses and metadata
CREATE TABLE IF NOT EXISTS wallets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT NOT NULL UNIQUE,
    chain_id INTEGER NOT NULL,
    label TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets(address);
CREATE INDEX IF NOT EXISTS idx_wallets_chain_id ON wallets(chain_id);

-- Raw transaction data from blockchain
CREATE TABLE IF NOT EXISTS tx_raw (
    hash TEXT PRIMARY KEY,
    block_number INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    from_addr TEXT NOT NULL,
    to_addr TEXT,
    value TEXT NOT NULL,
    input TEXT,
    status INTEGER NOT NULL,
    gas_used TEXT,
    gas_price TEXT,
    chain_id INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tx_raw_timestamp ON tx_raw(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_tx_raw_from ON tx_raw(from_addr);
CREATE INDEX IF NOT EXISTS idx_tx_raw_to ON tx_raw(to_addr);
CREATE INDEX IF NOT EXISTS idx_tx_raw_block ON tx_raw(block_number);

-- Decoded transaction data (human-readable interpretation)
CREATE TABLE IF NOT EXISTS tx_decoded (
    hash TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    token_in TEXT,
    token_out TEXT,
    amount_in TEXT,
    amount_out TEXT,
    counterparty TEXT,
    notes TEXT,
    decoded_json TEXT,
    FOREIGN KEY (hash) REFERENCES tx_raw(hash)
);

CREATE INDEX IF NOT EXISTS idx_tx_decoded_type ON tx_decoded(type);

-- Balance snapshots over time
CREATE TABLE IF NOT EXISTS balances_snapshot (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    token TEXT NOT NULL,
    balance TEXT NOT NULL,
    usd_value TEXT,
    chain_id INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_balances_timestamp ON balances_snapshot(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_balances_token ON balances_snapshot(token);

-- Policy storage (key-value store for configuration)
CREATE TABLE IF NOT EXISTS policies (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL
);

-- x402 payment records
CREATE TABLE IF NOT EXISTS payments_x402 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    merchant TEXT NOT NULL,
    resource TEXT NOT NULL,
    amount TEXT NOT NULL,
    token TEXT NOT NULL,
    tx_hash TEXT,
    status TEXT NOT NULL,
    receipt_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_payments_timestamp ON payments_x402(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_payments_merchant ON payments_x402(merchant);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments_x402(status);

-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insert initial schema version
INSERT OR IGNORE INTO schema_version (version) VALUES (1);
