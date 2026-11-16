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
})
