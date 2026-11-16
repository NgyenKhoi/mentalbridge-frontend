export type BenchmarkCase = Readonly<{
  id: string
  text: string
  acceptableSuggestedActions: readonly string[]
  requiredSignalTerms: readonly string[]
  forbiddenClaims: readonly string[]
}>

export type BenchmarkPrivacyApproval = Readonly<{
  registry: 'MB369_CURATED_REGISTRY'
  approvalId: string
  approvedBy: string
  approvedAt: string
  contentSha256: string
}>

export type BenchmarkDataset = Readonly<{
  datasetId: string
  version: string
  workload: 'EXACT_REVISION'
  language: 'vi'
  source: 'MENTALBRIDGE_SYNTHETIC_V1'
  license: 'CC0-1.0'
  description: string
  sha256: string
  caseCount: number
  registeredAt: string
  archivedAt: string | null
  previousVersion: string | null
  privacyApproval: BenchmarkPrivacyApproval
  cases?: readonly BenchmarkCase[]
}>

export type BenchmarkAggregate = Readonly<{
  provider: 'GEMINI' | 'OPENAI' | 'BEDROCK'
  model: string
  caseCount: number
  successCount: number
  errorCount: number
  qualityPassRate: number
  safetyPassRate: number
  averageQualityScore: number
  averageLatencyMs: number | null
  totalInputTokens: number
  totalOutputTokens: number
  totalEstimatedCostMicroUsd: number
}>

export type BenchmarkRun = Readonly<{
  runId: string
  datasetId: string
  datasetVersion: string
  datasetSha256: string
  promptVersion: string
  rubricVersion: string
  rubricSha256: string
  status: 'RUNNING' | 'COMPLETED' | 'FAILED'
  failureClassification: 'ALL_CASES_PROVIDER_FAILED' | 'EXECUTION_FAILED' | null
  candidates: readonly Readonly<{ provider: string; model: string }>[]
  aggregates: readonly BenchmarkAggregate[]
  startedAt: string
  completedAt: string | null
}>

export type CreateBenchmarkDataset = Readonly<{
  datasetId: string
  version: string
  workload: 'EXACT_REVISION'
  language: 'vi'
  source: 'MENTALBRIDGE_SYNTHETIC_V1'
  license: 'CC0-1.0'
  description: string
  cases: readonly BenchmarkCase[]
  privacyApproval: BenchmarkPrivacyApproval
}>

export type RunBenchmark = Readonly<{
  datasetId: string
  datasetVersion: string
  provider: 'GEMINI' | 'OPENAI' | 'BEDROCK'
  model: string
}>
