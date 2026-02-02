import {
    createPublicClient,
    http,
    type PublicClient,
    type Address,
    type Hash,
    type Log,
    formatUnits,
    parseAbiItem,
} from 'viem';
import { base } from 'viem/chains';
import { getEnvConfig } from '../config/env';
import { getTokenInfo, type TokenAllowlistEntry } from '../config/policy';
import { ERC20_ABI } from './erc20-abi';
import type Database from 'better-sqlite3';
import { insertTxRawBulk, upsertTxDecoded, setPolicy, getPolicy, type TxRaw, type TxDecoded } from '../db/db';

let publicClient: PublicClient | null = null;

/**
 * Get or create Base chain public client
 */
export function getPublicClient(): PublicClient {
    if (publicClient) {
        return publicClient;
    }

    const config = getEnvConfig();

    publicClient = createPublicClient({
        chain: base,
        transport: http(config.BASE_RPC_URL),
    });

    return publicClient;
}

/**
 * Normalized balance result
 */
export interface NormalizedBalance {
    token: string;
    symbol: string;
    balance: string;
    balanceFormatted: string;
    decimals: number;
    address?: string;
}

/**
 * Get native ETH balance
 */
export async function getNativeBalance(address: Address): Promise<bigint> {
    const client = getPublicClient();
    const balance = await client.getBalance({ address });
    return balance;
}

/**
 * Get ERC-20 token balance
 */
export async function getErc20Balance(
    address: Address,
    tokenAddress: Address
): Promise<bigint> {
    const client = getPublicClient();

    const balance = await client.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address],
    }) as bigint;

    return balance;
}

/**
 * Get all balances for tokens in allowlist
 */
export async function getBalances(
    address: Address,
    tokenAllowlist: TokenAllowlistEntry[]
): Promise<NormalizedBalance[]> {
    const balances: NormalizedBalance[] = [];

    // Get ETH balance
    const ethBalance = await getNativeBalance(address);
    balances.push({
        token: 'ETH',
        symbol: 'ETH',
        balance: ethBalance.toString(),
        balanceFormatted: formatUnits(ethBalance, 18),
        decimals: 18,
    });

    // Get ERC-20 balances
    for (const token of tokenAllowlist) {
        try {
            const balance = await getErc20Balance(address, token.address as Address);

            balances.push({
                token: token.symbol,
                symbol: token.symbol,
                balance: balance.toString(),
                balanceFormatted: formatUnits(balance, token.decimals),
                decimals: token.decimals,
                address: token.address,
            });
        } catch (error) {
            console.error(`Failed to get balance for ${token.symbol}:`, error);
            // Continue with other tokens
        }
    }

    return balances;
}

// ============================================================================
// EVENT SYNCING
// ============================================================================

/**
 * Sync ERC-20 Transfer and Approval events for an address
 */
export async function syncErc20Logs(
    address: Address,
    tokenAllowlist: TokenAllowlistEntry[],
    fromBlock: bigint,
    toBlock: bigint
): Promise<{ transferCount: number; approvalCount: number }> {
    const client = getPublicClient();
    let transferCount = 0;
    let approvalCount = 0;

    for (const token of tokenAllowlist) {
        try {
            // Fetch Transfer events where address is sender or receiver
            const transferLogs = await client.getLogs({
                address: token.address as Address,
                event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)'),
                fromBlock,
                toBlock,
                args: {
                    // Get transfers where address is either from or to
                    // Note: viem doesn't support OR in args, so we need to fetch both separately
                },
            });

            // Filter for our address
            const relevantTransfers = transferLogs.filter(log => {
                const from = log.args.from?.toLowerCase();
                const to = log.args.to?.toLowerCase();
                const addr = address.toLowerCase();
                return from === addr || to === addr;
            });

            // Process Transfer logs
            for (const log of relevantTransfers) {
                await processTransferLog(log, token, address);
                transferCount++;
            }

            // Fetch Approval events where address is owner
            const approvalLogs = await client.getLogs({
                address: token.address as Address,
                event: parseAbiItem('event Approval(address indexed owner, address indexed spender, uint256 value)'),
                fromBlock,
                toBlock,
                args: {
                    owner: address,
                },
            });

            // Process Approval logs
            for (const log of approvalLogs) {
                await processApprovalLog(log, token, address);
                approvalCount++;
            }
        } catch (error) {
            console.error(`Failed to sync logs for ${token.symbol}:`, error);
            // Continue with other tokens
        }
    }

    return { transferCount, approvalCount };
}

/**
 * Process a Transfer log and store in database
 */
