import Anthropic from '@anthropic-ai/sdk';
import type { Address } from 'viem';
import { getEnvConfig } from '../config/env';
import { getPolicy } from '../config/policy';
import { redactSecret } from '../signer/secureInput';
import { detectIntent, Intent, type DetectedIntent } from './intents';
import { getSystemPrompt } from './systemPrompt';
import { createToolRegistry, type ToolRegistry, type ToolResult } from './toolRegistry';

/**
 * Pending action (awaiting user confirmation)
 */
interface PendingAction {
    type: 'x402_payment' | 'transaction';
    description: string;
    toolName: string;
    params: any;
    timestamp: number;
}

/**
 * Orchestrator response
 */
export interface OrchestratorResponse {
    message: string;
    requiresConfirmation?: boolean;
    pendingAction?: PendingAction;
}

/**
 * Agent orchestrator
 * Coordinates between user input, intent detection, Claude API, and tool execution
 */
export class Orchestrator {
    private client: Anthropic;
    private toolRegistry: ToolRegistry;
    private pendingAction: PendingAction | null = null;
    private walletAddress: Address | null = null;

    constructor(walletAddress?: Address) {
        const config = getEnvConfig();
        this.client = new Anthropic({
            apiKey: config.CLAUDE_API_KEY,
        });
        this.toolRegistry = createToolRegistry();
        this.walletAddress = walletAddress || null;
    }

    /**
     * Set wallet address
     */
    setWalletAddress(address: Address): void {
        this.walletAddress = address;
    }

    /**
     * Process user input
     */
    async process(input: string): Promise<OrchestratorResponse> {
        // Check for confirmation keywords
        if (this.pendingAction && this.isConfirmation(input)) {
            return await this.executePendingAction();
        }

        // Check for cancellation keywords
        if (this.pendingAction && this.isCancellation(input)) {
            return this.cancelPendingAction();
        }

        // Detect intent
        const detected = detectIntent(input);

        // Handle simple intents directly (no Claude needed)
        if (detected.confidence > 0.7) {
            const directResponse = await this.handleDirectIntent(detected, input);
            if (directResponse) {
                return directResponse;
            }
        }

        // For complex requests, use Claude
        return await this.handleWithClaude(input);
    }

