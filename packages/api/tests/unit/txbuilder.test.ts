import { describe, it, expect } from 'vitest';
import { buildEthTransfer, buildErc20Transfer } from '../../src/tools/txbuilder';

describe('Transaction Builder', () => {
    it('should build ETH transfer with correct structure', async () => {
        const tx = await buildEthTransfer(
            '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
            '0.1'
        );

        expect(tx.to).toBe('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb');
        expect(tx.data).toBe('0x');
        expect(tx.chainId).toBe(8453);
        expect(tx.value).toBeTruthy();
        expect(tx.gas).toBeTruthy();
    });

    it('should build ERC-20 transfer with correct calldata', async () => {
        const tx = await buildErc20Transfer(
            '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
            '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
            '10',
            6 // USDC decimals
        );

        expect(tx.to).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
        expect(tx.data).toMatch(/^0xa9059cbb/); // transfer function selector
        expect(tx.value).toBe('0');
        expect(tx.chainId).toBe(8453);
    });

    it('should include gas estimation', async () => {
        const tx = await buildEthTransfer(
            '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
            '0.01'
        );

        expect(tx.gas).toBeTruthy();
        expect(tx.maxFeePerGas).toBeTruthy();
        expect(tx.maxPriorityFeePerGas).toBeTruthy();
    });
});
