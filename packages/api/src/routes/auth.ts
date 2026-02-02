import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';
import { createUser, createApiKey, getUserApiKeys, revokeApiKey } from '../db/client';
import { getEnvConfig } from '../config/env';

const registerSchema = z.object({
    email: z.string().email('Invalid email address').optional(),
    name: z.string().min(1, 'Name is required').optional(),
});

const createKeySchema = z.object({
    label: z.string().min(1, 'Label is required'),
});

/**
 * Authentication & API key management endpoints
 */
export async function authRoutes(fastify: FastifyInstance) {
    // POST /v1/auth/register - Self-service registration
    fastify.post('/v1/auth/register', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    email: { type: 'string', format: 'email' },
                    name: { type: 'string' },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        userId: { type: 'string' },
                        apiKey: { type: 'string' },
                        message: { type: 'string' },
                    },
                },
            },
        },
        handler: async (request, reply) => {
            // Validate request body
            const result = registerSchema.safeParse(request.body);
            if (!result.success) {
                return reply.status(400).send({
                    error: 'Validation Error',
                    message: result.error.errors[0].message,
                });
            }

            try {
                // Create user
                const user = await createUser();

                // Generate API key (32 bytes = 64 hex characters)
                const apiKey = randomBytes(32).toString('hex');
                const apiKeyWithPrefix = `claw_${apiKey}`;

                // Hash the API key
                const config = getEnvConfig();
                const saltRounds = parseInt(config.API_KEY_SALT_ROUNDS);
                const keyHash = await bcrypt.hash(apiKeyWithPrefix, saltRounds);

                // Store hashed key
                const label = result.data.name
                    ? `${result.data.name}'s API Key`
                    : 'Default API Key';
                await createApiKey(user.id, keyHash, label);

                return reply.send({
                    userId: user.id,
                    apiKey: apiKeyWithPrefix,
                    message:
                        'Registration successful! Save your API key securely - it will not be shown again.',
                });
            } catch (error) {
                console.error('Error during registration:', error);
                return reply.status(500).send({
                    error: 'Internal Server Error',
                    message: 'Failed to register user',
                });
            }
        },
    });

    // POST /v1/auth/keys - Create new API key
    fastify.post('/v1/auth/keys', {
        schema: {
            body: {
                type: 'object',
                required: ['label'],
                properties: {
                    label: { type: 'string' },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        keyId: { type: 'string' },
                        apiKey: { type: 'string' },
                        label: { type: 'string' },
                        createdAt: { type: 'string' },
                    },
                },
            },
        },
        preHandler: fastify.auth([fastify.authenticate]),
        handler: async (request, reply) => {
            const userId = request.userId!;

            // Validate request body
            const result = createKeySchema.safeParse(request.body);
            if (!result.success) {
                return reply.status(400).send({
                    error: 'Validation Error',
                    message: result.error.errors[0].message,
                });
            }

            const { label } = result.data;

            try {
                // Generate API key
                const apiKey = randomBytes(32).toString('hex');
                const apiKeyWithPrefix = `claw_${apiKey}`;

                // Hash the API key
                const config = getEnvConfig();
                const saltRounds = parseInt(config.API_KEY_SALT_ROUNDS);
                const keyHash = await bcrypt.hash(apiKeyWithPrefix, saltRounds);

                // Store hashed key
                const apiKeyRecord = await createApiKey(userId, keyHash, label);

                return reply.send({
                    keyId: apiKeyRecord.id,
                    apiKey: apiKeyWithPrefix,
                    label: apiKeyRecord.label,
                    createdAt: apiKeyRecord.created_at.toISOString(),
                });
            } catch (error) {
                console.error('Error creating API key:', error);
                return reply.status(500).send({
                    error: 'Internal Server Error',
                    message: 'Failed to create API key',
                });
            }
        },
    });

    // GET /v1/auth/keys - List API keys
    fastify.get('/v1/auth/keys', {
        schema: {
            response: {
                200: {
                    type: 'object',
                    properties: {
                        keys: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string' },
                                    label: { type: 'string', nullable: true },
                                    createdAt: { type: 'string' },
                                    lastUsedAt: { type: 'string', nullable: true },
                                    revokedAt: { type: 'string', nullable: true },
                                    status: { type: 'string' },
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
                const keys = await getUserApiKeys(userId);

                return reply.send({
                    keys: keys.map((k) => ({
                        id: k.id,
                        label: k.label,
                        createdAt: k.created_at.toISOString(),
                        lastUsedAt: k.last_used_at?.toISOString() || null,
                        revokedAt: k.revoked_at?.toISOString() || null,
                        status: k.revoked_at ? 'revoked' : 'active',
                    })),
                });
            } catch (error) {
                console.error('Error fetching API keys:', error);
                return reply.status(500).send({
                    error: 'Internal Server Error',
                    message: 'Failed to fetch API keys',
                });
            }
        },
    });

    // DELETE /v1/auth/keys/:id - Revoke API key
    fastify.delete('/v1/auth/keys/:id', {
        schema: {
            params: {
                type: 'object',
                required: ['id'],
                properties: {
                    id: { type: 'string', format: 'uuid' },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        message: { type: 'string' },
                    },
                },
            },
        },
        preHandler: fastify.auth([fastify.authenticate]),
        handler: async (request, reply) => {
            const userId = request.userId!;
            const { id } = request.params as { id: string };

            try {
                await revokeApiKey(id, userId);

                return reply.send({
                    message: 'API key revoked successfully',
                });
            } catch (error) {
                console.error('Error revoking API key:', error);
                return reply.status(500).send({
                    error: 'Internal Server Error',
                    message: 'Failed to revoke API key',
                });
            }
        },
    });
}
