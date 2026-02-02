import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { copySync } from 'fs-extra';
import chalk from 'chalk';

interface ValidationResult {
    valid: boolean;
    error?: string;
}

export function validateProjectName(name: string): ValidationResult {
    if (!name || name.length === 0) {
        return { valid: false, error: 'Project name cannot be empty' };
    }

    if (name.length > 214) {
        return { valid: false, error: 'Project name must be 214 characters or less' };
    }

    if (name.startsWith('.') || name.startsWith('-')) {
        return { valid: false, error: 'Project name cannot start with a dot or hyphen' };
    }

    const validNameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!validNameRegex.test(name)) {
        return {
            valid: false,
            error: 'Project name can only contain letters, numbers, hyphens, and underscores'
        };
    }

    return { valid: true };
}

export async function copyTemplate(targetDir: string): Promise<void> {
    const templateDir = join(__dirname, '../templates/clawfundr');

    if (!existsSync(templateDir)) {
        throw new Error(`Template directory not found at: ${templateDir}`);
    }

    if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
    }

    copySync(templateDir, targetDir, {
        overwrite: true,
        errorOnExist: false
    });
}

export async function generateEnvExample(targetDir: string): Promise<void> {
    const envExamplePath = join(targetDir, '.env.example');

    if (existsSync(envExamplePath)) {
        return;
    }

    const envContent = `# Anthropic API Key for Claude
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Base Chain RPC URL (default: public RPC)
BASE_RPC_URL=https://mainnet.base.org

# Basescan API Key (optional, for transaction history)
BASESCAN_API_KEY=your_basescan_api_key_here

# CoinGecko API Key (optional, for price data)
COINGECKO_API_KEY=your_coingecko_api_key_here

# Database path (default: ./data/clawfundr.db)
DATABASE_PATH=./data/clawfundr.db

# Log level (debug, info, warn, error)
LOG_LEVEL=info
`;

    writeFileSync(envExamplePath, envContent, 'utf-8');
}

export async function generatePolicyJson(targetDir: string): Promise<void> {
    const policyPath = join(targetDir, 'policy.json');

    if (existsSync(policyPath)) {
        return;
    }

    const policy = {
        version: '1.0',
        description: 'Clawfundr AI Banker Agent Policy',
        rules: {
            transaction_approval: {
                enabled: true,
                description: 'All transactions require explicit user approval'
            },
            max_transaction_value: {
                enabled: true,
                value_eth: 1.0,
                description: 'Maximum transaction value without additional confirmation'
            },
            private_key_exposure: {
                enabled: true,
                description: 'Private keys must NEVER be exposed to LLM context'
            },
            fund_advice: {
                risk_profiles: ['conservative', 'moderate', 'aggressive'],
                default_profile: 'moderate'
            }
        },
        skills: {
            enabled: [
                'balance-check',
                'transaction-history',
                'fund-advice',
                'transaction-decoder',
                'send-transaction',
                'x402-payment'
            ]
        }
    };

    writeFileSync(policyPath, JSON.stringify(policy, null, 2), 'utf-8');
}

export function printNextSteps(projectName: string): void {
    console.log(chalk.green.bold('\n✨ Installation complete!\n'));

    console.log(chalk.cyan('Next steps:\n'));
    console.log(chalk.white(`  1. ${chalk.bold(`cd ${projectName}`)}`));
    console.log(chalk.white(`  2. ${chalk.bold('npm install')}`));
    console.log(chalk.white(`  3. ${chalk.bold('cp .env.example .env')} and add your API keys`));
    console.log(chalk.white(`  4. ${chalk.bold('npm start')}\n`));

    console.log(chalk.gray('Documentation: https://github.com/your-org/clawfundr'));
    console.log(chalk.gray('Issues: https://github.com/your-org/clawfundr/issues\n'));

    console.log(chalk.yellow('⚠️  Important:'));
    console.log(chalk.yellow('   - Keep your .env file secure and never commit it'));
    console.log(chalk.yellow('   - Your wallet private keys are encrypted locally'));
    console.log(chalk.yellow('   - Always review transactions before approving\n'));
}
