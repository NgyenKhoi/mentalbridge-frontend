import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DailyEmotionCheckIn } from './DailyEmotionCheckIn'

const today = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

const entry = (revision = 1) => ({
  id: '40000000-0000-4000-8000-000000000001',
  localDate: today(),
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  emotion: 'GOOD',
  intensity: 4,
  note: 'Một ghi chú tổng hợp',
  sourceLabel: 'SELF_REPORTED_EMOTION',
  clinicalUse: 'NOT_A_DIAGNOSIS_OR_SAFETY_CLASSIFIER',
  revision,
  recordedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

const history = (items: unknown[]) => ({
  items,
  page: { limit: 7, hasMore: false },
  label: 'SELF_REPORTED_EMOTION',
  interpretation: 'NOT_DIAGNOSIS_OR_RECOVERY',
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('DailyEmotionCheckIn', () => {
  it('moves from loading to empty and persists the first daily check-in', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json(
          { code: 'RESOURCE_NOT_FOUND', title: 'Not found' },
          { status: 404 },
        ),
      )
      .mockResolvedValueOnce(Response.json(history([])))
      .mockResolvedValueOnce(Response.json(entry(), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<DailyEmotionCheckIn />)

    expect(screen.getAllByText('Đang tải ghi nhận hôm nay…')).toHaveLength(2)
    expect(
      await screen.findByText('Hôm nay bạn chưa ghi nhận cảm xúc.'),
    ).toBeVisible()
    await userEvent.click(screen.getByRole('radio', { name: 'Tốt' }))
    await userEvent.click(screen.getByRole('radio', { name: '4' }))
    await userEvent.type(
      screen.getByPlaceholderText('Một điều bạn muốn ghi nhớ về hôm nay…'),
      'Một ghi chú tổng hợp',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Lưu ghi nhận' }))

    expect(await screen.findByText('Đã lưu ghi nhận hôm nay.')).toBeVisible()
    expect(screen.getByText('Cường độ tự báo cáo 4/5')).toBeVisible()
    const create = fetchMock.mock.calls[2]
    expect(create?.[0]).toBe('/api/emotion-check-ins')
    expect(create?.[1]?.method).toBe('POST')
    expect(String(create?.[1]?.body)).toContain('Một ghi chú tổng hợp')
    expect(new Headers(create?.[1]?.headers).get('Idempotency-Key')).toMatch(
      /^emotion-/,
    )
  })

  it('reloads a saved record and uses optimistic update headers', async () => {
    const current = entry()
    const updated = { ...entry(2), emotion: 'GREAT', note: null }
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(current))
      .mockResolvedValueOnce(Response.json(history([current])))
      .mockResolvedValueOnce(Response.json(updated))
    vi.stubGlobal('fetch', fetchMock)
    render(<DailyEmotionCheckIn />)

    expect(
      await screen.findByText('Đã tải ghi nhận tự báo cáo hôm nay.'),
    ).toBeVisible()
    await userEvent.click(screen.getByRole('radio', { name: 'Rất tốt' }))
    await userEvent.clear(
      screen.getByPlaceholderText('Một điều bạn muốn ghi nhớ về hôm nay…'),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Cập nhật' }))

    await waitFor(() =>
      expect(screen.getByText('Đã cập nhật ghi nhận hôm nay.')).toBeVisible(),
    )
    const update = fetchMock.mock.calls[2]
    expect(update?.[1]?.method).toBe('PATCH')
    expect(new Headers(update?.[1]?.headers).get('If-Match-Revision')).toBe('1')
  })

  it('shows a recoverable dependency error', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          Response.json(
            {
              code: 'DEPENDENCY_UNAVAILABLE',
              title: 'Dịch vụ tạm thời không khả dụng.',
            },
            { status: 503 },
          ),
        )
        .mockResolvedValueOnce(Response.json(history([]))),
    )
    render(<DailyEmotionCheckIn />)

    expect(
      await screen.findByText('Dịch vụ tạm thời không khả dụng.'),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeVisible()
  })
})
