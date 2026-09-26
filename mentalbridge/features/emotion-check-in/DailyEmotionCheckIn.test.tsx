import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/api-error'
import type { EmotionCheckIn } from '@/lib/emotion-check-in/contract'
import {
  createEmotionCheckIn,
  getEmotionCheckIn,
  updateEmotionCheckIn,
} from './api/browser-emotion-check-in'
import { DailyEmotionCheckIn, localDateInTimeZone } from './DailyEmotionCheckIn'

vi.mock('./api/browser-emotion-check-in', () => ({
  createEmotionCheckIn: vi.fn(),
  getEmotionCheckIn: vi.fn(),
  updateEmotionCheckIn: vi.fn(),
}))

const get = vi.mocked(getEmotionCheckIn)
const create = vi.mocked(createEmotionCheckIn)
const update = vi.mocked(updateEmotionCheckIn)
const notFound = () =>
  new ApiError({
    message: 'not found',
    code: 'RESOURCE_NOT_FOUND',
    status: 404,
  })
const unavailable = () =>
  new ApiError({
    message: 'offline',
    code: 'DEPENDENCY_UNAVAILABLE',
    status: 503,
  })

function record(
  localDate: string,
  revision = 1,
  emotion: EmotionCheckIn['emotion'] = 'GOOD',
): EmotionCheckIn {
  return {
    id: '40000000-0000-4000-8000-000000000001',
    localDate,
    timezone: 'Asia/Ho_Chi_Minh',
    emotion,
    intensity: 4,
    note: null,
    sourceLabel: 'SELF_REPORTED_EMOTION',
    clinicalUse: 'NOT_A_DIAGNOSIS_OR_SAFETY_CLASSIFIER',
    revision,
    recordedAt: '2026-09-26T02:00:00.000Z',
    createdAt: '2026-09-26T02:00:00.000Z',
    updatedAt: '2026-09-26T02:00:00.000Z',
  }
}

describe('DailyEmotionCheckIn', () => {
  beforeEach(() => {
    get.mockReset()
    create.mockReset()
    update.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('starts empty with no default and creates only after emotion and intensity are selected', async () => {
    const user = userEvent.setup()
    get.mockRejectedValue(notFound())
    create.mockImplementation(async (body) => record(body.localDate))

    render(<DailyEmotionCheckIn />)

    expect(
      await screen.findByText('Hôm nay bạn chưa ghi nhận cảm xúc.'),
    ).toBeVisible()
    expect(
      screen
        .getAllByRole<HTMLInputElement>('radio')
        .every((radio) => !radio.checked),
    ).toBe(true)
    const save = screen.getByRole('button', { name: 'Lưu ghi nhận' })
    expect(save).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: 'Tốt' }))
    expect(save).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: '4' }))
    await user.click(save)

    expect(await screen.findByText('Đã lưu ghi nhận hôm nay.')).toBeVisible()
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ emotion: 'GOOD', intensity: 4, note: null }),
      expect.stringMatching(/^emotion-check-in-/),
    )
  })

  it('restores persisted state after remount and updates the same local-day record', async () => {
    const day = localDateInTimeZone(
      new Date(),
      Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    )
    get.mockResolvedValue(record(day))
    update.mockResolvedValue(record(day, 2, 'GREAT'))
    const first = render(<DailyEmotionCheckIn />)

    expect(await screen.findByRole('radio', { name: 'Tốt' })).toBeChecked()
    first.unmount()
    render(<DailyEmotionCheckIn />)
    expect(await screen.findByRole('radio', { name: 'Tốt' })).toBeChecked()
    await userEvent.click(screen.getByRole('radio', { name: 'Rất tốt' }))
    await userEvent.click(
      screen.getByRole('button', { name: 'Cập nhật ghi nhận' }),
    )

    expect(
      await screen.findByText('Đã cập nhật ghi nhận hôm nay.'),
    ).toBeVisible()
    expect(update).toHaveBeenCalledWith(
      day,
      1,
      { emotion: 'GREAT', intensity: 4, note: null },
      expect.stringMatching(/^emotion-check-in-/),
    )
  })

  it('does not pretend a failed save persisted and reuses its idempotency key on retry', async () => {
    const user = userEvent.setup()
    get.mockRejectedValue(notFound())
    create
      .mockRejectedValueOnce(unavailable())
      .mockImplementationOnce(async (body) => record(body.localDate))
    render(<DailyEmotionCheckIn />)
    await screen.findByText('Hôm nay bạn chưa ghi nhận cảm xúc.')
    await user.click(screen.getByRole('radio', { name: 'Bình thường' }))
    await user.click(screen.getByRole('radio', { name: '2' }))
    await user.click(screen.getByRole('button', { name: 'Lưu ghi nhận' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chưa thể lưu ghi nhận',
    )
    expect(
      screen.queryByText('Đã lưu ghi nhận hôm nay.'),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText('Đã lưu ghi nhận hôm nay.')).toBeVisible()
    expect(create).toHaveBeenCalledTimes(2)
    expect(create.mock.calls[0]?.[1]).toBe(create.mock.calls[1]?.[1])
  })

  it('shows an explicit session-expiry error without a mock selection', async () => {
    get.mockRejectedValue(
      new ApiError({
        message: 'expired',
        code: 'SESSION_REQUIRED',
        status: 401,
      }),
    )
    render(<DailyEmotionCheckIn />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Phiên đăng nhập đã hết hạn',
    )
    expect(
      screen
        .getAllByRole<HTMLInputElement>('radio')
        .every((radio) => !radio.checked),
    ).toBe(true)
  })

  it('reloads the authoritative empty state after the user local day rolls over', async () => {
    vi.useFakeTimers()
    const firstInstant = new Date('2026-09-26T12:00:00.000Z')
    const nextInstant = new Date('2026-09-27T12:00:00.000Z')
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    const firstDay = localDateInTimeZone(firstInstant, timeZone)
    const nextDay = localDateInTimeZone(nextInstant, timeZone)
    vi.setSystemTime(firstInstant)
    get
      .mockResolvedValueOnce(record(firstDay))
      .mockRejectedValueOnce(notFound())
    render(<DailyEmotionCheckIn />)
    await act(async () => Promise.resolve())
    expect(get).toHaveBeenCalledWith(firstDay)

    await act(async () => {
      vi.setSystemTime(nextInstant)
      window.dispatchEvent(new Event('focus'))
    })

    await act(async () => Promise.resolve())
    expect(get).toHaveBeenCalledWith(nextDay)
    expect(screen.getByText('Hôm nay bạn chưa ghi nhận cảm xúc.')).toBeVisible()
  })
})

describe('localDateInTimeZone', () => {
  it('uses the submitted IANA timezone at a local-day boundary', () => {
    const instant = new Date('2026-09-26T17:30:00.000Z')
    expect(localDateInTimeZone(instant, 'Asia/Ho_Chi_Minh')).toBe('2026-09-27')
    expect(localDateInTimeZone(instant, 'America/Los_Angeles')).toBe(
      '2026-09-26',
    )
  })
})
