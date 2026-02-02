import * as readline from 'readline';
import { writeFileSync, existsSync, readFileSync, appendFileSync } from 'fs';
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
export function checkEnvFile(): { exists: boolean; hasApiKey: boolean } {
    const envPath = join(process.cwd(), '.env');
    const exists = existsSync(envPath);

    if (!exists) {
        return { exists: false, hasApiKey: false };
    }

    const content = readFileSync(envPath, 'utf-8');
    const hasApiKey = content.includes('CLAUDE_API_KEY=') &&
        !content.includes('CLAUDE_API_KEY=your-api-key-here') &&
        !content.includes('CLAUDE_API_KEY=""') &&
        !content.includes('CLAUDE_API_KEY=\'\'');

    return { exists, hasApiKey };
}

/**
 * Create or update .env file with API key
 */
export function saveApiKeyToEnv(apiKey: string): void {
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

    // Check if CLAUDE_API_KEY already exists
    if (content.includes('CLAUDE_API_KEY=')) {
        // Replace existing value
        content = content.replace(
            /CLAUDE_API_KEY=.*/,
            `CLAUDE_API_KEY=${apiKey}`
        );
    } else {
        // Append new line
        if (!content.endsWith('\n') && content.length > 0) {
            content += '\n';
        }
        content += `CLAUDE_API_KEY=${apiKey}\n`;
    }

    writeFileSync(envPath, content, 'utf-8');
}

/**
 * Interactive setup for first-time users
 */
export async function interactiveSetup(): Promise<void> {
    console.log(chalk.cyan('\n🔧 First-time Setup\n'));
    console.log(chalk.gray('Clawfundr needs a Claude API key to function.'));
    console.log(chalk.gray('Get your API key from: https://console.anthropic.com/\n'));

    const apiKey = await promptUser(chalk.yellow('Enter your Claude API key (sk-ant-...): '));

    if (!apiKey || !apiKey.startsWith('sk-ant-')) {
        console.log(chalk.red('\n❌ Invalid API key format. Expected format: sk-ant-...'));
        console.log(chalk.yellow('Please get a valid API key from https://console.anthropic.com/\n'));
        process.exit(1);
    }

    // Save to .env
    saveApiKeyToEnv(apiKey);

    console.log(chalk.green('\n✓ API key saved to .env file'));
    console.log(chalk.gray('You can change it later by editing the .env file\n'));

    // Reload environment variables
    require('dotenv').config({ override: true });
}

/**
 * Ensure environment is configured, prompt if needed
 */
export async function ensureConfigured(): Promise<void> {
    const { exists, hasApiKey } = checkEnvFile();

    // If no .env or no API key, run interactive setup
    if (!exists || !hasApiKey) {
        await interactiveSetup();
    }
}
