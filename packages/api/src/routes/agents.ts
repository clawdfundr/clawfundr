import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
    getAgentActivity,
    getAgentDashboardMetrics,
    getAgentProfile,
    getAgentSkillUsage,
    getAgentStats,
    getAgentTrades,
    getVerifiedAgentByName,
    listAgents,
    listVerifiedAgentsWithStats,
    markAgentVerified,
    saveAgentTweetUrl,
} from '../db/client';

const verifySchema = z.object({
    tweetUrl: z.string().url('Tweet URL must be a valid URL').optional(),
    code: z.string().min(4, 'Verification code is required'),
});

function getAgentName(profile: { agent_name: string | null; display_name: string | null }): string {
    return profile.agent_name || profile.display_name || 'Unnamed Agent';
}

function toProfilePath(agentName: string): string {
    return `/u/${encodeURIComponent(agentName)}`;
}

function getTwitterHandle(tweetUrl: string | null): string | null {
    if (!tweetUrl) return null;

    const normalized = tweetUrl.trim();
    const directMatch = normalized.match(/(?:x|twitter)\.com\/(?:#!\/)?([A-Za-z0-9_]{1,15})\/status\/\d+/i);
    if (directMatch) return directMatch[1];

    // Some shared links may contain an @handle query string or path fragments.
    const queryHandle = normalized.match(/[?&]screen_name=([A-Za-z0-9_]{1,15})/i);
    if (queryHandle) return queryHandle[1];

    return null;
}

function createTweetText(agentName: string, code: string): string {
    return `I'm claiming my AI agent "${agentName}" on @clawfundr \u{1F980}\n\nVerification: claw-${code}`;
}

function createTweetIntentUrl(text: string): string {
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

function isValidTweetUrl(url: string): boolean {
    return /^https?:\/\/(?:www\.|m\.)?(?:x|twitter)\.com\/(?:[A-Za-z0-9_]{1,15}|i(?:\/web)?)\/status\/\d+/i.test(url);
}

type XPublicMetrics = { followersCount: number; followingCount: number };


async function resolveTwitterHandleFromTweetUrl(tweetUrl: string | null): Promise<string | null> {
    const direct = getTwitterHandle(tweetUrl);
    if (direct) return direct;
    if (!tweetUrl || !isValidTweetUrl(tweetUrl)) return null;

    try {
        const oembedUrl = `https://publish.twitter.com/oembed?omit_script=true&url=${encodeURIComponent(tweetUrl)}`;
        const res = await fetch(oembedUrl);
        if (!res.ok) return null;

        const payload = (await res.json()) as { author_url?: string };
        const authorUrl = payload.author_url || '';
        const match = authorUrl.match(/(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})/i);
        return match ? match[1] : null;
    } catch {
        return null;
    }
}

async function getXPublicMetrics(handle: string | null): Promise<XPublicMetrics | null> {
    if (!handle) return null;

    const normalizedHandle = handle.replace(/^@+/, '').trim();
    if (!normalizedHandle) return null;

    const bearer = process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN;

    // Preferred: official v2 API with bearer token.
    if (bearer) {
        const endpoints = [
            `https://api.x.com/2/users/by/username/${encodeURIComponent(normalizedHandle)}?user.fields=public_metrics`,
            `https://api.twitter.com/2/users/by/username/${encodeURIComponent(normalizedHandle)}?user.fields=public_metrics`,
        ];

        for (const endpoint of endpoints) {
            try {
                const res = await fetch(endpoint, {
                    headers: { Authorization: `Bearer ${bearer}` },
                });

                if (!res.ok) continue;

                const payload = (await res.json()) as {
                    data?: { public_metrics?: { followers_count?: number; following_count?: number } };
                };

                const metrics = payload.data?.public_metrics;
                if (metrics) {
                    return {
                        followersCount: Number(metrics.followers_count || 0),
                        followingCount: Number(metrics.following_count || 0),
                    };
                }
            } catch {
                // try next endpoint/fallback
            }
        }
    }

    // Fallback: public syndication endpoint (no bearer needed).
    try {
        const fallbackEndpoint = `https://cdn.syndication.twimg.com/widgets/followbutton/info.json?screen_names=${encodeURIComponent(normalizedHandle)}`;
        const res = await fetch(fallbackEndpoint, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; ClawfundrBot/1.0; +https://clawfundr.xyz)',
                Accept: 'application/json,text/plain,*/*',
            },
        });
        if (!res.ok) return null;

        const payload = (await res.json()) as Array<{
            followers_count?: number;
            friends_count?: number;
        }>;

        const first = payload?.[0];
        if (!first) return null;

        return {
            followersCount: Number(first.followers_count || 0),
            followingCount: Number(first.friends_count || 0),
        };
    } catch {
        return null;
    }
}

