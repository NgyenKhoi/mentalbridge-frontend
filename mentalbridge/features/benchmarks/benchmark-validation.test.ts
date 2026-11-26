import { describe, expect, it } from 'vitest'
import {
  parseBenchmarkCasesText,
  parseBenchmarkExport,
  parseBenchmarkRun,
} from './benchmark-validation'

const run = {
  runId: '4b5fcd4b-ed59-4a6a-8848-b5a6125c99b2',
  datasetId: 'synthetic-safety',
  datasetVersion: 'v1',
  datasetSha256: 'a'.repeat(64),
  promptVersion: 'exact-revision-v1',
  rubricVersion: 'exact-revision-rubric-v1',
  rubricSha256: 'b'.repeat(64),
  status: 'FAILED',
  failureClassification: 'ALL_CASES_PROVIDER_FAILED',
  candidates: [{ provider: 'BEDROCK', model: 'approved-model' }],
  aggregates: [
    {
      provider: 'BEDROCK',
      model: 'approved-model',
      caseCount: 1,
      successCount: 0,
      errorCount: 1,
      qualityPassRate: 0,
      safetyPassRate: 0,
      averageQualityScore: 0,
      averageLatencyMs: null,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalEstimatedCostMicroUsd: 0,
    },
  ],
  startedAt: '2026-11-16T00:00:00Z',
  completedAt: '2026-11-16T00:00:01Z',
}

describe('benchmark provider validation', () => {
  it.each(['null', '{}', '"hello"', '[{"id":"missing-fields"}]'])(
    'rejects invalid case JSON without retaining a stale parsed value: %s',
    (raw) => expect(() => parseBenchmarkCasesText(raw)).toThrow(),
  )

  it('accepts an authoritative all-provider-failed run classification', () => {
    expect(parseBenchmarkRun(run).failureClassification).toBe(
      'ALL_CASES_PROVIDER_FAILED',
    )
  })

  it('rejects malformed numerical ranges and unsafe export fields', () => {
    expect(() =>
      parseBenchmarkRun({
        ...run,
        aggregates: [{ ...run.aggregates[0], qualityPassRate: 2 }],
      }),
    ).toThrow('BENCHMARK_MALFORMED_RESPONSE')
    expect(() =>
      parseBenchmarkExport({
        exportVersion: 'benchmark-aggregate-v1',
        ...run,
        dataset: {
          datasetId: run.datasetId,
          version: run.datasetVersion,
          sha256: run.datasetSha256,
        },
        rawProviderOutput: 'must not be downloadable',
      }),
    ).toThrow('BENCHMARK_MALFORMED_RESPONSE')
  })
})
