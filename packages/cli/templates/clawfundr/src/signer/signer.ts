import {
    createWalletClient,
    http,
    type WalletClient,
    type Address,
    type Hash,
    parseUnits,
    formatUnits,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { getEnvConfig } from '../config/env';
import {
    isChainAllowed,
    isTokenAllowed,
    isRecipientAllowed,
    checkCaps,
    getTokenInfo,
} from '../config/policy';
import { getDb } from '../db/db';
import { ERC20_ABI } from '../tools/erc20-abi';
import { readSecureInput, confirmAction, redactSecret, isValidPrivateKey } from './secureInput';

/**
 * Transaction parameters
 */
export interface TransferParams {
    token: string; // Token symbol or 'ETH'
    to: Address;
    amount: string; // Human-readable amount (e.g., "1.5")
    chainId: number;
    confirmed?: boolean; // Must be true to execute
}

/**
 * Transaction result
 */
export interface TransactionResult {
    txHash: Hash;
    receiptSummary: {
        status: 'success' | 'reverted';
        blockNumber: bigint;
        gasUsed: bigint;
        effectiveGasPrice: bigint;
        from: Address;
        to: Address;
        value: string;
    };
}

/**
 * Signer instance (singleton)
 */
let walletClient: WalletClient | null = null;
let signerAddress: Address | null = null;

/**
 * Initialize signer with private key
 * Private key is requested via secure terminal input
 */
export async function initializeSigner(): Promise<Address> {
    if (walletClient && signerAddress) {
        return signerAddress;
    }

    console.log('\n🔐 Signer Initialization');
    console.log('⚠️  Your private key will NOT be stored on disk.');
    console.log('⚠️  It will only be kept in memory for this session.\n');

    const privateKey = await readSecureInput('Enter your private key (0x...): ');

    // Validate private key format
    if (!isValidPrivateKey(privateKey)) {
        throw new Error('Invalid private key format. Expected 0x followed by 64 hex characters.');
    }

    try {
        // Create account from private key
        const account = privateKeyToAccount(privateKey as `0x${string}`);

        // Create wallet client
        const config = getEnvConfig();
        walletClient = createWalletClient({
            account,
            chain: base,
            transport: http(config.BASE_RPC_URL),
        });

        signerAddress = account.address;

        console.log(`✓ Signer initialized: ${redactSecret(signerAddress)}\n`);

        // Clear private key from memory (best effort)
        // Note: JavaScript doesn't guarantee memory clearing, but this helps
        privateKey.split('').forEach((_, i, arr) => arr[i] = '0');

        return signerAddress;
    } catch (error) {
        throw new Error('Failed to initialize signer. Please check your private key.');
    }
}

/**
 * Get signer address
 */
export function getSignerAddress(): Address | null {
    return signerAddress;
}

/**
 * Check if signer is initialized
 */
export function isSignerInitialized(): boolean {
    return walletClient !== null && signerAddress !== null;
}

/**
 * Sign and send ERC-20 transfer
 */
export async function signAndSendErc20Transfer(
    params: TransferParams
): Promise<TransactionResult> {
    // Ensure signer is initialized
    if (!walletClient || !signerAddress) {
        throw new Error('Signer not initialized. Call initializeSigner() first.');
    }

    // CRITICAL: Require explicit confirmation
    if (params.confirmed !== true) {
        throw new Error('Transaction not confirmed. Set confirmed=true to proceed.');
    }

    // Validate chain
    if (!isChainAllowed(params.chainId)) {
        throw new Error(`Chain ${params.chainId} is not allowed by policy.`);
    }

    // Validate recipient
    if (!isRecipientAllowed(params.to)) {
        throw new Error(`Recipient ${params.to} is not allowed by policy.`);
    }

    // Handle ETH vs ERC-20
    if (params.token.toUpperCase() === 'ETH') {
        return await sendNativeTransfer(params);
    } else {
        return await sendErc20Transfer(params);
    }
}

/**
 * Send native ETH transfer
 */
async function sendNativeTransfer(params: TransferParams): Promise<TransactionResult> {
    if (!walletClient || !signerAddress) {
        throw new Error('Signer not initialized');
    }

    // Convert amount to wei
    const valueWei = parseUnits(params.amount, 18);

    // Check caps (convert to USD - simplified: 1 ETH = $2500)
    const amountUsd = parseFloat(params.amount) * 2500;
    const nowTs = Math.floor(Date.now() / 1000);
    const db = getDb();
    const capsCheck = checkCaps(amountUsd, 'ETH', nowTs, db);

    if (!capsCheck.allowed) {
        throw new Error(`Transaction blocked by policy: ${capsCheck.reason}`);
    }

    console.log(`\n📤 Sending ${params.amount} ETH to ${redactSecret(params.to)}`);

    // Send transaction
    const hash = await walletClient.sendTransaction({
        to: params.to,
        value: valueWei,
        chain: base,
    });

    console.log(`✓ Transaction sent: ${hash}`);
    console.log('⏳ Waiting for confirmation...');

    // Wait for receipt
    const receipt = await walletClient.waitForTransactionReceipt({ hash });

    console.log(`✓ Transaction confirmed in block ${receipt.blockNumber}\n`);

    return {
        txHash: hash,
        receiptSummary: {
            status: receipt.status === 'success' ? 'success' : 'reverted',
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed,
            effectiveGasPrice: receipt.effectiveGasPrice,
            from: receipt.from,
            to: receipt.to || params.to,
            value: params.amount,
        },
    };
}

/**
 * Send ERC-20 token transfer
 */
async function sendErc20Transfer(params: TransferParams): Promise<TransactionResult> {
    if (!walletClient || !signerAddress) {
        throw new Error('Signer not initialized');
    }

    // Get token info from policy
    const tokenInfo = getTokenInfo(params.token);
    if (!tokenInfo) {
        throw new Error(`Token ${params.token} not found in policy allowlist.`);
    }

    // Validate token is allowed
    if (!isTokenAllowed(tokenInfo.address)) {
        throw new Error(`Token ${params.token} is not allowed by policy.`);
    }

    // Convert amount to token's smallest unit
    const amountRaw = parseUnits(params.amount, tokenInfo.decimals);

    // Check caps (simplified: assume 1 USDC = $1, others use placeholder)
    const stablecoins = ['USDC', 'USDT', 'DAI', 'FRAX'];
    const amountUsd = stablecoins.includes(params.token.toUpperCase())
        ? parseFloat(params.amount)
        : parseFloat(params.amount) * 2500; // Placeholder for non-stables

    const nowTs = Math.floor(Date.now() / 1000);
    const db = getDb();
    const capsCheck = checkCaps(amountUsd, params.token, nowTs, db);

    if (!capsCheck.allowed) {
        throw new Error(`Transaction blocked by policy: ${capsCheck.reason}`);
    }

    console.log(`\n📤 Sending ${params.amount} ${params.token} to ${redactSecret(params.to)}`);

    // Simulate the contract call to estimate gas
    try {
        await walletClient.simulateContract({
            address: tokenInfo.address as Address,
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [params.to, amountRaw],
            account: signerAddress,
        });
    } catch (error) {
        throw new Error(`Transaction simulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Write the contract transaction
    const hash = await walletClient.writeContract({
        address: tokenInfo.address as Address,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [params.to, amountRaw],
        chain: base,
    });

    console.log(`✓ Transaction sent: ${hash}`);
    console.log('⏳ Waiting for confirmation...');

    // Wait for receipt
    const receipt = await walletClient.waitForTransactionReceipt({ hash });

    console.log(`✓ Transaction confirmed in block ${receipt.blockNumber}\n`);

    return {
        txHash: hash,
        receiptSummary: {
            status: receipt.status === 'success' ? 'success' : 'reverted',
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed,
            effectiveGasPrice: receipt.effectiveGasPrice,
            from: receipt.from,
            to: receipt.to || tokenInfo.address as Address,
            value: params.amount,
        },
    };
}

/**
 * Clear signer from memory (logout)
 */
export function clearSigner(): void {
    walletClient = null;
    signerAddress = null;
    console.log('✓ Signer cleared from memory');
}
