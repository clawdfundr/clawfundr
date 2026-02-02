import type { TxRaw, TxDecoded } from '../db/db';
import { lastTxs, reportTxs } from '../db/db';

/**
 * Transaction categories
 */
export enum TransactionCategory {
    TRANSFER_IN = 'transfer_in',
    TRANSFER_OUT = 'transfer_out',
    APPROVE = 'approve',
    REVOKE = 'revoke',
    UNKNOWN = 'unknown',
}

/**
 * Classified transaction
 */
export interface ClassifiedTransaction {
    hash: string;
    category: TransactionCategory;
    timestamp: number;
    token?: string;
    amount?: string;
    amountFormatted?: string;
    counterparty?: string;
    isHighRisk: boolean;
    riskReason?: string;
    gasUsed?: string;
    gasPrice?: string;
    notes?: string;
}

/**
 * Maximum uint256 value (unlimited approval)
 */
const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
const MAX_UINT256_STR = MAX_UINT256.toString();

/**
 * Check if an approval is unlimited (max uint256)
 */
export function isUnlimitedApproval(amount: string): boolean {
    try {
        const amountBigInt = BigInt(amount);
        return amountBigInt === MAX_UINT256;
    } catch {
        return false;
    }
}

/**
 * Classify a transaction based on its decoded data
 */
export function classifyTransaction(
    raw: TxRaw,
    decoded?: Partial<TxDecoded>,
    userAddress?: string
): ClassifiedTransaction {
    const classified: ClassifiedTransaction = {
        hash: raw.hash,
        category: TransactionCategory.UNKNOWN,
        timestamp: raw.timestamp,
        gasUsed: raw.gas_used || undefined,
        gasPrice: raw.gas_price || undefined,
        isHighRisk: false,
    };

    if (!decoded) {
        return classified;
    }

    // Parse decoded JSON if available
    let decodedData: any = {};
    if (decoded.decoded_json) {
        try {
            decodedData = JSON.parse(decoded.decoded_json);
        } catch {
            // Ignore parse errors
        }
    }

    // Classify based on type
    switch (decoded.type) {
        case 'transfer':
            // Determine if incoming or outgoing
            if (userAddress) {
                const isIncoming = raw.to_addr?.toLowerCase() === userAddress.toLowerCase();
                classified.category = isIncoming
                    ? TransactionCategory.TRANSFER_IN
                    : TransactionCategory.TRANSFER_OUT;
            } else {
                // Fallback: check token_in vs token_out
                classified.category = decoded.token_in
                    ? TransactionCategory.TRANSFER_IN
                    : TransactionCategory.TRANSFER_OUT;
            }

            classified.token = decoded.token_in || decoded.token_out;
            classified.amount = decodedData.value || raw.value;
            classified.amountFormatted = decoded.amount_in || decoded.amount_out;
            classified.counterparty = decoded.counterparty;
            classified.notes = decoded.notes;
            break;

        case 'approval':
            const approvalAmount = decodedData.value || '0';

            // Check if this is a revoke (amount = 0) or unlimited approval
            if (approvalAmount === '0') {
                classified.category = TransactionCategory.REVOKE;
                classified.notes = `Revoked ${decoded.token_in} approval`;
            } else {
                classified.category = TransactionCategory.APPROVE;

                // Check for unlimited approval
                if (isUnlimitedApproval(approvalAmount)) {
                    classified.isHighRisk = true;
                    classified.riskReason = 'Unlimited approval granted';
                }

                classified.notes = decoded.notes;
            }

            classified.token = decoded.token_in;
            classified.amount = approvalAmount;
            classified.amountFormatted = decodedData.valueFormatted;
            classified.counterparty = decoded.counterparty;
            break;

        default:
            classified.category = TransactionCategory.UNKNOWN;
            classified.notes = decoded.notes;
    }

    return classified;
}

/**
 * Get classified transaction history
 */
export function getClassifiedHistory(
    limit: number = 50,
    userAddress?: string
): ClassifiedTransaction[] {
    const txs = lastTxs(limit);

    return txs.map(tx => {
        const raw: TxRaw = {
            hash: tx.hash,
            block_number: tx.block_number,
            timestamp: tx.timestamp,
            from_addr: tx.from_addr,
            to_addr: tx.to_addr,
            value: tx.value,
            input: tx.input,
            status: tx.status,
            gas_used: tx.gas_used,
            gas_price: tx.gas_price,
            chain_id: tx.chain_id,
        };

        const decoded: Partial<TxDecoded> = {
            type: tx.type,
            token_in: tx.token_in,
            token_out: tx.token_out,
            amount_in: tx.amount_in,
            amount_out: tx.amount_out,
            counterparty: tx.counterparty,
            notes: tx.notes,
            decoded_json: tx.decoded_json,
        };

        return classifyTransaction(raw, decoded, userAddress);
    });
}

/**
 * Get classified transactions for a time period
 */
export function getClassifiedPeriod(
    fromTs: number,
    toTs: number,
    userAddress?: string
): ClassifiedTransaction[] {
    const txs = reportTxs(fromTs, toTs);

    return txs.map(tx => {
        const raw: TxRaw = {
            hash: tx.hash,
            block_number: tx.block_number,
            timestamp: tx.timestamp,
            from_addr: tx.from_addr,
            to_addr: tx.to_addr,
            value: tx.value,
            input: tx.input,
            status: tx.status,
            gas_used: tx.gas_used,
            gas_price: tx.gas_price,
            chain_id: tx.chain_id,
        };

        const decoded: Partial<TxDecoded> = {
            type: tx.type,
            token_in: tx.token_in,
            token_out: tx.token_out,
            amount_in: tx.amount_in,
            amount_out: tx.amount_out,
            counterparty: tx.counterparty,
            notes: tx.notes,
            decoded_json: tx.decoded_json,
        };

        return classifyTransaction(raw, decoded, userAddress);
    });
}

/**
 * Filter transactions by category
 */
export function filterByCategory(
    transactions: ClassifiedTransaction[],
    category: TransactionCategory
): ClassifiedTransaction[] {
    return transactions.filter(tx => tx.category === category);
}

/**
 * Get high-risk transactions
 */
export function getHighRiskTransactions(
    transactions: ClassifiedTransaction[]
): ClassifiedTransaction[] {
    return transactions.filter(tx => tx.isHighRisk);
}

/**
 * Group transactions by token
 */
export function groupByToken(
    transactions: ClassifiedTransaction[]
): Map<string, ClassifiedTransaction[]> {
    const grouped = new Map<string, ClassifiedTransaction[]>();

    for (const tx of transactions) {
        if (!tx.token) continue;

        if (!grouped.has(tx.token)) {
            grouped.set(tx.token, []);
        }
        grouped.get(tx.token)!.push(tx);
    }

    return grouped;
}

/**
 * Get top counterparties by transaction count
 */
export function getTopCounterparties(
    transactions: ClassifiedTransaction[],
    limit: number = 5
): Array<{ address: string; count: number }> {
    const counterpartyCounts = new Map<string, number>();

    for (const tx of transactions) {
        if (!tx.counterparty) continue;

        const count = counterpartyCounts.get(tx.counterparty) || 0;
        counterpartyCounts.set(tx.counterparty, count + 1);
    }

    return Array.from(counterpartyCounts.entries())
        .map(([address, count]) => ({ address, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
}
