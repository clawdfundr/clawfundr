import { Address, encodeFunctionData, parseAbi, parseEther, parseUnits } from 'viem';
import { UnsignedTransaction } from '../types';
import { estimateGas, getGasPrice } from './chain';

/**
 * Build unsigned ETH transfer transaction
 */
export async function buildEthTransfer(
    to: Address,
    amount: string,
    from?: Address
): Promise<UnsignedTransaction> {
    const value = parseEther(amount);

    const [gas, gasPrice] = await Promise.all([
        estimateGas({ to, value, from }),
        getGasPrice(),
    ]);

    return {
        to,
        data: '0x',
        value: value.toString(),
        chainId: 8453, // Base
        gas: gas.toString(),
        maxFeePerGas: (gasPrice * 2n).toString(), // 2x current gas price
        maxPriorityFeePerGas: parseEther('0.0000001').toString(), // 0.1 gwei
    };
}

/**
 * Build unsigned ERC-20 transfer transaction
 */
export async function buildErc20Transfer(
    tokenAddress: Address,
    to: Address,
    amount: string,
    decimals: number = 18,
    from?: Address
): Promise<UnsignedTransaction> {
    const abi = parseAbi(['function transfer(address to, uint256 amount) returns (bool)']);

    const amountBigInt = parseUnits(amount, decimals);

    const data = encodeFunctionData({
        abi,
        functionName: 'transfer',
        args: [to, amountBigInt],
    });

    const [gas, gasPrice] = await Promise.all([
        estimateGas({ to: tokenAddress, data, from }),
        getGasPrice(),
    ]);

    return {
        to: tokenAddress,
        data,
        value: '0',
        chainId: 8453, // Base
        gas: gas.toString(),
        maxFeePerGas: (gasPrice * 2n).toString(),
        maxPriorityFeePerGas: parseEther('0.0000001').toString(),
    };
}

/**
 * Build unsigned ERC-20 approval transaction
 */
export async function buildErc20Approval(
    tokenAddress: Address,
    spender: Address,
    amount: string,
    decimals: number = 18,
    from?: Address
): Promise<UnsignedTransaction> {
    const abi = parseAbi(['function approve(address spender, uint256 amount) returns (bool)']);

    const amountBigInt = parseUnits(amount, decimals);

    const data = encodeFunctionData({
        abi,
        functionName: 'approve',
        args: [spender, amountBigInt],
    });

    const [gas, gasPrice] = await Promise.all([
        estimateGas({ to: tokenAddress, data, from }),
        getGasPrice(),
    ]);

    return {
        to: tokenAddress,
        data,
        value: '0',
        chainId: 8453,
        gas: gas.toString(),
        maxFeePerGas: (gasPrice * 2n).toString(),
        maxPriorityFeePerGas: parseEther('0.0000001').toString(),
    };
}
