import { resolve } from 'path';
import { existsSync } from 'fs';
import chalk from 'chalk';
import prompts from 'prompts';
import {
    validateProjectName,
    copyTemplate,
    generateEnvExample,
    generatePolicyJson,
    printNextSteps
} from './utils';

export async function installProject(projectName: string): Promise<void> {
    // Validate project name
    const validation = validateProjectName(projectName);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    // Resolve target directory
    const targetDir = resolve(process.cwd(), projectName);

    // Check if directory already exists
    if (existsSync(targetDir)) {
        const { overwrite } = await prompts({
            type: 'confirm',
            name: 'overwrite',
            message: `Directory "${projectName}" already exists. Overwrite?`,
            initial: false
        });

        if (!overwrite) {
            console.log(chalk.yellow('\n⚠️  Installation cancelled.'));
            process.exit(0);
        }
    }

    console.log(chalk.blue(`\n📦 Installing Clawfundr project: ${chalk.bold(projectName)}`));
    console.log(chalk.gray(`   Target directory: ${targetDir}\n`));

    // Copy template
    console.log(chalk.cyan('📋 Copying template files...'));
    await copyTemplate(targetDir);
    console.log(chalk.green('✓ Template files copied'));

    // Generate .env.example if not present
    console.log(chalk.cyan('🔧 Generating configuration files...'));
    await generateEnvExample(targetDir);
    console.log(chalk.green('✓ .env.example created'));

    // Generate policy.json if not present
    await generatePolicyJson(targetDir);
    console.log(chalk.green('✓ policy.json created'));

    // Print next steps
    printNextSteps(projectName);
}
