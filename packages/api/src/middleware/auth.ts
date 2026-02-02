import { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import { getApiKeyByHash, updateApiKeyLastUsed } from '../db/client';

/**
 * API Key authentication middleware
 * Validates API key from Authorization header and attaches user context
 */
export async function authMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
        return reply.status(401).send({
            error: 'Unauthorized',
            message: 'Missing Authorization header',
        });
    }

    // Expected format: "Bearer claw_..."
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return reply.status(401).send({
            error: 'Unauthorized',
            message: 'Invalid Authorization header format. Expected: Bearer <api_key>',
        });
    }

    const apiKey = parts[1];

    // Validate API key format
    if (!apiKey.startsWith('claw_')) {
        return reply.status(401).send({
            error: 'Unauthorized',
            message: 'Invalid API key format',
        });
    }

    try {
        // Hash the provided key and look up in database
        // Note: In production, consider using a faster lookup mechanism
        // For now, we'll do a simple hash comparison
        const keyHash = await hashApiKey(apiKey);
        const apiKeyRecord = await getApiKeyByHash(keyHash);

        if (!apiKeyRecord) {
            return reply.status(401).send({
                error: 'Unauthorized',
                message: 'Invalid API key',
            });
        }

        // Check if key is revoked
        if (apiKeyRecord.revoked_at) {
            return reply.status(401).send({
                error: 'Unauthorized',
                message: 'API key has been revoked',
            });
        }

        // Attach user context to request
        request.userId = apiKeyRecord.user_id;
        request.apiKeyId = apiKeyRecord.id;

        // Update last used timestamp (async, don't wait)
        updateApiKeyLastUsed(apiKeyRecord.id).catch((err) => {
            console.error('Failed to update API key last_used_at:', err);
        });
    } catch (error) {
        console.error('Auth middleware error:', error);
        return reply.status(500).send({
            error: 'Internal Server Error',
            message: 'Authentication failed',
        });
    }
}

/**
 * Hash API key for database lookup
 * Note: This is a simplified version. In production, consider using
 * a more efficient lookup mechanism (e.g., indexed hash prefix)
 */
async function hashApiKey(apiKey: string): Promise<string> {
    // For lookup, we need to hash with the same salt
    // This is a simplified approach - in production, consider storing
    // a hash prefix for faster lookup
    return bcrypt.hash(apiKey, 10);
}

/**
 * Optional: Create a version that skips auth for public routes
 */
export async function optionalAuthMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
        // No auth header, continue without user context
        return;
    }

    // If auth header is present, validate it
    return authMiddleware(request, reply);
}