async function verifyTweetContainsCode(tweetUrl: string, verificationCode: string): Promise<{ ok: boolean; reason?: string; canonicalUrl?: string }> {
    if (!isValidTweetUrl(tweetUrl)) {
        return { ok: false, reason: 'Tweet URL must be a valid x.com/twitter.com status link.' };
    }

    const oembedUrl = `https://publish.twitter.com/oembed?omit_script=true&url=${encodeURIComponent(tweetUrl)}`;

    try {
        const res = await fetch(oembedUrl);
        if (!res.ok) {
            return { ok: false, reason: `Tweet does not appear accessible (HTTP ${res.status}).` };
        }

        const data = (await res.json()) as { html?: string; author_url?: string; url?: string };
        const rawHtml = data.html || '';
        const html = rawHtml.toLowerCase();

        if (!html) {
            return { ok: false, reason: 'Unable to read tweet content for verification.' };
        }

        const normalizedCode = verificationCode.toLowerCase();
        const expectedTaggedCode = `claw-${normalizedCode}`;

        const hasCode =
            html.includes(normalizedCode) ||
            html.includes(expectedTaggedCode) ||
            html.includes(`verification: ${expectedTaggedCode}`);

        if (!hasCode) {
            return {
                ok: false,
                reason: `Tweet found, but verification code ${verificationCode} was not detected in the tweet text.`,
            };
        }

        const canonicalUrl = typeof data.url === 'string' && data.url.trim().length > 0
            ? data.url.trim()
            : tweetUrl;

        return { ok: true, canonicalUrl };
    } catch (error) {
        const reason = error instanceof Error ? error.message : 'Unknown verification error';
        return { ok: false, reason: `Verification network error: ${reason}` };
    }
}

