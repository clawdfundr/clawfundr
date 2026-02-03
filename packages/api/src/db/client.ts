import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { getEnvConfig } from '../config/env';

let pool: Pool | null = null;

let agentProfilesReady = false;

async function ensureAgentProfilesTable(): Promise<void> {
    if (agentProfilesReady) {
        return;
    }

    await query(`
        CREATE TABLE IF NOT EXISTS agent_profiles (
            user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            display_name TEXT,
            agent_name TEXT,
            description TEXT,
            verification_code TEXT NOT NULL UNIQUE,
            verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified')),
            tweet_url TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            verified_at TIMESTAMPTZ,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await query('ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS agent_name TEXT');
    await query('ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS description TEXT');

    agentProfilesReady = true;
}

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

    ensureAgentProfilesTable().catch((err) => {
        console.error('Failed ensuring agent_profiles table:', err);
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
// AGENT PROFILE OPERATIONS
// ============================================================================

export interface AgentProfile {
    user_id: string;
    display_name: string | null;
    agent_name: string | null;
    description: string | null;
    verification_code: string;
    verification_status: 'pending' | 'verified';
    tweet_url: string | null;
    created_at: Date;
    verified_at: Date | null;
    updated_at: Date;
}

export interface AgentStats {
    total_agents: number;
    verified_agents: number;
    pending_agents: number;
}

export interface AgentDashboardMetrics {
    requests_count: number;
    tx_count: number;
    trades_count: number;
}

export interface AgentSkillUsage {
    route: string;
    count: number;
}

export interface AgentActivityItem {
    route: string;
    ts: Date;
}

export interface AgentTradeItem {
    hash: string;
    type: string;
    token_in: string | null;
    token_out: string | null;
    amount_in: string | null;
    amount_out: string | null;
}

export interface VerifiedAgentWithStats extends AgentProfile {
    trades_count: number;
    estimated_pnl: string;
}

export async function upsertAgentProfile(
    userId: string,
    verificationCode: string,
    agentName: string,
    description: string
): Promise<AgentProfile> {
    await ensureAgentProfilesTable();

    const result = await query<AgentProfile>(
        `INSERT INTO agent_profiles (user_id, display_name, agent_name, description, verification_code)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id)
         DO UPDATE SET
            display_name = EXCLUDED.display_name,
            agent_name = EXCLUDED.agent_name,
            description = EXCLUDED.description,
            verification_code = EXCLUDED.verification_code,
            verification_status = 'pending',
            tweet_url = NULL,
            verified_at = NULL,
            updated_at = NOW()
         RETURNING *`,
        [userId, agentName, agentName, description, verificationCode]
    );

    return result.rows[0];
}

export async function getAgentProfile(userId: string): Promise<AgentProfile | null> {
    await ensureAgentProfilesTable();

    const result = await query<AgentProfile>(
        'SELECT * FROM agent_profiles WHERE user_id = $1',
        [userId]
    );

    return result.rows[0] || null;
}

export async function isAgentNameTaken(agentName: string): Promise<boolean> {
    await ensureAgentProfilesTable();

    const result = await query<{ exists: boolean }>(
        'SELECT EXISTS(SELECT 1 FROM agent_profiles WHERE LOWER(agent_name) = LOWER($1)) AS exists',
        [agentName]
    );

    return result.rows[0]?.exists || false;
}

export async function saveAgentTweetUrl(userId: string, tweetUrl: string): Promise<void> {
    await ensureAgentProfilesTable();

    await query(
        `UPDATE agent_profiles
         SET tweet_url = $2,
             updated_at = NOW()
         WHERE user_id = $1`,
        [userId, tweetUrl]
    );
}

export async function markAgentVerified(userId: string, tweetUrl: string): Promise<AgentProfile | null> {
    await ensureAgentProfilesTable();

    const result = await query<AgentProfile>(
        `UPDATE agent_profiles
         SET verification_status = 'verified',
             tweet_url = $2,
             verified_at = NOW(),
             updated_at = NOW()
         WHERE user_id = $1
         RETURNING *`,
        [userId, tweetUrl]
    );

    return result.rows[0] || null;
}

export async function getAgentStats(): Promise<AgentStats> {
    await ensureAgentProfilesTable();

    const result = await query<AgentStats>(
        `SELECT
            COUNT(*)::int AS total_agents,
            COUNT(*) FILTER (WHERE verification_status = 'verified')::int AS verified_agents,
            COUNT(*) FILTER (WHERE verification_status = 'pending')::int AS pending_agents
         FROM agent_profiles`
    );

    return result.rows[0];
}

export async function listAgents(limit: number = 100): Promise<AgentProfile[]> {
    await ensureAgentProfilesTable();

    const result = await query<AgentProfile>(
        `SELECT *
         FROM agent_profiles
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit]
    );

    return result.rows;
}

