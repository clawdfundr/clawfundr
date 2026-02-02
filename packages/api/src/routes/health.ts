import { FastifyInstance } from 'fastify';

/**
 * Health check endpoint
 */
export async function healthRoutes(fastify: FastifyInstance) {
    fastify.get('/health', {
        schema: {
            response: {
                200: {
                    type: 'object',
                    properties: {
                        status: { type: 'string' },
                        timestamp: { type: 'string' },
                        uptime: { type: 'number' },
                    },
                },
            },
        },
        handler: async (_request, reply) => {
            return reply.send({
                status: 'ok',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
            });
        },
    });
}
