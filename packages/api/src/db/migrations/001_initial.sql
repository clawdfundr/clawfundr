-- Clawfundr Public API - Initial Schema
-- PostgreSQL 15+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted'))
);

CREATE INDEX idx_users_status ON users(status);

-- API Keys table
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash) WHERE revoked_at IS NULL;

-- Wallets table
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chain_id INTEGER NOT NULL,
  address TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, chain_id, address)
);

CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_wallets_address ON wallets(address);

-- Requests log table
CREATE TABLE requests_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  ip TEXT,
  route TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tokens_in INTEGER,
  tokens_out INTEGER,
  cost_estimate DECIMAL(10,6)
);

CREATE INDEX idx_requests_log_user_id ON requests_log(user_id);
CREATE INDEX idx_requests_log_ts ON requests_log(ts);

-- Raw transactions table
CREATE TABLE tx_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chain_id INTEGER NOT NULL,
  hash TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  timestamp BIGINT NOT NULL,
  from_addr TEXT NOT NULL,
  to_addr TEXT,
  value TEXT NOT NULL,
  input TEXT,
  status INTEGER NOT NULL,
  gas_used TEXT,
  gas_price TEXT,
  UNIQUE(user_id, chain_id, hash)
);

CREATE INDEX idx_tx_raw_user_id ON tx_raw(user_id);
CREATE INDEX idx_tx_raw_hash ON tx_raw(hash);
CREATE INDEX idx_tx_raw_timestamp ON tx_raw(timestamp);

-- Decoded transactions table
CREATE TABLE tx_decoded (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chain_id INTEGER NOT NULL,
  hash TEXT NOT NULL,
  type TEXT NOT NULL,
  token_in TEXT,
  token_out TEXT,
  amount_in TEXT,
  amount_out TEXT,
  counterparty TEXT,
  notes TEXT,
  decoded_json TEXT,
  UNIQUE(user_id, chain_id, hash)
);

CREATE INDEX idx_tx_decoded_user_id ON tx_decoded(user_id);
CREATE INDEX idx_tx_decoded_hash ON tx_decoded(hash);

-- Balance snapshots table
CREATE TABLE balances_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chain_id INTEGER NOT NULL,
  ts BIGINT NOT NULL,
  token TEXT NOT NULL,
  balance TEXT NOT NULL,
  usd_value TEXT
);

CREATE INDEX idx_balances_snapshot_user_id ON balances_snapshot(user_id);
CREATE INDEX idx_balances_snapshot_ts ON balances_snapshot(ts);

-- x402 payments table
CREATE TABLE x402_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ts BIGINT NOT NULL,
  merchant TEXT NOT NULL,
  resource TEXT NOT NULL,
  amount TEXT NOT NULL,
  token TEXT NOT NULL,
  recipient TEXT NOT NULL,
  tx_hash TEXT,
  status TEXT NOT NULL CHECK (status IN ('proposed', 'pending', 'confirmed', 'failed', 'expired')),
  receipt_json TEXT
);

CREATE INDEX idx_x402_payments_user_id ON x402_payments(user_id);
CREATE INDEX idx_x402_payments_status ON x402_payments(status);

-- Policies table
CREATE TABLE policies (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  value_json TEXT NOT NULL
);

-- Action proposals table
CREATE TABLE action_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('x402_payment', 'token_transfer', 'token_approval')),
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_action_proposals_user_id ON action_proposals(user_id);
CREATE INDEX idx_action_proposals_status ON action_proposals(status);
CREATE INDEX idx_action_proposals_expires_at ON action_proposals(expires_at);

-- Comments
COMMENT ON TABLE users IS 'User accounts for API access';
COMMENT ON TABLE api_keys IS 'API keys for authentication (hashed)';
COMMENT ON TABLE wallets IS 'User-registered wallet addresses';
COMMENT ON TABLE requests_log IS 'API request logs for usage tracking';
COMMENT ON TABLE tx_raw IS 'Raw blockchain transactions';
COMMENT ON TABLE tx_decoded IS 'Decoded/classified transactions';
COMMENT ON TABLE balances_snapshot IS 'Historical balance snapshots';
COMMENT ON TABLE x402_payments IS 'HTTP 402 payment records';
COMMENT ON TABLE policies IS 'User-specific policies (allowlists, caps)';
COMMENT ON TABLE action_proposals IS 'Pending actions requiring execution';
