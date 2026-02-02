import * as readline from 'readline';
import chalk from 'chalk';
import { config } from 'dotenv';
import { Agent } from './agent';
import { getEnvConfig, validateEnvironment } from './config';
import { ensureConfigured } from './config/setup';

config();

function promptOnce(question: string): Promise<string> {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

async function promptApiLogin(): Promise<void> {
    const env = getEnvConfig();
    const entered = await promptOnce(chalk.yellow('Enter your Clawfundr API key (claw_...): '));

    if (!/^claw_[a-fA-F0-9]{64}$/.test(entered)) {
        throw new Error('Invalid CLAWFUNDR_API_KEY format. Expected claw_<64 hex chars>.');
    }

    process.env.CLAWFUNDR_API_KEY = entered;

    const baseUrl = env.CLAWFUNDR_API_URL.replace(/\/+$/, '');
    const response = await fetch(`${baseUrl}/v1/auth/keys`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${entered}`,
        },
    });

    if (response.status === 401 || response.status === 403) {
        throw new Error('API key rejected by server.');
    }

    if (!response.ok) {
        throw new Error(`Failed to validate API key (HTTP ${response.status}).`);
    }
}

async function main() {
    console.log(chalk.cyan.bold('Clawfundr - Base Chain AI Banker'));

    try {
        await ensureConfigured();
    } catch (error) {
        console.error(chalk.red('Setup error:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }

    try {
        validateEnvironment();
    } catch (error) {
        console.error(chalk.red('Configuration error:'), error instanceof Error ? error.message : error);
        console.log(chalk.yellow('Please check your .env file and ensure all required variables are set.'));
        console.log(chalk.gray('Run: cp .env.example .env'));
        process.exit(1);
    }

    try {
        await promptApiLogin();
        console.log(chalk.green('API key validated.'));
    } catch (error) {
        console.error(chalk.red('API login failed:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }

    const agent = new Agent();
    await agent.initialize();

    console.log(chalk.green('Agent initialized'));
    console.log(chalk.gray('Type your message or press Ctrl+C to exit.'));

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.blue('You: '),
    });

    rl.on('SIGINT', async () => {
        console.log(chalk.yellow('Goodbye!'));
        await agent.shutdown();
        process.exit(0);
    });

    rl.on('line', async (input) => {
        const message = input.trim();

        if (!message) {
            rl.prompt();
            return;
        }

        if (message === '/exit' || message === '/quit') {
            console.log(chalk.yellow('Goodbye!'));
            await agent.shutdown();
            process.exit(0);
        }

        if (message === '/help') {
            printHelp();
            rl.prompt();
            return;
        }

        try {
            console.log(chalk.gray('Agent:'));
            const response = await agent.process(message);
            console.log(chalk.white(response));
            console.log();
        } catch (error) {
            console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
            console.log();
        }

        rl.prompt();
    });

    rl.prompt();
}

function printHelp() {
    console.log(chalk.cyan('Available Commands:'));
    console.log(chalk.white('  /help     - Show this help message'));
    console.log(chalk.white('  /exit     - Exit the application'));
    console.log(chalk.white('  Ctrl+C    - Exit the application'));
    console.log(chalk.cyan('Example Messages:'));
    console.log(chalk.gray('  "What\'s my balance?"'));
    console.log(chalk.gray('  "Show me my recent transactions"'));
    console.log(chalk.gray('  "Give me investment advice for moderate risk"'));
    console.log(chalk.gray('  "Send 0.01 ETH to 0x..."'));
}

process.on('uncaughtException', (error) => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
});

process.on('unhandledRejection', (error) => {
    console.error(chalk.red('Unhandled rejection:'), error);
    process.exit(1);
});

main().catch((error) => {
    console.error(chalk.red('Startup error:'), error);
    process.exit(1);
});
