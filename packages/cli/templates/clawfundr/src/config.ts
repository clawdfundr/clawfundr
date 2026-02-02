/**
 * Legacy config.ts - Re-exports from config module for backwards compatibility
 * @deprecated Use imports from './config' instead
 */

export {
    validateEnvironment,
    getEnvConfig as getConfig,
    type EnvConfig as Config,
} from './config/env';
