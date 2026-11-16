import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminBenchmarkGovernance from './AdminBenchmarkGovernance'

const dataset = {
  datasetId: 'synthetic-safety',
  version: 'v1',
  workload: 'EXACT_REVISION' as const,
  language: 'vi' as const,
  source: 'MENTALBRIDGE_SYNTHETIC_V1' as const,
  license: 'CC0-1.0' as const,
  description: 'Approved synthetic fixture',
  sha256: 'a'.repeat(64),
  caseCount: 1,
  registeredAt: '2026-11-16T00:00:00Z',
  archivedAt: null,
  previousVersion: null,
  privacyApproval: {
    registry: 'MB369_CURATED_REGISTRY' as const,
    approvalId: '4b5fcd4b-ed59-4a6a-8848-b5a6125c99b2',
    approvedBy: 'privacy-owner',
    approvedAt: '2026-11-16T00:00:00Z',
    contentSha256: 'b'.repeat(64),
  },
}

const failedRun = {
  runId: '6b5fcd4b-ed59-4a6a-8848-b5a6125c99b3',
  datasetId: dataset.datasetId,
  datasetVersion: dataset.version,
  datasetSha256: dataset.sha256,
  promptVersion: 'exact-revision-v1',
  rubricVersion: 'exact-revision-rubric-v1',
  rubricSha256: 'c'.repeat(64),
  status: 'FAILED' as const,
  failureClassification: 'ALL_CASES_PROVIDER_FAILED' as const,
  candidates: [{ provider: 'GEMINI', model: 'gemini-2.5-flash' }],
  aggregates: [
    {
      provider: 'GEMINI',
      model: 'gemini-2.5-flash',
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

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input)
      if (path.endsWith('/datasets') && !init?.body)
        return Response.json({ data: [dataset] })
      if (path.endsWith('/runs') && !init?.body)
        return Response.json({ data: [] })
      if (path.includes('/versions/v1'))
        return Response.json({
          ...dataset,
          cases: [
            {
              id: 'case-one',
              text: 'Tình huống tổng hợp.',
              acceptableSuggestedActions: ['NONE'],
              requiredSignalTerms: ['tổng hợp'],
              forbiddenClaims: [],
            },
          ],
        })
      return Response.json(dataset, {
        status: init?.method === 'POST' ? 201 : 200,
      })
    }),
  )
})

