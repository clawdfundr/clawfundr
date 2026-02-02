import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createActionProposal, getActionProposal, updateActionProposalStatus } from '../db/client';
import { fetchWithX402Check } from '../tools/x402';
import { buildErc20Transfer, buildEthTransfer } from '../tools/txbuilder';
import { Address } from 'viem';
import { BASE_TOKENS } from '../tools/chain';

const proposeSchema = z.object({
    url: z.string().url('Invalid URL'),
});

const executeSchema = z.object({
    proposalId: z.string().uuid('Invalid proposal ID'),
});

/**
 * x402 payment endpoints
 */
export async function x402Routes(fastify: FastifyInstance) {
    // POST /v1/x402/propose - Propose x402 payment
    fastify.post('/v1/x402/propose', {
        schema: {
            body: {
                type: 'object',
                required: ['url'],
                properties: {
                    url: { type: 'string' },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        proposalId: { type: 'string' },
                        merchant: { type: 'string' },
                        amount: { type: 'string' },
                        token: { type: 'string' },
                        recipient: { type: 'string' },
                        resource: { type: 'string' },
                        expiresAt: { type: 'string' },
                    },
                },
            },
        },
        preHandler: fastify.auth([fastify.authenticate]),
        handler: async (request, reply) => {
            const userId = request.userId!;

            // Validate request body
            const result = proposeSchema.safeParse(request.body);
            if (!result.success) {
                return reply.status(400).send({
                    error: 'Validation Error',
                    message: result.error.errors[0].message,
                });
            }

            const { url } = result.data;

            try {
                // Fetch resource and check for 402
                const response = await fetchWithX402Check(url);

                if (response.status !== 402 || !response.requirement) {
                    return reply.status(400).send({
                        error: 'No Payment Required',
                        message: 'Resource does not require payment (no 402 response)',
                    });
                }

                const req = response.requirement;

                // TODO: Validate against user policy (allowlists, caps)

                // Create action proposal
                const proposal = await createActionProposal(
                    userId,
                    'x402_payment',
                    JSON.stringify(req),
                    5 // expires in 5 minutes
                );

                return reply.send({
                    proposalId: proposal.id,
                    merchant: req.merchant,
                    amount: req.amount,
                    token: req.token,
                    recipient: req.recipient,
                    resource: req.resource,
                    expiresAt: proposal.expires_at.toISOString(),
                });
            } catch (error) {
                console.error('Error proposing x402 payment:', error);
                return reply.status(500).send({
                    error: 'Internal Server Error',
                    message: 'Failed to propose payment',
                });
            }
        },
    });

    // POST /v1/x402/execute - Get unsigned transaction for x402 payment
    fastify.post('/v1/x402/execute', {
        schema: {
            body: {
                type: 'object',
                required: ['proposalId'],
                properties: {
                    proposalId: { type: 'string' },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        unsignedTx: {
                            type: 'object',
                            properties: {
                                to: { type: 'string' },
                                data: { type: 'string' },
                                value: { type: 'string' },
                                chainId: { type: 'number' },
                                gas: { type: 'string' },
                                maxFeePerGas: { type: 'string' },
                                maxPriorityFeePerGas: { type: 'string' },
                            },
                        },
                        instructions: { type: 'string' },
                    },
                },
            },
        },
        preHandler: fastify.auth([fastify.authenticate]),
        handler: async (request, reply) => {
            const userId = request.userId!;

            // Validate request body
            const result = executeSchema.safeParse(request.body);
            if (!result.success) {
                return reply.status(400).send({
                    error: 'Validation Error',
                    message: result.error.errors[0].message,
                });
            }

            const { proposalId } = result.data;

            try {
                // Get proposal
                const proposal = await getActionProposal(proposalId, userId);

                if (!proposal) {
                    return reply.status(404).send({
                        error: 'Not Found',
                        message: 'Proposal not found',
                    });
                }

                // Check if expired
                if (proposal.expires_at < new Date()) {
                    await updateActionProposalStatus(proposalId, 'expired');
                    return reply.status(400).send({
                        error: 'Proposal Expired',
                        message: 'This proposal has expired',
                    });
                }

                // Check if already executed
                if (proposal.status !== 'pending') {
                    return reply.status(400).send({
                        error: 'Invalid Status',
                        message: `Proposal status is ${proposal.status}`,
                    });
                }

                // Parse payload
                const payload = JSON.parse(proposal.payload_json);

                // Build unsigned transaction
                let unsignedTx;
                if (payload.token === 'ETH') {
                    unsignedTx = await buildEthTransfer(
                        payload.recipient as Address,
                        payload.amount
                    );
                } else {
                    // Get token address
                    const tokenAddress = BASE_TOKENS[payload.token as keyof typeof BASE_TOKENS];
                    if (!tokenAddress) {
                        return reply.status(400).send({
                            error: 'Unsupported Token',
                            message: `Token ${payload.token} is not supported`,
                        });
                    }

                    unsignedTx = await buildErc20Transfer(
                        tokenAddress,
                        payload.recipient as Address,
                        payload.amount,
                        payload.token === 'USDC' ? 6 : 18
                    );
                }

                // Mark proposal as executed
                await updateActionProposalStatus(proposalId, 'executed');

                return reply.send({
                    unsignedTx,
                    instructions:
                        'Sign this transaction with your wallet and POST to /v1/tx/broadcast with the signed transaction',
                });
            } catch (error) {
                console.error('Error executing x402 payment:', error);
                return reply.status(500).send({
                    error: 'Internal Server Error',
                    message: 'Failed to execute payment',
                });
            }
        },
    });
}
