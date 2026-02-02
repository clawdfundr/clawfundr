import {
    getClassifiedPeriod,
    filterByCategory,
    getHighRiskTransactions,
    groupByToken,
    getTopCounterparties,
    TransactionCategory,
    type ClassifiedTransaction,
} from './history';

/**
 * Period summary report
 */
export interface PeriodSummary {
    period: {
        from: number;
        to: number;
        durationDays: number;
    };
    transactions: {
        total: number;
        transfersIn: number;
        transfersOut: number;
        approvals: number;
        revocations: number;
        unknown: number;
    };
    topCounterparties: Array<{
        address: string;
        count: number;
    }>;
    highRiskTransactions: Array<{
        hash: string;
        reason: string;
        token?: string;
        counterparty?: string;
    }>;
    gasSpent: {
        totalGasUsed: string;
        estimatedCostWei: string;
        transactionsWithGasData: number;
    };
    byToken: Array<{
        token: string;
        transfersIn: number;
        transfersOut: number;
        approvals: number;
    }>;
}

/**
 * Generate period summary report
 */
export function generatePeriodSummary(
    fromTs: number,
    toTs: number,
    userAddress?: string
): PeriodSummary {
    const transactions = getClassifiedPeriod(fromTs, toTs, userAddress);

    // Calculate period duration
    const durationSeconds = toTs - fromTs;
    const durationDays = Math.ceil(durationSeconds / 86400);

    // Count by category
    const transfersIn = filterByCategory(transactions, TransactionCategory.TRANSFER_IN);
    const transfersOut = filterByCategory(transactions, TransactionCategory.TRANSFER_OUT);
    const approvals = filterByCategory(transactions, TransactionCategory.APPROVE);
    const revocations = filterByCategory(transactions, TransactionCategory.REVOKE);
    const unknown = filterByCategory(transactions, TransactionCategory.UNKNOWN);

    // Get top counterparties
    const topCounterparties = getTopCounterparties(transactions, 5);

    // Get high-risk transactions
    const highRisk = getHighRiskTransactions(transactions);
    const highRiskSummary = highRisk.map(tx => ({
        hash: tx.hash,
        reason: tx.riskReason || 'Unknown risk',
        token: tx.token,
        counterparty: tx.counterparty,
    }));

    // Calculate gas spent
    const gasStats = calculateGasSpent(transactions);

    // Group by token
    const tokenGroups = groupByToken(transactions);
    const byToken = Array.from(tokenGroups.entries()).map(([token, txs]) => ({
        token,
        transfersIn: txs.filter(tx => tx.category === TransactionCategory.TRANSFER_IN).length,
        transfersOut: txs.filter(tx => tx.category === TransactionCategory.TRANSFER_OUT).length,
        approvals: txs.filter(tx => tx.category === TransactionCategory.APPROVE).length,
    }));

    return {
        period: {
            from: fromTs,
            to: toTs,
            durationDays,
        },
        transactions: {
            total: transactions.length,
            transfersIn: transfersIn.length,
            transfersOut: transfersOut.length,
            approvals: approvals.length,
            revocations: revocations.length,
            unknown: unknown.length,
        },
        topCounterparties,
        highRiskTransactions: highRiskSummary,
        gasSpent: gasStats,
        byToken,
    };
}

/**
 * Calculate gas spent from transactions
 */
function calculateGasSpent(transactions: ClassifiedTransaction[]): {
    totalGasUsed: string;
    estimatedCostWei: string;
    transactionsWithGasData: number;
} {
    let totalGasUsed = 0n;
    let totalCostWei = 0n;
    let txsWithGasData = 0;

    for (const tx of transactions) {
        if (tx.gasUsed && tx.gasPrice) {
            try {
                const gasUsed = BigInt(tx.gasUsed);
                const gasPrice = BigInt(tx.gasPrice);

                totalGasUsed += gasUsed;
                totalCostWei += gasUsed * gasPrice;
                txsWithGasData++;
            } catch {
                // Skip invalid gas data
            }
        }
    }

    return {
        totalGasUsed: totalGasUsed.toString(),
        estimatedCostWei: totalCostWei.toString(),
        transactionsWithGasData: txsWithGasData,
    };
}

