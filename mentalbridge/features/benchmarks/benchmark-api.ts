import type {
  BenchmarkCase,
  BenchmarkDataset,
  BenchmarkPrivacyApproval,
  CreateBenchmarkDataset,
  RunBenchmark,
} from '@/lib/benchmarks/benchmark-contract'
import {
  parseBenchmarkDataset,
  parseBenchmarkExport,
  parseBenchmarkRun,
  parseDatasetPage,
  parseRunPage,
} from './benchmark-validation'

async function request<T>(
  path: string,
  parse: (value: unknown) => T,
  options?: Readonly<{ body?: unknown; key?: string }>,
): Promise<T> {
  const response = await fetch(`/api/admin/ai-benchmarks/${path}`, {
    method: options?.body === undefined ? 'GET' : 'POST',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...(options?.body === undefined
        ? {}
        : {
            'Content-Type': 'application/json',
            'Idempotency-Key': options.key ?? crypto.randomUUID(),
          }),
    },
    ...(options?.body === undefined
      ? {}
      : { body: JSON.stringify(options.body) }),
  })
  const body = (await response.json()) as unknown
  if (!response.ok) {
    const problem = body as { code?: string; title?: string }
    throw new Error(problem.code ?? problem.title ?? 'BENCHMARK_REQUEST_FAILED')
  }
  return parse(body)
}

export const benchmarkApi = {
  datasets: () => request('datasets', parseDatasetPage),
  dataset: (datasetId: string, version: string) =>
    request(
      `datasets/${encodeURIComponent(datasetId)}/versions/${encodeURIComponent(version)}`,
      (value) => {
        const dataset = parseBenchmarkDataset(value)
        if (!dataset.cases) throw new Error('BENCHMARK_MALFORMED_RESPONSE')
        return dataset as BenchmarkDataset & { cases: readonly BenchmarkCase[] }
      },
    ),
  create: (body: CreateBenchmarkDataset, key: string) =>
    request('datasets', parseBenchmarkDataset, { body, key }),
  createVersion: (
    datasetId: string,
    sourceVersion: string,
    body: Readonly<{
      version: string
      description: string
      cases: readonly BenchmarkCase[]
      privacyApproval: BenchmarkPrivacyApproval
    }>,
    key: string,
  ) =>
    request(
      `datasets/${encodeURIComponent(datasetId)}/versions/${encodeURIComponent(sourceVersion)}`,
      parseBenchmarkDataset,
      { body, key },
    ),
  archive: (datasetId: string, version: string, key: string) =>
    request(
      `datasets/${encodeURIComponent(datasetId)}/versions/${encodeURIComponent(version)}/archive`,
      parseBenchmarkDataset,
      { body: {}, key },
    ),
  runs: () => request('runs', parseRunPage),
  run: (body: RunBenchmark, key: string) =>
    request('runs', parseBenchmarkRun, { body, key }),
  runDetail: (runId: string) =>
    request(`runs/${encodeURIComponent(runId)}`, parseBenchmarkRun),
  exportRun: (runId: string) =>
    request(`runs/${encodeURIComponent(runId)}/export`, parseBenchmarkExport),
}
