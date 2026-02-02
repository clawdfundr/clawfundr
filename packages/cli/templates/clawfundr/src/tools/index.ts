/**
 * Chain tools module
 * Exports Base chain interaction functions
 */

export {
    getPublicClient,
    getNativeBalance,
    getErc20Balance,
    getBalances,
    syncErc20Logs,
    incrementalSync,
    getLastSyncedBlock,
    setLastSyncedBlock,
    getCurrentBlockNumber,
    type NormalizedBalance,
} from './chain';

export { ERC20_ABI } from './erc20-abi';

export {
    classifyTransaction,
    isUnlimitedApproval,
    getClassifiedHistory,
    getClassifiedPeriod,
    filterByCategory,
    getHighRiskTransactions,
    groupByToken,
    getTopCounterparties,
    TransactionCategory,
    type ClassifiedTransaction,
} from './history';

export {
    generatePeriodSummary,
    generateDailyReport,
    generateWeeklyReport,
    generateMonthlyReport,
    analyzeFlows,
    generateApprovalSummary,
    formatGasCost,
    formatTimestamp,
    type PeriodSummary,
    type FlowAnalysis,
    type ApprovalSummary,
} from './reports';

export {
    analyzePortfolio,
    quickHealthCheck,
    getRecommendationPriority,
    RecommendationAction,
    type Recommendation,
    type AdvisorAnalysis,
} from './advisor';

export {
    fetchWithX402,
    parseX402Requirement,
    validateX402Payment,
    formatPaymentProposal,
    type X402PaymentRequirement,
    type X402PaymentProposal,
    type X402FetchOptions,
    type X402FetchResult,
} from './x402';

export {
    generateMoltbookAgentMetadata,
    isMoltbookEnabled,
    formatMetadataForRegistration,
    printRegistrationInstructions,
    exportMetadataToFile,
    type MoltbookAgentMetadata,
} from './moltbook';
