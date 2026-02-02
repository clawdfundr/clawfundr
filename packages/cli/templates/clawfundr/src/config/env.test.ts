import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateEnvironment, getEnvConfig, isDebugMode } from './env';

describe('Environment Configuration', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        // Reset environment
        process.env = { ...originalEnv };
        // Clear cached config by requiring fresh module
        // Note: In real tests, you might need to use jest.resetModules() or similar
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('Environment Validation', () => {
        it('should validate correct environment', () => {
            process.env.CLAUDE_API_KEY = 'sk-ant-test-key';
            process.env.BASE_RPC_URL = 'https://mainnet.base.org';

            const config = validateEnvironment();

            expect(config.CLAUDE_API_KEY).toBe('sk-ant-test-key');
            expect(config.BASE_RPC_URL).toBe('https://mainnet.base.org');
        });

        it('should use default values for optional fields', () => {
            process.env.CLAUDE_API_KEY = 'sk-ant-test-key';

            const config = validateEnvironment();

            expect(config.BASE_RPC_URL).toBe('https://mainnet.base.org');
            expect(config.DATABASE_PATH).toBe('./data/clawfundr.db');
            expect(config.LOG_LEVEL).toBe('info');
        });

        it('should reject missing required fields', () => {
            delete process.env.CLAUDE_API_KEY;

            expect(() => validateEnvironment()).toThrow('CLAUDE_API_KEY is required');
        });

        it('should reject invalid URL for BASE_RPC_URL', () => {
            process.env.CLAUDE_API_KEY = 'sk-ant-test-key';
            process.env.BASE_RPC_URL = 'not-a-url';

            expect(() => validateEnvironment()).toThrow('BASE_RPC_URL must be a valid URL');
        });

        it('should reject invalid LOG_LEVEL', () => {
            process.env.CLAUDE_API_KEY = 'sk-ant-test-key';
            process.env.LOG_LEVEL = 'invalid';

            expect(() => validateEnvironment()).toThrow();
        });

        it('should accept valid LOG_LEVEL values', () => {
            process.env.CLAUDE_API_KEY = 'sk-ant-test-key';

            process.env.LOG_LEVEL = 'debug';
            expect(validateEnvironment().LOG_LEVEL).toBe('debug');

            process.env.LOG_LEVEL = 'info';
            expect(validateEnvironment().LOG_LEVEL).toBe('info');

            process.env.LOG_LEVEL = 'warn';
            expect(validateEnvironment().LOG_LEVEL).toBe('warn');

            process.env.LOG_LEVEL = 'error';
            expect(validateEnvironment().LOG_LEVEL).toBe('error');
        });

        it('should handle optional WALLET_ADDRESS', () => {
            process.env.CLAUDE_API_KEY = 'sk-ant-test-key';
            process.env.WALLET_ADDRESS = '0x1234567890abcdef';

            const config = validateEnvironment();
            expect(config.WALLET_ADDRESS).toBe('0x1234567890abcdef');
        });
    });

    describe('Config Caching', () => {
        it('should cache validated config', () => {
            process.env.CLAUDE_API_KEY = 'sk-ant-test-key';

            const config1 = validateEnvironment();
            const config2 = getEnvConfig();

            expect(config1).toEqual(config2);
        });
    });

    describe('Debug Mode', () => {
        it('should return true when LOG_LEVEL is debug', () => {
            process.env.CLAUDE_API_KEY = 'sk-ant-test-key';
            process.env.LOG_LEVEL = 'debug';

            validateEnvironment();
            expect(isDebugMode()).toBe(true);
        });

        it('should return false when LOG_LEVEL is not debug', () => {
            process.env.CLAUDE_API_KEY = 'sk-ant-test-key';
            process.env.LOG_LEVEL = 'info';

            validateEnvironment();
            expect(isDebugMode()).toBe(false);
        });
    });

    describe('Error Messages', () => {
        it('should provide clear error messages', () => {
            delete process.env.CLAUDE_API_KEY;

            try {
                validateEnvironment();
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
                expect((error as Error).message).toContain('Environment validation failed');
                expect((error as Error).message).toContain('CLAUDE_API_KEY');
            }
        });

        it('should not expose sensitive values in errors', () => {
            process.env.CLAUDE_API_KEY = 'sk-ant-secret-key-12345';
            process.env.BASE_RPC_URL = 'invalid-url';

            try {
                validateEnvironment();
                expect.fail('Should have thrown an error');
            } catch (error) {
                const message = (error as Error).message;
                expect(message).not.toContain('sk-ant-secret-key-12345');
            }
        });
    });
});
