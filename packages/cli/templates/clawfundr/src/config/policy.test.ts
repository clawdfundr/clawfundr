import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import Database from 'better-sqlite3';
import {
    loadPolicy,
    reloadPolicy,
    isChainAllowed,
    isTokenAllowed,
    getTokenInfo,
    isMerchantAllowed,
    isRecipientAllowed,
    checkCaps,
    requireConfirmationForRiskyActions,
    isSlippageAllowed,
    getMaxSlippageBps,
    isAssetExposureAllowed,
    getTargetStableRatio,
    formatPolicyError,
} from './policy';

const TEST_POLICY_PATH = './test-policy.json';
const TEST_DB_PATH = './test-policy.db';

const mockPolicy = {
    version: '1.0',
    description: 'Test policy',
    chainAllowlist: [8453, 1],
    tokenAllowlist: [
        {
            symbol: 'USDC',
            address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            decimals: 6,
            description: 'USD Coin'
        },
        {
            symbol: 'WETH',
            address: '0x4200000000000000000000000000000000000006',
            decimals: 18,
            description: 'Wrapped Ether'
        }
    ],
    merchantAllowlistDomains: ['api.trusted.com', 'payments.example.org'],
    recipientAllowlist: ['0x1234567890abcdef1234567890abcdef12345678'],
    caps: {
        perPayment: {
            enabled: true,
            maxUsd: 1000,
            description: 'Max per payment'
        },
        daily: {
            enabled: true,
            maxUsd: 5000,
            description: 'Max per day'
        }
    },
    slippageCapBps: 100,
    targetStableRatio: 0.5,
    maxExposurePerAsset: 0.3,
    rules: {
        transaction_approval: {
            enabled: true,
            description: 'All transactions require approval'
        },
        private_key_exposure: {
            enabled: true,
            description: 'Never expose private keys'
        },
        fund_advice: {
            risk_profiles: ['conservative', 'moderate', 'aggressive'],
            default_profile: 'moderate'
        }
    },
    skills: {
        enabled: ['balance-check', 'transaction-history']
    }
};

