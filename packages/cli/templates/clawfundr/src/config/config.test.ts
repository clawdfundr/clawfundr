import { describe, it, expect } from 'vitest';
import { getEnvConfig } from './env';
import { loadPolicy, getPolicy, isChainAllowed, isTokenAllowed, checkCaps } from './policy';

describe('Configuration and Policy', () => {
    describe('Policy Loading', () => {
        it('should load policy from policy.json', () => {
            const policy = loadPolicy();

            expect(policy).toBeDefined();
            expect(policy.chainAllowlist).toBeDefined();
            expect(policy.tokenAllowlist).toBeDefined();
            expect(policy.caps).toBeDefined();
        });

        it('should have Base chain in allowlist', () => {
            const policy = getPolicy();
            expect(policy.chainAllowlist).toContain(8453);
        });

        it('should have USDC in token allowlist', () => {
            const policy = getPolicy();
            const usdc = policy.tokenAllowlist.find(t => t.symbol === 'USDC');
            expect(usdc).toBeDefined();
            expect(usdc?.address).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
        });
    });

    describe('Chain Validation', () => {
        it('should allow Base chain', () => {
            expect(isChainAllowed(8453)).toBe(true);
        });

        it('should reject non-allowed chains', () => {
            expect(isChainAllowed(1)).toBe(false); // Ethereum mainnet
            expect(isChainAllowed(137)).toBe(false); // Polygon
        });
    });

    describe('Token Validation', () => {
        it('should allow USDC', () => {
            const usdcAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
            expect(isTokenAllowed(usdcAddress)).toBe(true);
        });

        it('should reject non-allowed tokens', () => {
            const randomAddress = '0x0000000000000000000000000000000000000000';
            expect(isTokenAllowed(randomAddress)).toBe(false);
        });
    });

    describe('Spending Caps', () => {
        it('should enforce per-payment cap', () => {
            const policy = getPolicy();
            const db = { prepare: () => ({ all: () => [] }) } as any;

            const result = checkCaps(
                policy.caps.perPayment + 100, // Exceed cap
                'USDC',
                Math.floor(Date.now() / 1000),
                db
            );

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('per-payment cap');
        });

        it('should allow payments within cap', () => {
            const policy = getPolicy();
            const db = { prepare: () => ({ all: () => [] }) } as any;

            const result = checkCaps(
                policy.caps.perPayment - 100, // Within cap
                'USDC',
                Math.floor(Date.now() / 1000),
                db
            );

            expect(result.allowed).toBe(true);
        });
    });
});
