import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { unlinkSync, existsSync } from 'fs';
import {
    initDb,
    closeDb,
    ensureSchema,
    upsertWallet,
    getWallets,
    getWallet,
    setPolicy,
    getPolicy,
    getAllPolicies,
    insertTxRawBulk,
    upsertTxDecoded,
    lastTxs,
    reportTxs,
    saveBalanceSnapshot,
    getLatestBalances,
    saveX402Payment,
    getX402Payments,
    updateX402PaymentStatus,
    type TxRaw,
    type TxDecoded,
    type BalanceSnapshot,
    type X402Payment,
} from '../db/db';

const TEST_DB_PATH = './test-clawfundr.db';

describe('Database', () => {
    beforeEach(() => {
        // Clean up any existing test database
        if (existsSync(TEST_DB_PATH)) {
            unlinkSync(TEST_DB_PATH);
        }
        // Initialize fresh database
        initDb(TEST_DB_PATH);
    });

    afterEach(() => {
        closeDb();
        // Clean up test database
        if (existsSync(TEST_DB_PATH)) {
            unlinkSync(TEST_DB_PATH);
        }
    });

    describe('Schema', () => {
        it('should create all required tables', () => {
            // Schema is created in beforeEach via initDb
            // Just verify we can query without errors
            expect(() => ensureSchema()).not.toThrow();
        });

        it('should be idempotent', () => {
            // Running ensureSchema multiple times should not error
            ensureSchema();
            ensureSchema();
            expect(() => ensureSchema()).not.toThrow();
        });
    });

    describe('Wallet Operations', () => {
        it('should insert a new wallet', () => {
            upsertWallet('0x1234567890abcdef', 8453, 'My Wallet');

            const wallets = getWallets();
            expect(wallets).toHaveLength(1);
            expect(wallets[0].address).toBe('0x1234567890abcdef');
            expect(wallets[0].chain_id).toBe(8453);
            expect(wallets[0].label).toBe('My Wallet');
        });

        it('should update existing wallet on conflict', () => {
            upsertWallet('0x1234567890abcdef', 8453, 'Original Label');
            upsertWallet('0x1234567890abcdef', 8453, 'Updated Label');

            const wallets = getWallets();
            expect(wallets).toHaveLength(1);
            expect(wallets[0].label).toBe('Updated Label');
        });

        it('should get wallet by address', () => {
            upsertWallet('0xabcdef1234567890', 8453, 'Test Wallet');

            const wallet = getWallet('0xabcdef1234567890');
            expect(wallet).toBeDefined();
            expect(wallet?.address).toBe('0xabcdef1234567890');
            expect(wallet?.label).toBe('Test Wallet');
        });

        it('should return undefined for non-existent wallet', () => {
            const wallet = getWallet('0xnonexistent');
            expect(wallet).toBeUndefined();
        });
    });

    describe('Policy Operations', () => {
        it('should set and get a policy', () => {
            const policyValue = JSON.stringify({ maxUsd: 1000 });
            setPolicy('daily_cap', policyValue);

            const retrieved = getPolicy('daily_cap');
            expect(retrieved).toBe(policyValue);
            expect(JSON.parse(retrieved!)).toEqual({ maxUsd: 1000 });
        });

        it('should update existing policy', () => {
            setPolicy('test_key', JSON.stringify({ value: 1 }));
            setPolicy('test_key', JSON.stringify({ value: 2 }));

            const retrieved = getPolicy('test_key');
            expect(JSON.parse(retrieved!)).toEqual({ value: 2 });
        });

        it('should get all policies', () => {
            setPolicy('policy1', JSON.stringify({ a: 1 }));
            setPolicy('policy2', JSON.stringify({ b: 2 }));

            const all = getAllPolicies();
            expect(Object.keys(all)).toHaveLength(2);
            expect(all.policy1).toBe(JSON.stringify({ a: 1 }));
            expect(all.policy2).toBe(JSON.stringify({ b: 2 }));
        });
    });

    describe('Transaction Operations', () => {
        const mockTxs: TxRaw[] = [
            {
                hash: '0xabc123',
                block_number: 1000,
                timestamp: 1704067200,
                from_addr: '0xsender1',
                to_addr: '0xrecipient1',
                value: '1000000000000000000',
                input: '0x',
                status: 1,
                gas_used: '21000',
                gas_price: '1000000000',
                chain_id: 8453,
            },
            {
                hash: '0xdef456',
                block_number: 1001,
                timestamp: 1704067300,
                from_addr: '0xsender2',
                to_addr: '0xrecipient2',
                value: '2000000000000000000',
                input: '0xabcd',
                status: 1,
                gas_used: '50000',
                gas_price: '1200000000',
                chain_id: 8453,
            },
        ];

        it('should insert transactions in bulk', () => {
            insertTxRawBulk(mockTxs);

            const txs = lastTxs(10);
            expect(txs).toHaveLength(2);
            expect(txs[0].hash).toBe('0xdef456'); // Most recent first
            expect(txs[1].hash).toBe('0xabc123');
        });

        it('should upsert decoded transaction data', () => {
            insertTxRawBulk([mockTxs[0]]);

            const decoded: TxDecoded = {
                hash: '0xabc123',
                type: 'transfer',
                token_in: 'ETH',
                amount_in: '1.0',
                counterparty: '0xrecipient1',
                notes: 'Simple transfer',
            };

            upsertTxDecoded(decoded);

            const txs = lastTxs(1);
            expect(txs[0].type).toBe('transfer');
            expect(txs[0].token_in).toBe('ETH');
            expect(txs[0].notes).toBe('Simple transfer');
        });

        it('should get last N transactions', () => {
            insertTxRawBulk(mockTxs);

            const txs = lastTxs(1);
            expect(txs).toHaveLength(1);
            expect(txs[0].hash).toBe('0xdef456'); // Most recent
        });

        it('should get transactions in time range', () => {
            insertTxRawBulk(mockTxs);

            const txs = reportTxs(1704067200, 1704067250);
            expect(txs).toHaveLength(1);
            expect(txs[0].hash).toBe('0xabc123');
        });

        it('should join raw and decoded transaction data', () => {
            insertTxRawBulk([mockTxs[0]]);
            upsertTxDecoded({
                hash: '0xabc123',
                type: 'swap',
                token_in: 'ETH',
                token_out: 'USDC',
                amount_in: '1.0',
                amount_out: '2500',
            });

            const txs = lastTxs(1);
            expect(txs[0].hash).toBe('0xabc123');
            expect(txs[0].type).toBe('swap');
            expect(txs[0].token_in).toBe('ETH');
            expect(txs[0].token_out).toBe('USDC');
        });
    });

    describe('Balance Operations', () => {
        const mockBalances: BalanceSnapshot[] = [
            {
                timestamp: 1704067200,
                token: 'ETH',
                balance: '1.5',
                usd_value: '3750.00',
                chain_id: 8453,
            },
            {
                timestamp: 1704067200,
                token: 'USDC',
                balance: '1000.00',
                usd_value: '1000.00',
                chain_id: 8453,
            },
            {
                timestamp: 1704067300,
                token: 'ETH',
                balance: '1.6',
                usd_value: '4000.00',
                chain_id: 8453,
            },
        ];

        it('should save balance snapshots', () => {
            saveBalanceSnapshot(mockBalances);

            const latest = getLatestBalances(8453);
            expect(latest).toHaveLength(2); // ETH and USDC
        });

        it('should get latest balance for each token', () => {
            saveBalanceSnapshot(mockBalances);

            const latest = getLatestBalances(8453);
            const ethBalance = latest.find(b => b.token === 'ETH');

            expect(ethBalance).toBeDefined();
            expect(ethBalance?.balance).toBe('1.6'); // Latest ETH balance
            expect(ethBalance?.timestamp).toBe(1704067300);
        });
    });

    describe('X402 Payment Operations', () => {
        const mockPayment: X402Payment = {
            timestamp: 1704067200,
            merchant: 'api.example.com',
            resource: '/data/premium',
            amount: '0.01',
            token: 'USDC',
            status: 'pending',
        };

        it('should save x402 payment', () => {
            const id = saveX402Payment(mockPayment);

            expect(id).toBeGreaterThan(0);

            const payments = getX402Payments(10);
            expect(payments).toHaveLength(1);
            expect(payments[0].merchant).toBe('api.example.com');
            expect(payments[0].status).toBe('pending');
        });

        it('should update payment status', () => {
            const id = saveX402Payment(mockPayment);

            updateX402PaymentStatus(id, 'completed', '0xtxhash123');

            const payments = getX402Payments(10);
            expect(payments[0].status).toBe('completed');
            expect(payments[0].tx_hash).toBe('0xtxhash123');
        });

        it('should get payments with limit', () => {
            // Insert 5 payments
            for (let i = 0; i < 5; i++) {
                saveX402Payment({
                    ...mockPayment,
                    timestamp: 1704067200 + i,
                });
            }

            const payments = getX402Payments(3);
            expect(payments).toHaveLength(3);
            // Should be in descending order by timestamp
            expect(payments[0].timestamp).toBeGreaterThan(payments[1].timestamp);
        });
    });
});
