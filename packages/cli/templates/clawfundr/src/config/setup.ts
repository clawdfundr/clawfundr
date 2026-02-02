import * as readline from 'readline';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

/**
 * Prompt user for input
 */
export function promptUser(question: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

/**
 * Check if .env file exists and has required variables
 */
export function checkEnvFile(): { exists: boolean; hasClaudeApiKey: boolean; hasClawfundrApiKey: boolean } {
    const envPath = join(process.cwd(), '.env');
    const exists = existsSync(envPath);

    if (!exists) {
        return { exists: false, hasClaudeApiKey: false, hasClawfundrApiKey: false };
    }

    const content = readFileSync(envPath, 'utf-8');
    const claudeMatch = content.match(/^CLAUDE_API_KEY=(.*)$/m);
    const clawfundrMatch = content.match(/^CLAWFUNDR_API_KEY=(.*)$/m);

    const hasClaudeApiKey = Boolean(
        claudeMatch &&
        claudeMatch[1].trim().length > 0 &&
        claudeMatch[1].trim() !== 'your_anthropic_api_key_here'
    );

    const hasClawfundrApiKey = Boolean(
        clawfundrMatch && /^claw_[a-fA-F0-9]{64}$/.test(clawfundrMatch[1].trim())
    );

    return { exists, hasClaudeApiKey, hasClawfundrApiKey };
}

/**
 * Create or update .env file with required API keys
 */
export function saveApiKeysToEnv(claudeApiKey: string, clawfundrApiKey: string): void {
    const envPath = join(process.cwd(), '.env');
    const envExamplePath = join(process.cwd(), '.env.example');

    // If .env doesn't exist, copy from .env.example
    if (!existsSync(envPath)) {
        if (existsSync(envExamplePath)) {
            const exampleContent = readFileSync(envExamplePath, 'utf-8');
            writeFileSync(envPath, exampleContent, 'utf-8');
        } else {
            // Create minimal .env
            writeFileSync(envPath, '', 'utf-8');
        }
    }

    // Read current .env content
    let content = readFileSync(envPath, 'utf-8');

    // Upsert CLAUDE_API_KEY
    if (content.includes('CLAUDE_API_KEY=')) {
        content = content.replace(/CLAUDE_API_KEY=.*/g, `CLAUDE_API_KEY=${claudeApiKey}`);
    } else {
        if (!content.endsWith('\n') && content.length > 0) {
            content += '\n';
        }
        content += `CLAUDE_API_KEY=${claudeApiKey}\n`;
    }

    // Upsert CLAWFUNDR_API_KEY
    if (content.includes('CLAWFUNDR_API_KEY=')) {
        content = content.replace(/CLAWFUNDR_API_KEY=.*/g, `CLAWFUNDR_API_KEY=${clawfundrApiKey}`);
    } else {
        if (!content.endsWith('\n') && content.length > 0) {
            content += '\n';
        }
        content += `CLAWFUNDR_API_KEY=${clawfundrApiKey}\n`;
    }

    // Ensure API URL exists
    if (!content.includes('CLAWFUNDR_API_URL=')) {
        if (!content.endsWith('\n') && content.length > 0) {
            content += '\n';
        }
        content += 'CLAWFUNDR_API_URL=https://api.clawfundr.xyz\n';
    }

    writeFileSync(envPath, content, 'utf-8');
}

/**
 * Interactive setup for first-time users
 */
export async function interactiveSetup(): Promise<void> {
    console.log(chalk.cyan('\nFirst-time Setup\n'));
    console.log(chalk.gray('Clawfundr requires these keys:'));
    console.log(chalk.gray('- CLAUDE_API_KEY'));
    console.log(chalk.gray('- CLAWFUNDR_API_KEY\n'));

    const claudeApiKey = await promptUser(chalk.yellow('Enter your Claude API key (sk-ant-...): '));

    if (!claudeApiKey || !claudeApiKey.startsWith('sk-ant-')) {
        console.log(chalk.red('\nInvalid Claude API key format. Expected: sk-ant-...\n'));
        process.exit(1);
    }

    const clawfundrApiKey = await promptUser(chalk.yellow('Enter your Clawfundr API key (claw_...): '));

    if (!/^claw_[a-fA-F0-9]{64}$/.test(clawfundrApiKey)) {
        console.log(chalk.red('\nInvalid Clawfundr API key format. Expected: claw_<64 hex chars>\n'));
        process.exit(1);
    }

    // Save to .env
    saveApiKeysToEnv(claudeApiKey, clawfundrApiKey);

    console.log(chalk.green('\nAPI keys saved to .env file'));
    console.log(chalk.gray('You can change them later by editing the .env file\n'));

    // Reload environment variables
    require('dotenv').config({ override: true });
}

/**
 * Ensure environment is configured, prompt if needed
 */
export async function ensureConfigured(): Promise<void> {
    const { exists, hasClaudeApiKey, hasClawfundrApiKey } = checkEnvFile();

    // If no .env or missing keys, run interactive setup
    if (!exists || !hasClaudeApiKey || !hasClawfundrApiKey) {
        await interactiveSetup();
    }
}
