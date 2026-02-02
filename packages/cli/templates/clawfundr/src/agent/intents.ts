/**
 * User intent types
 */
export enum Intent {
    PORTFOLIO = 'portfolio',
    SYNC_HISTORY = 'sync_history',
    REPORT_PERIOD = 'report_period',
    ADVISE_FUND = 'advise_fund',
    X402_PAY = 'x402_pay',
    APPROVALS_REVIEW = 'approvals_review',
    SEND_TRANSACTION = 'send_transaction',
    GENERAL = 'general',
}

/**
 * Detected intent with confidence
 */
export interface DetectedIntent {
    intent: Intent;
    confidence: number; // 0-1
    entities?: Record<string, any>;
}

/**
 * Intent patterns (keyword-based detection)
 */
const INTENT_PATTERNS: Record<Intent, string[]> = {
    [Intent.PORTFOLIO]: [
        'balance',
        'portfolio',
        'holdings',
        'what do i have',
        'how much',
        'assets',
    ],
    [Intent.SYNC_HISTORY]: [
        'sync',
        'update',
        'refresh',
        'fetch transactions',
        'get history',
    ],
    [Intent.REPORT_PERIOD]: [
        'report',
        'summary',
        'activity',
        'last week',
        'last month',
        'daily',
        'weekly',
        'monthly',
    ],
    [Intent.ADVISE_FUND]: [
        'advice',
        'recommend',
        'should i',
        'what should',
        'invest',
        'rebalance',
    ],
    [Intent.X402_PAY]: [
        'pay',
        'payment',
        '402',
        'x402',
        'purchase',
    ],
    [Intent.APPROVALS_REVIEW]: [
        'approval',
        'allowance',
        'revoke',
        'unlimited',
    ],
    [Intent.SEND_TRANSACTION]: [
        'send',
        'transfer',
        'pay',
        'move',
    ],
    [Intent.GENERAL]: [],
};

/**
 * Detect user intent from natural language input
 */
export function detectIntent(input: string): DetectedIntent {
    const normalized = input.toLowerCase().trim();

    // Score each intent
    const scores: Record<Intent, number> = {
        [Intent.PORTFOLIO]: 0,
        [Intent.SYNC_HISTORY]: 0,
        [Intent.REPORT_PERIOD]: 0,
        [Intent.ADVISE_FUND]: 0,
        [Intent.X402_PAY]: 0,
        [Intent.APPROVALS_REVIEW]: 0,
        [Intent.SEND_TRANSACTION]: 0,
        [Intent.GENERAL]: 0,
    };

    // Check for keyword matches
    for (const [intent, keywords] of Object.entries(INTENT_PATTERNS)) {
        for (const keyword of keywords) {
            if (normalized.includes(keyword)) {
                scores[intent as Intent] += 1;
            }
        }
    }

    // Find highest scoring intent
    let maxScore = 0;
    let detectedIntent = Intent.GENERAL;

    for (const [intent, score] of Object.entries(scores)) {
        if (score > maxScore) {
            maxScore = score;
            detectedIntent = intent as Intent;
        }
    }

    // Calculate confidence (simple heuristic)
    const confidence = maxScore > 0 ? Math.min(maxScore / 3, 1.0) : 0.3;

    // Extract entities (simple extraction)
    const entities: Record<string, any> = {};

    // Extract time periods
    if (normalized.includes('last week') || normalized.includes('weekly')) {
        entities.period = 'week';
    } else if (normalized.includes('last month') || normalized.includes('monthly')) {
        entities.period = 'month';
    } else if (normalized.includes('today') || normalized.includes('daily')) {
        entities.period = 'day';
    }

    // Extract amounts (simple regex)
    const amountMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(usdc|eth|weth|dai)/i);
    if (amountMatch) {
        entities.amount = amountMatch[1];
        entities.token = amountMatch[2].toUpperCase();
    }

    return {
        intent: detectedIntent,
        confidence,
        entities: Object.keys(entities).length > 0 ? entities : undefined,
    };
}

/**
 * Format intent for logging
 */
export function formatIntent(detected: DetectedIntent): string {
    let message = `Intent: ${detected.intent} (${(detected.confidence * 100).toFixed(0)}% confidence)`;

    if (detected.entities) {
        message += `\nEntities: ${JSON.stringify(detected.entities)}`;
    }

    return message;
}
