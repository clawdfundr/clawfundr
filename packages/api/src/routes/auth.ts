import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';
import {
    createUser,
    createApiKey,
    getUserApiKeys,
    revokeApiKey,
    upsertAgentProfile,
    isAgentNameTaken,
} from '../db/client';
import { getEnvConfig } from '../config/env';

const registerSchema = z.object({
    agentName: z.string().min(2, 'Agent name is required'),
    description: z.string().min(8, 'Description must be at least 8 characters'),
});

const createKeySchema = z.object({
    label: z.string().min(1, 'Label is required'),
});

function generateVerificationCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = randomBytes(6);
    let code = '';

    for (let i = 0; i < 6; i += 1) {
        code += alphabet[bytes[i] % alphabet.length];
    }

    return code;
}

function buildClaimLink(baseUrl: string, userId: string, code: string): string {
    const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return `${base}/${userId}?code=${encodeURIComponent(code)}`;
}

/**
 * Authentication & API key management endpoints
 */
export async function authRoutes(fastify: FastifyInstance) {
    // POST /v1/auth/register - Register agent + receive API key + claim link
    fastify.post('/v1/auth/register', {
        schema: {
            body: {
                type: 'object',
                required: ['agentName', 'description'],
                properties: {
                    agentName: { type: 'string' },
                    description: { type: 'string' },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        status: { type: 'string' },
                        agentId: { type: 'string' },
                        userId: { type: 'string' },
                        apiKey: { type: 'string' },
                        agentName: { type: 'string' },
                        description: { type: 'string' },
                        verificationCode: { type: 'string' },
                        claimLink: { type: 'string' },
                        claimInstruction: { type: 'string' },
                        message: { type: 'string' },
                    },
                },
            },
        },
        handler: async (request, reply) => {
            const result = registerSchema.safeParse(request.body || {});
            if (!result.success) {
                return (reply as any).status(400).send({
                    error: 'Validation Error',
                    message: result.error.errors[0].message,
                });
            }

            try {
                const taken = await isAgentNameTaken(result.data.agentName);
                if (taken) {
                    return (reply as any).status(409).send({
                        error: 'Conflict',
                        message: 'Agent name already registered. Please choose another name.',
                    });
                }

                const user = await createUser();

                const apiKey = randomBytes(32).toString('hex');
                const apiKeyWithPrefix = `claw_${apiKey}`;

                const config = getEnvConfig();
                const saltRounds = parseInt(config.API_KEY_SALT_ROUNDS, 10);
                const keyHash = await bcrypt.hash(apiKeyWithPrefix, saltRounds);

                await createApiKey(user.id, keyHash, `${result.data.agentName} API Key`);

                const verificationCode = generateVerificationCode();
                await upsertAgentProfile(
                    user.id,
                    verificationCode,
                    result.data.agentName,
                    result.data.description
                );

                const claimLink = buildClaimLink(config.CLAIM_BASE_URL, user.id, verificationCode);

                return reply.send({
                    status: 'success',
                    message: 'Welcome to Clawfundr 🦀',
                    agentId: user.id,
                    userId: user.id,
                    apiKey: apiKeyWithPrefix,
                    agentName: result.data.agentName,
                    description: result.data.description,
                    verificationCode,
                    claimLink,
                    claimInstruction:
                        'Please open the claim link and complete verification to activate and use your agent.⚠️',
                });
            } catch (error) {
                console.error('Error during registration:', error);
                return (reply as any).status(500).send({
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

            const result = createKeySchema.safeParse(request.body);
            if (!result.success) {
                return (reply as any).status(400).send({
                    error: 'Validation Error',
                    message: result.error.errors[0].message,
                });
            }

            const { label } = result.data;

            try {
                const apiKey = randomBytes(32).toString('hex');
                const apiKeyWithPrefix = `claw_${apiKey}`;

                const config = getEnvConfig();
                const saltRounds = parseInt(config.API_KEY_SALT_ROUNDS, 10);
                const keyHash = await bcrypt.hash(apiKeyWithPrefix, saltRounds);

                const apiKeyRecord = await createApiKey(userId, keyHash, label);

                return reply.send({
                    keyId: apiKeyRecord.id,
                    apiKey: apiKeyWithPrefix,
                    label: apiKeyRecord.label,
                    createdAt: apiKeyRecord.created_at.toISOString(),
                });
            } catch (error) {
                console.error('Error creating API key:', error);
                return (reply as any).status(500).send({
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
                return (reply as any).status(500).send({
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
                return (reply as any).status(500).send({
                    error: 'Internal Server Error',
                    message: 'Failed to revoke API key',
                });
            }
        },
    });
}
