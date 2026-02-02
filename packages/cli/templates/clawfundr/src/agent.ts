import chalk from 'chalk';
import type { Address } from 'viem';
import { initDb, closeDb } from './db/db';
import { getConfig } from './config';
import { loadPolicy } from './config/policy';
import { Orchestrator } from './agent/orchestrator';
import { initializeSigner } from './signer/signer';

export class Agent {
    private initialized: boolean = false;
    private orchestrator: Orchestrator | null = null;

    async initialize(): Promise<void> {
        // Initialize database
        const config = getConfig();
        initDb(config.DATABASE_PATH);

        // Load and validate policy
        loadPolicy();

        // Initialize signer (prompts for private key)
        console.log(chalk.cyan('\n🔐 Initializing wallet signer...'));
        const signerAddress = await initializeSigner();

        // Create orchestrator with wallet address
        this.orchestrator = new Orchestrator(signerAddress);

        console.log(chalk.green(`✓ Agent initialized with wallet: ${signerAddress.slice(0, 6)}...${signerAddress.slice(-4)}\n`));

        this.initialized = true;
    }

    async shutdown(): Promise<void> {
        closeDb();
    }

    async process(message: string): Promise<string> {
        if (!this.initialized || !this.orchestrator) {
            throw new Error('Agent not initialized');
        }

        try {
            const response = await this.orchestrator.process(message);
            return response.message;
        } catch (error) {
            return chalk.red(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
