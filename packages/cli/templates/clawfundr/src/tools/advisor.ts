import type { NormalizedBalance } from './chain';
import type { ClassifiedTransaction } from './history';
import { getPolicy } from '../config/policy';
import {
    filterByCategory,
    getHighRiskTransactions,
    TransactionCategory,
} from './history';

/**
 * Recommendation action types
 */
export enum RecommendationAction {
    HOLD = 'HOLD',
    REBALANCE = 'REBALANCE',
    REVIEW_APPROVALS = 'REVIEW_APPROVALS',
    REDUCE_EXPOSURE = 'REDUCE_EXPOSURE',
    INCREASE_STABLE = 'INCREASE_STABLE',
    EXERCISE_CAUTION = 'EXERCISE_CAUTION',
}

/**
 * Recommendation structure
 */
export interface Recommendation {
    action: RecommendationAction;
    token?: string;
    amount?: string;
    reason: string;
    riskScore: number; // 0-100
    requiresConfirmation: boolean;
    details?: string;
}

/**
 * Advisor analysis result
 */
export interface AdvisorAnalysis {
    recommendations: Recommendation[];
    summary: string;
    portfolioHealth: {
        stableRatio: number;
        targetStableRatio: number;
        maxAssetExposure: number;
        maxExposureLimit: number;
        totalValueUsd?: number;
    };
    risks: {
        unlimitedApprovals: number;
        highExposureAssets: string[];
        unusualActivity: boolean;
    };
}

/**
 * Portfolio composition
 */
interface PortfolioComposition {
    totalValueUsd: number;
    stableValueUsd: number;
    assetExposures: Map<string, number>; // token -> ratio (0-1)
}

/**
 * Stablecoin symbols
 */
const STABLECOINS = ['USDC', 'USDT', 'DAI', 'FRAX'];

/**
 * Check if token is a stablecoin
 */
function isStablecoin(token: string): boolean {
    return STABLECOINS.includes(token.toUpperCase());
}

/**
 * Calculate portfolio composition
 * Note: This is a simplified version. In production, you'd fetch real-time prices.
 */
function calculatePortfolioComposition(
    balances: NormalizedBalance[]
): PortfolioComposition {
    // Simplified: assume 1 USDC = $1, 1 ETH = $2500, 1 WETH = $2500
    const prices: Record<string, number> = {
        USDC: 1,
        USDT: 1,
        DAI: 1,
        FRAX: 1,
        ETH: 2500,
        WETH: 2500,
    };

    let totalValueUsd = 0;
    let stableValueUsd = 0;
    const assetValues = new Map<string, number>();

    for (const balance of balances) {
        const price = prices[balance.symbol] || 0;
        const valueUsd = parseFloat(balance.balanceFormatted) * price;

        totalValueUsd += valueUsd;
        assetValues.set(balance.symbol, valueUsd);

        if (isStablecoin(balance.symbol)) {
            stableValueUsd += valueUsd;
        }
    }

    // Calculate exposure ratios
    const assetExposures = new Map<string, number>();
    for (const [token, value] of assetValues.entries()) {
        if (totalValueUsd > 0) {
            assetExposures.set(token, value / totalValueUsd);
        }
    }

    return {
        totalValueUsd,
        stableValueUsd,
        assetExposures,
    };
}

/**
 * Analyze portfolio and generate recommendations
 */
export function analyzePortfolio(
    balances: NormalizedBalance[],
    recentActivity: ClassifiedTransaction[],
    activeApprovals: ClassifiedTransaction[]
): AdvisorAnalysis {
    const policy = getPolicy();
    const recommendations: Recommendation[] = [];

    // Calculate portfolio composition
    const portfolio = calculatePortfolioComposition(balances);
    const stableRatio = portfolio.totalValueUsd > 0
        ? portfolio.stableValueUsd / portfolio.totalValueUsd
        : 0;

    // Find max asset exposure
    let maxExposure = 0;
    let maxExposureToken = '';
    for (const [token, exposure] of portfolio.assetExposures.entries()) {
        if (exposure > maxExposure) {
            maxExposure = exposure;
            maxExposureToken = token;
        }
    }

    // Track risks
    const risks = {
        unlimitedApprovals: 0,
        highExposureAssets: [] as string[],
        unusualActivity: false,
    };

    // Rule 1: Check stable ratio
    const targetStableRatio = policy.targetStableRatio;
    const stableThreshold = 0.1; // 10% threshold

    if (stableRatio < targetStableRatio - stableThreshold) {
        const deficit = (targetStableRatio - stableRatio) * 100;
        recommendations.push({
            action: RecommendationAction.INCREASE_STABLE,
            reason: `Stablecoin ratio (${(stableRatio * 100).toFixed(1)}%) is below target (${(targetStableRatio * 100).toFixed(1)}%)`,
            riskScore: Math.min(Math.round(deficit * 2), 70),
            requiresConfirmation: true,
            details: `Consider converting some volatile assets to stablecoins to reach your target allocation.`,
        });
    }

    // Rule 2: Check unlimited approvals
    const highRiskApprovals = getHighRiskTransactions(activeApprovals);
    risks.unlimitedApprovals = highRiskApprovals.length;

    if (highRiskApprovals.length > 0) {
        recommendations.push({
            action: RecommendationAction.REVIEW_APPROVALS,
            reason: `${highRiskApprovals.length} unlimited approval(s) detected`,
            riskScore: 90,
            requiresConfirmation: true,
            details: `Unlimited approvals pose a security risk. Review and revoke unnecessary approvals.`,
        });
    }

    // Rule 3: Check asset exposure
    const maxExposureLimit = policy.maxExposurePerAsset;

    if (maxExposure > maxExposureLimit) {
        risks.highExposureAssets.push(maxExposureToken);
        const excessExposure = (maxExposure - maxExposureLimit) * 100;

        recommendations.push({
            action: RecommendationAction.REDUCE_EXPOSURE,
            token: maxExposureToken,
            reason: `${maxExposureToken} exposure (${(maxExposure * 100).toFixed(1)}%) exceeds limit (${(maxExposureLimit * 100).toFixed(1)}%)`,
            riskScore: Math.min(Math.round(excessExposure * 3), 85),
            requiresConfirmation: true,
            details: `Consider diversifying to reduce concentration risk.`,
        });
    }

    // Rule 4: Check for frequent approvals (unusual activity)
    const recentApprovals = filterByCategory(recentActivity, TransactionCategory.APPROVE);
    const approvalFrequency = recentApprovals.length / Math.max(recentActivity.length, 1);

    if (approvalFrequency > 0.3 && recentApprovals.length > 3) {
        risks.unusualActivity = true;

        recommendations.push({
            action: RecommendationAction.EXERCISE_CAUTION,
            reason: `High approval frequency detected (${recentApprovals.length} approvals in recent activity)`,
            riskScore: 60,
            requiresConfirmation: false,
            details: `Multiple approvals may indicate interaction with new protocols. Verify all contracts before approving.`,
        });
    }

    // Rule 5: If no issues, recommend HOLD
    if (recommendations.length === 0) {
        recommendations.push({
            action: RecommendationAction.HOLD,
            reason: 'Portfolio is well-balanced and within policy limits',
            riskScore: 10,
            requiresConfirmation: false,
            details: 'Your portfolio allocation aligns with your risk profile. Continue monitoring.',
        });
    }

    // Generate summary
    const summary = generateSummary(recommendations, portfolio, stableRatio, policy);

    return {
        recommendations,
        summary,
        portfolioHealth: {
            stableRatio,
            targetStableRatio,
            maxAssetExposure: maxExposure,
            maxExposureLimit,
            totalValueUsd: portfolio.totalValueUsd,
        },
        risks,
    };
}