describe('AdminBenchmarkGovernance', () => {
  it('shows immutable provenance and blocks run until a version is selected', async () => {
    render(<AdminBenchmarkGovernance />)
    expect(await screen.findByText('synthetic-safety')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Chạy benchmark' }),
    ).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /synthetic-safety/i }))
    await waitFor(() =>
      expect(screen.getByText(/synthetic-safety · v1 ·/)).toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: 'Chạy benchmark' })).toBeEnabled()
    expect(screen.getByText(/SHA aaaaaaaaaaaa/)).toBeInTheDocument()
  })

  it('fails closed and clears retained admin records after a denied refresh', async () => {
    const fetchMock = vi.mocked(fetch)
    render(<AdminBenchmarkGovernance />)
    expect(await screen.findByText('synthetic-safety')).toBeInTheDocument()
    fetchMock.mockImplementation(async () =>
      Response.json({ code: 'FORBIDDEN' }, { status: 403 }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('FORBIDDEN')
    expect(screen.queryByText('synthetic-safety')).not.toBeInTheDocument()
  })

  it.each(['null', '{}', '"hello"', '{invalid'])(
    'keeps the visible raw case text and disables save for invalid JSON: %s',
    async (raw) => {
      render(<AdminBenchmarkGovernance />)
      await screen.findByText('synthetic-safety')
      const editor = screen.getByRole('textbox', { name: 'Ca kiểm thử (JSON)' })
      fireEvent.change(editor, { target: { value: raw } })
      expect(editor).toHaveValue(raw)
      expect(
        screen.getByRole('button', { name: 'Lưu bất biến' }),
      ).toBeDisabled()
      expect(screen.getByRole('alert')).toHaveTextContent(/BENCHMARK_CASES/)
    },
  )

  it('requires archive confirmation and disables the selected archived version', async () => {
    const fetchMock = vi.mocked(fetch)
    let archivedAt: string | null = null
    fetchMock.mockImplementation(async (input, init) => {
      const path = String(input)
      if (path.endsWith('/datasets') && !init?.body)
        return Response.json({ data: [{ ...dataset, archivedAt }] })
      if (path.endsWith('/runs') && !init?.body)
        return Response.json({ data: [] })
      if (path.endsWith('/versions/v1') && !init?.body)
        return Response.json({
          ...dataset,
          cases: [
            {
              id: 'case-one',
              text: 'Tình huống tổng hợp.',
              acceptableSuggestedActions: ['NONE'],
              requiredSignalTerms: ['tổng hợp'],
              forbiddenClaims: [],
            },
          ],
        })
      if (path.endsWith('/versions/v1/archive')) {
        archivedAt = '2026-11-16T01:00:00Z'
        return Response.json({
          ...dataset,
          archivedAt,
        })
      }
      throw new Error(`Unexpected request ${path}`)
    })
    render(<AdminBenchmarkGovernance />)
    await screen.findByText('synthetic-safety')
    fireEvent.click(screen.getByRole('button', { name: /synthetic-safety/i }))
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Chạy benchmark' }),
      ).toBeEnabled(),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Lưu trữ' }))
    expect(screen.getByRole('dialog')).toHaveTextContent(
      'synthetic-safety · v1',
    )
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        String(input).endsWith('/archive'),
      ),
    ).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận lưu trữ' }))
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Chạy benchmark' }),
      ).toBeDisabled(),
    )
  })

  it('does not present an all-provider-failed terminal run as success', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockImplementation(async (input, init) => {
      const path = String(input)
      if (path.endsWith('/datasets') && !init?.body)
        return Response.json({ data: [dataset] })
      if (path.endsWith('/runs') && !init?.body)
        return Response.json({ data: [] })
      if (path.endsWith('/runs') && init?.body)
        return Response.json(failedRun, { status: 202 })
      if (path.endsWith('/versions/v1'))
        return Response.json({
          ...dataset,
          cases: [
            {
              id: 'case-one',
              text: 'Tình huống tổng hợp.',
              acceptableSuggestedActions: ['NONE'],
              requiredSignalTerms: ['tổng hợp'],
              forbiddenClaims: [],
            },
          ],
        })
      throw new Error(`Unexpected request ${path}`)
    })
    render(<AdminBenchmarkGovernance />)
    await screen.findByText('synthetic-safety')
    fireEvent.click(screen.getByRole('button', { name: /synthetic-safety/i }))
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Chạy benchmark' }),
      ).toBeEnabled(),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Chạy benchmark' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'tất cả provider',
    )
    expect(
      screen.queryByText(/đã hoàn tất với provenance/i),
    ).not.toBeInTheDocument()
  })

  it('reuses a pending key for the same payload and rotates it after changed intent', async () => {
    const keys: string[] = []
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockImplementation(async (input, init) => {
      const path = String(input)
      if (path.endsWith('/datasets') && !init?.body)
        return Response.json({ data: [dataset] })
      if (path.endsWith('/runs') && !init?.body)
        return Response.json({ data: [] })
      if (path.endsWith('/versions/v1'))
        return Response.json({
          ...dataset,
          cases: [
            {
              id: 'case-one',
              text: 'Tình huống tổng hợp.',
              acceptableSuggestedActions: ['NONE'],
              requiredSignalTerms: ['tổng hợp'],
              forbiddenClaims: [],
            },
          ],
        })
      if (path.endsWith('/runs') && init?.body) {
        keys.push(new Headers(init.headers).get('Idempotency-Key') ?? '')
        throw new Error('network timeout')
      }
      throw new Error(`Unexpected request ${path}`)
    })
    render(<AdminBenchmarkGovernance />)
    await screen.findByText('synthetic-safety')
    fireEvent.click(screen.getByRole('button', { name: /synthetic-safety/i }))
    const runButton = await screen.findByRole('button', {
      name: 'Chạy benchmark',
    })
    await waitFor(() => expect(runButton).toBeEnabled())
    fireEvent.click(runButton)
    await waitFor(() => expect(keys).toHaveLength(1))
    await waitFor(() => expect(runButton).toBeEnabled())
    fireEvent.click(runButton)
    await waitFor(() => expect(keys).toHaveLength(2))
    expect(keys[1]).toBe(keys[0])
    await waitFor(() => expect(runButton).toBeEnabled())
    fireEvent.change(screen.getByRole('textbox', { name: 'Model' }), {
      target: { value: 'gemini-changed' },
    })
    fireEvent.click(runButton)
    await waitFor(() => expect(keys).toHaveLength(3))
    expect(keys[2]).not.toBe(keys[0])
  })
})
