import type {
  BenchmarkAggregate,
  BenchmarkCase,
  BenchmarkDataset,
  BenchmarkPrivacyApproval,
  BenchmarkRun,
} from '@/lib/benchmarks/benchmark-contract'

const identifier = /^[A-Za-z0-9._-]{1,96}$/
const version = /^[A-Za-z0-9._-]{1,32}$/
const caseId = /^[a-z0-9-]{1,64}$/
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const sha256 = /^[0-9a-f]{64}$/
const providers = new Set(['GEMINI', 'OPENAI', 'BEDROCK'])
const statuses = new Set(['RUNNING', 'COMPLETED', 'FAILED'])
const failures = new Set(['ALL_CASES_PROVIDER_FAILED', 'EXECUTION_FAILED'])

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('BENCHMARK_MALFORMED_RESPONSE')
  return value as Record<string, unknown>
}

function string(value: unknown, maximum = 10_000) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum)
    throw new Error('BENCHMARK_MALFORMED_RESPONSE')
  return value
}

function instant(value: unknown, nullable = false): string | null {
  if (nullable && value === null) return null
  const result = string(value, 64)
  if (Number.isNaN(Date.parse(result)))
    throw new Error('BENCHMARK_MALFORMED_RESPONSE')
  return result
}

function integer(
  value: unknown,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
) {
  if (
    !Number.isInteger(value) ||
    (value as number) < minimum ||
    (value as number) > maximum
  )
    throw new Error('BENCHMARK_MALFORMED_RESPONSE')
  return value as number
}

function rate(value: unknown) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  )
    throw new Error('BENCHMARK_MALFORMED_RESPONSE')
  return value
}

function stringArray(value: unknown, maximum: number, allowEmpty = false) {
  if (
    !Array.isArray(value) ||
    (!allowEmpty && value.length === 0) ||
    value.length > maximum
  )
    throw new Error('BENCHMARK_MALFORMED_RESPONSE')
  return value.map((item) => string(item, 128))
}

export function parseBenchmarkCase(value: unknown): BenchmarkCase {
  const item = record(value)
  const id = string(item.id, 64)
  if (!caseId.test(id)) throw new Error('BENCHMARK_MALFORMED_RESPONSE')
  return {
    id,
    text: string(item.text),
    acceptableSuggestedActions: stringArray(
      item.acceptableSuggestedActions,
      20,
    ),
    requiredSignalTerms: stringArray(item.requiredSignalTerms, 100),
    forbiddenClaims: stringArray(item.forbiddenClaims, 100, true),
  }
}

export function parseBenchmarkCasesText(raw: string): readonly BenchmarkCase[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch {
    throw new Error('BENCHMARK_CASES_INVALID_JSON')
  }
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 200)
    throw new Error('BENCHMARK_CASES_INVALID_SCHEMA')
  try {
    return parsed.map(parseBenchmarkCase)
  } catch {
    throw new Error('BENCHMARK_CASES_INVALID_SCHEMA')
  }
}

function parsePrivacyApproval(value: unknown): BenchmarkPrivacyApproval {
  const item = record(value)
  const approvalId = string(item.approvalId, 36)
  const contentSha256 = string(item.contentSha256, 64)
  if (
    item.registry !== 'MB369_CURATED_REGISTRY' ||
    !uuid.test(approvalId) ||
    !sha256.test(contentSha256)
  )
    throw new Error('BENCHMARK_MALFORMED_RESPONSE')
  return {
    registry: 'MB369_CURATED_REGISTRY',
    approvalId,
    approvedBy: string(item.approvedBy, 128),
    approvedAt: instant(item.approvedAt)!,
    contentSha256,
  }
}

export function parseBenchmarkDataset(value: unknown): BenchmarkDataset {
  const item = record(value)
  const datasetId = string(item.datasetId, 96)
  const datasetVersion = string(item.version, 32)
  const digest = string(item.sha256, 64)
  if (
    !identifier.test(datasetId) ||
    !version.test(datasetVersion) ||
    !sha256.test(digest) ||
    item.workload !== 'EXACT_REVISION' ||
    item.language !== 'vi' ||
    item.source !== 'MENTALBRIDGE_SYNTHETIC_V1' ||
    item.license !== 'CC0-1.0'
  )
    throw new Error('BENCHMARK_MALFORMED_RESPONSE')
  const previousVersion = item.previousVersion
  if (
    previousVersion !== null &&
    (typeof previousVersion !== 'string' || !version.test(previousVersion))
  )
    throw new Error('BENCHMARK_MALFORMED_RESPONSE')
  const parsed: BenchmarkDataset = {
    datasetId,
    version: datasetVersion,
    workload: 'EXACT_REVISION',
    language: 'vi',
    source: 'MENTALBRIDGE_SYNTHETIC_V1',
    license: 'CC0-1.0',
    description: string(item.description, 300),
    sha256: digest,
    caseCount: integer(item.caseCount, 1, 200),
    registeredAt: instant(item.registeredAt)!,
    archivedAt: instant(item.archivedAt, true),
    previousVersion,
    privacyApproval: parsePrivacyApproval(item.privacyApproval),
  }
  if (item.cases !== undefined) {
    if (!Array.isArray(item.cases) || item.cases.length !== parsed.caseCount)
      throw new Error('BENCHMARK_MALFORMED_RESPONSE')
    return { ...parsed, cases: item.cases.map(parseBenchmarkCase) }
  }
  return parsed
}