    /**
     * Handle direct intent (without Claude)
     */
    private async handleDirectIntent(
        detected: DetectedIntent,
        input: string
    ): Promise<OrchestratorResponse | null> {
        if (!this.walletAddress) {
            return {
                message: '⚠️ No wallet address set. Please initialize the signer first.',
            };
        }

        try {
            switch (detected.intent) {
                case Intent.PORTFOLIO:
                    return await this.handlePortfolio();

                case Intent.SYNC_HISTORY:
                    return await this.handleSync();

                case Intent.REPORT_PERIOD:
                    return await this.handleReport(detected.entities?.period || 'week');

                default:
                    // Let Claude handle it
                    return null;
            }
        } catch (error) {
            return {
                message: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
        }
    }

    /**
     * Handle portfolio request
     */
    private async handlePortfolio(): Promise<OrchestratorResponse> {
        const result = await this.toolRegistry.execute('getBalances', {
            address: this.walletAddress,
        });

        if (!result.success) {
            return { message: `❌ Failed to get balances: ${result.error}` };
        }

        const balances = result.data;
        let message = '📊 Your Portfolio:\n\n';

        for (const balance of balances) {
            message += `  ${balance.symbol}: ${balance.balanceFormatted}\n`;
        }

        return { message };
    }

    /**
     * Handle sync request
     */
    private async handleSync(): Promise<OrchestratorResponse> {
        const result = await this.toolRegistry.execute('syncHistory', {
            address: this.walletAddress,
        });

        if (!result.success) {
            return { message: `❌ Failed to sync: ${result.error}` };
        }

        const { transferCount, approvalCount, blocksProcessed } = result.data;

        return {
            message: `✓ Synced ${blocksProcessed} blocks\n  Transfers: ${transferCount}\n  Approvals: ${approvalCount}`,
        };
    }

    /**
     * Handle report request
     */
    private async handleReport(period: string): Promise<OrchestratorResponse> {
        const result = await this.toolRegistry.execute('generateReport', {
            address: this.walletAddress,
            period,
        });

        if (!result.success) {
            return { message: `❌ Failed to generate report: ${result.error}` };
        }

        const report = result.data;
        let message = `📊 ${period.charAt(0).toUpperCase() + period.slice(1)}ly Report\n\n`;
        message += `Transactions: ${report.transactions.total}\n`;
        message += `  In: ${report.transactions.transfersIn}\n`;
        message += `  Out: ${report.transactions.transfersOut}\n`;
        message += `  Approvals: ${report.transactions.approvals}\n`;

        return { message };
    }

    /**
     * Handle request with Claude
     */
    private async handleWithClaude(input: string): Promise<OrchestratorResponse> {
        if (!this.walletAddress) {
            return {
                message: '⚠️ No wallet address set. Please initialize the signer first.',
            };
        }

        // Redact any sensitive data from input
        const sanitizedInput = this.sanitizeInput(input);

        // Get policy for context
        const policy = getPolicy();

        // Create system prompt with context
        const systemPrompt = getSystemPrompt({
            walletAddress: this.walletAddress,
            policyTargets: {
                targetStableRatio: policy.targetStableRatio,
                maxExposurePerAsset: policy.maxExposurePerAsset,
            },
        });

        try {
            // Call Claude with tools
            const response = await this.client.messages.create({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 4096,
                temperature: 0.3, // Low temperature for consistency
                system: systemPrompt,
                tools: this.toolRegistry.getAllDefinitions(),
                messages: [
                    {
                        role: 'user',
                        content: sanitizedInput,
                    },
                ],
            });

            // Process Claude's response
            return await this.processClaudeResponse(response);
        } catch (error) {
            return {
                message: `❌ Claude API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
        }
    }

    /**
     * Process Claude's response
     */
    private async processClaudeResponse(response: Anthropic.Message): Promise<OrchestratorResponse> {
        let finalMessage = '';
        const toolResults: any[] = [];

        // Execute tool calls
        for (const block of response.content) {
            if (block.type === 'tool_use') {
                const toolName = block.name;
                const toolParams = block.input;

                // Check if tool requires confirmation
                if (this.requiresConfirmation(toolName, toolParams)) {
                    // Store as pending action
                    this.pendingAction = {
                        type: toolName === 'executeX402Payment' ? 'x402_payment' : 'transaction',
                        description: this.describeAction(toolName, toolParams),
                        toolName,
                        params: toolParams,
                        timestamp: Date.now(),
                    };

                    return {
                        message: `${this.pendingAction.description}\n\nType 'yes' to confirm or 'no' to cancel.`,
                        requiresConfirmation: true,
                        pendingAction: this.pendingAction,
                    };
                }

                // Execute tool
                const result = await this.toolRegistry.execute(toolName, toolParams);
                toolResults.push({
                    tool_use_id: block.id,
                    content: JSON.stringify(result),
                });
            } else if (block.type === 'text') {
                finalMessage += block.text;
            }
        }

        // If there were tool calls, get final response from Claude
        if (toolResults.length > 0) {
            const followUp = await this.client.messages.create({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 4096,
                temperature: 0.3,
                system: getSystemPrompt({
                    walletAddress: this.walletAddress || undefined,
                }),
                tools: this.toolRegistry.getAllDefinitions(),
                messages: [
                    {
                        role: 'user',
                        content: this.sanitizeInput(''),
                    },
                    {
                        role: 'assistant',
                        content: response.content,
                    },
                    {
                        role: 'user',
                        content: toolResults,
                    },
                ],
            });

            // Extract text from follow-up
            for (const block of followUp.content) {
                if (block.type === 'text') {
                    finalMessage = block.text;
                }
            }
        }

        return { message: finalMessage || 'I processed your request.' };
    }

    /**
     * Check if tool requires user confirmation
     */
    private requiresConfirmation(toolName: string, params: any): boolean {
        // Execution tools always require confirmation
        if (toolName === 'executeX402Payment') {
            return true;
        }

        // Any tool with confirmed=true parameter requires confirmation
        if (params.confirmed === true) {
            return true;
        }

        return false;
    }

    /**
     * Describe action for user confirmation
     */
    private describeAction(toolName: string, params: any): string {
        switch (toolName) {
            case 'executeX402Payment':
                return `💳 Execute x402 payment for ${params.url}`;
            default:
                return `Execute ${toolName}`;
        }
    }

    /**
     * Execute pending action
     */
    private async executePendingAction(): Promise<OrchestratorResponse> {
        if (!this.pendingAction) {
            return { message: '❌ No pending action to execute.' };
        }

        const action = this.pendingAction;
        this.pendingAction = null; // Clear pending action

        // Execute the tool
        const result = await this.toolRegistry.execute(action.toolName, {
            ...action.params,
            confirmed: true,
        });

        if (result.success) {
            return {
                message: `✓ ${action.description} completed successfully.`,
            };
        } else {
            return {
                message: `❌ ${action.description} failed: ${result.error}`,
            };
        }
    }

    /**
     * Cancel pending action
     */
    private cancelPendingAction(): OrchestratorResponse {
        if (!this.pendingAction) {
            return { message: '❌ No pending action to cancel.' };
        }

        const action = this.pendingAction;
        this.pendingAction = null;

        return {
            message: `✗ ${action.description} cancelled.`,
        };
    }

    /**
     * Check if input is a confirmation
     */
    private isConfirmation(input: string): boolean {
        const normalized = input.toLowerCase().trim();
        return normalized === 'yes' || normalized === 'y' || normalized === 'confirm';
    }

    /**
     * Check if input is a cancellation
     */
    private isCancellation(input: string): boolean {
        const normalized = input.toLowerCase().trim();
        return normalized === 'no' || normalized === 'n' || normalized === 'cancel';
    }

    /**
     * Sanitize input (redact sensitive data)
     */
    private sanitizeInput(input: string): string {
        // Redact anything that looks like a private key
        let sanitized = input.replace(/0x[0-9a-fA-F]{64}/g, (match) => redactSecret(match));

        // Redact anything that looks like a seed phrase (12+ words)
        const words = sanitized.split(/\s+/);
        if (words.length >= 12) {
            sanitized = '[REDACTED SEED PHRASE]';
        }

        return sanitized;
    }

    /**
     * Clear pending action (timeout)
     */
    clearPendingAction(): void {
        this.pendingAction = null;
    }

    /**
     * Get pending action
     */
    getPendingAction(): PendingAction | null {
        return this.pendingAction;
    }
}
