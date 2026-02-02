import type { Address } from 'viem';
import {
    isMerchantAllowed,
    isChainAllowed,
    isTokenAllowed,
    checkCaps,
    getTokenInfo,
} from '../config/policy';
import { getDb, saveX402Payment, updateX402PaymentStatus } from '../db/db';
import { signAndSendErc20Transfer } from '../signer/signer';

/**
 * x402 Payment requirement (parsed from 402 response)
 */
export interface X402PaymentRequirement {
    chainId: number;
    tokenAddress: Address;
    tokenSymbol?: string;
    amount: string; // Human-readable amount
    recipient: Address;
    merchantDomain: string;
    resource: string;
    rawRequirement: any; // Original payment requirement JSON
}

/**
 * Payment proposal (returned when confirmed=false)
 */
export interface X402PaymentProposal {
    requirement: X402PaymentRequirement;
    policyChecks: {
        merchantAllowed: boolean;
        chainAllowed: boolean;
        tokenAllowed: boolean;
        capsAllowed: boolean;
        capsReason?: string;
    };
    estimatedCostUsd?: number;
    canProceed: boolean;
    blockers: string[];
}

/**
 * x402 fetch options
 */
export interface X402FetchOptions extends RequestInit {
    confirmed?: boolean;
}

/**
 * x402 fetch result
 */
export interface X402FetchResult {
    response?: Response;
    paymentProposal?: X402PaymentProposal;
    paymentCompleted?: boolean;
    txHash?: string;
}

/**
 * Parse x402 payment requirement from 402 response
 */
export function parseX402Requirement(
    response: Response,
    url: string
): X402PaymentRequirement {
    // Get payment requirement from headers or body
    const paymentHeader = response.headers.get('x-payment-required');
    const wwwAuthHeader = response.headers.get('www-authenticate');

    let requirement: any;

    if (paymentHeader) {
        try {
            requirement = JSON.parse(paymentHeader);
        } catch {
            throw new Error('Invalid x-payment-required header format');
        }
    } else if (wwwAuthHeader && wwwAuthHeader.includes('x402')) {
        // Parse WWW-Authenticate: x402 format
        // Example: x402 chain=8453 token=0x833... amount=1.0 recipient=0xabc...
        const params = parseWwwAuthenticate(wwwAuthHeader);
        requirement = params;
    } else {
        throw new Error('No payment requirement found in 402 response');
    }

    // Extract merchant domain from URL
    const urlObj = new URL(url);
    const merchantDomain = urlObj.hostname;

    // Validate required fields
    if (!requirement.chainId && !requirement.chain) {
        throw new Error('Missing chainId in payment requirement');
    }
    if (!requirement.tokenAddress && !requirement.token) {
        throw new Error('Missing token address in payment requirement');
    }
    if (!requirement.amount) {
        throw new Error('Missing amount in payment requirement');
    }
    if (!requirement.recipient) {
        throw new Error('Missing recipient in payment requirement');
    }

    const chainId = requirement.chainId || requirement.chain;
    const tokenAddress = requirement.tokenAddress || requirement.token;

    // Try to get token symbol from policy
    const tokenInfo = getTokenInfo(tokenAddress);

    return {
        chainId: typeof chainId === 'string' ? parseInt(chainId) : chainId,
        tokenAddress: tokenAddress as Address,
        tokenSymbol: tokenInfo?.symbol || requirement.tokenSymbol,
        amount: requirement.amount,
        recipient: requirement.recipient as Address,
        merchantDomain,
        resource: urlObj.pathname,
        rawRequirement: requirement,
    };
}

/**
 * Parse WWW-Authenticate header
 */
function parseWwwAuthenticate(header: string): any {
    const params: any = {};

    // Remove "x402 " prefix
    const paramsStr = header.replace(/^x402\s+/i, '');

    // Parse key=value pairs
    const pairs = paramsStr.match(/(\w+)=([^\s,]+)/g) || [];

    for (const pair of pairs) {
        const [key, value] = pair.split('=');
        params[key] = value;
    }

    return params;
}

/**
 * Validate payment requirement against policy
 */
