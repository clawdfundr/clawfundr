import { describe, it, expect } from 'vitest';
import {
    classifyTransaction,
    isUnlimitedApproval,
    filterByCategory,
    getHighRiskTransactions,
    groupByToken,
    getTopCounterparties,
    TransactionCategory,
    type ClassifiedTransaction,
} from './history';
import type { TxRaw, TxDecoded } from '../db/db';

describe('Transaction Classification', () => {
    describe('Unlimited Approval Detection', () => {
        it('should detect max uint256 as unlimited', () => {
            const maxUint256 = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
            expect(isUnlimitedApproval(maxUint256)).toBe(true);
        });

        it('should detect hex max uint256 as unlimited', () => {
            const maxUint256Hex = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff').toString();
            expect(isUnlimitedApproval(maxUint256Hex)).toBe(true);
        });

        it('should not detect normal amounts as unlimited', () => {
            expect(isUnlimitedApproval('1000000')).toBe(false);
            expect(isUnlimitedApproval('0')).toBe(false);
        });

        it('should handle invalid input', () => {
            expect(isUnlimitedApproval('invalid')).toBe(false);
            expect(isUnlimitedApproval('')).toBe(false);
        });
    });

    describe('Transfer Classification', () => {
        it('should classify incoming transfer', () => {
            const raw: TxRaw = {
                hash: '0xabc123',
                block_number: 1000,
                timestamp: 1704067200,
                from_addr: '0xsender',
                to_addr: '0xuser',
                value: '1000000',
                input: null,
                status: 1,
                gas_used: '21000',
                gas_price: '1000000000',
                chain_id: 8453,
            };

            const decoded: TxDecoded = {
                hash: '0xabc123',
                type: 'transfer',
                token_in: 'USDC',
                amount_in: '1.0',
                counterparty: '0xsender',
                notes: 'USDC transfer',
                decoded_json: JSON.stringify({
                    type: 'ERC20_Transfer',
                    value: '1000000',
                    valueFormatted: '1.0',
                }),
            };

            const classified = classifyTransaction(raw, decoded, '0xuser');

            expect(classified.category).toBe(TransactionCategory.TRANSFER_IN);
            expect(classified.token).toBe('USDC');
            expect(classified.amountFormatted).toBe('1.0');
            expect(classified.counterparty).toBe('0xsender');
            expect(classified.isHighRisk).toBe(false);
        });

        it('should classify outgoing transfer', () => {
            const raw: TxRaw = {
                hash: '0xdef456',
                block_number: 1001,
                timestamp: 1704067300,
                from_addr: '0xuser',
                to_addr: '0xrecipient',
                value: '2000000',
                input: null,
                status: 1,
                gas_used: null,
                gas_price: null,
                chain_id: 8453,
            };

            const decoded: TxDecoded = {
                hash: '0xdef456',
                type: 'transfer',
                token_out: 'USDC',
                amount_out: '2.0',
                counterparty: '0xrecipient',
                notes: 'USDC transfer',
                decoded_json: JSON.stringify({
                    type: 'ERC20_Transfer',
                    value: '2000000',
                    valueFormatted: '2.0',
                }),
            };

            const classified = classifyTransaction(raw, decoded, '0xuser');

            expect(classified.category).toBe(TransactionCategory.TRANSFER_OUT);
            expect(classified.token).toBe('USDC');
            expect(classified.amountFormatted).toBe('2.0');
        });
    });

    describe('Approval Classification', () => {
        it('should classify normal approval', () => {
            const raw: TxRaw = {
                hash: '0xghi789',
                block_number: 1002,
                timestamp: 1704067400,
                from_addr: '0xuser',
                to_addr: '0xspender',
                value: '0',
                input: null,
                status: 1,
                gas_used: null,
                gas_price: null,
                chain_id: 8453,
            };

            const decoded: TxDecoded = {
                hash: '0xghi789',
                type: 'approval',
                token_in: 'USDC',
                counterparty: '0xspender',
                notes: 'USDC approval',
                decoded_json: JSON.stringify({
                    type: 'ERC20_Approval',
                    value: '1000000',
                    valueFormatted: '1.0',
                }),
            };

            const classified = classifyTransaction(raw, decoded, '0xuser');

            expect(classified.category).toBe(TransactionCategory.APPROVE);
            expect(classified.token).toBe('USDC');
            expect(classified.isHighRisk).toBe(false);
        });

        it('should classify unlimited approval as high risk', () => {
            const maxUint256 = '115792089237316195423570985008687907853269984665640564039457584007913129639935';

            const raw: TxRaw = {
                hash: '0xjkl012',
                block_number: 1003,
                timestamp: 1704067500,
                from_addr: '0xuser',
                to_addr: '0xspender',
                value: '0',
                input: null,
                status: 1,
                gas_used: null,
                gas_price: null,
                chain_id: 8453,
            };

            const decoded: TxDecoded = {
                hash: '0xjkl012',
                type: 'approval',
                token_in: 'USDC',
                counterparty: '0xspender',
                notes: 'USDC approval',
                decoded_json: JSON.stringify({
                    type: 'ERC20_Approval',
                    value: maxUint256,
                    valueFormatted: 'unlimited',
                }),
            };

            const classified = classifyTransaction(raw, decoded, '0xuser');

            expect(classified.category).toBe(TransactionCategory.APPROVE);
            expect(classified.isHighRisk).toBe(true);
            expect(classified.riskReason).toBe('Unlimited approval granted');
        });

        it('should classify revocation (zero approval)', () => {
            const raw: TxRaw = {
                hash: '0xmno345',
                block_number: 1004,
                timestamp: 1704067600,
                from_addr: '0xuser',
                to_addr: '0xspender',
                value: '0',
                input: null,
                status: 1,
                gas_used: null,
                gas_price: null,
                chain_id: 8453,
            };

            const decoded: TxDecoded = {
                hash: '0xmno345',
                type: 'approval',
                token_in: 'USDC',
                counterparty: '0xspender',
                notes: 'USDC approval',
                decoded_json: JSON.stringify({
                    type: 'ERC20_Approval',
                    value: '0',
                    valueFormatted: '0',
                }),
            };

            const classified = classifyTransaction(raw, decoded, '0xuser');

            expect(classified.category).toBe(TransactionCategory.REVOKE);
            expect(classified.notes).toContain('Revoked');
        });
    });

    describe('Unknown Classification', () => {
        it('should classify unknown type as UNKNOWN', () => {
            const raw: TxRaw = {
                hash: '0xpqr678',
                block_number: 1005,
                timestamp: 1704067700,
                from_addr: '0xuser',
                to_addr: '0xcontract',
                value: '0',
                input: '0xabcd',
                status: 1,
                gas_used: null,
                gas_price: null,
                chain_id: 8453,
            };

            const decoded: TxDecoded = {
                hash: '0xpqr678',
                type: 'swap',
                notes: 'Unknown transaction type',
            };

            const classified = classifyTransaction(raw, decoded, '0xuser');

            expect(classified.category).toBe(TransactionCategory.UNKNOWN);
        });

        it('should handle missing decoded data', () => {
            const raw: TxRaw = {
                hash: '0xstu901',
                block_number: 1006,
                timestamp: 1704067800,
                from_addr: '0xuser',
                to_addr: '0xcontract',
                value: '0',
                input: null,
                status: 1,
                gas_used: null,
                gas_price: null,
                chain_id: 8453,
            };

            const classified = classifyTransaction(raw, undefined, '0xuser');

            expect(classified.category).toBe(TransactionCategory.UNKNOWN);
            expect(classified.hash).toBe('0xstu901');
        });
    });

    describe('Filtering and Grouping', () => {
        const mockTransactions: ClassifiedTransaction[] = [
            {
                hash: '0x1',
                category: TransactionCategory.TRANSFER_IN,
                timestamp: 1704067200,
                token: 'USDC',
                isHighRisk: false,
            },
            {
                hash: '0x2',
                category: TransactionCategory.TRANSFER_OUT,
                timestamp: 1704067300,
                token: 'USDC',
                isHighRisk: false,
            },
            {
                hash: '0x3',
                category: TransactionCategory.APPROVE,
                timestamp: 1704067400,
                token: 'WETH',
                isHighRisk: true,
                riskReason: 'Unlimited approval',
            },
            {
                hash: '0x4',
                category: TransactionCategory.TRANSFER_IN,
                timestamp: 1704067500,
                token: 'WETH',
                isHighRisk: false,
            },
        ];

        it('should filter by category', () => {
            const transfersIn = filterByCategory(mockTransactions, TransactionCategory.TRANSFER_IN);
            expect(transfersIn).toHaveLength(2);
            expect(transfersIn.every(tx => tx.category === TransactionCategory.TRANSFER_IN)).toBe(true);
        });

        it('should get high-risk transactions', () => {
            const highRisk = getHighRiskTransactions(mockTransactions);
            expect(highRisk).toHaveLength(1);
            expect(highRisk[0].hash).toBe('0x3');
            expect(highRisk[0].isHighRisk).toBe(true);
        });

        it('should group by token', () => {
            const grouped = groupByToken(mockTransactions);
            expect(grouped.size).toBe(2);
            expect(grouped.get('USDC')).toHaveLength(2);
            expect(grouped.get('WETH')).toHaveLength(2);
        });

        it('should get top counterparties', () => {
            const txsWithCounterparties: ClassifiedTransaction[] = [
                { ...mockTransactions[0], counterparty: '0xA' },
                { ...mockTransactions[1], counterparty: '0xA' },
                { ...mockTransactions[2], counterparty: '0xB' },
                { ...mockTransactions[3], counterparty: '0xA' },
            ];

            const top = getTopCounterparties(txsWithCounterparties, 2);
            expect(top).toHaveLength(2);
            expect(top[0].address).toBe('0xA');
            expect(top[0].count).toBe(3);
            expect(top[1].address).toBe('0xB');
            expect(top[1].count).toBe(1);
        });
    });

    describe('Gas Data', () => {
        it('should include gas data when available', () => {
            const raw: TxRaw = {
                hash: '0xgas123',
                block_number: 1000,
                timestamp: 1704067200,
                from_addr: '0xuser',
                to_addr: '0xrecipient',
                value: '0',
                input: null,
                status: 1,
                gas_used: '50000',
                gas_price: '2000000000',
                chain_id: 8453,
            };

            const decoded: TxDecoded = {
                hash: '0xgas123',
                type: 'transfer',
                token_out: 'USDC',
            };

            const classified = classifyTransaction(raw, decoded, '0xuser');

            expect(classified.gasUsed).toBe('50000');
            expect(classified.gasPrice).toBe('2000000000');
        });
    });
});
