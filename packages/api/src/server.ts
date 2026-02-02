import Fastify, { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import { validateEnvironment, getEnvConfig } from './config/env';
import { initDb, closeDb } from './db/client';
import { requestIdMiddleware } from './middleware/requestId';
import { authMiddleware } from './middleware/auth';
import { createRateLimiter, cleanupRateLimits } from './middleware/rateLimit';
import { healthRoutes } from './routes/health';
import { authRoutes } from './routes/auth';
import { walletRoutes } from './routes/wallets';
import { portfolioRoutes } from './routes/portfolio';
import { txRoutes } from './routes/tx';
import { x402Routes } from './routes/x402';

/**
 * Create and configure Fastify server
 */
export async function createServer(): Promise<FastifyInstance> {
    // Validate environment
    validateEnvironment();
    const config = getEnvConfig();

    // Create Fastify instance
    const fastify = Fastify({
        logger: {
            level: config.LOG_LEVEL,
            serializers: {
                req(request) {
                    return {
                        method: request.method,
                        url: request.url,
                        headers: {
                            ...request.headers,
                            // Redact authorization header
                            authorization: request.headers.authorization ? '[REDACTED]' : undefined,
                        },
                        hostname: request.hostname,
                        remoteAddress: request.ip,
                        requestId: (request as any).requestId,
                    };
                },
            },
        },
    });

    // Register security plugins
    await fastify.register(helmet, {
        contentSecurityPolicy: false, // API doesn't serve HTML
    });

    await fastify.register(cors, {
        origin: false, // Disable CORS (server-to-server API)
    });

    // Add request ID middleware
    fastify.addHook('onRequest', requestIdMiddleware);

    // Create rate limiter
    const rateLimiter = createRateLimiter({
        maxRequests: parseInt(config.RATE_LIMIT_MAX),
        windowMs: parseInt(config.RATE_LIMIT_WINDOW),
    });

    // Add rate limiting (after auth)
    fastify.addHook('preHandler', rateLimiter);

    // Register auth decorator
    fastify.decorate('authenticate', authMiddleware);
    fastify.decorate('auth', function (handlers: any[]) {
        return async function (request: any, reply: any) {
            for (const handler of handlers) {
                await handler(request, reply);
            }
        };
    });

    // Register routes
    await fastify.register(healthRoutes);
    await fastify.register(authRoutes);
    await fastify.register(walletRoutes);
    await fastify.register(portfolioRoutes);
    await fastify.register(txRoutes);
    await fastify.register(x402Routes);

    // Error handler
    fastify.setErrorHandler((error, request, reply) => {
        fastify.log.error(error);

        // Don't expose internal errors in production
        const message =
            config.NODE_ENV === 'production' ? 'Internal Server Error' : error.message;

        reply.status(error.statusCode || 500).send({
            error: error.name || 'Error',
            message,
            requestId: request.requestId,
        });
    });

    // Not found handler
    fastify.setNotFoundHandler((request, reply) => {
        reply.status(404).send({
            error: 'Not Found',
            message: `Route ${request.method} ${request.url} not found`,
            requestId: request.requestId,
        });
    });

    return fastify;
}

/**
 * Start the server
 */
async function start() {
    try {
        // Initialize database
        console.log('🔌 Connecting to database...');
        initDb();
        console.log('✅ Database connected\n');

        // Create server
        const fastify = await createServer();
        const config = getEnvConfig();

        // Start cleanup interval for rate limits
        setInterval(cleanupRateLimits, 60000); // Every minute

        // Start listening
        const port = parseInt(config.PORT);
        await fastify.listen({ port, host: '0.0.0.0' });

        console.log(`
╔════════════════════════════════════════╗
║   Clawfundr Public API Server          ║
╚════════════════════════════════════════╝

🚀 Server running on port ${port}
📊 Environment: ${config.NODE_ENV}
🔐 Auth: API Key (Bearer token)
⚡ Rate limit: ${config.RATE_LIMIT_MAX} req/${parseInt(config.RATE_LIMIT_WINDOW) / 1000}s

Endpoints:
  GET  /health
  POST /v1/auth/register
  POST /v1/auth/keys
  GET  /v1/auth/keys
  DELETE /v1/auth/keys/:id
  POST /v1/wallets
  GET  /v1/wallets
  GET  /v1/portfolio
  POST /v1/tx/broadcast
  POST /v1/x402/propose
  POST /v1/x402/execute

Ready to accept requests! 🐾
`);
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Handle shutdown gracefully
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await closeDb();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await closeDb();
    process.exit(0);
});

// Start if run directly
if (require.main === module) {
    start();
}

export { start };
