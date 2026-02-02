import * as readline from 'readline';

/**
 * Securely read password/private key from terminal without echoing.
 * Uses readline masking instead of raw mode for broader terminal compatibility.
 */
export async function readSecureInput(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: true,
        });

        const mutableRl = rl as readline.Interface & {
            stdoutMuted?: boolean;
            _writeToOutput?: (str: string) => void;
        };

        mutableRl.stdoutMuted = true;
        mutableRl._writeToOutput = (str: string) => {
            // Keep prompt text visible, mask user input.
            if (mutableRl.stdoutMuted && !str.includes(prompt)) {
                rl.output.write('*');
                return;
            }
            rl.output.write(str);
        };

        const onSigint = () => {
            rl.close();
            reject(new Error('Input cancelled by user'));
        };

        rl.once('SIGINT', onSigint);
        rl.question(prompt, (answer) => {
            rl.removeListener('SIGINT', onSigint);
            rl.close();
            resolve(answer.trim());
        });
    });
}

/**
 * Confirm action with yes/no prompt
 */
export async function confirmAction(message: string): Promise<boolean> {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        rl.question(`${message} (yes/no): `, (answer) => {
            rl.close();
            const normalized = answer.trim().toLowerCase();
            resolve(normalized === 'yes' || normalized === 'y');
        });
    });
}

/**
 * Redact sensitive data from logs
 */
export function redactSecret(secret: string): string {
    if (!secret || secret.length < 8) {
        return '***';
    }

    // Show first 4 and last 4 characters
    const start = secret.slice(0, 4);
    const end = secret.slice(-4);
    return `${start}...${end}`;
}

/**
 * Validate private key format (0x + 64 hex chars)
 */
export function isValidPrivateKey(key: string): boolean {
    const hexPattern = /^0x[0-9a-fA-F]{64}$/;
    return hexPattern.test(key);
}
