import { FastifyRequest, FastifyReply } from 'fastify';

// Simple in-memory rate limiter
// In production, use Redis for distributed rate limiting
const requestCounts = new Map<string, { count: number; resetAt: number }>();

interface RateLimitConfig {
    maxRequests: number;
    windowMs: number;
}

/**
 * Rate limiting middleware
 * Limits requests per API key and per IP
 */
export function createRateLimiter(config: RateLimitConfig) {
    return async function rateLimitMiddleware(
        request: FastifyRequest,
        reply: FastifyReply
    ): Promise<void> {
        const now = Date.now();
        const key = request.userId || request.ip;

        if (!key) {
            // No user or IP, skip rate limiting
            return;
        }

        // Clean up expired entries
        for (const [k, v] of requestCounts.entries()) {
            if (v.resetAt < now) {
                requestCounts.delete(k);
            }
        }

        // Get or create rate limit entry
        let entry = requestCounts.get(key);

        if (!entry || entry.resetAt < now) {
            // Create new entry
            entry = {
                count: 0,
                resetAt: now + config.windowMs,
            };
            requestCounts.set(key, entry);
        }

        // Increment count
        entry.count++;

        // Check if limit exceeded
        if (entry.count > config.maxRequests) {
            const retryAfter = Math.ceil((entry.resetAt - now) / 1000);

            reply.header('X-RateLimit-Limit', config.maxRequests);
            reply.header('X-RateLimit-Remaining', 0);
            reply.header('X-RateLimit-Reset', entry.resetAt);
            reply.header('Retry-After', retryAfter);

            return reply.status(429).send({
                error: 'Too Many Requests',
                message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
                retryAfter,
            });
        }

        // Add rate limit headers
        reply.header('X-RateLimit-Limit', config.maxRequests);
        reply.header('X-RateLimit-Remaining', config.maxRequests - entry.count);
        reply.header('X-RateLimit-Reset', entry.resetAt);
    };
}

/**
 * Cleanup function to remove expired entries
 * Call this periodically (e.g., every minute)
 */
export function cleanupRateLimits(): void {
    const now = Date.now();
    for (const [key, value] of requestCounts.entries()) {
        if (value.resetAt < now) {
            requestCounts.delete(key);
        }
    }
}