export async function agentRoutes(fastify: FastifyInstance) {
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

    fastify.get('/v1/agents', {
        handler: async (_request, reply) => {
            try {
                const agents = await listAgents(200);
                return reply.send({
                    agents: agents.map((agent) => ({
                        userId: agent.user_id,
                        agentName: getAgentName(agent),
                        description: agent.description,
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

    // Public users directory (verified agents)
    fastify.get('/v1/users', {
        handler: async (_request, reply) => {
            try {
                const users = await listVerifiedAgentsWithStats(300);
                return reply.send({
                    users: users.map((agent) => {
                        const agentName = getAgentName(agent);
                        const twitterHandle = getTwitterHandle(agent.tweet_url);
                        return {
                            userId: agent.user_id,
                            agentName,
                            description: agent.description,
                            twitterHandle,
                            twitterUrl: twitterHandle ? `https://x.com/${twitterHandle}` : null,
                            profileUrl: toProfilePath(agentName),
                            verifiedAt: agent.verified_at ? agent.verified_at.toISOString() : null,
                            tradesCount: agent.trades_count || 0,
                            estimatedPnl: agent.estimated_pnl || '0',
                        };
                    }),
                });
            } catch (error) {
                console.error('Error loading users directory:', error);
                return (reply as any).status(500).send({
                    error: 'Internal Server Error',
                    message: 'Failed to load users directory',
                });
            }
        },
    });

    // Public profile by agent name
    fastify.get('/v1/u/:agentName', {
        handler: async (request, reply) => {
            const { agentName } = request.params as { agentName: string };

            try {
                const profile = await getVerifiedAgentByName(agentName);
                if (!profile) {
                    return (reply as any).status(404).send({
                        error: 'Not Found',
                        message: 'Verified agent profile not found',
                    });
                }

                const metrics = await getAgentDashboardMetrics(profile.user_id);
                const trades = await getAgentTrades(profile.user_id, 30);
                const activity = await getAgentActivity(profile.user_id, 20);
                const skillUsage = await getAgentSkillUsage(profile.user_id, 10);

                const normalizedName = getAgentName(profile);
                const twitterHandle = (await resolveTwitterHandleFromTweetUrl(profile.tweet_url)) || null;
                const xMetrics = await getXPublicMetrics(twitterHandle);

                return reply.send({
                    profile: {
                        userId: profile.user_id,
                        agentName: normalizedName,
                        description: profile.description,
                        verificationStatus: profile.verification_status,
                        verifiedAt: profile.verified_at ? profile.verified_at.toISOString() : null,
                        joinedAt: profile.created_at.toISOString(),
                        twitterHandle,
                        twitterUrl: twitterHandle ? `https://x.com/${twitterHandle}` : null,
                        tweetUrl: profile.tweet_url,
                        twitterFollowers: xMetrics?.followersCount ?? null,
                        twitterFollowing: xMetrics?.followingCount ?? null,
                    },
                    metrics,
                    skillUsage,
                    activity: activity.map((a) => ({
                        route: a.route,
                        ts: a.ts.toISOString(),
                    })),
                    trades,
                });
            } catch (error) {
                console.error('Error loading public profile:', error);
                return (reply as any).status(500).send({
                    error: 'Internal Server Error',
                    message: 'Failed to load public profile',
                });
            }
        },
    });

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
                              agentName: getAgentName(profile),
                              description: profile.description,
                              verificationCode: profile.verification_code,
                              verificationStatus: profile.verification_status,
                              tweetUrl: profile.tweet_url,
                              twitterHandle: getTwitterHandle(profile.tweet_url),
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

    // Claim page data (public, code-gated)
    fastify.get('/v1/agents/claim/:userId', {
        handler: async (request, reply) => {
            const { userId } = request.params as { userId: string };
            const { code } = (request.query || {}) as { code?: string };

            if (!code) {
                return (reply as any).status(400).send({
                    error: 'Validation Error',
                    message: 'Missing claim verification code in query string.',
                });
            }

            try {
                const profile = await getAgentProfile(userId);
                if (!profile) {
                    return (reply as any).status(404).send({
                        error: 'Not Found',
                        message: 'Claim profile not found.',
                    });
                }

                if (profile.verification_code !== code) {
                    return (reply as any).status(403).send({
                        error: 'Forbidden',
                        message: 'Invalid claim code.',
                    });
                }

                const agentName = getAgentName(profile);
                const tweetText = createTweetText(agentName, profile.verification_code);

                return reply.send({
                    userId: profile.user_id,
                    agentName,
                    description: profile.description,
                    verificationCode: profile.verification_code,
                    verificationStatus: profile.verification_status,
                    tweetTemplate: tweetText,
                    tweetIntentUrl: createTweetIntentUrl(tweetText),
                    tweetUrl: profile.tweet_url,
                    verifiedAt: profile.verified_at ? profile.verified_at.toISOString() : null,
                });
            } catch (error) {
                console.error('Error loading claim profile:', error);
                return (reply as any).status(500).send({
                    error: 'Internal Server Error',
                    message: 'Failed to load claim profile',
                });
            }
        },
    });

    // Claim auto verify attempt (checks stored tweet URL first)
    fastify.post('/v1/agents/claim/:userId/verify-auto', {
        handler: async (request, reply) => {
            const { userId } = request.params as { userId: string };
            const parsed = verifySchema.safeParse(request.body || {});

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
                        message: 'Claim profile not found.',
                    });
                }

                if (profile.verification_code !== parsed.data.code) {
                    return (reply as any).status(403).send({
                        error: 'Forbidden',
                        message: 'Invalid claim code.',
                    });
                }

                if (profile.verification_status === 'verified') {
                    return reply.send({
                        verified: true,
                        message: 'Agent already verified.',
                        profile,
                    });
                }

                const candidateUrl = parsed.data.tweetUrl?.trim() || profile.tweet_url || '';
                if (!candidateUrl) {
                    return reply.send({
                        verified: false,
                        message: 'Automatic verification failed. Submit tweet URL manually for re-verification.',
                    });
                }

                await saveAgentTweetUrl(userId, candidateUrl);
                const check = await verifyTweetContainsCode(candidateUrl, profile.verification_code);

                if (!check.ok) {
                    return reply.send({
                        verified: false,
                        message: check.reason,
                    });
                }

                const finalTweetUrl = check.canonicalUrl || candidateUrl;
                const verified = await markAgentVerified(userId, finalTweetUrl);
                return reply.send({
                    verified: true,
                    message: 'Verification successful.',
                    profile: verified,
                });
            } catch (error) {
                console.error('Error auto-verifying claim:', error);
                return (reply as any).status(500).send({
                    error: 'Internal Server Error',
                    message: 'Failed to verify claim automatically',
                });
            }
        },
    });

    // Claim manual verify
    fastify.post('/v1/agents/claim/:userId/verify', {
        handler: async (request, reply) => {
            const { userId } = request.params as { userId: string };
            const parsed = verifySchema.safeParse(request.body || {});

            if (!parsed.success || !parsed.data.tweetUrl) {
                return (reply as any).status(400).send({
                    error: 'Validation Error',
                    message: 'Tweet URL and code are required.',
                });
            }

            try {
                const profile = await getAgentProfile(userId);
                if (!profile) {
                    return (reply as any).status(404).send({
                        error: 'Not Found',
                        message: 'Claim profile not found.',
                    });
                }

                if (profile.verification_code !== parsed.data.code) {
                    return (reply as any).status(403).send({
                        error: 'Forbidden',
                        message: 'Invalid claim code.',
                    });
                }

                const tweetUrl = parsed.data.tweetUrl.trim();
                await saveAgentTweetUrl(userId, tweetUrl);

                const check = await verifyTweetContainsCode(tweetUrl, profile.verification_code);
                if (!check.ok) {
                    return reply.send({
                        verified: false,
                        message: check.reason,
                    });
                }

                const finalTweetUrl = check.canonicalUrl || tweetUrl;
                const verified = await markAgentVerified(userId, finalTweetUrl);
                return reply.send({
                    verified: true,
                    message: 'Verification successful.',
                    profile: verified,
                });
            } catch (error) {
                console.error('Error manual claim verify:', error);
                return (reply as any).status(500).send({
                    error: 'Internal Server Error',
                    message: 'Failed to verify claim',
                });
            }
        },
    });
}

