import { createPublicClient, http, Address, formatEther, parseAbi } from 'viem';
import { base } from 'viem/chains';
import { getEnvConfig } from '../config/env';

let publicClient: any = null;

/**
 * Get or create Base chain public client
 */
export function getBaseClient() {
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
 * Get ETH balance for an address
 */
export async function getEthBalance(address: Address): Promise<string> {
    const client = getBaseClient();
    const balance = await client.getBalance({ address });
    return formatEther(balance);
}

/**
 * Get ERC-20 token balance
 */
export async function getErc20Balance(
    tokenAddress: Address,
    walletAddress: Address
): Promise<string> {
    const client = getBaseClient();

    const abi = parseAbi([
        'function balanceOf(address) view returns (uint256)',
        'function decimals() view returns (uint8)',
    ]);

    try {
        const [balance, decimals] = await Promise.all([
            client.readContract({
                address: tokenAddress,
                abi,
                functionName: 'balanceOf',
                args: [walletAddress],
            }) as Promise<bigint>,
            client.readContract({
                address: tokenAddress,
                abi,
                functionName: 'decimals',
                args: [],
            }) as Promise<number>,
        ]);

        // Format balance with decimals
        const divisor = BigInt(10 ** decimals);
        const integerPart = balance / divisor;
        const fractionalPart = balance % divisor;
        const fractionalStr = fractionalPart.toString().padStart(decimals, '0');

        return `${integerPart}.${fractionalStr}`;
    } catch (error) {
        console.error('Error fetching ERC-20 balance:', error);
        return '0';
    }
}

/**
 * Get multiple token balances
 */
export async function getBalances(
    walletAddress: Address,
    tokens: { symbol: string; address?: Address }[]
): Promise<Array<{ token: string; balance: string }>> {
    const results = await Promise.all(
        tokens.map(async (token) => {
            if (token.symbol === 'ETH') {
                const balance = await getEthBalance(walletAddress);
                return { token: 'ETH', balance };
            } else if (token.address) {
                const balance = await getErc20Balance(token.address, walletAddress);
                return { token: token.symbol, balance };
            }
            return { token: token.symbol, balance: '0' };
        })
    );

    return results;
}

/**
 * Get current block number
 */
export async function getCurrentBlock(): Promise<bigint> {
    const client = getBaseClient();
    return await client.getBlockNumber();
}

/**
 * Get transaction receipt
 */
export async function getTransactionReceipt(txHash: `0x${string}`) {
    const client = getBaseClient();
    return await client.getTransactionReceipt({ hash: txHash });
}

/**
 * Broadcast signed transaction
 */
export async function broadcastTransaction(signedTx: `0x${string}`): Promise<`0x${string}`> {
    const client = getBaseClient();
    return await client.sendRawTransaction({ serializedTransaction: signedTx });
}

/**
 * Estimate gas for a transaction
 */
export async function estimateGas(params: {
    to: Address;
    data?: `0x${string}`;
    value?: bigint;
    from?: Address;
}): Promise<bigint> {
    const client = getBaseClient();
    return await client.estimateGas(params);
}

/**
 * Get gas price
 */
export async function getGasPrice(): Promise<bigint> {
    const client = getBaseClient();
    return await client.getGasPrice();
}

// Common token addresses on Base
export const BASE_TOKENS = {
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address,
    DAI: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb' as Address,
    WETH: '0x4200000000000000000000000000000000000006' as Address,
};
