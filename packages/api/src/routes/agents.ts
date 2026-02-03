import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
    getAgentActivity,
    getAgentDashboardMetrics,
    getAgentProfile,
    getAgentSkillUsage,
    getAgentStats,
    getAgentTrades,
    listAgents,
    markAgentVerified,
    saveAgentTweetUrl,
} from '../db/client';

const verifySchema = z.object({
    tweetUrl: z.string().url('Tweet URL must be a valid URL'),
});

function isValidTweetUrl(url: string): boolean {
    return /^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/[A-Za-z0-9_]{1,15}\/status\/\d+/i.test(url);
}

async function verifyTweetContainsCode(tweetUrl: string, verificationCode: string) {
    if (!isValidTweetUrl(tweetUrl)) {
        return { ok: false, reason: 'Tweet URL must be a valid x.com/twitter.com status link.' };
    }

    const oembedUrl = `https://publish.twitter.com/oembed?omit_script=true&url=${encodeURIComponent(tweetUrl)}`;

    try {
        const res = await fetch(oembedUrl);
        if (!res.ok) {
            return { ok: false, reason: `Tweet does not appear accessible (HTTP ${res.status}).` };
        }

        const data = (await res.json()) as { html?: string };
        const html = (data.html || '').toLowerCase();

        if (!html) {
            return { ok: false, reason: 'Unable to read tweet content for verification.' };
        }

        const normalizedCode = verificationCode.toLowerCase();
        if (!html.includes(normalizedCode)) {
            return {
                ok: false,
                reason: `Tweet found, but verification code ${verificationCode} was not detected in the tweet text.`,
            };
        }

        return { ok: true };
    } catch (error) {
        const reason = error instanceof Error ? error.message : 'Unknown verification error';
        return { ok: false, reason: `Verification network error: ${reason}` };
    }
}

export async function agentRoutes(fastify: FastifyInstance) {
    // Public stats
    fastify.get('/v1/agents/stats', {
        handler: async (_request, reply) => {
            try {
                const stats = await getAgentStats();
                return reply.send({
                    totalAgents: stats.total_agents,
                    verifiedAgents: stats.verified_agents,
                    pendingAgents: stats.pending_agents,
                });
            } catch (error) {
                console.error('Error getting agent stats:', error);
                return (reply as any).status(500).send({
                    error: 'Internal Server Error',
                    message: 'Failed to load agent statistics',
                });
            }
        },
    });

    // Public directory
    fastify.get('/v1/agents', {
        handler: async (_request, reply) => {
            try {
                const agents = await listAgents(200);
                return reply.send({
                    agents: agents.map((agent) => ({
                        userId: agent.user_id,
                        displayName: agent.display_name,
                        verificationStatus: agent.verification_status,
                        createdAt: agent.created_at.toISOString(),
                        verifiedAt: agent.verified_at ? agent.verified_at.toISOString() : null,
                    })),
                });
            } catch (error) {
                console.error('Error listing agents:', error);
                return (reply as any).status(500).send({
                    error: 'Internal Server Error',
                    message: 'Failed to load agent directory',
                });
            }
        },
    });

    // Authenticated profile summary
    fastify.get('/v1/agents/me', {
        preHandler: fastify.auth([fastify.authenticate]),
        handler: async (request, reply) => {
            const userId = request.userId!;

            try {
                const [profile, metrics, skillUsage, recentActivity, recentTrades] = await Promise.all([
                    getAgentProfile(userId),
                    getAgentDashboardMetrics(userId),
                    getAgentSkillUsage(userId, 10),
                    getAgentActivity(userId, 20),
                    getAgentTrades(userId, 20),
                ]);

                return reply.send({
                    profile: profile
                        ? {
                              userId: profile.user_id,
                              displayName: profile.display_name,
                              verificationCode: profile.verification_code,
                              verificationStatus: profile.verification_status,
                              tweetUrl: profile.tweet_url,
                              createdAt: profile.created_at.toISOString(),
                              verifiedAt: profile.verified_at ? profile.verified_at.toISOString() : null,
                          }
                        : null,
                    metrics,
                    skillUsage,
                    recentActivity: recentActivity.map((item) => ({
                        route: item.route,
                        ts: item.ts.toISOString(),
                    })),
                    recentTrades,
                });
            } catch (error) {
                console.error('Error loading agent profile:', error);
                return (reply as any).status(500).send({
                    error: 'Internal Server Error',
                    message: 'Failed to load your agent profile',
                });
            }
        },
    });

    // Auto verification (best-effort)
    fastify.post('/v1/agents/verify/auto', {
        preHandler: fastify.auth([fastify.authenticate]),
        handler: async (request, reply) => {
            const userId = request.userId!;

            try {
                const profile = await getAgentProfile(userId);
                if (!profile) {
                    return (reply as any).status(404).send({
                        error: 'Not Found',
                        message: 'Agent profile not found for this user.',
                    });
                }

                if (profile.verification_status === 'verified') {
                    return reply.send({
                        verified: true,
                        message: 'Agent is already verified.',
                        profile,
                    });
                }

                if (!profile.tweet_url) {
                    return reply.send({
                        verified: false,
                        message:
                            'Automatic verification could not find a tweet yet. Submit your tweet URL manually for verification.',
                    });
                }

                const check = await verifyTweetContainsCode(profile.tweet_url, profile.verification_code);
                if (!check.ok) {
                    return reply.send({
                        verified: false,
                        message: check.reason,
                    });
                }

                const verified = await markAgentVerified(userId, profile.tweet_url);
                return reply.send({
                    verified: true,
                    message: 'Verification successful.',
                    profile: verified,
                });
            } catch (error) {
                console.error('Error auto-verifying agent:', error);
                return (reply as any).status(500).send({
                    error: 'Internal Server Error',
                    message: 'Failed to auto-verify agent',
                });
            }
        },
    });

    // Manual verification
    fastify.post('/v1/agents/verify', {
        preHandler: fastify.auth([fastify.authenticate]),
        handler: async (request, reply) => {
            const userId = request.userId!;
            const parsed = verifySchema.safeParse(request.body);

            if (!parsed.success) {
                return (reply as any).status(400).send({
                    error: 'Validation Error',
                    message: parsed.error.errors[0].message,
                });
            }

            try {
                const profile = await getAgentProfile(userId);
                if (!profile) {
                    return (reply as any).status(404).send({
                        error: 'Not Found',
                        message: 'Agent profile not found for this user.',
                    });
                }

                const tweetUrl = parsed.data.tweetUrl.trim();
                await saveAgentTweetUrl(userId, tweetUrl);

                if (profile.verification_status === 'verified') {
                    return reply.send({
                        verified: true,
                        message: 'Agent is already verified.',
                        profile,
                    });
                }

                const check = await verifyTweetContainsCode(tweetUrl, profile.verification_code);
                if (!check.ok) {
                    return reply.send({
                        verified: false,
                        message: check.reason,
                    });
                }

                const verified = await markAgentVerified(userId, tweetUrl);
                return reply.send({
                    verified: true,
                    message: 'Verification successful.',
                    profile: verified,
                });
            } catch (error) {
                console.error('Error verifying agent:', error);
                return (reply as any).status(500).send({
                    error: 'Internal Server Error',
                    message: 'Failed to verify agent',
                });
            }
        },
    });
}
