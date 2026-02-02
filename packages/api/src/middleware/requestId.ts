import { FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';

/**
 * Request ID middleware
 * Adds a unique request ID to each request for tracing
 */
export async function requestIdMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    const requestId = randomUUID();
    request.requestId = requestId;
    reply.header('X-Request-ID', requestId);
}
