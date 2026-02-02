import { z } from 'zod';
import { config as loadDotenv } from 'dotenv';

// Load environment variables from .env file
loadDotenv();

/**
 * Environment variable schema
 */
const envSchema = z.object({
    CLAUDE_API_KEY: z.string().min(1, 'CLAUDE_API_KEY is required'),
    CLAWFUNDR_API_URL: z
        .string()
        .url('CLAWFUNDR_API_URL must be a valid URL')
        .default('https://api.clawfundr.xyz'),
    CLAWFUNDR_API_KEY: z
        .string()
        .regex(
            /^claw_[a-fA-F0-9]{64}$/,
            'CLAWFUNDR_API_KEY must be in format claw_<64 hex chars>'
        ),
    BASE_RPC_URL: z.string().url('BASE_RPC_URL must be a valid URL').default('https://mainnet.base.org'),
    WALLET_ADDRESS: z.string().optional(),
    BASESCAN_API_KEY: z.string().optional(),
    COINGECKO_API_KEY: z.string().optional(),
    DATABASE_PATH: z.string().default('./data/clawfundr.db'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
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
            .map(e => `  - ${e.path.join('.')}: ${e.message}`)
            .join('\n');
        throw new Error(`Environment validation failed:\n${errors}`);
    }

    cachedConfig = result.data;
    return result.data;
}

/**
 * Get validated environment configuration
 * @throws Error if not yet validated
 */
export function getEnvConfig(): EnvConfig {
    if (!cachedConfig) {
        return validateEnvironment();
    }
    return cachedConfig;
}

/**
 * Check if running in debug mode
 */
export function isDebugMode(): boolean {
    return getEnvConfig().LOG_LEVEL === 'debug';
}
