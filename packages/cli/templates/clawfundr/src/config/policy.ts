import { z } from 'zod';
import { readFileSync } from 'fs';
import { join } from 'path';
import type Database from 'better-sqlite3';

/**
 * Token allowlist entry schema
 */
const tokenSchema = z.object({
    symbol: z.string(),
    address: z.string(),
    decimals: z.number(),
    description: z.string().optional(),
});

/**
 * Cap configuration schema
 */
const capSchema = z.object({
    enabled: z.boolean(),
    maxUsd: z.number().optional(),
    description: z.string().optional(),
});

/**
 * Policy configuration schema
 */
const policySchema = z.object({
    version: z.string(),
    description: z.string().optional(),
    chainAllowlist: z.array(z.number()),
    tokenAllowlist: z.array(tokenSchema),
    merchantAllowlistDomains: z.array(z.string()),
    recipientAllowlist: z.array(z.string()),
    caps: z.object({
        perPayment: capSchema,
        daily: capSchema,
    }),
    slippageCapBps: z.number(),
    targetStableRatio: z.number(),
    maxExposurePerAsset: z.number(),
    rules: z.object({
        transaction_approval: z.object({
            enabled: z.boolean(),
            description: z.string().optional(),
        }),
        private_key_exposure: z.object({
            enabled: z.boolean(),
            description: z.string().optional(),
        }),
        fund_advice: z.object({
            risk_profiles: z.array(z.string()),
            default_profile: z.string(),
        }),
    }).optional(),
    skills: z.object({
        enabled: z.array(z.string()),
    }).optional(),
});

export type PolicyConfig = z.infer<typeof policySchema>;
export type TokenAllowlistEntry = z.infer<typeof tokenSchema>;
export type CapConfig = z.infer<typeof capSchema>;

let cachedPolicy: PolicyConfig | null = null;

/**
 * Load and validate policy.json
 * @param policyPath Path to policy.json file
 * @throws Error if policy file is invalid
 */
export function loadPolicy(policyPath: string = './policy.json'): PolicyConfig {
    if (cachedPolicy) {
        return cachedPolicy;
    }

    try {
        const policyContent = readFileSync(policyPath, 'utf-8');
        const policyData = JSON.parse(policyContent);

        const result = policySchema.safeParse(policyData);

        if (!result.success) {
            const errors = result.error.errors
                .map(e => `  - ${e.path.join('.')}: ${e.message}`)
                .join('\n');
            throw new Error(`Policy validation failed:\n${errors}`);
        }

        cachedPolicy = result.data;
        return result.data;
    } catch (error) {
        if (error instanceof SyntaxError) {
            throw new Error(`Failed to parse policy.json: Invalid JSON format`);
        }
        throw error;
    }
}

/**
 * Get cached policy configuration
 * @throws Error if policy not yet loaded
 */
export function getPolicy(): PolicyConfig {
    if (!cachedPolicy) {
        return loadPolicy();
    }
    return cachedPolicy;
}

/**
 * Reload policy from disk (useful for testing or config updates)
 */
export function reloadPolicy(policyPath?: string): PolicyConfig {
    cachedPolicy = null;
    return loadPolicy(policyPath);
}

// ============================================================================
// POLICY ENFORCEMENT HELPERS
// ============================================================================

/**
 * Check if a chain ID is allowed
 */
export function isChainAllowed(chainId: number): boolean {
    const policy = getPolicy();
    return policy.chainAllowlist.includes(chainId);
}

/**
 * Check if a token address is allowed
 * @param tokenAddress Token contract address (case-insensitive)
 */
export function isTokenAllowed(tokenAddress: string): boolean {
    const policy = getPolicy();
    const normalizedAddress = tokenAddress.toLowerCase();

    return policy.tokenAllowlist.some(
        token => token.address.toLowerCase() === normalizedAddress
    );
}

/**
 * Get token info from allowlist
 */
export function getTokenInfo(tokenAddress: string): TokenAllowlistEntry | undefined {
    const policy = getPolicy();
    const normalizedAddress = tokenAddress.toLowerCase();

    return policy.tokenAllowlist.find(
        token => token.address.toLowerCase() === normalizedAddress
    );
}

/**
 * Check if a merchant domain is allowed
 * @param domain Merchant domain (e.g., "api.example.com")
 */
