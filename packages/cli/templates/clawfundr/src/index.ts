import * as readline from 'readline';
import chalk from 'chalk';
import { config } from 'dotenv';
import { Agent } from './agent';
import { validateEnvironment } from './config';
import { ensureConfigured } from './config/setup';

// Load environment variables
config();

async function main() {
    // Print banner
    console.log(chalk.cyan.bold('\n╔════════════════════════════════════════╗'));
    console.log(chalk.cyan.bold('║  Clawfundr — Base Chain AI Banker     ║'));
    console.log(chalk.cyan.bold('╚════════════════════════════════════════╝\n'));

    // Ensure configuration (interactive setup if needed)
    try {
        await ensureConfigured();
    } catch (error) {
        console.error(chalk.red('❌ Setup error:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }

    // Validate environment
    try {
        validateEnvironment();
    } catch (error) {
        console.error(chalk.red('❌ Configuration error:'), error instanceof Error ? error.message : error);
        console.log(chalk.yellow('\nPlease check your .env file and ensure all required variables are set.'));
        console.log(chalk.gray('Run: cp .env.example .env\n'));
        process.exit(1);
    }

    // Initialize agent
    const agent = new Agent();
    await agent.initialize();

    console.log(chalk.green('✓ Agent initialized'));
    console.log(chalk.gray('Type your message or press Ctrl+C to exit.\n'));

    // Create readline interface
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.blue('You: ')
    });

    // Handle Ctrl+C
    rl.on('SIGINT', async () => {
        console.log(chalk.yellow('\n\n👋 Goodbye!'));
        await agent.shutdown();
        process.exit(0);
    });

    // Handle user input
    rl.on('line', async (input) => {
        const message = input.trim();

        if (!message) {
            rl.prompt();
            return;
        }

        // Handle special commands
        if (message === '/exit' || message === '/quit') {
            console.log(chalk.yellow('\n👋 Goodbye!'));
            await agent.shutdown();
            process.exit(0);
        }

        if (message === '/help') {
            printHelp();
            rl.prompt();
            return;
        }

        try {
            // Process message through agent
            console.log(chalk.gray('\nAgent: '));
            const response = await agent.process(message);
            console.log(chalk.white(response));
            console.log();
        } catch (error) {
            console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : error);
            console.log();
        }

        rl.prompt();
    });

    // Start REPL
    rl.prompt();
}

function printHelp() {
    console.log(chalk.cyan('\n📖 Available Commands:\n'));
    console.log(chalk.white('  /help     - Show this help message'));
    console.log(chalk.white('  /exit     - Exit the application'));
    console.log(chalk.white('  Ctrl+C    - Exit the application\n'));
    console.log(chalk.cyan('💬 Example Messages:\n'));
    console.log(chalk.gray('  "What\'s my balance?"'));
    console.log(chalk.gray('  "Show me my recent transactions"'));
    console.log(chalk.gray('  "Give me investment advice for moderate risk"'));
    console.log(chalk.gray('  "Send 0.01 ETH to 0x..."'));
    console.log();
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error(chalk.red('\n❌ Fatal error:'), error);
    process.exit(1);
});

process.on('unhandledRejection', (error) => {
    console.error(chalk.red('\n❌ Unhandled rejection:'), error);
    process.exit(1);
});

main().catch((error) => {
    console.error(chalk.red('\n❌ Startup error:'), error);
    process.exit(1);
});
