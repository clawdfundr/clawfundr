import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';
import { initDb, createUser, createApiKey } from '../src/db/client';
import { getEnvConfig } from '../src/config/env';

/**
 * Bootstrap script to create initial user and API key
 * Run this once after migrations to get started
 */
async function bootstrap() {
    console.log('🚀 Clawfundr API Bootstrap\n');

    try {
        // Validate environment
        const config = getEnvConfig();

        // Initialize database
        initDb();

        // Create user
        console.log('Creating user...');
        const user = await createUser();
        console.log(`✅ User created: ${user.id}\n`);

        // Generate API key (32 bytes = 64 hex characters)
        const apiKey = randomBytes(32).toString('hex');
        const apiKeyWithPrefix = `claw_${apiKey}`;

        // Hash the API key
        const saltRounds = parseInt(config.API_KEY_SALT_ROUNDS);
        const keyHash = await bcrypt.hash(apiKeyWithPrefix, saltRounds);

        // Store hashed key
        console.log('Creating API key...');
        const apiKeyRecord = await createApiKey(user.id, keyHash, 'Bootstrap Key');
        console.log(`✅ API key created: ${apiKeyRecord.id}\n`);

        // Display results
        console.log('═══════════════════════════════════════════════════════════');
        console.log('🎉 Bootstrap Complete!\n');
        console.log('User ID:', user.id);
        console.log('API Key ID:', apiKeyRecord.id);
        console.log('\n⚠️  IMPORTANT: Save this API key securely!\n');
        console.log('API Key:', apiKeyWithPrefix);
        console.log('\nThis key will NOT be shown again.');
        console.log('Use it in the Authorization header:');
        console.log(`  Authorization: Bearer ${apiKeyWithPrefix}\n`);
        console.log('Example curl command:');
        console.log(`  curl -H "Authorization: Bearer ${apiKeyWithPrefix}" \\`);
        console.log('       http://localhost:3000/health\n');
        console.log('═══════════════════════════════════════════════════════════\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Bootstrap failed:', error);
        process.exit(1);
    }
}

bootstrap();
