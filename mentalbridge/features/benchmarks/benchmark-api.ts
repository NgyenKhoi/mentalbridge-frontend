import type {
  BenchmarkCase,
  BenchmarkDataset,
  BenchmarkRun,
  CreateBenchmarkDataset,
  RunBenchmark,
} from '@/lib/benchmarks/benchmark-contract'

async function request<T>(
  path: string,
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
  return body as T
}

export const benchmarkApi = {
  datasets: () =>
    request<{ data: BenchmarkDataset[] }>('datasets').then((page) => page.data),
  dataset: (datasetId: string, version: string) =>
    request<BenchmarkDataset & { cases: readonly BenchmarkCase[] }>(
      `datasets/${encodeURIComponent(datasetId)}/versions/${encodeURIComponent(version)}`,
    ),
  create: (body: CreateBenchmarkDataset, key: string) =>
    request<BenchmarkDataset>('datasets', { body, key }),
  createVersion: (
    datasetId: string,
    sourceVersion: string,
    body: Readonly<{
      version: string
      description: string
      cases: readonly BenchmarkCase[]
    }>,
    key: string,
  ) =>
    request<BenchmarkDataset>(
      `datasets/${encodeURIComponent(datasetId)}/versions/${encodeURIComponent(sourceVersion)}`,
      { body, key },
    ),
  archive: (datasetId: string, version: string, key: string) =>
    request<BenchmarkDataset>(
      `datasets/${encodeURIComponent(datasetId)}/versions/${encodeURIComponent(version)}/archive`,
      { body: {}, key },
    ),
  runs: () =>
    request<{ data: BenchmarkRun[] }>('runs').then((page) => page.data),
  run: (body: RunBenchmark, key: string) =>
    request<BenchmarkRun>('runs', { body, key }),
  exportRun: (runId: string) =>
    request<Record<string, unknown>>(
      `runs/${encodeURIComponent(runId)}/export`,
    ),
}
