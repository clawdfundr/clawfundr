/**
 * Configuration module
 * Exports environment and policy configuration
 */

export {
    validateEnvironment,
    getEnvConfig,
    isDebugMode,
    type EnvConfig,
} from './env';

export {
    loadPolicy,
    getPolicy,
    reloadPolicy,
    isChainAllowed,
    isTokenAllowed,
    getTokenInfo,
    isMerchantAllowed,
    isRecipientAllowed,
    checkCaps,
    requireConfirmationForRiskyActions,
    isSlippageAllowed,
    getMaxSlippageBps,
    isAssetExposureAllowed,
    getTargetStableRatio,
    formatPolicyError,
    type PolicyConfig,
    type TokenAllowlistEntry,
    type CapConfig,
} from './policy';