describe('Policy Configuration', () => {
    let db: Database.Database;

    beforeEach(() => {
        // Create test policy file
        writeFileSync(TEST_POLICY_PATH, JSON.stringify(mockPolicy, null, 2));

        // Create test database
        db = new Database(TEST_DB_PATH);
        db.exec(`
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
      )
    `);
    });

    afterEach(() => {
        // Clean up
        if (existsSync(TEST_POLICY_PATH)) {
            unlinkSync(TEST_POLICY_PATH);
        }
        if (db) {
            db.close();
        }
        if (existsSync(TEST_DB_PATH)) {
            unlinkSync(TEST_DB_PATH);
        }
    });

    describe('Policy Loading', () => {
        it('should load and validate policy.json', () => {
            const policy = loadPolicy(TEST_POLICY_PATH);

            expect(policy.version).toBe('1.0');
            expect(policy.chainAllowlist).toContain(8453);
            expect(policy.tokenAllowlist).toHaveLength(2);
        });

        it('should reject invalid policy', () => {
            const invalidPolicy = { ...mockPolicy, chainAllowlist: 'invalid' };
            writeFileSync(TEST_POLICY_PATH, JSON.stringify(invalidPolicy));

            expect(() => reloadPolicy(TEST_POLICY_PATH)).toThrow('Policy validation failed');
        });

        it('should reject malformed JSON', () => {
            writeFileSync(TEST_POLICY_PATH, '{ invalid json }');

            expect(() => reloadPolicy(TEST_POLICY_PATH)).toThrow('Invalid JSON format');
        });

        it('should cache policy after first load', () => {
            const policy1 = loadPolicy(TEST_POLICY_PATH);
            const policy2 = loadPolicy(TEST_POLICY_PATH);

            expect(policy1).toBe(policy2); // Same reference
        });

        it('should reload policy when explicitly requested', () => {
            loadPolicy(TEST_POLICY_PATH);

            // Modify policy file
            const modifiedPolicy = { ...mockPolicy, version: '2.0' };
            writeFileSync(TEST_POLICY_PATH, JSON.stringify(modifiedPolicy));

            const reloaded = reloadPolicy(TEST_POLICY_PATH);
            expect(reloaded.version).toBe('2.0');
        });
    });

    describe('Chain Allowlist', () => {
        beforeEach(() => {
            reloadPolicy(TEST_POLICY_PATH);
        });

        it('should allow chains in allowlist', () => {
            expect(isChainAllowed(8453)).toBe(true);
            expect(isChainAllowed(1)).toBe(true);
        });

        it('should reject chains not in allowlist', () => {
            expect(isChainAllowed(137)).toBe(false);
            expect(isChainAllowed(42161)).toBe(false);
        });
    });

    describe('Token Allowlist', () => {
        beforeEach(() => {
            reloadPolicy(TEST_POLICY_PATH);
        });

        it('should allow tokens in allowlist', () => {
            expect(isTokenAllowed('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')).toBe(true);
            expect(isTokenAllowed('0x4200000000000000000000000000000000000006')).toBe(true);
        });

        it('should be case-insensitive', () => {
            expect(isTokenAllowed('0x833589FCD6EDB6E08F4C7C32D4F71B54BDA02913')).toBe(true);
            expect(isTokenAllowed('0X4200000000000000000000000000000000000006')).toBe(true);
        });

        it('should reject tokens not in allowlist', () => {
            expect(isTokenAllowed('0x0000000000000000000000000000000000000000')).toBe(false);
        });

        it('should get token info', () => {
            const usdc = getTokenInfo('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');

            expect(usdc).toBeDefined();
            expect(usdc?.symbol).toBe('USDC');
            expect(usdc?.decimals).toBe(6);
        });

        it('should return undefined for unknown token', () => {
            const unknown = getTokenInfo('0x0000000000000000000000000000000000000000');
            expect(unknown).toBeUndefined();
        });
    });

    describe('Merchant Allowlist', () => {
        beforeEach(() => {
            reloadPolicy(TEST_POLICY_PATH);
        });

        it('should allow merchants in allowlist', () => {
            expect(isMerchantAllowed('api.trusted.com')).toBe(true);
            expect(isMerchantAllowed('payments.example.org')).toBe(true);
        });

        it('should be case-insensitive', () => {
            expect(isMerchantAllowed('API.TRUSTED.COM')).toBe(true);
            expect(isMerchantAllowed('Payments.Example.Org')).toBe(true);
        });

        it('should reject merchants not in allowlist', () => {
            expect(isMerchantAllowed('malicious.com')).toBe(false);
        });

        it('should allow all merchants if allowlist is empty', () => {
            const emptyAllowlistPolicy = { ...mockPolicy, merchantAllowlistDomains: [] };
            writeFileSync(TEST_POLICY_PATH, JSON.stringify(emptyAllowlistPolicy));
            reloadPolicy(TEST_POLICY_PATH);

            expect(isMerchantAllowed('any-merchant.com')).toBe(true);
        });
    });

    describe('Recipient Allowlist', () => {
        beforeEach(() => {
            reloadPolicy(TEST_POLICY_PATH);
        });

        it('should allow recipients in allowlist', () => {
            expect(isRecipientAllowed('0x1234567890abcdef1234567890abcdef12345678')).toBe(true);
        });

        it('should be case-insensitive', () => {
            expect(isRecipientAllowed('0X1234567890ABCDEF1234567890ABCDEF12345678')).toBe(true);
        });

        it('should reject recipients not in allowlist', () => {
            expect(isRecipientAllowed('0x0000000000000000000000000000000000000000')).toBe(false);
        });

        it('should allow all recipients if allowlist is empty', () => {
            const emptyAllowlistPolicy = { ...mockPolicy, recipientAllowlist: [] };
            writeFileSync(TEST_POLICY_PATH, JSON.stringify(emptyAllowlistPolicy));
            reloadPolicy(TEST_POLICY_PATH);

            expect(isRecipientAllowed('0x0000000000000000000000000000000000000000')).toBe(true);
        });
    });

    describe('Spending Caps', () => {
        beforeEach(() => {
            reloadPolicy(TEST_POLICY_PATH);
        });

        it('should allow amounts within per-payment cap', () => {
            const nowTs = Math.floor(Date.now() / 1000);
            const result = checkCaps(500, 'USDC', nowTs, db);

            expect(result.allowed).toBe(true);
            expect(result.reason).toBeUndefined();
        });

        it('should reject amounts exceeding per-payment cap', () => {
            const nowTs = Math.floor(Date.now() / 1000);
            const result = checkCaps(1500, 'USDC', nowTs, db);

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('per-payment cap');
            expect(result.reason).toContain('$1500.00');
        });

        it('should enforce daily cap', () => {
            const nowTs = Math.floor(Date.now() / 1000);

            // Insert existing payments totaling $4000
            db.prepare(`
        INSERT INTO payments_x402 (timestamp, merchant, resource, amount, token, status)
        VALUES (?, 'test', '/resource', '4000', 'USDC', 'completed')
      `).run(nowTs - 3600); // 1 hour ago

            // Try to spend another $1500 (would exceed $5000 daily cap)
            const result = checkCaps(1500, 'USDC', nowTs, db);

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Daily cap exceeded');
            expect(result.reason).toContain('$4000.00');
        });

        it('should allow spending within daily cap', () => {
            const nowTs = Math.floor(Date.now() / 1000);

            // Insert existing payments totaling $3000
            db.prepare(`
        INSERT INTO payments_x402 (timestamp, merchant, resource, amount, token, status)
        VALUES (?, 'test', '/resource', '3000', 'USDC', 'completed')
      `).run(nowTs - 3600);

            // Try to spend $1000 (total $4000, within $5000 cap)
            const result = checkCaps(1000, 'USDC', nowTs, db);

            expect(result.allowed).toBe(true);
        });

        it('should only count payments from last 24 hours', () => {
            const nowTs = Math.floor(Date.now() / 1000);

            // Insert old payment (25 hours ago)
            db.prepare(`
        INSERT INTO payments_x402 (timestamp, merchant, resource, amount, token, status)
        VALUES (?, 'test', '/resource', '4000', 'USDC', 'completed')
      `).run(nowTs - 90000); // 25 hours

            // Should allow new payment since old one is outside 24h window
            const result = checkCaps(1000, 'USDC', nowTs, db);

            expect(result.allowed).toBe(true);
        });

        it('should count pending payments in daily cap', () => {
            const nowTs = Math.floor(Date.now() / 1000);

            // Insert pending payment
            db.prepare(`
        INSERT INTO payments_x402 (timestamp, merchant, resource, amount, token, status)
        VALUES (?, 'test', '/resource', '4500', 'USDC', 'pending')
      `).run(nowTs - 1800);

            // Should reject new payment
            const result = checkCaps(1000, 'USDC', nowTs, db);

            expect(result.allowed).toBe(false);
        });
    });

    describe('Risk Assessment', () => {
        beforeEach(() => {
            reloadPolicy(TEST_POLICY_PATH);
        });

        it('should require confirmation for risky actions', () => {
            expect(requireConfirmationForRiskyActions('send')).toBe(true);
            expect(requireConfirmationForRiskyActions('transfer')).toBe(true);
            expect(requireConfirmationForRiskyActions('swap')).toBe(true);
            expect(requireConfirmationForRiskyActions('approve')).toBe(true);
        });

        it('should require confirmation when policy mandates it', () => {
            expect(requireConfirmationForRiskyActions('query')).toBe(true); // Because transaction_approval is enabled
        });

        it('should validate slippage', () => {
            expect(isSlippageAllowed(50)).toBe(true);
            expect(isSlippageAllowed(100)).toBe(true);
            expect(isSlippageAllowed(150)).toBe(false);
        });

        it('should get max slippage', () => {
            expect(getMaxSlippageBps()).toBe(100);
        });

        it('should validate asset exposure', () => {
            expect(isAssetExposureAllowed(0.2)).toBe(true);
            expect(isAssetExposureAllowed(0.3)).toBe(true);
            expect(isAssetExposureAllowed(0.4)).toBe(false);
        });

        it('should get target stable ratio', () => {
            expect(getTargetStableRatio()).toBe(0.5);
        });
    });

    describe('Error Formatting', () => {
        it('should format policy errors without secrets', () => {
            const error = formatPolicyError('Chain not allowed', 'Chain ID 137 is not in the allowlist');

            expect(error).toContain('Policy Violation');
            expect(error).toContain('Chain not allowed');
            expect(error).toContain('Chain ID 137');
            expect(error).toContain('policy.json');
            expect(error).not.toContain('0x'); // No addresses
        });

        it('should format errors without details', () => {
            const error = formatPolicyError('Invalid configuration');

            expect(error).toContain('Policy Violation');
            expect(error).toContain('Invalid configuration');
        });
    });
});