/**
 * Generate banker-style explanation text
 */
function generateSummary(
    recommendations: Recommendation[],
    portfolio: PortfolioComposition,
    stableRatio: number,
    policy: any
): string {
    let summary = '📊 Portfolio Analysis\n\n';

    // Portfolio overview
    if (portfolio.totalValueUsd > 0) {
        summary += `Total Portfolio Value: $${portfolio.totalValueUsd.toFixed(2)}\n`;
        summary += `Stablecoin Allocation: ${(stableRatio * 100).toFixed(1)}% (Target: ${(policy.targetStableRatio * 100).toFixed(1)}%)\n\n`;
    }

    // Asset breakdown
    if (portfolio.assetExposures.size > 0) {
        summary += 'Asset Allocation:\n';
        const sortedAssets = Array.from(portfolio.assetExposures.entries())
            .sort((a, b) => b[1] - a[1]);

        for (const [token, exposure] of sortedAssets) {
            const percentage = (exposure * 100).toFixed(1);
            const indicator = exposure > policy.maxExposurePerAsset ? '⚠️' : '✓';
            summary += `  ${indicator} ${token}: ${percentage}%\n`;
        }
        summary += '\n';
    }

    // Recommendations
    summary += 'Recommendations:\n\n';

    for (let i = 0; i < recommendations.length; i++) {
        const rec = recommendations[i];
        const priority = rec.riskScore >= 70 ? '🔴 HIGH' : rec.riskScore >= 40 ? '🟡 MEDIUM' : '🟢 LOW';

        summary += `${i + 1}. [${priority}] ${rec.action}\n`;
        summary += `   ${rec.reason}\n`;

        if (rec.details) {
            summary += `   ${rec.details}\n`;
        }

        if (rec.token) {
            summary += `   Token: ${rec.token}\n`;
        }

        summary += '\n';
    }

    // Closing advice
    summary += '💡 Remember: This is automated analysis based on your policy settings. ';
    summary += 'Always conduct your own research before making investment decisions.\n';

    return summary;
}

/**
 * Quick portfolio health check
 */
export function quickHealthCheck(
    balances: NormalizedBalance[]
): {
    isHealthy: boolean;
    issues: string[];
    score: number; // 0-100
} {
    const policy = getPolicy();
    const portfolio = calculatePortfolioComposition(balances);
    const stableRatio = portfolio.totalValueUsd > 0
        ? portfolio.stableValueUsd / portfolio.totalValueUsd
        : 0;

    const issues: string[] = [];
    let score = 100;

    // Check stable ratio
    if (stableRatio < policy.targetStableRatio - 0.1) {
        issues.push('Stablecoin allocation below target');
        score -= 20;
    }

    // Check asset concentration
    for (const [token, exposure] of portfolio.assetExposures.entries()) {
        if (exposure > policy.maxExposurePerAsset) {
            issues.push(`High concentration in ${token}`);
            score -= 25;
        }
    }

    // Check if portfolio is too small
    if (portfolio.totalValueUsd < 100) {
        issues.push('Portfolio value very low');
        score -= 10;
    }

    return {
        isHealthy: issues.length === 0,
        issues,
        score: Math.max(score, 0),
    };
}

/**
 * Get recommendation priority
 */
export function getRecommendationPriority(riskScore: number): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (riskScore >= 70) return 'HIGH';
    if (riskScore >= 40) return 'MEDIUM';
    return 'LOW';
}
