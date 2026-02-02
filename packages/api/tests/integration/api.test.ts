import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from '../../src/server';
import { FastifyInstance } from 'fastify';

describe('API Integration Tests', () => {
    let server: FastifyInstance;

    beforeAll(async () => {
        // Note: These tests require a running PostgreSQL database
        // Set TEST_DATABASE_URL in your environment
        server = await createServer();
    });

    afterAll(async () => {
        await server.close();
    });

    describe('Health Endpoint', () => {
        it('should return 200 OK', async () => {
            const response = await server.inject({
                method: 'GET',
                url: '/health',
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.status).toBe('ok');
            expect(body.timestamp).toBeTruthy();
            expect(body.uptime).toBeGreaterThan(0);
        });
    });

    describe('Protected Routes', () => {
        it('should return 401 without auth header', async () => {
            const response = await server.inject({
                method: 'GET',
                url: '/v1/wallets',
            });

            expect(response.statusCode).toBe(401);
            const body = JSON.parse(response.body);
            expect(body.error).toBe('Unauthorized');
        });

        it('should return 401 with invalid auth header', async () => {
            const response = await server.inject({
                method: 'GET',
                url: '/v1/wallets',
                headers: {
                    authorization: 'Bearer invalid_key',
                },
            });

            expect(response.statusCode).toBe(401);
        });
    });

    describe('Not Found', () => {
        it('should return 404 for unknown routes', async () => {
            const response = await server.inject({
                method: 'GET',
                url: '/unknown',
            });

            expect(response.statusCode).toBe(404);
            const body = JSON.parse(response.body);
            expect(body.error).toBe('Not Found');
        });
    });
});
