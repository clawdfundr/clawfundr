import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    parseX402Requirement,
    validateX402Payment,
    formatPaymentProposal,
    type X402PaymentRequirement,
} from './x402';

describe('x402 Payment Automation', () => {
    describe('Parse x402 Requirement', () => {
        it('should parse payment requirement from x-payment-required header', () => {
            const paymentData = {
                chainId: 8453,
                tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
                tokenSymbol: 'USDC',
                amount: '1.0',
                recipient: '0x1234567890abcdef1234567890abcdef12345678',
            };

            const mockResponse = new Response(null, {
                status: 402,
                headers: {
                    'x-payment-required': JSON.stringify(paymentData),
                },
            });

            const url = 'https://api.example.com/premium/resource';
            const requirement = parseX402Requirement(mockResponse, url);

            expect(requirement.chainId).toBe(8453);
            expect(requirement.tokenAddress).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
            expect(requirement.tokenSymbol).toBe('USDC');
            expect(requirement.amount).toBe('1.0');
            expect(requirement.recipient).toBe('0x1234567890abcdef1234567890abcdef12345678');
            expect(requirement.merchantDomain).toBe('api.example.com');
            expect(requirement.resource).toBe('/premium/resource');
        });

        it('should parse payment requirement from www-authenticate header', () => {
            const mockResponse = new Response(null, {
                status: 402,
                headers: {
                    'www-authenticate': 'x402 chain=8453 token=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 amount=1.0 recipient=0x1234567890abcdef1234567890abcdef12345678',
                },
            });

            const url = 'https://api.example.com/premium/resource';
            const requirement = parseX402Requirement(mockResponse, url);

            expect(requirement.chainId).toBe(8453);
            expect(requirement.tokenAddress).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
            expect(requirement.amount).toBe('1.0');
        });

        it('should handle alternative field names', () => {
            const paymentData = {
                chain: '8453', // Alternative to chainId
                token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Alternative to tokenAddress
                amount: '1.0',
                recipient: '0x1234567890abcdef1234567890abcdef12345678',
            };

            const mockResponse = new Response(null, {
                status: 402,
                headers: {
                    'x-payment-required': JSON.stringify(paymentData),
                },
            });

            const url = 'https://api.example.com/resource';
            const requirement = parseX402Requirement(mockResponse, url);

            expect(requirement.chainId).toBe(8453);
            expect(requirement.tokenAddress).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
        });

        it('should throw error if missing required fields', () => {
            const invalidData = {
                chainId: 8453,
                // Missing tokenAddress
                amount: '1.0',
                recipient: '0x1234567890abcdef1234567890abcdef12345678',
            };

            const mockResponse = new Response(null, {
                status: 402,
                headers: {
                    'x-payment-required': JSON.stringify(invalidData),
                },
            });

            const url = 'https://api.example.com/resource';

            expect(() => parseX402Requirement(mockResponse, url)).toThrow('Missing token address');
        });

        it('should throw error if no payment requirement found', () => {
            const mockResponse = new Response(null, {
                status: 402,
                headers: {},
            });

            const url = 'https://api.example.com/resource';

            expect(() => parseX402Requirement(mockResponse, url)).toThrow('No payment requirement found');
        });
    });

    describe('Validate x402 Payment', () => {
        it('should validate payment against policy', () => {
            const requirement: X402PaymentRequirement = {
                chainId: 8453,
                tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
                tokenSymbol: 'USDC',
                amount: '10.0',
                recipient: '0x1234567890abcdef1234567890abcdef12345678',
                merchantDomain: 'api.trusted.com',
                resource: '/premium/resource',
                rawRequirement: {},
            };

            const proposal = validateX402Payment(requirement);

            expect(proposal.requirement).toEqual(requirement);
            expect(proposal.policyChecks.chainAllowed).toBe(true);
            expect(proposal.policyChecks.tokenAllowed).toBe(true);
            expect(proposal.estimatedCostUsd).toBe(10.0); // USDC = $1
        });

        it('should block payment if merchant not allowed', () => {
            const requirement: X402PaymentRequirement = {
                chainId: 8453,
                tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
                tokenSymbol: 'USDC',
                amount: '10.0',
                recipient: '0x1234567890abcdef1234567890abcdef12345678',
                merchantDomain: 'untrusted.com',
                resource: '/resource',
                rawRequirement: {},
            };

            const proposal = validateX402Payment(requirement);

            expect(proposal.policyChecks.merchantAllowed).toBe(false);
            expect(proposal.canProceed).toBe(false);
            expect(proposal.blockers).toContain('Merchant untrusted.com not in allowlist');
        });

        it('should block payment if chain not allowed', () => {
            const requirement: X402PaymentRequirement = {
                chainId: 137, // Polygon, not in allowlist
                tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
                tokenSymbol: 'USDC',
                amount: '10.0',
                recipient: '0x1234567890abcdef1234567890abcdef12345678',
                merchantDomain: 'api.trusted.com',
                resource: '/resource',
                rawRequirement: {},
            };

            const proposal = validateX402Payment(requirement);

            expect(proposal.policyChecks.chainAllowed).toBe(false);
            expect(proposal.canProceed).toBe(false);
            expect(proposal.blockers).toContain('Chain 137 not in allowlist');
        });

        it('should block payment if token not allowed', () => {
            const requirement: X402PaymentRequirement = {
                chainId: 8453,
                tokenAddress: '0x0000000000000000000000000000000000000000', // Not in allowlist
                tokenSymbol: 'UNKNOWN',
                amount: '10.0',
                recipient: '0x1234567890abcdef1234567890abcdef12345678',
                merchantDomain: 'api.trusted.com',
                resource: '/resource',
                rawRequirement: {},
            };

            const proposal = validateX402Payment(requirement);

            expect(proposal.policyChecks.tokenAllowed).toBe(false);
            expect(proposal.canProceed).toBe(false);
            expect(proposal.blockers.some(b => b.includes('Token'))).toBe(true);
        });

        it('should block payment if exceeds caps', () => {
            const requirement: X402PaymentRequirement = {
                chainId: 8453,
                tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
                tokenSymbol: 'USDC',
                amount: '2000.0', // Exceeds per-payment cap of $1000
                recipient: '0x1234567890abcdef1234567890abcdef12345678',
                merchantDomain: 'api.trusted.com',
                resource: '/resource',
                rawRequirement: {},
            };

            const proposal = validateX402Payment(requirement);

            expect(proposal.policyChecks.capsAllowed).toBe(false);
            expect(proposal.canProceed).toBe(false);
            expect(proposal.blockers.some(b => b.includes('cap'))).toBe(true);
        });

        it('should allow payment if all checks pass', () => {
            const requirement: X402PaymentRequirement = {
                chainId: 8453,
                tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
                tokenSymbol: 'USDC',
                amount: '50.0',
                recipient: '0x1234567890abcdef1234567890abcdef12345678',
                merchantDomain: 'api.trusted.com',
                resource: '/resource',
                rawRequirement: {},
            };

            const proposal = validateX402Payment(requirement);

            expect(proposal.canProceed).toBe(true);
            expect(proposal.blockers).toHaveLength(0);
        });
    });

    describe('Format Payment Proposal', () => {
        it('should format payment proposal for display', () => {
            const requirement: X402PaymentRequirement = {
                chainId: 8453,
                tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
                tokenSymbol: 'USDC',
                amount: '10.0',
                recipient: '0x1234567890abcdef1234567890abcdef12345678',
                merchantDomain: 'api.trusted.com',
                resource: '/premium/resource',
                rawRequirement: {},
            };

            const proposal = validateX402Payment(requirement);
            const formatted = formatPaymentProposal(proposal);

            expect(formatted).toContain('x402 Payment Required');
            expect(formatted).toContain('api.trusted.com');
            expect(formatted).toContain('/premium/resource');
            expect(formatted).toContain('10.0 USDC');
            expect(formatted).toContain('$10.00');
            expect(formatted).toContain('Policy Checks');
        });

        it('should show blockers when payment cannot proceed', () => {
            const requirement: X402PaymentRequirement = {
                chainId: 137, // Not allowed
                tokenAddress: '0x0000000000000000000000000000000000000000', // Not allowed
                tokenSymbol: 'UNKNOWN',
                amount: '10.0',
                recipient: '0x1234567890abcdef1234567890abcdef12345678',
                merchantDomain: 'untrusted.com', // Not allowed
                resource: '/resource',
                rawRequirement: {},
            };

            const proposal = validateX402Payment(requirement);
            const formatted = formatPaymentProposal(proposal);

            expect(formatted).toContain('Payment blocked');
            expect(formatted).toContain('Merchant untrusted.com not in allowlist');
            expect(formatted).toContain('Chain 137 not in allowlist');
        });
    });

    describe('Payment Requirement Parsing Edge Cases', () => {
        it('should handle numeric chainId as string', () => {
            const paymentData = {
                chain: '8453',
                tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
                amount: '1.0',
                recipient: '0x1234567890abcdef1234567890abcdef12345678',
            };

            const mockResponse = new Response(null, {
                status: 402,
                headers: {
                    'x-payment-required': JSON.stringify(paymentData),
                },
            });

            const requirement = parseX402Requirement(mockResponse, 'https://api.example.com/resource');

            expect(requirement.chainId).toBe(8453);
            expect(typeof requirement.chainId).toBe('number');
        });

        it('should extract merchant domain correctly', () => {
            const paymentData = {
                chainId: 8453,
                tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
                amount: '1.0',
                recipient: '0x1234567890abcdef1234567890abcdef12345678',
            };

            const mockResponse = new Response(null, {
                status: 402,
                headers: {
                    'x-payment-required': JSON.stringify(paymentData),
                },
            });

            const requirement = parseX402Requirement(
                mockResponse,
                'https://subdomain.example.com:8080/path/to/resource?query=param'
            );

            expect(requirement.merchantDomain).toBe('subdomain.example.com');
            expect(requirement.resource).toBe('/path/to/resource');
        });
    });
});
