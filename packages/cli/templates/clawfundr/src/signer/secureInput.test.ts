import { describe, it, expect } from 'vitest';
import { redactSecret, isValidPrivateKey } from './secureInput';

describe('Secure Input Utilities', () => {
    describe('Secret Redaction', () => {
        it('should redact private keys', () => {
            const privateKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
            const redacted = redactSecret(privateKey);

            expect(redacted).toBe('0x12...cdef');
            expect(redacted).not.toContain('567890abcdef');
        });

        it('should redact addresses', () => {
            const address = '0x1234567890abcdef1234567890abcdef12345678';
            const redacted = redactSecret(address);

            expect(redacted).toBe('0x12...5678');
            expect(redacted.length).toBeLessThan(address.length);
        });

        it('should handle short secrets', () => {
            const short = '0x1234';
            const redacted = redactSecret(short);

            expect(redacted).toBe('***');
        });

        it('should handle empty strings', () => {
            const redacted = redactSecret('');
            expect(redacted).toBe('***');
        });
    });

    describe('Private Key Validation', () => {
        it('should validate correct private key format', () => {
            const validKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
            expect(isValidPrivateKey(validKey)).toBe(true);
        });

        it('should reject private key without 0x prefix', () => {
            const invalidKey = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
            expect(isValidPrivateKey(invalidKey)).toBe(false);
        });

        it('should reject private key with wrong length', () => {
            const tooShort = '0x1234567890abcdef';
            const tooLong = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef00';

            expect(isValidPrivateKey(tooShort)).toBe(false);
            expect(isValidPrivateKey(tooLong)).toBe(false);
        });

        it('should reject private key with invalid characters', () => {
            const invalidChars = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdeg';
            expect(isValidPrivateKey(invalidChars)).toBe(false);
        });

        it('should accept uppercase hex', () => {
            const upperKey = '0x1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF';
            expect(isValidPrivateKey(upperKey)).toBe(true);
        });

        it('should accept mixed case hex', () => {
            const mixedKey = '0x1234567890AbCdEf1234567890aBcDeF1234567890AbCdEf1234567890aBcDeF';
            expect(isValidPrivateKey(mixedKey)).toBe(true);
        });
    });
});
