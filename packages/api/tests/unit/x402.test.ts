import { describe, it, expect } from 'vitest';
import { parseX402Response } from '../../src/tools/x402';

describe('x402 Payment Parsing', () => {
    it('should parse valid 402 response headers', () => {
        const headers = {
            'x-payment-merchant': 'Example API',
            'x-payment-amount': '0.001',
            'x-payment-token': 'ETH',
            'x-payment-recipient': '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
            'x-payment-resource': 'https://api.example.com/premium-data',
        };

        const result = parseX402Response(headers);

        expect(result).toEqual({
            merchant: 'Example API',
            amount: '0.001',
            token: 'ETH',
            recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
            resource: 'https://api.example.com/premium-data',
        });
    });

    it('should return null for missing required headers', () => {
        const headers = {
            'x-payment-merchant': 'Example API',
            'x-payment-amount': '0.001',
            // Missing recipient and resource
        };

        const result = parseX402Response(headers);
        expect(result).toBeNull();
    });

    it('should default to ETH if token not specified', () => {
        const headers = {
            'x-payment-merchant': 'Example API',
            'x-payment-amount': '0.001',
            'x-payment-recipient': '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
            'x-payment-resource': 'https://api.example.com/premium-data',
            // No token specified
        };

        const result = parseX402Response(headers);
        expect(result?.token).toBe('ETH');
    });

    it('should handle USDC token', () => {
        const headers = {
            'x-payment-merchant': 'Example API',
            'x-payment-amount': '1.50',
            'x-payment-token': 'USDC',
            'x-payment-recipient': '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
            'x-payment-resource': 'https://api.example.com/premium-data',
        };

        const result = parseX402Response(headers);
        expect(result?.token).toBe('USDC');
        expect(result?.amount).toBe('1.50');
    });
});
