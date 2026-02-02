export interface User {
    id: string;
    created_at: Date;
    status: string;
}

export interface ApiKey {
    id: string;
    user_id: string;
    key_hash: string;
    label: string | null;
    created_at: Date;
    last_used_at: Date | null;
    revoked_at: Date | null;
}

export interface Wallet {
    id: string;
    user_id: string;
    chain_id: number;
    address: string;
    label: string | null;
    created_at: Date;
}

export interface Balance {
    token: string;
    balance: string;
    usdValue?: string;
}

export interface Transaction {
    hash: string;
    blockNumber: number;
    timestamp: number;
    from: string;
    to: string | null;
    value: string;
    input: string | null;
    status: number;
    gasUsed: string | null;
    gasPrice: string | null;
    type?: string;
    tokenIn?: string;
    tokenOut?: string;
    amountIn?: string;
    amountOut?: string;
    counterparty?: string;
}

export interface ActionProposal {
    id: string;
    user_id: string;
    type: 'x402_payment' | 'token_transfer' | 'token_approval';
    payload_json: string;
    status: 'pending' | 'executed' | 'expired' | 'cancelled';
    created_at: Date;
    expires_at: Date;
}

export interface X402Requirement {
    merchant: string;
    amount: string;
    token: string;
    recipient: string;
    resource: string;
}

export interface UnsignedTransaction {
    to: string;
    data: string;
    value: string;
    chainId: number;
    gas?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
}

export interface Policy {
    allowedChains: number[];
    allowedTokens: string[];
    allowedMerchants: string[];
    spendingCaps: {
        perTransaction: string;
        daily: string;
        monthly: string;
    };
    targets?: {
        stableRatio: number;
        maxAssetExposure: number;
    };
}

export interface RequestContext {
    userId: string;
    apiKeyId: string;
    ip: string;
    requestId: string;
}

// Fastify type augmentation
declare module 'fastify' {
    interface FastifyInstance {
        authenticate: (
            request: import('fastify').FastifyRequest,
            reply: import('fastify').FastifyReply
        ) => Promise<void>;
        auth: (
            handlers: Array<
                (
                    request: import('fastify').FastifyRequest,
                    reply: import('fastify').FastifyReply
                ) => Promise<void>
            >
        ) => (
            request: import('fastify').FastifyRequest,
            reply: import('fastify').FastifyReply
        ) => Promise<void>;
    }

    interface FastifyRequest {
        userId?: string;
        apiKeyId?: string;
        requestId?: string;
    }
}
