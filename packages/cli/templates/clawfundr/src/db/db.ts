import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { mkdirSync, existsSync } from 'fs';

let db: Database.Database | null = null;

export interface Wallet {
    id?: number;
    address: string;
    chain_id: number;
    label?: string;
    created_at?: string;
}

export interface TxRaw {
    hash: string;
    block_number: number;
    timestamp: number;
    from_addr: string;
    to_addr: string | null;
    value: string;
    input: string | null;
    status: number;
    gas_used: string | null;
    gas_price: string | null;
    chain_id: number;
}

export interface TxDecoded {
    hash: string;
    type: string;
    token_in?: string;
    token_out?: string;
    amount_in?: string;
    amount_out?: string;
    counterparty?: string;
    notes?: string;
    decoded_json?: string;
}

export interface BalanceSnapshot {
    timestamp: number;
    token: string;
    balance: string;
    usd_value?: string;
    chain_id: number;
}

export interface X402Payment {
    timestamp: number;
    merchant: string;
    resource: string;
    amount: string;
    token: string;
    tx_hash?: string;
    status: string;
    receipt_json?: string;
}

/**
 * Initialize the database and ensure schema is up to date
 */
export function initDb(dbPath: string): Database.Database {
    // Create directory if it doesn't exist
    const dbDir = dirname(dbPath);
    if (!existsSync(dbDir)) {
        mkdirSync(dbDir, { recursive: true });
    }

    // Open database
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Ensure schema
    ensureSchema();

    return db;
}

/**
 * Ensure database schema is created/migrated
 */
export function ensureSchema(): void {
    if (!db) {
        throw new Error('Database not initialized. Call initDb() first.');
    }

    // Read schema SQL file
    const schemaPath = join(__dirname, 'schema.sql');
    const schemaSql = readFileSync(schemaPath, 'utf-8');

    // Execute schema (CREATE TABLE IF NOT EXISTS is idempotent)
    db.exec(schemaSql);
}

/**
 * Get the database instance
 */
export function getDb(): Database.Database {
    if (!db) {
        throw new Error('Database not initialized. Call initDb() first.');
    }
    return db;
}

/**
 * Close the database connection
 */
export function closeDb(): void {
    if (db) {
        db.close();
        db = null;
    }
}

// ============================================================================
// WALLET OPERATIONS
// ============================================================================

/**
 * Insert or update a wallet
 */
export function upsertWallet(address: string, chainId: number, label?: string): void {
    const stmt = getDb().prepare(`
    INSERT INTO wallets (address, chain_id, label)
    VALUES (?, ?, ?)
    ON CONFLICT(address) DO UPDATE SET
      chain_id = excluded.chain_id,
      label = COALESCE(excluded.label, label)
  `);

    stmt.run(address, chainId, label || null);
}

/**
 * Get all wallets
 */
export function getWallets(): Wallet[] {
    const stmt = getDb().prepare('SELECT * FROM wallets ORDER BY created_at DESC');
    return stmt.all() as Wallet[];
}

/**
 * Get wallet by address
 */
export function getWallet(address: string): Wallet | undefined {
    const stmt = getDb().prepare('SELECT * FROM wallets WHERE address = ?');
    return stmt.get(address) as Wallet | undefined;
}

// ============================================================================
// POLICY OPERATIONS
// ============================================================================

/**
 * Set a policy value
 */
export function setPolicy(key: string, valueJson: string): void {
    const stmt = getDb().prepare(`
    INSERT INTO policies (key, value_json)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json
  `);

    stmt.run(key, valueJson);
}

/**
 * Get a policy value
 */
export function getPolicy(key: string): string | undefined {
    const stmt = getDb().prepare('SELECT value_json FROM policies WHERE key = ?');
    const result = stmt.get(key) as { value_json: string } | undefined;
    return result?.value_json;
}

/**
 * Get all policies
 */
export function getAllPolicies(): Record<string, string> {
    const stmt = getDb().prepare('SELECT key, value_json FROM policies');
    const rows = stmt.all() as Array<{ key: string; value_json: string }>;

    const policies: Record<string, string> = {};
    for (const row of rows) {
        policies[row.key] = row.value_json;
    }
    return policies;
}

// ============================================================================
// TRANSACTION OPERATIONS
// ============================================================================

/**
 * Insert multiple raw transactions in bulk
 */
