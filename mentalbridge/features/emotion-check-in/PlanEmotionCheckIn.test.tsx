import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/api-error'
import {
  emotionOccurrenceFixture,
  nativeSupportPlanFixture,
} from '@/features/support-plan/testing/native-support-plan-fixture'
const api = vi.hoisted(() => ({
  current: vi.fn(),
  occurrences: vi.fn(),
  reconcile: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  list: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}))
vi.mock('@/features/support-plan/api/browser-support-plan-actions', () => ({
  getCurrentSupportPlanActions: api.current,
  getSupportPlanActionOccurrences: api.occurrences,
  reconcileEmotionCheckInOccurrence: api.reconcile,
}))
vi.mock('./api/browser-emotion-check-in', () => ({
  getEmotionCheckIn: api.get,
  createEmotionCheckIn: api.create,
  listEmotionCheckIns: api.list,
  updateEmotionCheckIn: api.update,
  deleteEmotionCheckIn: api.remove,
}))
import { PlanEmotionCheckIn } from './PlanEmotionCheckIn'

const occurrence = emotionOccurrenceFixture()
const originParams = () =>
  new URLSearchParams({
    occurrenceId: occurrence.occurrenceId,
    actionId: occurrence.actionId,
    localDate: occurrence.localDate,
  })
describe('Canonical Emotion entry from an owned plan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.setSystemTime(new Date('2026-10-13T13:00:00Z'))
    window.history.replaceState(null, '', `/dashboard?${originParams()}`)
    Element.prototype.scrollIntoView = vi.fn()
    const plan = nativeSupportPlanFixture()
    api.current.mockResolvedValue(plan)
    api.occurrences.mockResolvedValue({
      supportPlanId: plan.supportPlanId,
      representationMode: 'NATIVE_V3',
      occurrences: [occurrence],
    })
    api.get.mockRejectedValue(
      new ApiError({
        message: 'Missing',
        code: 'EMOTION_CHECK_IN_NOT_FOUND',
        status: 404,
      }),
    )
    api.list.mockResolvedValue({
      items: [],
      page: { limit: 10, hasMore: false },
    })
    api.create.mockImplementation(async (body) => ({
      ...body,
      id: '70000000-0000-4000-8000-000000000641',
      revision: 1,
      createdAt: '2026-10-13T13:00:00Z',
      recordedAt: '2026-10-13T13:00:00Z',
      updatedAt: '2026-10-13T13:00:00Z',
    }))
  })
  afterEach(() => {
    vi.useRealTimers()
    window.history.replaceState(null, '', '/dashboard')
  })
  it('reuses the canonical form with the owner frozen timezone and returns exact origin without auto-completing', async () => {
    const user = userEvent.setup()
    render(<PlanEmotionCheckIn />)
    expect(
      await screen.findByText('Hôm nay bạn chưa ghi nhận cảm xúc.'),
    ).toBeVisible()
    const back = screen.getByRole('link', {
      name: 'Quay lại hoạt động trong kế hoạch',
    })
    expect(back).toHaveAttribute(
      'href',
      expect.stringContaining(`occurrenceId=${occurrence.occurrenceId}`),
    )
    await user.click(screen.getByRole('radio', { name: 'Tốt' }))
    await user.click(screen.getByRole('radio', { name: '4' }))
    await user.click(screen.getByRole('button', { name: 'Lưu ghi nhận' }))
    expect(await screen.findByText('Đã lưu ghi nhận hôm nay.')).toBeVisible()
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({
        localDate: '2026-10-13',
        timezone: 'Asia/Ho_Chi_Minh',
      }),
      expect.any(String),
    )
    expect(api.reconcile).not.toHaveBeenCalled()
  })
  it('never uses a date/timezone query to create a historical or foreign-owner check-in', async () => {
    const params = originParams()
    params.set('localDate', '2026-10-12')
    params.set('timezone', 'UTC')
    window.history.replaceState(null, '', `/dashboard?${params}`)
    const plan = nativeSupportPlanFixture()
    api.occurrences.mockResolvedValue({
      supportPlanId: plan.supportPlanId,
      representationMode: 'NATIVE_V3',
      occurrences: [{ ...occurrence, localDate: '2026-10-12' }],
    })
    render(<PlanEmotionCheckIn />)
    expect(
      await screen.findByText(/chỉ có thể ghi nhận cảm xúc của hôm nay/),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Lưu ghi nhận' }),
    ).not.toBeInTheDocument()
    expect(api.get).not.toHaveBeenCalled()
    expect(api.create).not.toHaveBeenCalled()
    expect(api.reconcile).not.toHaveBeenCalled()
  })
  it('shows dependency failure distinctly and retries only context reads', async () => {
    const user = userEvent.setup()
    api.current.mockRejectedValueOnce(
      new ApiError({
        message: 'Unavailable',
        code: 'CARE_UNAVAILABLE',
        status: 503,
      }),
    )
    render(<PlanEmotionCheckIn />)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chưa tải được hoạt động',
    )
    expect(api.get).not.toHaveBeenCalled()
    await user.click(
      screen.getByRole('button', { name: 'Thử tải lại hoạt động' }),
    )
    await screen.findByText('Hôm nay bạn chưa ghi nhận cảm xúc.')
    expect(api.reconcile).not.toHaveBeenCalled()
  })
  it('rejects malformed hints instead of completing another activity', async () => {
    window.history.replaceState(
      null,
      '',
      '/dashboard?occurrenceId=bad&actionId=bad&localDate=2026-10-13',
    )
    render(<PlanEmotionCheckIn />)
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Không tìm thấy hoạt động',
      ),
    )
    expect(api.current).not.toHaveBeenCalled()
    expect(api.get).not.toHaveBeenCalled()
    expect(api.reconcile).not.toHaveBeenCalled()
  })
  it('keeps the origin and unsaved values on failure, then retries the same save command', async () => {
    const user = userEvent.setup()
    const saved = api.create.getMockImplementation()
    api.create.mockRejectedValueOnce(
      new ApiError({
        message: 'Unavailable',
        code: 'JOURNAL_UNAVAILABLE',
        status: 503,
      }),
    )
    render(<PlanEmotionCheckIn />)
    await screen.findByText('Hôm nay bạn chưa ghi nhận cảm xúc.')
    await user.click(screen.getByRole('radio', { name: 'Tốt' }))
    await user.click(screen.getByRole('radio', { name: '4' }))
    await user.click(screen.getByRole('button', { name: 'Lưu ghi nhận' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Lựa chọn của bạn vẫn được giữ',
    )
    expect(screen.getByRole('radio', { name: 'Tốt' })).toBeChecked()
    expect(screen.getByRole('radio', { name: '4' })).toBeChecked()
    expect(
      screen.getByRole('link', { name: 'Quay lại hoạt động trong kế hoạch' }),
    ).toHaveAttribute('href', expect.stringContaining(occurrence.occurrenceId))
    if (saved) api.create.mockImplementation(saved)
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    await screen.findByText('Đã lưu ghi nhận hôm nay.')
    expect(api.create.mock.calls[1]).toEqual(api.create.mock.calls[0])
    expect(api.reconcile).not.toHaveBeenCalled()
  })
  it('explains incompatible saved provenance without rewriting it or reconciling', async () => {
    api.get.mockResolvedValue({
      id: '70000000-0000-4000-8000-000000000641',
      localDate: occurrence.localDate,
      timezone: 'UTC',
      emotion: 'GOOD',
      intensity: 4,
      factors: [],
      note: null,
      revision: 1,
      createdAt: '2026-10-13T01:00:00Z',
      recordedAt: '2026-10-13T01:00:00Z',
      updatedAt: '2026-10-13T01:00:00Z',
    })
    render(<PlanEmotionCheckIn />)
    expect(
      await screen.findByText(/Ghi nhận đã có dùng múi giờ khác/),
    ).toBeVisible()
    expect(screen.getByRole('radio', { name: 'Tốt' })).toBeChecked()
    expect(api.update).not.toHaveBeenCalled()
    expect(api.remove).not.toHaveBeenCalled()
    expect(api.reconcile).not.toHaveBeenCalled()
  })
  it('blocks a plan-origin save when the owner local day rolls over', async () => {
    const user = userEvent.setup()
    render(<PlanEmotionCheckIn />)
    await screen.findByText('Hôm nay bạn chưa ghi nhận cảm xúc.')
    await user.click(screen.getByRole('radio', { name: 'Tốt' }))
    await user.click(screen.getByRole('radio', { name: '4' }))
    act(() => {
      vi.setSystemTime(new Date('2026-10-13T17:01:00Z'))
      window.dispatchEvent(new Event('focus'))
    })
    expect(await screen.findByText(/Ngày đã thay đổi/)).toBeVisible()
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Lưu ghi nhận' }),
      ).toBeDisabled(),
    )
    expect(api.create).not.toHaveBeenCalled()
    expect(api.reconcile).not.toHaveBeenCalled()
  })
  it('revalidates a changed client-side origin instead of keeping the previous action', async () => {
    const view = render(<PlanEmotionCheckIn />)
    await screen.findByText('Hôm nay bạn chưa ghi nhận cảm xúc.')
    const params = originParams()
    params.set('actionId', '20000000-0000-4000-8000-000000000642')
    window.history.replaceState(null, '', `/dashboard?${params}`)
    view.rerender(<PlanEmotionCheckIn />)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Không tìm thấy hoạt động',
    )
    expect(
      screen.queryByRole('link', { name: 'Quay lại hoạt động trong kế hoạch' }),
    ).not.toBeInTheDocument()
    expect(api.create).not.toHaveBeenCalled()
    expect(api.reconcile).not.toHaveBeenCalled()
  })
  it('ignores a previous-day save response that arrives after the next-day read', async () => {
    const user = userEvent.setup()
    let finishSave: (value: unknown) => void = () => undefined
    api.create.mockReturnValueOnce(
      new Promise((resolve) => {
        finishSave = resolve
      }),
    )
    render(<PlanEmotionCheckIn />)
    await screen.findByText('Hôm nay bạn chưa ghi nhận cảm xúc.')
    await user.click(screen.getByRole('radio', { name: 'Tốt' }))
    await user.click(screen.getByRole('radio', { name: '4' }))
    await user.click(screen.getByRole('button', { name: 'Lưu ghi nhận' }))
    act(() => {
      vi.setSystemTime(new Date('2026-10-13T17:01:00Z'))
      window.dispatchEvent(new Event('focus'))
    })
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('2026-10-14'))
    await screen.findByText('Hôm nay bạn chưa ghi nhận cảm xúc.')
    await act(async () => {
      finishSave({
        id: '70000000-0000-4000-8000-000000000641',
        localDate: '2026-10-13',
        timezone: 'Asia/Ho_Chi_Minh',
        emotion: 'GOOD',
        intensity: 4,
        factors: [],
        note: null,
        revision: 1,
        createdAt: '2026-10-13T16:59:59Z',
        recordedAt: '2026-10-13T16:59:59Z',
        updatedAt: '2026-10-13T16:59:59Z',
      })
    })
    expect(screen.getByText('Hôm nay bạn chưa ghi nhận cảm xúc.')).toBeVisible()
    expect(screen.getByRole('radio', { name: 'Tốt' })).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Lưu ghi nhận' })).toBeDisabled()
    expect(
      screen.queryByText('Đã lưu ghi nhận hôm nay.'),
    ).not.toBeInTheDocument()
    expect(api.reconcile).not.toHaveBeenCalled()
  })
})
