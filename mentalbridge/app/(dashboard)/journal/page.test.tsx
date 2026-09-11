import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import JournalPage from './page'

const journalId = '40000000-0000-4000-8000-000000000001'
const clientEntryId = '50000000-0000-4000-8000-000000000001'
const commandKey = '60000000-0000-4000-8000-000000000001'
const timestamp = '2026-09-11T03:00:00.000Z'

function entry(text: string, revision = 1, tags: string[] = []) {
  return {
    id: journalId,
    ownerAccountId: '10000000-0000-4000-8000-000000000001',
    currentRevision: revision,
    occurredAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    deleted: false,
    tags,
    encryption: {
      algorithm: 'AES-256-GCM',
      keyId: 'test-v1',
      encryptedAt: timestamp,
    },
    analysisState: revision === 1 ? 'not_requested' : 'stale',
    content: {
      text,
      byteLength: new TextEncoder().encode(text).byteLength,
    },
  }
}

function summary(value: ReturnType<typeof entry>) {
  return {
    ...value,
    content: {
      preview: value.content.text,
      byteLength: value.content.byteLength,
    },
  }
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type':
        status >= 400 ? 'application/problem+json' : 'application/json',
    },
  })
}

describe('Journal page', () => {
  beforeEach(() => {
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce(clientEntryId)
      .mockReturnValue(commandKey)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('uses local calendar time and manages dialog focus and background access', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        json({ items: [], page: { limit: 20, hasMore: false } }),
      )
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-420)
    const now = new Date()
    const expectedLocalTime = new Date(now.getTime() + 7 * 60 * 60 * 1_000)
      .toISOString()
      .slice(0, 16)
    const user = userEvent.setup()
    render(<JournalPage />)
    const open = await screen.findByRole('button', {
      name: 'Viết nhật ký đầu tiên',
    })

    await user.click(open)

    const modal = within(screen.getByRole('dialog'))
    expect(modal.getByLabelText('Thời điểm ghi')).toHaveValue(expectedLocalTime)
    await waitFor(() => expect(modal.getByLabelText('Nội dung')).toHaveFocus())
    const background = document.querySelector('.journal-page-content')
    expect(background).toHaveAttribute('aria-hidden', 'true')
    expect((background as HTMLElement).inert).toBe(true)

    await user.keyboard('{Escape}')
    await waitFor(() => expect(open).toHaveFocus())
    expect(background).not.toHaveAttribute('aria-hidden')
  })

  it('reuses the same command key after an ambiguous create outcome', async () => {
    const created = entry('bản nháp an toàn')
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        json({ items: [], page: { limit: 20, hasMore: false } }),
      )
      .mockResolvedValueOnce(
        json(
          {
            code: 'JOURNAL_MUTATION_OUTCOME_UNKNOWN',
            title: 'Unknown outcome',
          },
          503,
        ),
      )
      .mockResolvedValueOnce(json(created, 201))
      .mockResolvedValueOnce(
        json({
          items: [summary(created)],
          page: { limit: 20, hasMore: false },
        }),
      )
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<JournalPage />)

    await user.click(
      await screen.findByRole('button', { name: 'Viết nhật ký đầu tiên' }),
    )
    const modal = within(screen.getByRole('dialog'))
    await user.type(modal.getByLabelText('Nội dung'), 'bản nháp an toàn')
    await user.click(modal.getByRole('button', { name: 'Lưu nhật ký' }))
    await modal.findByRole('alert')
    await user.click(modal.getByRole('button', { name: 'Lưu nhật ký' }))

    const mutationCalls = fetchMock.mock.calls.filter(
      ([url, options]) => url === '/api/journals' && options?.method === 'POST',
    )
    expect(mutationCalls).toHaveLength(2)
    expect(
      (mutationCalls[0]?.[1]?.headers as Record<string, string>)[
        'Idempotency-Key'
      ],
    ).toBe(commandKey)
    expect(
      (mutationCalls[1]?.[1]?.headers as Record<string, string>)[
        'Idempotency-Key'
      ],
    ).toBe(commandKey)
  })

  it('loads the authoritative revision after 412 and retains the editable draft', async () => {
    const original = entry('nội dung ban đầu')
    const authoritative = entry('nội dung từ nơi khác', 2, ['remote'])
    const saved = entry('bản nháp của tôi', 3, ['mine'])
    const patchHeaders: string[] = []
    let detailReads = 0
    const fetchMock = vi.fn<typeof fetch>(async (url, options) => {
      if (url === '/api/journals' && !options?.method)
        return json({
          items: [summary(saved)],
          page: { limit: 20, hasMore: false },
        })
      if (url === `/api/journals/${journalId}` && !options?.method) {
        detailReads += 1
        return json(detailReads === 1 ? original : authoritative)
      }
      if (url === `/api/journals/${journalId}` && options?.method === 'PATCH') {
        patchHeaders.push(
          (options.headers as Record<string, string>)['If-Match-Revision'],
        )
        return patchHeaders.length === 1
          ? json({ code: 'PRECONDITION_FAILED', title: 'Conflict' }, 412)
          : json(saved)
      }
      return json({ items: [], page: { limit: 20, hasMore: false } })
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<JournalPage />)

    await user.click(
      await screen.findByRole('button', { name: 'Xem chi tiết' }),
    )
    await user.click(await screen.findByRole('button', { name: 'Chỉnh sửa' }))
    const modal = within(screen.getByRole('dialog'))
    const draft = modal.getByLabelText('Nội dung')
    await user.clear(draft)
    await user.type(draft, 'bản nháp của tôi')
    await user.clear(modal.getByLabelText('Thẻ do bạn đặt'))
    await user.type(modal.getByLabelText('Thẻ do bạn đặt'), 'mine')
    await user.click(modal.getByRole('button', { name: 'Lưu nhật ký' }))

    expect(await modal.findByRole('alert')).toHaveTextContent(
      'Đã tải phiên bản mới nhất',
    )
    expect(draft).toHaveValue('bản nháp của tôi')
    await user.click(modal.getByRole('button', { name: 'Lưu nhật ký' }))

    await waitFor(() =>
      expect(screen.getByRole('dialog')).toHaveTextContent('Phiên bản 3'),
    )
    expect(patchHeaders).toEqual(['1', '2'])
  })
})
