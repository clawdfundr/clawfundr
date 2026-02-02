import type { Address } from 'viem';
import type { NormalizedBalance } from '../tools/chain';
import type { ClassifiedTransaction } from '../tools/history';
import type { PeriodSummary, ApprovalSummary } from '../tools/reports';
import type { AdvisorAnalysis } from '../tools/advisor';
import type { X402PaymentProposal } from '../tools/x402';

/**
 * Tool definition with JSON schema
 */
export interface ToolDefinition {
    name: string;
    description: string;
    input_schema: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
}

/**
 * Tool execution result
 */
export interface ToolResult {
    success: boolean;
    data?: any;
    error?: string;
}

/**
 * Tool executor function
 */
export type ToolExecutor = (params: any) => Promise<ToolResult>;

/**
 * Tool registry
 */
export class ToolRegistry {
    private tools: Map<string, { definition: ToolDefinition; executor: ToolExecutor }> = new Map();

    /**
     * Register a tool
     */
    register(definition: ToolDefinition, executor: ToolExecutor): void {
        this.tools.set(definition.name, { definition, executor });
    }

    /**
     * Get tool definition
     */
    getDefinition(name: string): ToolDefinition | undefined {
        return this.tools.get(name)?.definition;
    }

    /**
     * Get all tool definitions (for Claude API)
     */
    getAllDefinitions(): ToolDefinition[] {
        return Array.from(this.tools.values()).map(t => t.definition);
    }

    /**
     * Execute a tool
     */
    async execute(name: string, params: any): Promise<ToolResult> {
        const tool = this.tools.get(name);

        if (!tool) {
            return {
                success: false,
                error: `Tool ${name} not found`,
            };
        }

        try {
            return await tool.executor(params);
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Check if tool exists
     */
    has(name: string): boolean {
        return this.tools.has(name);
    }
}

/**
 * Create default tool registry with all available tools
 */
export function createToolRegistry(): ToolRegistry {
    const registry = new ToolRegistry();

    // Tool: getBalances
    registry.register(
        {
            name: 'getBalances',
            description: 'Get current portfolio balances for all tokens in the allowlist',
            input_schema: {
                type: 'object',
                properties: {
                    address: {
                        type: 'string',
                        description: 'Wallet address to check balances for',
                    },
                },
                required: ['address'],
            },
        },
        async (params): Promise<ToolResult> => {
            const { getBalances } = await import('../tools/chain');
            const { getPolicy } = await import('../config/policy');

            const policy = getPolicy();
            const balances = await getBalances(params.address as Address, policy.tokenAllowlist);

            return {
                success: true,
                data: balances,
            };
        }
    );

    // Tool: syncHistory
    registry.register(
        {
            name: 'syncHistory',
            description: 'Sync transaction history from blockchain for the wallet',
            input_schema: {
                type: 'object',
                properties: {
                    address: {
                        type: 'string',
                        description: 'Wallet address to sync history for',
                    },
                },
                required: ['address'],
            },
        },
        async (params): Promise<ToolResult> => {
            const { incrementalSync } = await import('../tools/chain');
            const { getPolicy } = await import('../config/policy');

            const policy = getPolicy();
            const result = await incrementalSync(params.address as Address, policy.tokenAllowlist);

            return {
                success: true,
                data: result,
            };
        }
    );

    // Tool: generateReport
    registry.register(
        {
            name: 'generateReport',
            description: 'Generate activity report for a time period (day/week/month)',
            input_schema: {
                type: 'object',
                properties: {
                    period: {
                        type: 'string',
                        enum: ['day', 'week', 'month'],
                        description: 'Time period for the report',
                    },
                    address: {
                        type: 'string',
                        description: 'Wallet address to generate report for',
                    },
                },
                required: ['period', 'address'],
            },
        },
        async (params): Promise<ToolResult> => {
            const {
                generateDailyReport,
                generateWeeklyReport,
                generateMonthlyReport,
            } = await import('../tools/reports');

            let report: PeriodSummary;

            switch (params.period) {
                case 'day':
                    report = generateDailyReport(params.address);
                    break;
                case 'week':
                    report = generateWeeklyReport(params.address);
                    break;
                case 'month':
                    report = generateMonthlyReport(params.address);
                    break;
                default:
                    return {
                        success: false,
                        error: 'Invalid period. Must be day, week, or month.',
                    };
            }

            return {
                success: true,
                data: report,
            };
        }
    );

    // Tool: getRecommendations
    registry.register(
        {
            name: 'getRecommendations',
            description: 'Get portfolio recommendations based on policy targets and current holdings',
            input_schema: {
                type: 'object',
                properties: {
                    address: {
                        type: 'string',
                        description: 'Wallet address to analyze',
                    },
                },
                required: ['address'],
            },
        },
        async (params): Promise<ToolResult> => {
            const { analyzePortfolio } = await import('../tools/advisor');
            const { getBalances } = await import('../tools/chain');
            const { getClassifiedPeriod } = await import('../tools/history');
            const { getPolicy } = await import('../config/policy');

            const policy = getPolicy();
            const balances = await getBalances(params.address as Address, policy.tokenAllowlist);

            // Get last 7 days of activity
            const now = Math.floor(Date.now() / 1000);
            const sevenDaysAgo = now - 604800;
            const recentActivity = getClassifiedPeriod(sevenDaysAgo, now, params.address);

            // TODO: Get active approvals from database
            const activeApprovals: ClassifiedTransaction[] = [];

            const analysis = analyzePortfolio(balances, recentActivity, activeApprovals);

            return {
                success: true,
                data: analysis,
            };
        }
    );

    // Tool: proposeX402Payment
    registry.register(
        {
            name: 'proposeX402Payment',
            description: 'Propose an x402 payment for user review (does not execute)',
            input_schema: {
                type: 'object',
                properties: {
                    url: {
                        type: 'string',
                        description: 'URL that returned 402 Payment Required',
                    },
                },
                required: ['url'],
            },
        },
        async (params): Promise<ToolResult> => {
            const { fetchWithX402 } = await import('../tools/x402');

            // Fetch without confirmation to get proposal
            const result = await fetchWithX402(params.url, { confirmed: false });

            if (result.paymentProposal) {
                return {
                    success: true,
                    data: result.paymentProposal,
                };
            } else {
                return {
                    success: false,
                    error: 'No payment required for this URL',
                };
            }
        }
    );

    // Tool: executeX402Payment
    registry.register(
        {
            name: 'executeX402Payment',
            description: 'Execute a confirmed x402 payment (REQUIRES USER CONFIRMATION)',
            input_schema: {
                type: 'object',
                properties: {
                    url: {
                        type: 'string',
                        description: 'URL that returned 402 Payment Required',
                    },
                    confirmed: {
                        type: 'boolean',
                        description: 'Must be true to execute payment',
                    },
                },
                required: ['url', 'confirmed'],
            },
        },
        async (params): Promise<ToolResult> => {
            if (!params.confirmed) {
                return {
                    success: false,
                    error: 'Payment not confirmed. User must explicitly approve.',
                };
            }

            const { fetchWithX402 } = await import('../tools/x402');

            const result = await fetchWithX402(params.url, { confirmed: true });

            return {
                success: true,
                data: {
                    paymentCompleted: result.paymentCompleted,
                    txHash: result.txHash,
                    response: result.response ? 'Success' : 'Failed',
                },
            };
        }
    );

    return registry;
}
