import { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import { ApiKey, getActiveApiKeys, updateApiKeyLastUsed } from '../db/client';

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
        const apiKeyRecord = await findApiKeyByValue(apiKey);

        if (!apiKeyRecord) {
            return reply.status(401).send({
                error: 'Unauthorized',
                message: 'Invalid API key',
            });
        }

        if (apiKeyRecord.revoked_at) {
            return reply.status(401).send({
                error: 'Unauthorized',
                message: 'API key has been revoked',
            });
        }

        request.userId = apiKeyRecord.user_id;
        request.apiKeyId = apiKeyRecord.id;

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
 * Find matching API key by bcrypt compare against active key hashes.
 */
async function findApiKeyByValue(apiKey: string): Promise<ApiKey | null> {
    const activeKeys = await getActiveApiKeys();

    for (const key of activeKeys) {
        const isMatch = await bcrypt.compare(apiKey, key.key_hash);
        if (isMatch) {
            return key;
        }
    }

    return null;
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
        return;
    }

    return authMiddleware(request, reply);
}
