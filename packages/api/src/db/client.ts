import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { getEnvConfig } from '../config/env';

let pool: Pool | null = null;

/**
 * Initialize database connection pool
 */
export function initDb(): Pool {
    if (pool) {
        return pool;
    }

    const config = getEnvConfig();
    pool = new Pool({
        connectionString: config.DATABASE_URL,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
        console.error('Unexpected database error:', err);
    });

    return pool;
}

/**
 * Get database pool
 */
export function getDb(): Pool {
    if (!pool) {
        return initDb();
    }
    return pool;
}

/**
 * Close database connection pool
 */
export async function closeDb(): Promise<void> {
    if (pool) {
        await pool.end();
        pool = null;
    }
}

/**
 * Execute a query
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: any[]
): Promise<QueryResult<T>> {
    const db = getDb();
    return db.query<T>(text, params);
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient(): Promise<PoolClient> {
    const db = getDb();
    return db.connect();
}

/**
 * Execute a transaction
 */
export async function transaction<T>(
    callback: (client: PoolClient) => Promise<T>
): Promise<T> {
    const client = await getClient();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// ============================================================================
// USER OPERATIONS
// ============================================================================

export interface User {
    id: string;
    created_at: Date;
    status: string;
}

/**
 * Create a new user
 */
export async function createUser(): Promise<User> {
    const result = await query<User>(
        'INSERT INTO users DEFAULT VALUES RETURNING *'
    );
    return result.rows[0];
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
    const result = await query<User>(
        'SELECT * FROM users WHERE id = $1',
        [userId]
    );
    return result.rows[0] || null;
}

// ============================================================================
// API KEY OPERATIONS
// ============================================================================

export interface ApiKey {
    id: string;
    user_id: string;
    key_hash: string;
    label: string | null;
    created_at: Date;
    last_used_at: Date | null;
    revoked_at: Date | null;
}

/**
 * Create API key
 */
export async function createApiKey(
    userId: string,
    keyHash: string,
    label?: string
): Promise<ApiKey> {
    const result = await query<ApiKey>(
        'INSERT INTO api_keys (user_id, key_hash, label) VALUES ($1, $2, $3) RETURNING *',
        [userId, keyHash, label || null]
    );
    return result.rows[0];
}

/**
 * Get API key by hash
 */
export async function getApiKeyByHash(keyHash: string): Promise<ApiKey | null> {
    const result = await query<ApiKey>(
        'SELECT * FROM api_keys WHERE key_hash = $1 AND revoked_at IS NULL',
        [keyHash]
    );
    return result.rows[0] || null;
}


/**
 * Get all active API keys.
 * Used for bcrypt.compare() based validation in auth middleware.
 */
export async function getActiveApiKeys(): Promise<ApiKey[]> {
    const result = await query<ApiKey>(
        'SELECT * FROM api_keys WHERE revoked_at IS NULL'
    );
    return result.rows;
}

/**
 * Update API key last used timestamp
 */
export async function updateApiKeyLastUsed(keyId: string): Promise<void> {
    await query(
        'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
        [keyId]
    );
}

/**
 * Get all API keys for a user
 */
export async function getUserApiKeys(userId: string): Promise<ApiKey[]> {
    const result = await query<ApiKey>(
        'SELECT * FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
    );
    return result.rows;
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(keyId: string, userId: string): Promise<void> {
    await query(
        'UPDATE api_keys SET revoked_at = NOW() WHERE id = $1 AND user_id = $2',
        [keyId, userId]
    );
}

// ============================================================================
// WALLET OPERATIONS
// ============================================================================

export interface Wallet {
    id: string;
    user_id: string;
    chain_id: number;
    address: string;
    label: string | null;
    created_at: Date;
}

/**
 * Register a wallet
 */
export async function registerWallet(
    userId: string,
    chainId: number,
    address: string,
    label?: string
): Promise<Wallet> {
    const result = await query<Wallet>(
        `INSERT INTO wallets (user_id, chain_id, address, label) 
     VALUES ($1, $2, $3, $4) 
     ON CONFLICT (user_id, chain_id, address) DO UPDATE SET label = COALESCE($4, wallets.label)
     RETURNING *`,
        [userId, chainId, address.toLowerCase(), label || null]
    );
    return result.rows[0];
}

/**
 * Get wallet by ID
 */
export async function getWalletById(walletId: string, userId: string): Promise<Wallet | null> {
    const result = await query<Wallet>(
        'SELECT * FROM wallets WHERE id = $1 AND user_id = $2',
        [walletId, userId]
    );
    return result.rows[0] || null;
}

/**
 * Get wallet by address
 */
export async function getWalletByAddress(
    address: string,
    userId: string,
    chainId: number
): Promise<Wallet | null> {
    const result = await query<Wallet>(
        'SELECT * FROM wallets WHERE address = $1 AND user_id = $2 AND chain_id = $3',
        [address.toLowerCase(), userId, chainId]
    );
    return result.rows[0] || null;
}

/**
 * Get all wallets for a user
 */
export async function getUserWallets(userId: string): Promise<Wallet[]> {
    const result = await query<Wallet>(
        'SELECT * FROM wallets WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
    );
    return result.rows;
}

// ============================================================================
// REQUEST LOG OPERATIONS
// ============================================================================

export interface RequestLog {
    id: string;
    user_id: string | null;
    api_key_id: string | null;
    ip: string | null;
    route: string;
    ts: Date;
    tokens_in: number | null;
    tokens_out: number | null;
    cost_estimate: string | null;
}

/**
 * Log API request
 */
export async function logRequest(
    userId: string | null,
    apiKeyId: string | null,
    ip: string | null,
    route: string,
    tokensIn?: number,
    tokensOut?: number,
    costEstimate?: number
): Promise<void> {
    await query(
        `INSERT INTO requests_log (user_id, api_key_id, ip, route, tokens_in, tokens_out, cost_estimate)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, apiKeyId, ip, route, tokensIn || null, tokensOut || null, costEstimate || null]
    );
}

// ============================================================================
// POLICY OPERATIONS
// ============================================================================

export interface Policy {
    user_id: string;
    value_json: string;
}

/**
 * Get user policy
 */
export async function getUserPolicy(userId: string): Promise<Policy | null> {
    const result = await query<Policy>(
        'SELECT * FROM policies WHERE user_id = $1',
        [userId]
    );
    return result.rows[0] || null;
}

/**
 * Set user policy
 */
export async function setUserPolicy(userId: string, policyJson: string): Promise<void> {
    await query(
        `INSERT INTO policies (user_id, value_json) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET value_json = $2`,
        [userId, policyJson]
    );
}

// ============================================================================
// ACTION PROPOSAL OPERATIONS
// ============================================================================

export interface ActionProposal {
    id: string;
    user_id: string;
    type: string;
    payload_json: string;
    status: string;
    created_at: Date;
    expires_at: Date;
}

/**
 * Create action proposal
 */
export async function createActionProposal(
    userId: string,
    type: string,
    payloadJson: string,
    expiresInMinutes: number = 5
): Promise<ActionProposal> {
    const result = await query<ActionProposal>(
        `INSERT INTO action_proposals (user_id, type, payload_json, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '${expiresInMinutes} minutes')
     RETURNING *`,
        [userId, type, payloadJson]
    );
    return result.rows[0];
}

/**
 * Get action proposal by ID
 */
export async function getActionProposal(
    proposalId: string,
    userId: string
): Promise<ActionProposal | null> {
    const result = await query<ActionProposal>(
        'SELECT * FROM action_proposals WHERE id = $1 AND user_id = $2',
        [proposalId, userId]
    );
    return result.rows[0] || null;
}

/**
 * Update action proposal status
 */
export async function updateActionProposalStatus(
    proposalId: string,
    status: string
): Promise<void> {
    await query(
        'UPDATE action_proposals SET status = $1 WHERE id = $2',
        [status, proposalId]
    );
}

/**
 * Expire old proposals
 */
export async function expireOldProposals(): Promise<void> {
    await query(
        `UPDATE action_proposals 
     SET status = 'expired' 
     WHERE status = 'pending' AND expires_at < NOW()`
    );
}
