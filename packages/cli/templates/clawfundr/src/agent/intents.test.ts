import { describe, it, expect } from 'vitest';
import { detectIntent, Intent, formatIntent } from './intents';

describe('Intent Detection', () => {
    describe('Portfolio Intent', () => {
        it('should detect portfolio queries', () => {
            const inputs = [
                'what is my balance',
                'show me my portfolio',
                'how much do i have',
                'check my holdings',
            ];

            for (const input of inputs) {
                const detected = detectIntent(input);
                expect(detected.intent).toBe(Intent.PORTFOLIO);
                expect(detected.confidence).toBeGreaterThan(0);
            }
        });
    });

    describe('Sync History Intent', () => {
        it('should detect sync requests', () => {
            const inputs = [
                'sync my transactions',
                'update history',
                'refresh my data',
                'fetch latest transactions',
            ];

            for (const input of inputs) {
                const detected = detectIntent(input);
                expect(detected.intent).toBe(Intent.SYNC_HISTORY);
            }
        });
    });

    describe('Report Period Intent', () => {
        it('should detect report requests', () => {
            const inputs = [
                'show me last week report',
                'monthly summary',
                'what was my activity last month',
            ];

            for (const input of inputs) {
                const detected = detectIntent(input);
                expect(detected.intent).toBe(Intent.REPORT_PERIOD);
            }
        });

        it('should extract period entities', () => {
            const weeklyDetected = detectIntent('show me last week activity');
            expect(weeklyDetected.entities?.period).toBe('week');

            const monthlyDetected = detectIntent('monthly report');
            expect(monthlyDetected.entities?.period).toBe('month');

            const dailyDetected = detectIntent('today summary');
            expect(dailyDetected.entities?.period).toBe('day');
        });
    });

    describe('Advise Fund Intent', () => {
        it('should detect advice requests', () => {
            const inputs = [
                'should i invest more',
                'give me recommendations',
                'what should i do',
                'help me rebalance',
            ];

            for (const input of inputs) {
                const detected = detectIntent(input);
                expect(detected.intent).toBe(Intent.ADVISE_FUND);
            }
        });
    });

    describe('x402 Payment Intent', () => {
        it('should detect payment requests', () => {
            const inputs = [
                'make a payment',
                'handle 402 response',
                'process x402',
            ];

            for (const input of inputs) {
                const detected = detectIntent(input);
                expect(detected.intent).toBe(Intent.X402_PAY);
            }
        });
    });

    describe('Approvals Review Intent', () => {
        it('should detect approval-related queries', () => {
            const inputs = [
                'check my approvals',
                'show unlimited allowances',
                'revoke approval',
            ];

            for (const input of inputs) {
                const detected = detectIntent(input);
                expect(detected.intent).toBe(Intent.APPROVALS_REVIEW);
            }
        });
    });

    describe('Send Transaction Intent', () => {
        it('should detect send requests', () => {
            const inputs = [
                'send 10 USDC to 0x1234',
                'transfer ETH',
                'pay someone',
            ];

            for (const input of inputs) {
                const detected = detectIntent(input);
                expect(detected.intent).toBe(Intent.SEND_TRANSACTION);
            }
        });

        it('should extract amount and token entities', () => {
            const detected = detectIntent('send 10.5 USDC to someone');
            expect(detected.entities?.amount).toBe('10.5');
            expect(detected.entities?.token).toBe('USDC');
        });
    });

    describe('General Intent', () => {
        it('should default to general for unclear inputs', () => {
            const inputs = [
                'hello',
                'what can you do',
                'help',
            ];

            for (const input of inputs) {
                const detected = detectIntent(input);
                expect(detected.intent).toBe(Intent.GENERAL);
            }
        });
    });

    describe('Confidence Scoring', () => {
        it('should have higher confidence for clear intents', () => {
            const clear = detectIntent('show me my balance and portfolio');
            const unclear = detectIntent('what');

            expect(clear.confidence).toBeGreaterThan(unclear.confidence);
        });

        it('should have confidence between 0 and 1', () => {
            const detected = detectIntent('show my balance');
            expect(detected.confidence).toBeGreaterThanOrEqual(0);
            expect(detected.confidence).toBeLessThanOrEqual(1);
        });
    });

    describe('Format Intent', () => {
        it('should format intent for logging', () => {
            const detected = detectIntent('show me my balance');
            const formatted = formatIntent(detected);

            expect(formatted).toContain('Intent:');
            expect(formatted).toContain('confidence');
        });

        it('should include entities if present', () => {
            const detected = detectIntent('send 10 USDC');
            const formatted = formatIntent(detected);

            if (detected.entities) {
                expect(formatted).toContain('Entities:');
            }
        });
    });
});
