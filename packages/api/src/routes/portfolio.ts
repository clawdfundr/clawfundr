import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getWalletById, getWalletByAddress } from '../db/client';
import { getBalances, BASE_TOKENS } from '../tools/chain';
import { Address } from 'viem';

const portfolioQuerySchema = z.object({
    walletId: z.string().uuid().optional(),
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
}).refine((data) => data.walletId || data.address, {
    message: 'Either walletId or address must be provided',
});

/**
 * Portfolio endpoint
 */
export async function portfolioRoutes(fastify: FastifyInstance) {
    fastify.get('/v1/portfolio', {
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    walletId: { type: 'string' },
                    address: { type: 'string' },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        walletId: { type: 'string' },
                        address: { type: 'string' },
                        chainId: { type: 'number' },
                        balances: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    token: { type: 'string' },
                                    balance: { type: 'string' },
                                    usdValue: { type: 'string', nullable: true },
                                },
                            },
                        },
                        lastUpdated: { type: 'string' },
                    },
                },
            },
        },
        preHandler: fastify.auth([fastify.authenticate]),
        handler: async (request, reply) => {
            const userId = request.userId!;

            // Validate query params
            const result = portfolioQuerySchema.safeParse(request.query);
            if (!result.success) {
                return reply.status(400).send({
                    error: 'Validation Error',
                    message: result.error.errors[0].message,
                });
            }

            const { walletId, address } = result.data;

            try {
                // Get wallet
                let wallet;
                if (walletId) {
                    wallet = await getWalletById(walletId, userId);
                } else if (address) {
                    wallet = await getWalletByAddress(address, userId, 8453);
                }

                if (!wallet) {
                    return reply.status(404).send({
                        error: 'Not Found',
                        message: 'Wallet not found',
                    });
                }

                // Fetch balances
                const tokens = [
                    { symbol: 'ETH' },
                    { symbol: 'USDC', address: BASE_TOKENS.USDC },
                    { symbol: 'DAI', address: BASE_TOKENS.DAI },
                ];

                const balances = await getBalances(wallet.address as Address, tokens);

                return reply.send({
                    walletId: wallet.id,
                    address: wallet.address,
                    chainId: wallet.chain_id,
                    balances: balances.map((b) => ({
                        token: b.token,
                        balance: b.balance,
                        usdValue: null, // TODO: Add price feed integration
                    })),
                    lastUpdated: new Date().toISOString(),
                });
            } catch (error) {
                console.error('Error fetching portfolio:', error);
                return reply.status(500).send({
                    error: 'Internal Server Error',
                    message: 'Failed to fetch portfolio',
                });
            }
        },
    });
}
