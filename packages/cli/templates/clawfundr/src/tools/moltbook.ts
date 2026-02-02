/**
 * Moltbook Agent Registration Metadata Generator
 * 
 * Generates metadata for optional Moltbook agent registry registration.
 * Disabled by default unless MOLTBOOK_ENABLE=true in environment.
 * 
 * NOTE: This module does NOT auto-submit anything. It only generates
 * metadata that can be manually submitted to Moltbook registry.
 */

export interface MoltbookAgentMetadata {
    name: string;
    description: string;
    version: string;
    skills: string[];
    capabilities: {
        blockchain: string[];
        ai: string[];
        payments: string[];
    };
    contact: {
        github?: string;
        website?: string;
        email?: string;
    };
    configuration: {
        requiredEnvVars: string[];
        optionalEnvVars: string[];
    };
    security: {
        privateKeyHandling: string;
        policyEnforcement: boolean;
        confirmationRequired: boolean;
    };
}

/**
 * Generate Moltbook agent metadata
 */
export function generateMoltbookAgentMetadata(): MoltbookAgentMetadata {
    return {
        name: 'Clawfundr',
        description: 'Terminal-based AI banker agent for Base chain fund management with portfolio analysis, transaction history, rule-based investment advice, and x402 payment automation',
        version: '0.1.0',
        skills: [
            'portfolio_management',
            'transaction_history',
            'investment_advisor',
            'x402_payments',
            'blockchain_sync',
            'risk_assessment',
            'spending_control',
        ],
        capabilities: {
            blockchain: [
                'Base chain (chainId: 8453)',
                'ETH balance queries',
                'ERC-20 token support',
                'Transaction event syncing',
                'Incremental blockchain sync',
            ],
            ai: [
                'Claude 3.5 Sonnet integration',
                'Natural language processing',
                'Intent detection',
                'Tool-based reasoning',
                'Investment recommendations',
            ],
            payments: [
                'x402 payment protocol',
                'Policy-based transaction control',
                'Merchant allowlisting',
                'Spending caps enforcement',
                'Payment tracking',
            ],
        },
        contact: {
            github: 'https://github.com/YOUR_USERNAME/clawfundr', // Placeholder
            website: 'https://your-website.com', // Placeholder
            email: 'your-email@example.com', // Placeholder
        },
        configuration: {
            requiredEnvVars: [
                'CLAUDE_API_KEY',
            ],
            optionalEnvVars: [
                'BASE_RPC_URL',
                'WALLET_ADDRESS',
                'BASESCAN_API_KEY',
                'COINGECKO_API_KEY',
                'DATABASE_PATH',
                'LOG_LEVEL',
                'MOLTBOOK_ENABLE',
            ],
        },
        security: {
            privateKeyHandling: 'Isolated signer module, never exposed to LLM context, memory-only storage by default',
            policyEnforcement: true,
            confirmationRequired: true,
        },
    };
}

/**
 * Check if Moltbook integration is enabled
 */
export function isMoltbookEnabled(): boolean {
    return process.env.MOLTBOOK_ENABLE === 'true';
}

/**
 * Format metadata as JSON for manual registration
 */
export function formatMetadataForRegistration(): string {
    const metadata = generateMoltbookAgentMetadata();
    return JSON.stringify(metadata, null, 2);
}

/**
 * Print registration instructions
 */
export function printRegistrationInstructions(): void {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║                 Moltbook Agent Registration                    ║
╚════════════════════════════════════════════════════════════════╝

Clawfundr can be registered with the Moltbook agent registry.

IMPORTANT: Registration is MANUAL and OPTIONAL.
This tool does NOT auto-submit anything.

Steps to Register:
1. Review the generated metadata below
2. Update contact information (GitHub, website, email)
3. Visit the Moltbook registry website
4. Submit the metadata manually
5. Follow Moltbook's verification process

Generated Metadata:
${formatMetadataForRegistration()}

To enable Moltbook features in your agent:
  Set MOLTBOOK_ENABLE=true in your .env file

For more information:
  - Moltbook Registry: https://moltbook.io (example)
  - Documentation: See README.md

╔════════════════════════════════════════════════════════════════╗
║  NOTE: Never share private keys or sensitive data publicly    ║
╚════════════════════════════════════════════════════════════════╝
  `);
}

/**
 * Export metadata to file
 */
export function exportMetadataToFile(filepath: string): void {
    const fs = require('fs');
    const metadata = formatMetadataForRegistration();

    fs.writeFileSync(filepath, metadata, 'utf-8');
    console.log(`✓ Metadata exported to: ${filepath}`);
    console.log('  Review and update contact information before submitting.');
}
