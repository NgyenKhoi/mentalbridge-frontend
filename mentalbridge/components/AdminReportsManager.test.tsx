import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import AdminReportsManager from './AdminReportsManager'

const catalogue = [
  {
    reportType: 'ACCOUNT_ACTIVITY',
    label: 'Account activity',
    description:
      'Aggregate account creations by role and current lifecycle state.',
    scopeVersion: 'platform-account-activity-report-v1',
    maximumPeriodDays: 366,
  },
]

const completed = {
  reportId: '94464b2b-a7fd-46fd-9310-64ef4eac7de7',
  reportType: 'ACCOUNT_ACTIVITY',
  scopeVersion: 'platform-account-activity-report-v1',
  periodStart: '2026-09-01',
  periodEnd: '2026-09-30',
  requestedBy: '82464b2b-a7fd-46fd-9310-64ef4eac7de7',
  requestedAt: '2026-10-01T00:00:00Z',
  status: 'COMPLETED',
  sourceVersions: { identityAccounts: 'identity-account-projection-v1' },
  retryOf: null,
  startedAt: '2026-10-01T00:00:01Z',
  completedAt: '2026-10-01T00:00:02Z',
  failedAt: null,
  failureCode: null,
  downloadable: true,
  fileName: 'account-activity.json',
  mediaType: 'application/json',
  contentLength: 200,
  contentSha256: 'a'.repeat(64),
  retainedUntil: '2026-10-31T00:00:02Z',
}

function json(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

describe('AdminReportsManager', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.endsWith('/catalogue')) return json(catalogue)
        if (init?.method === 'POST')
          return json(
            {
              ...completed,
              status: 'QUEUED',
              downloadable: false,
              fileName: null,
              mediaType: null,
              contentLength: null,
              contentSha256: null,
              retainedUntil: null,
              startedAt: null,
              completedAt: null,
            },
            202,
          )
        return json({ items: [completed], nextCursor: null })
      }),
    )
  })

  afterEach(() => vi.unstubAllGlobals())

  it('renders only authoritative catalogue and history values', async () => {
    render(<AdminReportsManager onNotice={vi.fn()} />)

    expect(
      await screen.findByRole('option', { name: 'Account activity' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Account activity').length).toBeGreaterThan(0)
    expect(screen.getByText('Hoàn tất')).toBeInTheDocument()
    expect(
      screen.getByText(/identity-account-projection-v1/),
    ).toBeInTheDocument()
    expect(screen.queryByText('8.742')).not.toBeInTheDocument()
    expect(screen.queryByText('486,2 tr')).not.toBeInTheDocument()
  })

  it('submits a bounded report request with an idempotency key', async () => {
    const notice = vi.fn()
    const user = userEvent.setup()
    render(<AdminReportsManager onNotice={notice} />)
    await screen.findByRole('option', { name: 'Account activity' })

    await user.click(screen.getByRole('button', { name: '+ Tạo báo cáo' }))

    await waitFor(() =>
      expect(notice).toHaveBeenCalledWith('Báo cáo đã được đưa vào hàng đợi.'),
    )
    const call = vi
      .mocked(fetch)
      .mock.calls.find(([, options]) => options?.method === 'POST')
    expect(call).toBeDefined()
    expect(new Headers(call?.[1]?.headers).get('Idempotency-Key')).toMatch(
      /^platform-report-/,
    )
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
      reportType: 'ACCOUNT_ACTIVITY',
    })
  })

  it('reuses the create key after an ambiguous failure', async () => {
    let postAttempts = 0
    vi.mocked(fetch).mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.endsWith('/catalogue')) return json(catalogue)
        if (init?.method === 'POST') {
          postAttempts += 1
          if (postAttempts === 1)
            return Promise.reject(new Error('network response lost'))
          return json(
            {
              ...completed,
              status: 'QUEUED',
              downloadable: false,
              fileName: null,
              mediaType: null,
              contentLength: null,
              contentSha256: null,
              retainedUntil: null,
              startedAt: null,
              completedAt: null,
            },
            202,
          )
        }
        return json({ items: [], nextCursor: null })
      },
    )
    const user = userEvent.setup()
    render(<AdminReportsManager onNotice={vi.fn()} />)
    await screen.findByRole('option', { name: 'Account activity' })

    const submit = screen.getByRole('button', { name: '+ Tạo báo cáo' })
    await user.click(submit)
    expect(await screen.findByText('network response lost')).toBeInTheDocument()
    await user.click(submit)

    await waitFor(() => expect(postAttempts).toBe(2))
    const keys = vi
      .mocked(fetch)
      .mock.calls.filter(([, options]) => options?.method === 'POST')
      .map(([, options]) =>
        new Headers(options?.headers).get('Idempotency-Key'),
      )
    expect(keys).toHaveLength(2)
    expect(keys[1]).toBe(keys[0])
  })
})
