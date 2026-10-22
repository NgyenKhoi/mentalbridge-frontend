import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/api-error'
import type { EmotionCheckIn } from '@/lib/emotion-check-in/contract'
import {
  createEmotionCheckIn,
  deleteEmotionCheckIn,
  getEmotionCheckIn,
  listEmotionCheckIns,
  updateEmotionCheckIn,
} from './api/browser-emotion-check-in'
import { DailyEmotionCheckIn, localDateInTimeZone } from './DailyEmotionCheckIn'

vi.mock('./api/browser-emotion-check-in', () => ({
  createEmotionCheckIn: vi.fn(),
  deleteEmotionCheckIn: vi.fn(),
  getEmotionCheckIn: vi.fn(),
  listEmotionCheckIns: vi.fn(),
  updateEmotionCheckIn: vi.fn(),
}))

const get = vi.mocked(getEmotionCheckIn)
const create = vi.mocked(createEmotionCheckIn)
const remove = vi.mocked(deleteEmotionCheckIn)
const update = vi.mocked(updateEmotionCheckIn)
const list = vi.mocked(listEmotionCheckIns)
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
  factors: EmotionCheckIn['factors'] = [],
  note: string | null = null,
): EmotionCheckIn {
  return {
    id: '40000000-0000-4000-8000-000000000001',
    localDate,
    timezone: 'Asia/Ho_Chi_Minh',
    emotion,
    intensity: 4,
    factors,
    note,
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
    remove.mockReset()
    update.mockReset()
    list.mockReset()
    list.mockResolvedValue({
      items: [],
      page: { limit: 10, hasMore: false },
      label: 'SELF_REPORTED_EMOTION',
      interpretation: 'NOT_DIAGNOSIS_OR_RECOVERY',
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('reserves the idle choices and action row without exposing controls while loading', () => {
    get.mockReturnValue(new Promise(() => {}))
    render(<DailyEmotionCheckIn />)
    const loading = screen.getByRole('status', {
      name: 'Đang tải ghi nhận hôm nay',
    })
    expect(loading).toHaveTextContent('Đang tải ghi nhận hôm nay…')
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lưu ghi nhận' })).toBeNull()
    expect(loading.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2)
    expect(loading).toHaveTextContent('Rất tốt')
    expect(loading).toHaveTextContent('Rất không tốt')
    expect(loading).toHaveTextContent('Lưu ghi nhận')
    expect(loading).toHaveTextContent(
      'Chọn xong sẽ hiện mức độ và ghi chú riêng.',
    )
  })

  it('starts empty with no default and creates only after emotion and intensity are selected', async () => {
    const user = userEvent.setup()
    const onPersisted = vi.fn()
    get.mockRejectedValue(notFound())
    create.mockImplementation(async (body) => record(body.localDate))

    render(<DailyEmotionCheckIn onPersisted={onPersisted} />)

    await screen.findByRole('radio', { name: 'Tốt' })
    expect(
      screen.queryByText('Hôm nay bạn chưa ghi nhận cảm xúc.'),
    ).not.toBeInTheDocument()
    expect(
      screen
        .getAllByRole<HTMLInputElement>('radio')
        .every((radio) => !radio.checked),
    ).toBe(true)
    const save = screen.getByRole('button', { name: 'Lưu ghi nhận' })
    expect(save).toBeDisabled()
    expect(screen.getAllByRole('radio')).toHaveLength(5)
    expect(screen.queryByText('Mức độ cảm nhận')).not.toBeInTheDocument()
    expect(
      screen.queryByText('Thêm bối cảnh riêng tư (không bắt buộc)'),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'Tốt' }))
    await waitFor(() =>
      expect(screen.getByText('Mức độ cảm nhận')).toBeVisible(),
    )
    expect(save).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: '4' }))
    await user.click(save)

    expect(await screen.findByText('Đã lưu ghi nhận hôm nay.')).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Đã ghi nhận: Tốt' }),
    ).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('Đã ghi nhận: Tốt.')
    expect(screen.getByRole('status')).toHaveAttribute('aria-atomic', 'true')
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Chỉnh sửa ghi nhận' }))
    expect(screen.getByRole('radio', { name: 'Tốt' })).toBeChecked()
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        emotion: 'GOOD',
        intensity: 4,
        factors: [],
        note: null,
      }),
      expect.stringMatching(/^emotion-check-in-/),
    )
    expect(onPersisted).toHaveBeenCalledOnce()
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
      { emotion: 'GREAT', intensity: 4, factors: [], note: null },
      expect.stringMatching(/^emotion-check-in-/),
    )
  })

  it('persists, restores, and clears optional private context', async () => {
    const user = userEvent.setup()
    const day = localDateInTimeZone(
      new Date(),
      Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    )
    const saved = record(day, 1, 'GOOD', ['sleep', 'work'], 'Một ngày dài')
    const cleared = record(day, 2, 'GOOD')
    get.mockResolvedValue(saved)
    update.mockResolvedValue(cleared)
    render(<DailyEmotionCheckIn />)

    await screen.findByRole('radio', { name: 'Tốt' })
    await user.click(
      screen.getByText('Thêm bối cảnh riêng tư (không bắt buộc)'),
    )
    expect(screen.getByRole('checkbox', { name: 'Giấc ngủ' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Công việc' })).toBeChecked()
    expect(screen.getByLabelText('Ghi chú riêng (không bắt buộc)')).toHaveValue(
      'Một ngày dài',
    )

    await user.click(screen.getByRole('checkbox', { name: 'Giấc ngủ' }))
    await user.click(screen.getByRole('checkbox', { name: 'Công việc' }))
    await user.clear(screen.getByLabelText('Ghi chú riêng (không bắt buộc)'))
    await user.click(screen.getByRole('button', { name: 'Cập nhật ghi nhận' }))

    expect(update).toHaveBeenCalledWith(
      day,
      1,
      { emotion: 'GOOD', intensity: 4, factors: [], note: null },
      expect.stringMatching(/^emotion-check-in-/),
    )
    expect(
      await screen.findByText('Đã cập nhật ghi nhận hôm nay.'),
    ).toBeVisible()
  })

  it('limits optional factors to three without blocking the primary flow', async () => {
    const user = userEvent.setup()
    get.mockRejectedValue(notFound())
    create.mockImplementation(async (body) =>
      record(
        body.localDate,
        1,
        body.emotion,
        body.factors ?? [],
        body.note ?? null,
      ),
    )
    render(<DailyEmotionCheckIn />)
    await screen.findByRole('radio', { name: 'Tốt' })
    await user.click(screen.getByRole('radio', { name: 'Tốt' }))
    await user.click(
      screen.getByText('Thêm bối cảnh riêng tư (không bắt buộc)'),
    )
    await user.click(screen.getByRole('checkbox', { name: 'Giấc ngủ' }))
    await user.click(screen.getByRole('checkbox', { name: 'Công việc' }))
    await user.click(screen.getByRole('checkbox', { name: 'Học tập' }))
    expect(screen.getByRole('checkbox', { name: 'Gia đình' })).toBeDisabled()

    await user.click(screen.getByRole('radio', { name: 'Tốt' }))
    await user.click(screen.getByRole('radio', { name: '4' }))
    await user.click(screen.getByRole('button', { name: 'Lưu ghi nhận' }))

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ factors: ['sleep', 'work', 'study'] }),
      expect.any(String),
    )
  })

  it('does not pretend a failed save persisted and reuses its idempotency key on retry', async () => {
    const user = userEvent.setup()
    get.mockRejectedValue(notFound())
    create
      .mockRejectedValueOnce(unavailable())
      .mockImplementationOnce(async (body) => record(body.localDate))
    render(<DailyEmotionCheckIn />)
    await screen.findByRole('radio', { name: 'Tốt' })
    await user.click(screen.getByRole('radio', { name: 'Bình thường' }))
    await user.click(screen.getByRole('radio', { name: '2' }))
    await user.click(screen.getByRole('button', { name: 'Lưu ghi nhận' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chưa thể lưu thay đổi',
    )
    expect(
      screen.queryByText('Đã lưu ghi nhận hôm nay.'),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText('Đã lưu ghi nhận hôm nay.')).toBeVisible()
    expect(create).toHaveBeenCalledTimes(2)
    expect(create.mock.calls[0]?.[1]).toBe(create.mock.calls[1]?.[1])
  })

  it('keeps a changed selection explicitly unsaved without showing a saved acknowledgement', async () => {
    const day = localDateInTimeZone(
      new Date(),
      Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    )
    get.mockResolvedValue(record(day, 1, 'GOOD'))
    render(<DailyEmotionCheckIn />)
    await screen.findByRole('radio', { name: 'Tốt' })

    await userEvent.click(screen.getByRole('radio', { name: 'Rất tốt' }))

    expect(screen.getByText('Lựa chọn này chưa được lưu.')).toBeVisible()
    expect(screen.queryByTestId('emotion-saved')).not.toBeInTheDocument()
    expect(screen.queryByText('Hôm qua và hôm nay')).not.toBeInTheDocument()
  })

  it('deletes the persisted day and invalidates dependent progress', async () => {
    const onPersisted = vi.fn()
    const event = vi.fn()
    window.addEventListener('mb:emotion-check-in-updated', event)
    const day = localDateInTimeZone(
      new Date(),
      Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    )
    get.mockResolvedValue(record(day))
    remove.mockResolvedValue({
      localDate: day,
      deleted: true,
      deletedAt: '2026-09-26T03:00:00.000Z',
    })
    render(<DailyEmotionCheckIn onPersisted={onPersisted} />)
    await screen.findByRole('radio', { name: 'Tốt' })

    await userEvent.click(screen.getByRole('button', { name: 'Xóa ghi nhận' }))

    expect(
      await screen.findByText('Đã xóa ghi nhận cảm xúc hôm nay.'),
    ).toBeVisible()
    expect(remove).toHaveBeenCalledWith(
      day,
      expect.stringMatching(/^emotion-check-in-/),
    )
    expect(onPersisted).toHaveBeenCalledOnce()
    expect(event).toHaveBeenCalledOnce()
    window.removeEventListener('mb:emotion-check-in-updated', event)
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
    expect(
      screen.queryByText('Hôm nay bạn chưa ghi nhận cảm xúc.'),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lưu ghi nhận' })).toBeDisabled()
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