export function isMerchantAllowed(domain: string): boolean {
    const policy = getPolicy();

    // If allowlist is empty, all merchants are allowed
    if (policy.merchantAllowlistDomains.length === 0) {
        return true;
    }

    const normalizedDomain = domain.toLowerCase();
    return policy.merchantAllowlistDomains.some(
        allowed => allowed.toLowerCase() === normalizedDomain
    );
}

/**
 * Check if a recipient address is allowed
 * @param address Recipient address (case-insensitive)
 */
export function isRecipientAllowed(address: string): boolean {
    const policy = getPolicy();

    // If allowlist is empty, all recipients are allowed
    if (policy.recipientAllowlist.length === 0) {
        return true;
    }

    const normalizedAddress = address.toLowerCase();
    return policy.recipientAllowlist.some(
        allowed => allowed.toLowerCase() === normalizedAddress
    );
}

/**
 * Check spending caps against policy
 * @param amountUsd Amount in USD
 * @param token Token symbol
 * @param nowTs Current timestamp (seconds)
 * @param db Database instance for querying payment history
 * @returns Object with allowed status and reason if denied
 */
export function checkCaps(
    amountUsd: number,
    token: string,
    nowTs: number,
    db: Database.Database
): { allowed: boolean; reason?: string } {
    const policy = getPolicy();

    // Check per-payment cap
    if (policy.caps.perPayment.enabled && policy.caps.perPayment.maxUsd) {
        if (amountUsd > policy.caps.perPayment.maxUsd) {
            return {
                allowed: false,
                reason: `Amount ($${amountUsd.toFixed(2)}) exceeds per-payment cap ($${policy.caps.perPayment.maxUsd.toFixed(2)})`,
            };
        }
    }

    // Check daily cap
    if (policy.caps.daily.enabled && policy.caps.daily.maxUsd) {
        const oneDayAgo = nowTs - 86400; // 24 hours in seconds

        // Query payments in last 24 hours
        const stmt = db.prepare(`
      SELECT SUM(CAST(amount AS REAL)) as total
      FROM payments_x402
      WHERE timestamp >= ?
      AND status IN ('completed', 'pending')
    `);

        const result = stmt.get(oneDayAgo) as { total: number | null };
        const dailySpent = result.total || 0;
        const newTotal = dailySpent + amountUsd;

        if (newTotal > policy.caps.daily.maxUsd) {
            return {
                allowed: false,
                reason: `Daily cap exceeded. Spent: $${dailySpent.toFixed(2)}, Limit: $${policy.caps.daily.maxUsd.toFixed(2)}, Requested: $${amountUsd.toFixed(2)}`,
            };
        }
    }

    return { allowed: true };
}

/**
 * Determine if an action requires user confirmation
 * @param action Action type (e.g., 'send', 'swap', 'approve')
 * @returns true if confirmation is required
 */
export function requireConfirmationForRiskyActions(action: string): boolean {
    const policy = getPolicy();

    // If transaction approval is enabled, all actions require confirmation
    if (policy.rules?.transaction_approval?.enabled) {
        return true;
    }

    // Define risky actions that always require confirmation
    const riskyActions = ['send', 'transfer', 'swap', 'approve', 'stake', 'unstake'];
    return riskyActions.includes(action.toLowerCase());
}

/**
 * Validate slippage is within policy limits
 * @param slippageBps Slippage in basis points (100 = 1%)
 */
export function isSlippageAllowed(slippageBps: number): boolean {
    const policy = getPolicy();
    return slippageBps <= policy.slippageCapBps;
}

/**
 * Get maximum allowed slippage
 */
export function getMaxSlippageBps(): number {
    const policy = getPolicy();
    return policy.slippageCapBps;
}

/**
 * Validate portfolio allocation against policy
 * @param assetRatio Ratio of single asset to total portfolio (0-1)
 */
export function isAssetExposureAllowed(assetRatio: number): boolean {
    const policy = getPolicy();
    return assetRatio <= policy.maxExposurePerAsset;
}

/**
 * Get target stablecoin ratio from policy
 */
export function getTargetStableRatio(): number {
    const policy = getPolicy();
    return policy.targetStableRatio;
}

/**
 * Format policy violation error message (user-friendly, no secrets)
 */
export function formatPolicyError(violation: string, details?: string): string {
    let message = `🚫 Policy Violation: ${violation}`;

    if (details) {
        message += `\n\n${details}`;
    }

    message += '\n\nPlease review your policy.json configuration or contact your administrator.';

    return message;
}
