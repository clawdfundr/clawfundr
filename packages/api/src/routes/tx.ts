import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { broadcastTransaction } from '../tools/chain';

const broadcastSchema = z.object({
    signedTx: z.string().regex(/^0x[a-fA-F0-9]+$/, 'Invalid signed transaction format'),
});

/**
 * Transaction broadcasting endpoint
 */
export async function txRoutes(fastify: FastifyInstance) {
    fastify.post('/v1/tx/broadcast', {
        schema: {
            body: {
                type: 'object',
                required: ['signedTx'],
                properties: {
                    signedTx: { type: 'string' },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        txHash: { type: 'string' },
                        status: { type: 'string' },
                    },
                },
            },
        },
        preHandler: fastify.auth([fastify.authenticate]),
        handler: async (request, reply) => {
            // Validate request body
            const result = broadcastSchema.safeParse(request.body);
            if (!result.success) {
                return reply.status(400).send({
                    error: 'Validation Error',
                    message: result.error.errors[0].message,
                });
            }

            const { signedTx } = result.data;

            try {
                const txHash = await broadcastTransaction(signedTx as `0x${string}`);

                return reply.send({
                    txHash,
                    status: 'pending',
                });
            } catch (error: any) {
                console.error('Error broadcasting transaction:', error);
                return reply.status(500).send({
                    error: 'Broadcast Failed',
                    message: error.message || 'Failed to broadcast transaction',
                });
            }
        },
    });
}
