import { describe, it, expect, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';

describe('API Key Authentication', () => {
    const testApiKey = 'claw_test1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab';

    it('should hash API key correctly', async () => {
        const hash = await bcrypt.hash(testApiKey, 10);
        expect(hash).toBeTruthy();
        expect(hash).not.toBe(testApiKey);
    });

    it('should verify correct API key', async () => {
        const hash = await bcrypt.hash(testApiKey, 10);
        const isValid = await bcrypt.compare(testApiKey, hash);
        expect(isValid).toBe(true);
    });

    it('should reject incorrect API key', async () => {
        const hash = await bcrypt.hash(testApiKey, 10);
        const wrongKey = 'claw_wrong1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab';
        const isValid = await bcrypt.compare(wrongKey, hash);
        expect(isValid).toBe(false);
    });

    it('should validate API key format', () => {
        expect(testApiKey.startsWith('claw_')).toBe(true);
        expect(testApiKey.length).toBe(69); // 'claw_' + 64 hex chars
    });
});
