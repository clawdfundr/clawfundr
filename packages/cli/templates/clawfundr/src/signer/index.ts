/**
 * Signer module
 * CRITICAL: This is the ONLY module that handles private keys
 */

export {
    initializeSigner,
    getSignerAddress,
    isSignerInitialized,
    signAndSendErc20Transfer,
    clearSigner,
    type TransferParams,
    type TransactionResult,
} from './signer';

export {
    readSecureInput,
    confirmAction,
    redactSecret,
    isValidPrivateKey,
} from './secureInput';
