import chalk from 'chalk';
import { installProject } from './install';
import { readFileSync } from 'fs';
import { join } from 'path';

// Read package.json for version
let version = '0.1.0';
try {
    const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));
    version = packageJson.version;
} catch (error) {
    // Fallback to default version
}

function showHelp() {
    console.log(chalk.cyan.bold('\n🐾 Clawfundr CLI\n'));
    console.log(chalk.white('Terminal-only AI banker agent for EVM Base Chain\n'));
    console.log(chalk.yellow('Usage:'));
    console.log(chalk.white('  clawfundr install <project-name>  Install a new Clawfundr project'));
    console.log(chalk.white('  clawfundr --version               Show version'));
    console.log(chalk.white('  clawfundr --help                  Show this help\n'));
    console.log(chalk.gray(`Version: ${version}\n`));
}

async function main() {
    const args = process.argv.slice(2);

    // No arguments - show help
    if (args.length === 0) {
        showHelp();
        process.exit(0);
    }

    const command = args[0];

    // Handle flags
    if (command === '--version' || command === '-v') {
        console.log(version);
        process.exit(0);
    }

    if (command === '--help' || command === '-h') {
        showHelp();
        process.exit(0);
    }

    // Handle install command
    if (command === 'install') {
        const projectName = args[1];

        if (!projectName) {
            console.error(chalk.red('\n❌ Error: Project name is required\n'));
            console.log(chalk.yellow('Usage: clawfundr install <project-name>\n'));
            process.exit(1);
        }

        try {
            console.log(chalk.cyan.bold('\n🐾 Clawfundr Installer\n'));
            await installProject(projectName);
        } catch (error) {
            console.error(chalk.red('\n❌ Installation failed:'), error instanceof Error ? error.message : error);
            process.exit(1);
        }
    } else {
        console.error(chalk.red(`\n❌ Unknown command: ${command}\n`));
        showHelp();
        process.exit(1);
    }
}

main().catch((error) => {
    console.error(chalk.red('\n❌ Fatal error:'), error);
    process.exit(1);
});
