import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { registerWallet, getUserWallets } from '../db/client';

const registerWalletSchema = z.object({
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
    label: z.string().optional(),
});

/**
 * Wallet management endpoints
 */
export async function walletRoutes(fastify: FastifyInstance) {
    // POST /v1/wallets - Register a wallet
    fastify.post('/v1/wallets', {
        schema: {
            body: {
                type: 'object',
                required: ['address'],
                properties: {
                    address: { type: 'string' },
                    label: { type: 'string' },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        address: { type: 'string' },
                        label: { type: 'string', nullable: true },
                        chainId: { type: 'number' },
                        createdAt: { type: 'string' },
                    },
                },
            },
        },
        preHandler: fastify.auth([fastify.authenticate]),
        handler: async (request, reply) => {
            const userId = request.userId!;

            // Validate request body
            const result = registerWalletSchema.safeParse(request.body);
            if (!result.success) {
                return reply.status(400).send({
                    error: 'Validation Error',
                    message: result.error.errors[0].message,
                });
            }

            const { address, label } = result.data;

            try {
                const wallet = await registerWallet(userId, 8453, address, label);

                return reply.send({
                    id: wallet.id,
                    address: wallet.address,
                    label: wallet.label,
                    chainId: wallet.chain_id,
                    createdAt: wallet.created_at.toISOString(),
                });
            } catch (error) {
                console.error('Error registering wallet:', error);
                return reply.status(500).send({
                    error: 'Internal Server Error',
                    message: 'Failed to register wallet',
                });
            }
        },
    });

    // GET /v1/wallets - List user's wallets
    fastify.get('/v1/wallets', {
        schema: {
            response: {
                200: {
                    type: 'object',
                    properties: {
                        wallets: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string' },
                                    address: { type: 'string' },
                                    label: { type: 'string', nullable: true },
                                    chainId: { type: 'number' },
                                    createdAt: { type: 'string' },
                                },
                            },
                        },
                    },
                },
            },
        },
        preHandler: fastify.auth([fastify.authenticate]),
        handler: async (request, reply) => {
            const userId = request.userId!;

            try {
                const wallets = await getUserWallets(userId);

                return reply.send({
                    wallets: wallets.map((w) => ({
                        id: w.id,
                        address: w.address,
                        label: w.label,
                        chainId: w.chain_id,
                        createdAt: w.created_at.toISOString(),
                    })),
                });
            } catch (error) {
                console.error('Error fetching wallets:', error);
                return reply.status(500).send({
                    error: 'Internal Server Error',
                    message: 'Failed to fetch wallets',
                });
            }
        },
    });
}
