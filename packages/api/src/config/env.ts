import { z } from 'zod';
import { config as loadDotenv } from 'dotenv';

// Load environment variables
loadDotenv();

/**
 * Environment variable schema
 */
const envSchema = z.object({
    // Server
    PORT: z.string().default('3000'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    // Database
    DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection string'),

    // Claude API
    CLAUDE_API_KEY: z.string().min(1, 'CLAUDE_API_KEY is required'),

    // Base Chain
    BASE_RPC_URL: z.string().url().default('https://mainnet.base.org'),
    BASESCAN_API_KEY: z.string().optional(),

    // X / Twitter API (optional, used for real follower/following metrics)
    X_BEARER_TOKEN: z.string().optional(),
    TWITTER_BEARER_TOKEN: z.string().optional(),

    // Optional
    COINGECKO_API_KEY: z.string().optional(),

    // Logging
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

    // Rate Limiting
    RATE_LIMIT_MAX: z.string().default('100'),
    RATE_LIMIT_WINDOW: z.string().default('60000'),

    // Security
    API_KEY_SALT_ROUNDS: z.string().default('10'),

    // Public claim links
    CLAIM_BASE_URL: z.string().url().default('https://clawfundr.xyz/claim'),

});

export type EnvConfig = z.infer<typeof envSchema>;

let cachedConfig: EnvConfig | null = null;

/**
 * Validate and return environment configuration
 * @throws Error if validation fails
 */
export function validateEnvironment(): EnvConfig {
    if (cachedConfig) {
        return cachedConfig;
    }

    const result = envSchema.safeParse(process.env);

    if (!result.success) {
        const errors = result.error.errors
            .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
            .join('\n');
        throw new Error(`Environment validation failed:\n${errors}`);
    }

    cachedConfig = result.data;
    return result.data;
}

/**
 * Get validated environment configuration
 */
export function getEnvConfig(): EnvConfig {
    if (!cachedConfig) {
        return validateEnvironment();
    }
    return cachedConfig;
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
    return getEnvConfig().NODE_ENV === 'production';
}

/**
 * Check if running in debug mode
 */
export function isDebugMode(): boolean {
    return getEnvConfig().LOG_LEVEL === 'debug';
}