async function processTransferLog(
    log: Log,
    token: TokenAllowlistEntry,
    userAddress: Address
): Promise<void> {
    const { from, to, value } = log.args as { from: Address; to: Address; value: bigint };

    // Get block details for timestamp
    const client = getPublicClient();
    const block = await client.getBlock({ blockNumber: log.blockNumber! });

    // Create raw transaction record
    const txRaw: TxRaw = {
        hash: log.transactionHash!,
        block_number: Number(log.blockNumber!),
        timestamp: Number(block.timestamp),
        from_addr: from,
        to_addr: to,
        value: value.toString(),
        input: null,
        status: 1, // Assume success if log exists
        gas_used: null,
        gas_price: null,
        chain_id: 8453, // Base chain
    };

    // Create decoded transaction record
    const isReceiving = to.toLowerCase() === userAddress.toLowerCase();
    const txDecoded: TxDecoded = {
        hash: log.transactionHash!,
        type: 'transfer',
        token_in: isReceiving ? token.symbol : undefined,
        token_out: isReceiving ? undefined : token.symbol,
        amount_in: isReceiving ? formatUnits(value, token.decimals) : undefined,
        amount_out: isReceiving ? undefined : formatUnits(value, token.decimals),
        counterparty: isReceiving ? from : to,
        notes: `${token.symbol} transfer`,
        decoded_json: JSON.stringify({
            type: 'ERC20_Transfer',
            token: token.symbol,
            tokenAddress: token.address,
            from,
            to,
            value: value.toString(),
            valueFormatted: formatUnits(value, token.decimals),
        }),
    };

    // Store in database
    insertTxRawBulk([txRaw]);
    upsertTxDecoded(txDecoded);
}

/**
 * Process an Approval log and store in database
 */
async function processApprovalLog(
    log: Log,
    token: TokenAllowlistEntry,
    userAddress: Address
): Promise<void> {
    const { owner, spender, value } = log.args as { owner: Address; spender: Address; value: bigint };

    // Get block details for timestamp
    const client = getPublicClient();
    const block = await client.getBlock({ blockNumber: log.blockNumber! });

    // Create raw transaction record
    const txRaw: TxRaw = {
        hash: log.transactionHash!,
        block_number: Number(log.blockNumber!),
        timestamp: Number(block.timestamp),
        from_addr: owner,
        to_addr: spender,
        value: '0', // Approval doesn't transfer value
        input: null,
        status: 1,
        gas_used: null,
        gas_price: null,
        chain_id: 8453,
    };

    // Create decoded transaction record
    const txDecoded: TxDecoded = {
        hash: log.transactionHash!,
        type: 'approval',
        token_in: token.symbol,
        counterparty: spender,
        notes: `${token.symbol} approval`,
        decoded_json: JSON.stringify({
            type: 'ERC20_Approval',
            token: token.symbol,
            tokenAddress: token.address,
            owner,
            spender,
            value: value.toString(),
            valueFormatted: formatUnits(value, token.decimals),
        }),
    };

    // Store in database
    insertTxRawBulk([txRaw]);
    upsertTxDecoded(txDecoded);
}

// ============================================================================
// INCREMENTAL SYNC
// ============================================================================

const LAST_SYNCED_BLOCK_KEY = 'lastSyncedBlock';

/**
 * Get the last synced block number
 */
export function getLastSyncedBlock(): bigint {
    const value = getPolicy(LAST_SYNCED_BLOCK_KEY);
    if (!value) {
        return 0n; // Start from genesis if never synced
    }
    return BigInt(value);
}

/**
 * Set the last synced block number
 */
export function setLastSyncedBlock(blockNumber: bigint): void {
    setPolicy(LAST_SYNCED_BLOCK_KEY, blockNumber.toString());
}

/**
 * Perform incremental sync from last synced block
 */
export async function incrementalSync(
    address: Address,
    tokenAllowlist: TokenAllowlistEntry[]
): Promise<{ transferCount: number; approvalCount: number; blocksProcessed: bigint }> {
    const client = getPublicClient();

    // Get current block
    const currentBlock = await client.getBlockNumber();

    // Get last synced block
    const lastSyncedBlock = getLastSyncedBlock();
    const fromBlock = lastSyncedBlock === 0n ? currentBlock - 1000n : lastSyncedBlock + 1n;

    // Don't sync if we're already up to date
    if (fromBlock > currentBlock) {
        return { transferCount: 0, approvalCount: 0, blocksProcessed: 0n };
    }

    // Sync logs
    const result = await syncErc20Logs(address, tokenAllowlist, fromBlock, currentBlock);

    // Update last synced block
    setLastSyncedBlock(currentBlock);

    return {
        ...result,
        blocksProcessed: currentBlock - fromBlock + 1n,
    };
}

/**
 * Get current block number
 */
export async function getCurrentBlockNumber(): Promise<bigint> {
    const client = getPublicClient();
    return await client.getBlockNumber();
}
