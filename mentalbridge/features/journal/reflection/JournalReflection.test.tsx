import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { JournalEntry } from '@/lib/journal/journal-contract'
import { JournalReflection } from './JournalReflection'
import { analysisStorageKey } from './reflection'

const journalId = '40000000-0000-4000-8000-000000000001'
const jobId = '50000000-0000-4000-8000-000000000001'
const timestamp = '2026-09-23T00:00:00Z'
const disclosure = {
  consentType: 'AI_PROCESSING',
  version: 'ai-processing-capstone-v1',
  locale: 'vi-VN',
  title: 'Đồng ý xử lý nhật ký bằng AI',
  content: 'Chỉ xử lý phiên bản nhật ký khi bạn chủ động yêu cầu.',
  capstoneOnly: true,
}
const decision = {
  decisionId: '30000000-0000-4000-8000-000000000001',
  consentType: 'AI_PROCESSING',
  policyVersion: 'ai-processing-capstone-v1',
  granted: true,
  decidedAt: timestamp,
}

function entry(analysisState: JournalEntry['analysisState'] = 'not_requested') {
  return {
    id: journalId,
    ownerAccountId: '10000000-0000-4000-8000-000000000001',
    currentRevision: 2,
    occurredAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    deleted: false,
    tags: [],
    mood: 'GOOD',
    encryption: {
      algorithm: 'AES-256-GCM',
      keyId: 'test-v1',
      encryptedAt: timestamp,
    },
    analysisState,
    content: { text: 'Nội dung tổng hợp', byteLength: 21 },
  } as JournalEntry
}

function job(
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED',
  attemptCount = 0,
  terminalReason: string | null = null,
) {
  return {
    jobId,
    journalId,
    journalRevision: 2,
    status,
    attemptCount,
    terminalReason,
    result:
      status === 'SUCCEEDED'
        ? {
            summary: 'Bạn đang cân nhắc dành thêm thời gian nghỉ ngơi.',
            contextSignals: ['công việc'],
            emotionIndicators: ['căng thẳng'],
            themes: ['nghỉ ngơi'],
            preferenceSignals: ['hoạt động ngắn'],
            barrierSignals: [],
            modelConfidence: 0.7,
            suggestedAction: 'GUIDE_APPROVED_ACTIVITY',
            provider: 'DETERMINISTIC_FAKE',
            model: 'deterministic-reflection-v1',
            promptVersion: 'exact-revision-v1',
            schemaVersion: 1,
            createdAt: timestamp,
          }
        : null,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: status === 'RUNNING' ? null : timestamp,
  }
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function baseFetch(
  consents: unknown,
  analysis: (
    url: string,
    options?: RequestInit,
  ) => Response | Promise<Response>,
) {
  return vi.fn<typeof fetch>((input, options) => {
    const url = String(input)
    if (url === '/api/care/consents') return Promise.resolve(json(consents))
    if (url === '/api/care/ai-processing-disclosure')
      return Promise.resolve(json(disclosure))
    return Promise.resolve(analysis(url, options))
  })
}

describe('JournalReflection', () => {
  afterEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('records explicit AI consent and renders a successful exact-revision result', async () => {
    const fetchMock = baseFetch({ decisions: [] }, (url, options) => {
      if (url === '/api/care/consent-decisions' && options?.method === 'POST')
        return json(decision, 201)
      if (url.endsWith('/revisions/2/analysis-jobs'))
        return json(job('SUCCEEDED'), 202)
      return json({ code: 'RESOURCE_NOT_FOUND' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      '60000000-0000-4000-8000-000000000001',
    )
    const user = userEvent.setup()

    render(<JournalReflection entry={entry()} />)

    expect(
      screen.getByRole('heading', {
        name: 'AI giúp bạn hiểu rõ hơn những điều mình đã viết',
      }),
    ).toBeVisible()
    expect(
      screen.getByText(/AI có thể tóm tắt nội dung, nhận diện cảm xúc/i),
    ).toBeVisible()
    expect(
      screen.queryByText(/kết quả chỉ hỗ trợ tự phản ánh/i),
    ).not.toBeInTheDocument()
    expect(await screen.findByText(disclosure.title)).toBeVisible()
    await user.click(
      screen.getByRole('checkbox', {
        name: /tôi đã đọc và chủ động đồng ý/i,
      }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Đồng ý và phân tích bản này' }),
    )

    expect(
      await screen.findByText(
        'Bạn đang cân nhắc dành thêm thời gian nghỉ ngơi.',
      ),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Mở hướng dẫn hỗ trợ' }),
    ).toHaveAttribute('href', '/support-guides')
    expect(screen.getByText('Phản ánh cho phiên bản 2')).toBeVisible()
    const analysisCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/revisions/2/analysis-jobs'),
    )
    expect(analysisCall?.[1]?.headers).toMatchObject({
      'Idempotency-Key': expect.stringContaining('analysis-'),
    })
  })

  it('restores the queued job for the same revision after reload', async () => {
    window.localStorage.setItem(
      analysisStorageKey(journalId, 2),
      JSON.stringify({
        journalId,
        journalRevision: 2,
        requestKey: 'analysis-command-0001',
        jobId,
      }),
    )
    const fetchMock = baseFetch({ decisions: [decision] }, (url) =>
      url.endsWith(jobId)
        ? json(job('RUNNING', 0))
        : json({ code: 'RESOURCE_NOT_FOUND' }, 404),
    )
    vi.stubGlobal('fetch', fetchMock)

    render(<JournalReflection entry={entry()} />)

    expect(await screen.findByText('Yêu cầu đang chờ xử lý')).toBeVisible()
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/journals/analysis-jobs/${jobId}`,
      { cache: 'no-store' },
    )
  })

  it('shows failure and starts a manual retry without changing the journal', async () => {
    window.localStorage.setItem(
      analysisStorageKey(journalId, 2),
      JSON.stringify({
        journalId,
        journalRevision: 2,
        requestKey: 'analysis-command-0001',
        jobId,
      }),
    )
    const fetchMock = baseFetch({ decisions: [decision] }, (url, options) => {
      if (url.endsWith(jobId) && !options?.method)
        return json(job('FAILED', 2, 'PROVIDER_TIMEOUT'))
      if (url.endsWith('/revisions/2/analysis-jobs'))
        return json(job('RUNNING', 1), 202)
      return json({ code: 'RESOURCE_NOT_FOUND' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      '60000000-0000-4000-8000-000000000002',
    )
    const user = userEvent.setup()

    render(<JournalReflection entry={entry()} />)

    expect(await screen.findByText('Phản ánh chưa hoàn tất')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Thử phân tích lại' }))
    expect(
      await screen.findByText('Đang phân tích phiên bản này'),
    ).toBeVisible()
  })

  it('marks an old result stale and keeps the current journal revision actionable', async () => {
    vi.stubGlobal(
      'fetch',
      baseFetch({ decisions: [decision] }, () =>
        json({ code: 'RESOURCE_NOT_FOUND' }, 404),
      ),
    )

    render(<JournalReflection entry={entry('stale')} />)

    expect(await screen.findByText('Phản ánh trước đã cũ')).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Phân tích phiên bản này' }),
    ).toBeEnabled()
  })
})
