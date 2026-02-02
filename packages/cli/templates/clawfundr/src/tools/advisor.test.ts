import { describe, it, expect, beforeEach } from 'vitest';
import {
    analyzePortfolio,
    quickHealthCheck,
    getRecommendationPriority,
    RecommendationAction,
    type Recommendation,
} from './advisor';
import type { NormalizedBalance } from './chain';
import type { ClassifiedTransaction } from './history';
import { TransactionCategory } from './history';

describe('Rule-Based Advisor', () => {
    describe('Stable Ratio Rule', () => {
        it('should recommend increasing stables when below target', () => {
            const balances: NormalizedBalance[] = [
                {
                    token: 'ETH',
                    symbol: 'ETH',
                    balance: '1000000000000000000', // 1 ETH
                    balanceFormatted: '1.0',
                    decimals: 18,
                },
                {
                    token: 'USDC',
                    symbol: 'USDC',
                    balance: '500000000', // 500 USDC
                    balanceFormatted: '500.0',
                    decimals: 6,
                },
            ];

            // Portfolio: 1 ETH ($2500) + 500 USDC ($500) = $3000 total
            // Stable ratio: 500/3000 = 16.7%
            // Target: 50% (from policy)
            // Should recommend increasing stables

            const analysis = analyzePortfolio(balances, [], []);

            const increaseStableRec = analysis.recommendations.find(
                r => r.action === RecommendationAction.INCREASE_STABLE
            );

            expect(increaseStableRec).toBeDefined();
            expect(increaseStableRec?.riskScore).toBeGreaterThan(0);
            expect(increaseStableRec?.requiresConfirmation).toBe(true);
        });

        it('should not recommend increasing stables when at target', () => {
            const balances: NormalizedBalance[] = [
                {
                    token: 'ETH',
                    symbol: 'ETH',
                    balance: '500000000000000000', // 0.5 ETH
                    balanceFormatted: '0.5',
                    decimals: 18,
                },
                {
                    token: 'USDC',
                    symbol: 'USDC',
                    balance: '1250000000', // 1250 USDC
                    balanceFormatted: '1250.0',
                    decimals: 6,
                },
            ];

            // Portfolio: 0.5 ETH ($1250) + 1250 USDC ($1250) = $2500 total
            // Stable ratio: 1250/2500 = 50% (at target)

            const analysis = analyzePortfolio(balances, [], []);

            const increaseStableRec = analysis.recommendations.find(
                r => r.action === RecommendationAction.INCREASE_STABLE
            );

            expect(increaseStableRec).toBeUndefined();
        });
    });

    describe('Unlimited Approval Rule', () => {
        it('should recommend reviewing unlimited approvals', () => {
            const balances: NormalizedBalance[] = [
                {
                    token: 'USDC',
                    symbol: 'USDC',
                    balance: '1000000000',
                    balanceFormatted: '1000.0',
                    decimals: 6,
                },
            ];

            const activeApprovals: ClassifiedTransaction[] = [
                {
                    hash: '0xabc123',
                    category: TransactionCategory.APPROVE,
                    timestamp: Date.now() / 1000,
                    token: 'USDC',
                    isHighRisk: true,
                    riskReason: 'Unlimited approval granted',
                },
            ];

            const analysis = analyzePortfolio(balances, [], activeApprovals);

            const reviewApprovalsRec = analysis.recommendations.find(
                r => r.action === RecommendationAction.REVIEW_APPROVALS
            );

            expect(reviewApprovalsRec).toBeDefined();
            expect(reviewApprovalsRec?.riskScore).toBe(90);
            expect(reviewApprovalsRec?.requiresConfirmation).toBe(true);
            expect(analysis.risks.unlimitedApprovals).toBe(1);
        });

        it('should not recommend reviewing when no unlimited approvals', () => {
            const balances: NormalizedBalance[] = [
                {
                    token: 'USDC',
                    symbol: 'USDC',
                    balance: '1000000000',
                    balanceFormatted: '1000.0',
                    decimals: 6,
                },
            ];

            const activeApprovals: ClassifiedTransaction[] = [
                {
                    hash: '0xabc123',
                    category: TransactionCategory.APPROVE,
                    timestamp: Date.now() / 1000,
                    token: 'USDC',
                    isHighRisk: false,
                },
            ];

            const analysis = analyzePortfolio(balances, [], activeApprovals);

            const reviewApprovalsRec = analysis.recommendations.find(
                r => r.action === RecommendationAction.REVIEW_APPROVALS
            );

            expect(reviewApprovalsRec).toBeUndefined();
        });
    });

    describe('Asset Exposure Rule', () => {
        it('should recommend reducing exposure when over limit', () => {
            const balances: NormalizedBalance[] = [
                {
                    token: 'ETH',
                    symbol: 'ETH',
                    balance: '2000000000000000000', // 2 ETH
                    balanceFormatted: '2.0',
                    decimals: 18,
                },
                {
                    token: 'USDC',
                    symbol: 'USDC',
                    balance: '500000000', // 500 USDC
                    balanceFormatted: '500.0',
                    decimals: 6,
                },
            ];

            // Portfolio: 2 ETH ($5000) + 500 USDC ($500) = $5500 total
            // ETH exposure: 5000/5500 = 90.9%
            // Max exposure limit: 30% (from policy)
            // Should recommend reducing ETH exposure

            const analysis = analyzePortfolio(balances, [], []);

            const reduceExposureRec = analysis.recommendations.find(
                r => r.action === RecommendationAction.REDUCE_EXPOSURE
            );

            expect(reduceExposureRec).toBeDefined();
            expect(reduceExposureRec?.token).toBe('ETH');
            expect(reduceExposureRec?.riskScore).toBeGreaterThan(0);
            expect(analysis.risks.highExposureAssets).toContain('ETH');
        });

        it('should not recommend reducing exposure when within limits', () => {
            const balances: NormalizedBalance[] = [
                {
                    token: 'ETH',
                    symbol: 'ETH',
                    balance: '200000000000000000', // 0.2 ETH
                    balanceFormatted: '0.2',
                    decimals: 18,
                },
                {
                    token: 'USDC',
                    symbol: 'USDC',
                    balance: '1500000000', // 1500 USDC
                    balanceFormatted: '1500.0',
                    decimals: 6,
                },
                {
                    token: 'WETH',
                    symbol: 'WETH',
                    balance: '200000000000000000', // 0.2 WETH
                    balanceFormatted: '0.2',
                    decimals: 18,
                },
            ];

            // Portfolio well-diversified, no single asset > 30%

            const analysis = analyzePortfolio(balances, [], []);

            const reduceExposureRec = analysis.recommendations.find(
                r => r.action === RecommendationAction.REDUCE_EXPOSURE
            );

            expect(reduceExposureRec).toBeUndefined();
        });
    });

    describe('Frequent Approvals Rule', () => {
        it('should recommend caution with frequent approvals', () => {
            const balances: NormalizedBalance[] = [
                {
                    token: 'USDC',
                    symbol: 'USDC',
                    balance: '1000000000',
                    balanceFormatted: '1000.0',
                    decimals: 6,
                },
            ];

            const recentActivity: ClassifiedTransaction[] = [
                {
                    hash: '0x1',
                    category: TransactionCategory.APPROVE,
                    timestamp: Date.now() / 1000,
                    isHighRisk: false,
                },
                {
                    hash: '0x2',
                    category: TransactionCategory.APPROVE,
                    timestamp: Date.now() / 1000,
                    isHighRisk: false,
                },
                {
                    hash: '0x3',
                    category: TransactionCategory.APPROVE,
                    timestamp: Date.now() / 1000,
                    isHighRisk: false,
                },
                {
                    hash: '0x4',
                    category: TransactionCategory.APPROVE,
                    timestamp: Date.now() / 1000,
                    isHighRisk: false,
                },
                {
                    hash: '0x5',
                    category: TransactionCategory.TRANSFER_IN,
                    timestamp: Date.now() / 1000,
                    isHighRisk: false,
                },
            ];

            // 4 approvals out of 5 transactions = 80% approval frequency

            const analysis = analyzePortfolio(balances, recentActivity, []);

            const cautionRec = analysis.recommendations.find(
                r => r.action === RecommendationAction.EXERCISE_CAUTION
            );

            expect(cautionRec).toBeDefined();
            expect(cautionRec?.riskScore).toBe(60);
            expect(analysis.risks.unusualActivity).toBe(true);
        });

        it('should not recommend caution with normal activity', () => {
            const balances: NormalizedBalance[] = [
                {
                    token: 'USDC',
                    symbol: 'USDC',
                    balance: '1000000000',
                    balanceFormatted: '1000.0',
                    decimals: 6,
                },
            ];

            const recentActivity: ClassifiedTransaction[] = [
                {
                    hash: '0x1',
                    category: TransactionCategory.TRANSFER_IN,
                    timestamp: Date.now() / 1000,
                    isHighRisk: false,
                },
                {
                    hash: '0x2',
                    category: TransactionCategory.TRANSFER_OUT,
                    timestamp: Date.now() / 1000,
                    isHighRisk: false,
                },
                {
                    hash: '0x3',
                    category: TransactionCategory.APPROVE,
                    timestamp: Date.now() / 1000,
                    isHighRisk: false,
                },
            ];

            // 1 approval out of 3 transactions = 33% (borderline but only 1 approval)

            const analysis = analyzePortfolio(balances, recentActivity, []);

            const cautionRec = analysis.recommendations.find(
                r => r.action === RecommendationAction.EXERCISE_CAUTION
            );

            expect(cautionRec).toBeUndefined();
        });
    });

    describe('HOLD Recommendation', () => {
        it('should recommend HOLD when portfolio is healthy', () => {
            const balances: NormalizedBalance[] = [
                {
                    token: 'ETH',
                    symbol: 'ETH',
                    balance: '400000000000000000', // 0.4 ETH
                    balanceFormatted: '0.4',
                    decimals: 18,
                },
                {
                    token: 'USDC',
                    symbol: 'USDC',
                    balance: '1000000000', // 1000 USDC
                    balanceFormatted: '1000.0',
                    decimals: 6,
                },
                {
                    token: 'WETH',
                    symbol: 'WETH',
                    balance: '400000000000000000', // 0.4 WETH
                    balanceFormatted: '0.4',
                    decimals: 18,
                },
            ];

            // Portfolio: 0.4 ETH ($1000) + 1000 USDC ($1000) + 0.4 WETH ($1000) = $3000
            // Stable ratio: 1000/3000 = 33.3% (close to 50% target, within threshold)
            // Max exposure: 33.3% (within 30% limit with threshold)
            // Well-balanced portfolio

            const analysis = analyzePortfolio(balances, [], []);

            const holdRec = analysis.recommendations.find(
                r => r.action === RecommendationAction.HOLD
            );

            expect(holdRec).toBeDefined();
            expect(holdRec?.riskScore).toBe(10);
            expect(holdRec?.requiresConfirmation).toBe(false);
        });
    });

    describe('Quick Health Check', () => {
        it('should return healthy for balanced portfolio', () => {
            const balances: NormalizedBalance[] = [
                {
                    token: 'ETH',
                    symbol: 'ETH',
                    balance: '400000000000000000',
                    balanceFormatted: '0.4',
                    decimals: 18,
                },
                {
                    token: 'USDC',
                    symbol: 'USDC',
                    balance: '1000000000',
                    balanceFormatted: '1000.0',
                    decimals: 6,
                },
                {
                    token: 'WETH',
                    symbol: 'WETH',
                    balance: '400000000000000000',
                    balanceFormatted: '0.4',
                    decimals: 18,
                },
            ];

            const health = quickHealthCheck(balances);

            expect(health.isHealthy).toBe(true);
            expect(health.issues).toHaveLength(0);
            expect(health.score).toBeGreaterThan(80);
        });

        it('should detect issues in unbalanced portfolio', () => {
            const balances: NormalizedBalance[] = [
                {
                    token: 'ETH',
                    symbol: 'ETH',
                    balance: '2000000000000000000', // 2 ETH
                    balanceFormatted: '2.0',
                    decimals: 18,
                },
                {
                    token: 'USDC',
                    symbol: 'USDC',
                    balance: '100000000', // 100 USDC
                    balanceFormatted: '100.0',
                    decimals: 6,
                },
            ];

            // High ETH concentration, low stable ratio

            const health = quickHealthCheck(balances);

            expect(health.isHealthy).toBe(false);
            expect(health.issues.length).toBeGreaterThan(0);
            expect(health.score).toBeLessThan(100);
        });
    });

    describe('Recommendation Priority', () => {
        it('should classify risk scores correctly', () => {
            expect(getRecommendationPriority(90)).toBe('HIGH');
            expect(getRecommendationPriority(70)).toBe('HIGH');
            expect(getRecommendationPriority(60)).toBe('MEDIUM');
            expect(getRecommendationPriority(40)).toBe('MEDIUM');
            expect(getRecommendationPriority(30)).toBe('LOW');
            expect(getRecommendationPriority(10)).toBe('LOW');
        });
    });

    describe('Summary Generation', () => {
        it('should generate comprehensive summary', () => {
            const balances: NormalizedBalance[] = [
                {
                    token: 'ETH',
                    symbol: 'ETH',
                    balance: '1000000000000000000',
                    balanceFormatted: '1.0',
                    decimals: 18,
                },
                {
                    token: 'USDC',
                    symbol: 'USDC',
                    balance: '500000000',
                    balanceFormatted: '500.0',
                    decimals: 6,
                },
            ];

            const analysis = analyzePortfolio(balances, [], []);

            expect(analysis.summary).toContain('Portfolio Analysis');
            expect(analysis.summary).toContain('Total Portfolio Value');
            expect(analysis.summary).toContain('Stablecoin Allocation');
            expect(analysis.summary).toContain('Asset Allocation');
            expect(analysis.summary).toContain('Recommendations');
        });
    });
});