/**
 * Generate daily activity report
 */
export function generateDailyReport(userAddress?: string): PeriodSummary {
    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - 86400;

    return generatePeriodSummary(oneDayAgo, now, userAddress);
}

/**
 * Generate weekly activity report
 */
export function generateWeeklyReport(userAddress?: string): PeriodSummary {
    const now = Math.floor(Date.now() / 1000);
    const oneWeekAgo = now - 604800; // 7 days

    return generatePeriodSummary(oneWeekAgo, now, userAddress);
}

/**
 * Generate monthly activity report
 */
export function generateMonthlyReport(userAddress?: string): PeriodSummary {
    const now = Math.floor(Date.now() / 1000);
    const oneMonthAgo = now - 2592000; // 30 days

    return generatePeriodSummary(oneMonthAgo, now, userAddress);
}

/**
 * Inflow/outflow analysis
 */
export interface FlowAnalysis {
    token: string;
    inflowCount: number;
    outflowCount: number;
    netFlow: 'positive' | 'negative' | 'neutral';
}

/**
 * Analyze inflow/outflow by token
 */
export function analyzeFlows(
    fromTs: number,
    toTs: number,
    userAddress?: string
): FlowAnalysis[] {
    const transactions = getClassifiedPeriod(fromTs, toTs, userAddress);
    const tokenGroups = groupByToken(transactions);

    const analysis: FlowAnalysis[] = [];

    for (const [token, txs] of tokenGroups.entries()) {
        const inflowCount = txs.filter(tx => tx.category === TransactionCategory.TRANSFER_IN).length;
        const outflowCount = txs.filter(tx => tx.category === TransactionCategory.TRANSFER_OUT).length;

        let netFlow: 'positive' | 'negative' | 'neutral' = 'neutral';
        if (inflowCount > outflowCount) {
            netFlow = 'positive';
        } else if (outflowCount > inflowCount) {
            netFlow = 'negative';
        }

        analysis.push({
            token,
            inflowCount,
            outflowCount,
            netFlow,
        });
    }

    return analysis;
}

/**
 * Approval summary
 */
export interface ApprovalSummary {
    totalApprovals: number;
    totalRevocations: number;
    unlimitedApprovals: number;
    activeApprovals: number; // approvals - revocations
    byToken: Array<{
        token: string;
        approvals: number;
        revocations: number;
        unlimited: number;
    }>;
}

/**
 * Generate approval summary
 */
export function generateApprovalSummary(
    fromTs: number,
    toTs: number,
    userAddress?: string
): ApprovalSummary {
    const transactions = getClassifiedPeriod(fromTs, toTs, userAddress);

    const approvals = filterByCategory(transactions, TransactionCategory.APPROVE);
    const revocations = filterByCategory(transactions, TransactionCategory.REVOKE);
    const unlimited = approvals.filter(tx => tx.isHighRisk);

    // Group by token
    const tokenGroups = groupByToken([...approvals, ...revocations]);
    const byToken = Array.from(tokenGroups.entries()).map(([token, txs]) => ({
        token,
        approvals: txs.filter(tx => tx.category === TransactionCategory.APPROVE).length,
        revocations: txs.filter(tx => tx.category === TransactionCategory.REVOKE).length,
        unlimited: txs.filter(tx => tx.isHighRisk).length,
    }));

    return {
        totalApprovals: approvals.length,
        totalRevocations: revocations.length,
        unlimitedApprovals: unlimited.length,
        activeApprovals: approvals.length - revocations.length,
        byToken,
    };
}

/**
 * Format gas cost in ETH
 */
export function formatGasCost(costWei: string): string {
    try {
        const wei = BigInt(costWei);
        const eth = Number(wei) / 1e18;
        return eth.toFixed(6);
    } catch {
        return '0';
    }
}

/**
 * Format timestamp to date string
 */
export function formatTimestamp(timestamp: number): string {
    return new Date(timestamp * 1000).toISOString().split('T')[0];
}
