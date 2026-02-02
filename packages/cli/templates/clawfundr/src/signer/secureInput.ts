import * as readline from 'readline';

/**
 * Securely read password/private key from terminal without echoing
 */
export async function readSecureInput(prompt: string): Promise<string> {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        // Disable echo
        const stdin = process.stdin;
        if ((stdin as any).isTTY) {
            (stdin as any).setRawMode(true);
        }

        let input = '';
        process.stdout.write(prompt);

        stdin.on('data', (char) => {
            const charStr = char.toString('utf8');

            switch (charStr) {
                case '\n':
                case '\r':
                case '\u0004': // Ctrl-D
                    // Enter pressed
                    if ((stdin as any).isTTY) {
                        (stdin as any).setRawMode(false);
                    }
                    stdin.pause();
                    process.stdout.write('\n');
                    rl.close();
                    resolve(input);
                    break;
                case '\u0003': // Ctrl-C
                    if ((stdin as any).isTTY) {
                        (stdin as any).setRawMode(false);
                    }
                    process.stdout.write('\n');
                    rl.close();
                    process.exit(1);
                    break;
                case '\u007f': // Backspace
                case '\b':
                    if (input.length > 0) {
                        input = input.slice(0, -1);
                        process.stdout.write('\b \b');
                    }
                    break;
                default:
                    // Only accept printable characters
                    if (charStr >= ' ' && charStr <= '~') {
                        input += charStr;
                        process.stdout.write('*');
                    }
                    break;
            }
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