export async function listVerifiedAgents(limit: number = 100): Promise<AgentProfile[]> {
    await ensureAgentProfilesTable();

    const result = await query<AgentProfile>(
        `SELECT *
         FROM agent_profiles
         WHERE verification_status = 'verified'
         ORDER BY verified_at DESC NULLS LAST, created_at DESC
         LIMIT $1`,
        [limit]
    );

    return result.rows;
}

export async function getVerifiedAgentByName(agentName: string): Promise<AgentProfile | null> {
    await ensureAgentProfilesTable();

    const result = await query<AgentProfile>(
        `SELECT *
         FROM agent_profiles
         WHERE verification_status = 'verified'
           AND LOWER(agent_name) = LOWER($1)
         LIMIT 1`,
        [agentName]
    );

    return result.rows[0] || null;
}

export async function listVerifiedAgentsWithStats(limit: number = 100): Promise<VerifiedAgentWithStats[]> {
    await ensureAgentProfilesTable();

    const result = await query<VerifiedAgentWithStats>(
        `SELECT
            ap.*,
            COALESCE(COUNT(td.*), 0)::int AS trades_count,
            COALESCE(
                SUM(
                    (CASE WHEN td.amount_out ~ '^\d+(\.\d+)?$' THEN td.amount_out::numeric ELSE 0 END)
                    -
                    (CASE WHEN td.amount_in ~ '^\d+(\.\d+)?$' THEN td.amount_in::numeric ELSE 0 END)
                ),
                0
            )::text AS estimated_pnl
         FROM agent_profiles ap
         LEFT JOIN tx_decoded td ON td.user_id = ap.user_id
         WHERE ap.verification_status = 'verified'
         GROUP BY ap.user_id
         ORDER BY ap.verified_at DESC NULLS LAST, ap.created_at DESC
         LIMIT $1`,
        [limit]
    );

    return result.rows;
}

export async function getAgentDashboardMetrics(userId: string): Promise<AgentDashboardMetrics> {
    const result = await query<AgentDashboardMetrics>(
        `SELECT
            (SELECT COUNT(*)::int FROM requests_log WHERE user_id = $1) AS requests_count,
            (SELECT COUNT(*)::int FROM tx_raw WHERE user_id = $1) AS tx_count,
            (SELECT COUNT(*)::int FROM tx_decoded WHERE user_id = $1) AS trades_count`,
        [userId]
    );

    return result.rows[0];
}

export async function getAgentSkillUsage(userId: string, limit: number = 10): Promise<AgentSkillUsage[]> {
    const result = await query<AgentSkillUsage>(
        `SELECT route, COUNT(*)::int AS count
         FROM requests_log
         WHERE user_id = $1
         GROUP BY route
         ORDER BY count DESC
         LIMIT $2`,
        [userId, limit]
    );

    return result.rows;
}

export async function getAgentActivity(userId: string, limit: number = 20): Promise<AgentActivityItem[]> {
    const result = await query<AgentActivityItem>(
        `SELECT route, ts
         FROM requests_log
         WHERE user_id = $1
         ORDER BY ts DESC
         LIMIT $2`,
        [userId, limit]
    );

    return result.rows;
}

export async function getAgentTrades(userId: string, limit: number = 20): Promise<AgentTradeItem[]> {
    const result = await query<AgentTradeItem>(
        `SELECT hash, type, token_in, token_out, amount_in, amount_out
         FROM tx_decoded
         WHERE user_id = $1
         ORDER BY id DESC
         LIMIT $2`,
        [userId, limit]
    );

    return result.rows;
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
