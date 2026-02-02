import { readFileSync } from 'fs';
import { join } from 'path';
import { initDb, query } from '../src/db/client';

async function runMigrations() {
    console.log('🔄 Running database migrations...\n');

    try {
        // Initialize database connection
        initDb();

        // Read migration file
        const migrationPath = join(__dirname, '../src/db/migrations/001_initial.sql');
        const migrationSql = readFileSync(migrationPath, 'utf-8');

        // Execute migration
        await query(migrationSql);

        console.log('✅ Migration 001_initial.sql completed successfully\n');
        console.log('Database schema created:');
        console.log('  - users');
        console.log('  - api_keys');
        console.log('  - wallets');
        console.log('  - requests_log');
        console.log('  - tx_raw');
        console.log('  - tx_decoded');
        console.log('  - balances_snapshot');
        console.log('  - x402_payments');
        console.log('  - policies');
        console.log('  - action_proposals\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

runMigrations();
