import Anthropic from '@anthropic-ai/sdk';
import { getEnvConfig } from '../config/env';

let claudeClient: Anthropic | null = null;
export type ClaudeTool = Anthropic.Beta.Tools.Tool;
export type ClaudeMessage = Anthropic.Message | Anthropic.Beta.Tools.ToolsBetaMessage;

/**
 * Get or create Claude client
 */
export function getClaudeClient(): Anthropic {
    if (claudeClient) {
        return claudeClient;
    }

    const config = getEnvConfig();
    claudeClient = new Anthropic({
        apiKey: config.CLAUDE_API_KEY,
    });

    return claudeClient;
}

/**
 * Send message to Claude
 */
export async function sendMessage(
    message: string,
    systemPrompt?: string,
    tools?: ClaudeTool[]
): Promise<ClaudeMessage> {
    const client = getClaudeClient();

    const params: Anthropic.MessageCreateParamsNonStreaming = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: [
            {
                role: 'user',
                content: message,
            },
        ],
    };

    if (systemPrompt) {
        params.system = systemPrompt;
    }

    if (tools && tools.length > 0) {
        const toolsParams: Anthropic.Beta.Tools.MessageCreateParamsNonStreaming = {
            ...params,
            tools,
        };
        return await client.beta.tools.messages.create(toolsParams);
    }

    return await client.messages.create(params);
}

/**
 * Extract text from Claude response
 */
export function extractText(message: ClaudeMessage): string {
    const textChunks: string[] = [];

    for (const block of message.content) {
        if (block.type === 'text' && 'text' in block) {
            textChunks.push(block.text);
        }
    }

    return textChunks.join('\n');
}

/**
 * Extract tool calls from Claude response
 */
export function extractToolCalls(
    message: ClaudeMessage
): Array<{ id: string; name: string; input: unknown }> {
    const toolCalls: Array<{ id: string; name: string; input: unknown }> = [];

    for (const block of message.content) {
        if (block.type !== 'tool_use') {
            continue;
        }

        const toolBlock = block as Anthropic.Beta.Tools.ToolUseBlock;
        toolCalls.push({
            id: toolBlock.id,
            name: toolBlock.name,
            input: toolBlock.input,
        });
    }

    return toolCalls;
}