export function validateX402Payment(
    requirement: X402PaymentRequirement
): X402PaymentProposal {
    const blockers: string[] = [];

    // Check merchant allowlist
    const merchantAllowed = isMerchantAllowed(requirement.merchantDomain);
    if (!merchantAllowed) {
        blockers.push(`Merchant ${requirement.merchantDomain} not in allowlist`);
    }

    // Check chain allowlist
    const chainAllowed = isChainAllowed(requirement.chainId);
    if (!chainAllowed) {
        blockers.push(`Chain ${requirement.chainId} not in allowlist`);
    }

    // Check token allowlist
    const tokenAllowed = isTokenAllowed(requirement.tokenAddress);
    if (!tokenAllowed) {
        blockers.push(`Token ${requirement.tokenAddress} not in allowlist`);
    }

    // Check spending caps
    const tokenInfo = getTokenInfo(requirement.tokenAddress);
    const stablecoins = ['USDC', 'USDT', 'DAI', 'FRAX'];
    const isStable = tokenInfo && stablecoins.includes(tokenInfo.symbol.toUpperCase());

    // Estimate USD cost (simplified)
    const estimatedCostUsd = isStable
        ? parseFloat(requirement.amount)
        : parseFloat(requirement.amount) * 2500; // Placeholder for non-stables

    const nowTs = Math.floor(Date.now() / 1000);
    const db = getDb();
    const capsCheck = checkCaps(
        estimatedCostUsd,
        requirement.tokenSymbol || 'UNKNOWN',
        nowTs,
        db
    );

    let capsAllowed = capsCheck.allowed;
    let capsReason = capsCheck.reason;

    if (!capsAllowed) {
        blockers.push(capsReason || 'Spending cap exceeded');
    }

    return {
        requirement,
        policyChecks: {
            merchantAllowed,
            chainAllowed,
            tokenAllowed,
            capsAllowed,
            capsReason,
        },
        estimatedCostUsd,
        canProceed: blockers.length === 0,
        blockers,
    };
}

/**
 * Fetch with x402 payment support
 */
export async function fetchWithX402(
    url: string,
    options: X402FetchOptions = {}
): Promise<X402FetchResult> {
    const { confirmed, ...fetchOptions } = options;

    // Make initial request
    const response = await fetch(url, fetchOptions);

    // If not 402, return response directly
    if (response.status !== 402) {
        return { response };
    }

    // Parse payment requirement
    const requirement = parseX402Requirement(response, url);

    // Validate against policy
    const proposal = validateX402Payment(requirement);

    // If not confirmed, return proposal for user review
    if (!confirmed) {
        return { paymentProposal: proposal };
    }

    // If confirmed but policy blocks it, throw error
    if (!proposal.canProceed) {
        throw new Error(`Payment blocked by policy: ${proposal.blockers.join(', ')}`);
    }

    // Save payment record (pending)
    const db = getDb();
    const paymentId = saveX402Payment({
        timestamp: Math.floor(Date.now() / 1000),
        merchant: requirement.merchantDomain,
        resource: requirement.resource,
        amount: proposal.estimatedCostUsd?.toString() || requirement.amount,
        token: requirement.tokenSymbol || requirement.tokenAddress,
        tx_hash: undefined,
        status: 'pending',
        receipt_json: JSON.stringify(requirement.rawRequirement),
    });

    try {
        // Execute payment
        const txResult = await signAndSendErc20Transfer({
            token: requirement.tokenSymbol || requirement.tokenAddress,
            to: requirement.recipient,
            amount: requirement.amount,
            chainId: requirement.chainId,
            confirmed: true,
        });

        // Update payment record (completed)
        updateX402PaymentStatus(paymentId, 'completed', txResult.txHash);

        console.log(`✓ x402 payment completed: ${txResult.txHash}`);

        // Retry original request with payment proof
        const retryHeaders = new Headers(fetchOptions.headers);
        retryHeaders.set('x-payment-proof', txResult.txHash);

        const retryResponse = await fetch(url, {
            ...fetchOptions,
            headers: retryHeaders,
        });

        return {
            response: retryResponse,
            paymentCompleted: true,
            txHash: txResult.txHash,
        };
    } catch (error) {
        // Update payment record (failed)
        updateX402PaymentStatus(paymentId, 'failed');
        throw error;
    }
}

/**
 * Format payment proposal for display
 */
export function formatPaymentProposal(proposal: X402PaymentProposal): string {
    const req = proposal.requirement;

    let message = '💳 x402 Payment Required\n\n';
    message += `Merchant: ${req.merchantDomain}\n`;
    message += `Resource: ${req.resource}\n`;
    message += `Amount: ${req.amount} ${req.tokenSymbol || req.tokenAddress}\n`;
    message += `Estimated Cost: $${proposal.estimatedCostUsd?.toFixed(2) || 'Unknown'}\n`;
    message += `Chain: ${req.chainId}\n`;
    message += `Recipient: ${req.recipient}\n\n`;

    message += 'Policy Checks:\n';
    message += `  Merchant: ${proposal.policyChecks.merchantAllowed ? '✓' : '✗'}\n`;
    message += `  Chain: ${proposal.policyChecks.chainAllowed ? '✓' : '✗'}\n`;
    message += `  Token: ${proposal.policyChecks.tokenAllowed ? '✓' : '✗'}\n`;
    message += `  Caps: ${proposal.policyChecks.capsAllowed ? '✓' : '✗'}`;

    if (proposal.policyChecks.capsReason) {
        message += ` (${proposal.policyChecks.capsReason})`;
    }
    message += '\n\n';

    if (proposal.canProceed) {
        message += '✓ Payment can proceed\n';
    } else {
        message += '✗ Payment blocked:\n';
        for (const blocker of proposal.blockers) {
            message += `  - ${blocker}\n`;
        }
    }

    return message;
}
