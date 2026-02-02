import { describe, it, expect } from 'vitest';
import { Orchestrator } from './orchestrator';

describe('Orchestrator Confirmation Gating', () => {
    describe('Confirmation Detection', () => {
        it('should detect yes confirmation', () => {
            const orchestrator = new Orchestrator();

            expect((orchestrator as any).isConfirmation('yes')).toBe(true);
            expect((orchestrator as any).isConfirmation('y')).toBe(true);
            expect((orchestrator as any).isConfirmation('confirm')).toBe(true);
            expect((orchestrator as any).isConfirmation('YES')).toBe(true);
        });

        it('should detect no cancellation', () => {
            const orchestrator = new Orchestrator();

            expect((orchestrator as any).isCancellation('no')).toBe(true);
            expect((orchestrator as any).isCancellation('n')).toBe(true);
            expect((orchestrator as any).isCancellation('cancel')).toBe(true);
            expect((orchestrator as any).isCancellation('NO')).toBe(true);
        });

        it('should not detect other inputs as confirmation', () => {
            const orchestrator = new Orchestrator();

            expect((orchestrator as any).isConfirmation('maybe')).toBe(false);
            expect((orchestrator as any).isConfirmation('ok')).toBe(false);
            expect((orchestrator as any).isConfirmation('sure')).toBe(false);
        });
    });

    describe('Input Sanitization', () => {
        it('should redact private keys', () => {
            const orchestrator = new Orchestrator();
            const privateKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

            const sanitized = (orchestrator as any).sanitizeInput(`My key is ${privateKey}`);

            expect(sanitized).not.toContain(privateKey);
            expect(sanitized).toContain('0x12...cdef');
        });

        it('should redact seed phrases', () => {
            const orchestrator = new Orchestrator();
            const seedPhrase = 'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12';

            const sanitized = (orchestrator as any).sanitizeInput(seedPhrase);

            expect(sanitized).toBe('[REDACTED SEED PHRASE]');
        });

        it('should not redact normal text', () => {
            const orchestrator = new Orchestrator();
            const normalText = 'show me my balance';

            const sanitized = (orchestrator as any).sanitizeInput(normalText);

            expect(sanitized).toBe(normalText);
        });
    });

    describe('Pending Actions', () => {
        it('should store pending action', () => {
            const orchestrator = new Orchestrator();

            (orchestrator as any).pendingAction = {
                type: 'x402_payment',
                description: 'Test payment',
                toolName: 'executeX402Payment',
                params: { url: 'https://example.com' },
                timestamp: Date.now(),
            };

            const pending = orchestrator.getPendingAction();
            expect(pending).toBeDefined();
            expect(pending?.type).toBe('x402_payment');
        });

        it('should clear pending action', () => {
            const orchestrator = new Orchestrator();

            (orchestrator as any).pendingAction = {
                type: 'x402_payment',
                description: 'Test payment',
                toolName: 'executeX402Payment',
                params: {},
                timestamp: Date.now(),
            };

            orchestrator.clearPendingAction();

            expect(orchestrator.getPendingAction()).toBeNull();
        });
    });

    describe('Tool Confirmation Requirements', () => {
        it('should require confirmation for executeX402Payment', () => {
            const orchestrator = new Orchestrator();

            const requires = (orchestrator as any).requiresConfirmation('executeX402Payment', {});
            expect(requires).toBe(true);
        });

        it('should require confirmation for confirmed=true params', () => {
            const orchestrator = new Orchestrator();

            const requires = (orchestrator as any).requiresConfirmation('anyTool', { confirmed: true });
            expect(requires).toBe(true);
        });

        it('should not require confirmation for read-only tools', () => {
            const orchestrator = new Orchestrator();

            const requires = (orchestrator as any).requiresConfirmation('getBalances', {});
            expect(requires).toBe(false);
        });
    });
});