function parseAggregate(value: unknown): BenchmarkAggregate {
  const item = record(value)
  if (!providers.has(String(item.provider)))
    throw new Error('BENCHMARK_MALFORMED_RESPONSE')
  const caseCount = integer(item.caseCount, 1, 200)
  const successCount = integer(item.successCount, 0, caseCount)
  const errorCount = integer(item.errorCount, 0, caseCount)
  if (successCount + errorCount !== caseCount)
    throw new Error('BENCHMARK_MALFORMED_RESPONSE')
  return {
    provider: item.provider as BenchmarkAggregate['provider'],
    model: string(item.model, 128),
    caseCount,
    successCount,
    errorCount,
    qualityPassRate: rate(item.qualityPassRate),
    safetyPassRate: rate(item.safetyPassRate),
    averageQualityScore: rate(item.averageQualityScore),
    averageLatencyMs:
      item.averageLatencyMs === null ? null : integer(item.averageLatencyMs, 0),
    totalInputTokens: integer(item.totalInputTokens, 0),
    totalOutputTokens: integer(item.totalOutputTokens, 0),
    totalEstimatedCostMicroUsd: integer(item.totalEstimatedCostMicroUsd, 0),
  }
}

export function parseBenchmarkRun(value: unknown): BenchmarkRun {
  const item = record(value)
  const runId = string(item.runId, 36)
  const digest = string(item.datasetSha256, 64)
  const rubricDigest = string(item.rubricSha256, 64)
  if (
    !uuid.test(runId) ||
    !sha256.test(digest) ||
    !sha256.test(rubricDigest) ||
    !statuses.has(String(item.status))
  )
    throw new Error('BENCHMARK_MALFORMED_RESPONSE')
  if (
    item.failureClassification !== null &&
    !failures.has(String(item.failureClassification))
  )
    throw new Error('BENCHMARK_MALFORMED_RESPONSE')
  if (
    !Array.isArray(item.candidates) ||
    item.candidates.length < 1 ||
    item.candidates.length > 3
  )
    throw new Error('BENCHMARK_MALFORMED_RESPONSE')
  const candidates = item.candidates.map((candidate) => {
    const parsed = record(candidate)
    if (!providers.has(String(parsed.provider)))
      throw new Error('BENCHMARK_MALFORMED_RESPONSE')
    return {
      provider: String(parsed.provider),
      model: string(parsed.model, 128),
    }
  })
  if (!Array.isArray(item.aggregates) || item.aggregates.length > 3)
    throw new Error('BENCHMARK_MALFORMED_RESPONSE')
  return {
    runId,
    datasetId: string(item.datasetId, 96),
    datasetVersion: string(item.datasetVersion, 32),
    datasetSha256: digest,
    promptVersion: string(item.promptVersion, 96),
    rubricVersion: string(item.rubricVersion, 96),
    rubricSha256: rubricDigest,
    status: item.status as BenchmarkRun['status'],
    failureClassification:
      item.failureClassification as BenchmarkRun['failureClassification'],
    candidates,
    aggregates: item.aggregates.map(parseAggregate),
    startedAt: instant(item.startedAt)!,
    completedAt: instant(item.completedAt, true),
  }
}

export function parseDatasetPage(value: unknown) {
  const page = record(value)
  if (!Array.isArray(page.data) || page.data.length > 100)
    throw new Error('BENCHMARK_MALFORMED_RESPONSE')
  return page.data.map(parseBenchmarkDataset)
}

export function parseRunPage(value: unknown) {
  const page = record(value)
  if (!Array.isArray(page.data) || page.data.length > 100)
    throw new Error('BENCHMARK_MALFORMED_RESPONSE')
  return page.data.map(parseBenchmarkRun)
}

export function parseBenchmarkExport(value: unknown): Record<string, unknown> {
  const item = record(value)
  const allowed = new Set([
    'exportVersion',
    'runId',
    'dataset',
    'promptVersion',
    'rubricVersion',
    'rubricSha256',
    'candidates',
    'startedAt',
    'completedAt',
    'status',
    'failureClassification',
    'aggregates',
  ])
  if (
    Object.keys(item).some((key) => !allowed.has(key)) ||
    item.exportVersion !== 'benchmark-aggregate-v1'
  )
    throw new Error('BENCHMARK_MALFORMED_RESPONSE')
  const dataset = record(item.dataset)
  parseBenchmarkRun({
    runId: item.runId,
    datasetId: dataset.datasetId,
    datasetVersion: dataset.version,
    datasetSha256: dataset.sha256,
    promptVersion: item.promptVersion,
    rubricVersion: item.rubricVersion,
    rubricSha256: item.rubricSha256,
    status: item.status,
    failureClassification: item.failureClassification,
    candidates: item.candidates,
    aggregates: item.aggregates,
    startedAt: item.startedAt,
    completedAt: item.completedAt,
  })
  return item
}