export function insertTxRawBulk(rows: TxRaw[]): void {
    const stmt = getDb().prepare(`
    INSERT OR REPLACE INTO tx_raw (
      hash, block_number, timestamp, from_addr, to_addr,
      value, input, status, gas_used, gas_price, chain_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

    const insertMany = getDb().transaction((txs: TxRaw[]) => {
        for (const tx of txs) {
            stmt.run(
                tx.hash,
                tx.block_number,
                tx.timestamp,
                tx.from_addr,
                tx.to_addr,
                tx.value,
                tx.input,
                tx.status,
                tx.gas_used,
                tx.gas_price,
                tx.chain_id
            );
        }
    });

    insertMany(rows);
}

/**
 * Insert or update decoded transaction data
 */
export function upsertTxDecoded(row: TxDecoded): void {
    const stmt = getDb().prepare(`
    INSERT INTO tx_decoded (
      hash, type, token_in, token_out, amount_in, amount_out,
      counterparty, notes, decoded_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(hash) DO UPDATE SET
      type = excluded.type,
      token_in = excluded.token_in,
      token_out = excluded.token_out,
      amount_in = excluded.amount_in,
      amount_out = excluded.amount_out,
      counterparty = excluded.counterparty,
      notes = excluded.notes,
      decoded_json = excluded.decoded_json
  `);

    stmt.run(
        row.hash,
        row.type,
        row.token_in || null,
        row.token_out || null,
        row.amount_in || null,
        row.amount_out || null,
        row.counterparty || null,
        row.notes || null,
        row.decoded_json || null
    );
}

/**
 * Get last N transactions
 */
export function lastTxs(limit: number = 10): Array<TxRaw & Partial<TxDecoded>> {
    const stmt = getDb().prepare(`
    SELECT 
      r.*,
      d.type,
      d.token_in,
      d.token_out,
      d.amount_in,
      d.amount_out,
      d.counterparty,
      d.notes
    FROM tx_raw r
    LEFT JOIN tx_decoded d ON r.hash = d.hash
    ORDER BY r.timestamp DESC
    LIMIT ?
  `);

    return stmt.all(limit) as Array<TxRaw & Partial<TxDecoded>>;
}

/**
 * Get transactions within a time range
 */
export function reportTxs(fromTs: number, toTs: number): Array<TxRaw & Partial<TxDecoded>> {
    const stmt = getDb().prepare(`
    SELECT 
      r.*,
      d.type,
      d.token_in,
      d.token_out,
      d.amount_in,
      d.amount_out,
      d.counterparty,
      d.notes
    FROM tx_raw r
    LEFT JOIN tx_decoded d ON r.hash = d.hash
    WHERE r.timestamp >= ? AND r.timestamp <= ?
    ORDER BY r.timestamp DESC
  `);

    return stmt.all(fromTs, toTs) as Array<TxRaw & Partial<TxDecoded>>;
}

/**
 * Get active token approvals (placeholder - would need approval tracking)
 */
export function activeApprovals(): Array<{ token: string; spender: string; amount: string }> {
    // This would require tracking ERC-20 approval events
    // For now, return empty array as placeholder
    return [];
}

// ============================================================================
// BALANCE OPERATIONS
// ============================================================================

/**
 * Save balance snapshots
 */
export function saveBalanceSnapshot(rows: BalanceSnapshot[]): void {
    const stmt = getDb().prepare(`
    INSERT INTO balances_snapshot (timestamp, token, balance, usd_value, chain_id)
    VALUES (?, ?, ?, ?, ?)
  `);

    const insertMany = getDb().transaction((snapshots: BalanceSnapshot[]) => {
        for (const snapshot of snapshots) {
            stmt.run(
                snapshot.timestamp,
                snapshot.token,
                snapshot.balance,
                snapshot.usd_value || null,
                snapshot.chain_id
            );
        }
    });

    insertMany(rows);
}

/**
 * Get latest balance snapshot for each token
 */
export function getLatestBalances(chainId: number): BalanceSnapshot[] {
    const stmt = getDb().prepare(`
    SELECT b.*
    FROM balances_snapshot b
    INNER JOIN (
      SELECT token, MAX(timestamp) as max_ts
      FROM balances_snapshot
      WHERE chain_id = ?
      GROUP BY token
    ) latest ON b.token = latest.token AND b.timestamp = latest.max_ts
    WHERE b.chain_id = ?
  `);

    return stmt.all(chainId, chainId) as BalanceSnapshot[];
}

// ============================================================================
// X402 PAYMENT OPERATIONS
// ============================================================================

/**
 * Save an x402 payment record
 */
export function saveX402Payment(row: X402Payment): number {
    const stmt = getDb().prepare(`
    INSERT INTO payments_x402 (
      timestamp, merchant, resource, amount, token, tx_hash, status, receipt_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

    const result = stmt.run(
        row.timestamp,
        row.merchant,
        row.resource,
        row.amount,
        row.token,
        row.tx_hash || null,
        row.status,
        row.receipt_json || null
    );

    return result.lastInsertRowid as number;
}

/**
 * Get x402 payments
 */
export function getX402Payments(limit: number = 50): X402Payment[] {
    const stmt = getDb().prepare(`
    SELECT * FROM payments_x402
    ORDER BY timestamp DESC
    LIMIT ?
  `);

    return stmt.all(limit) as X402Payment[];
}

/**
 * Update x402 payment status
 */
export function updateX402PaymentStatus(id: number, status: string, txHash?: string): void {
    const stmt = getDb().prepare(`
    UPDATE payments_x402
    SET status = ?, tx_hash = COALESCE(?, tx_hash)
    WHERE id = ?
  `);

    stmt.run(status, txHash || null, id);
}
