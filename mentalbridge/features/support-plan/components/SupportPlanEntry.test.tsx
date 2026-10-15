import { render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/api-error'
import { nativeSupportPlanFixture } from '../testing/native-support-plan-fixture'
const api = vi.hoisted(() => ({
  getCurrentSupportPlanActions: vi.fn(),
  getCurrentNativeSupportPlanDraft: vi.fn(),
  getSupportPlanActionHistory: vi.fn(),
}))
const feedback = vi.hoisted(() => ({ confirm: vi.fn() }))
vi.mock('../api/browser-support-plan-actions', () => api)
vi.mock('@/components/ui/FeedbackProvider', () => ({
  useFeedback: () => feedback,
}))
vi.mock('./SupportPlanJourney', () => ({
  default: function LegacyEditor({
    onDirtyChange,
  }: {
    onDirtyChange?: (dirty: boolean) => void
  }) {
    const [value, setValue] = useState('Saved choice')
    return (
      <>
        <p>Legacy resource plan</p>
        <input
          aria-label="Legacy unsaved choice"
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            onDirtyChange?.(event.target.value !== 'Saved choice')
          }}
        />
      </>
    )
  },
}))
vi.mock('./NativeSupportPlanJourney', () => ({
  default: () => <p>Native action plan</p>,
}))
import SupportPlanEntry from './SupportPlanEntry'
describe('Representation-aware SupportPlan entry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    feedback.confirm.mockResolvedValue(true)
    api.getSupportPlanActionHistory.mockResolvedValue({
      items: [],
      nextCursor: null,
      hasMore: false,
    })
    api.getCurrentNativeSupportPlanDraft.mockRejectedValue(
      new ApiError({
        status: 404,
        code: 'SUPPORT_PLAN_DRAFT_NOT_FOUND',
        message: 'Not found',
      }),
    )
  })
  it('selects native current data without invoking legacy UI', async () => {
    api.getCurrentSupportPlanActions.mockResolvedValue(
      nativeSupportPlanFixture(),
    )
    render(<SupportPlanEntry />)
    await screen.findByText('Native action plan')
    expect(feedback.confirm).not.toHaveBeenCalled()
  })
  it('keeps the mounted legacy draft when native-entry confirmation is cancelled, and switches only after approval', async () => {
    const user = userEvent.setup()
    feedback.confirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    api.getCurrentSupportPlanActions.mockResolvedValue({
      ...nativeSupportPlanFixture(),
      representationMode: 'V2_RESOURCE_ADAPTER',
    })
    render(<SupportPlanEntry />)
    const choice = await screen.findByLabelText('Legacy unsaved choice')
    await user.clear(choice)
    await user.type(choice, 'Keep this draft')
    const enter = screen.getByRole('button', {
      name: 'Xem phương án có ghi nhận cảm xúc',
    })
    await user.click(enter)
    await waitFor(() => expect(feedback.confirm).toHaveBeenCalledOnce())
    expect(screen.getByLabelText('Legacy unsaved choice')).toBe(choice)
    expect(choice).toHaveValue('Keep this draft')
    expect(screen.queryByText('Native action plan')).not.toBeInTheDocument()
    expect(feedback.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Rời kế hoạch đang chỉnh sửa?',
        cancelLabel: 'Tiếp tục chỉnh sửa',
      }),
    )
    await user.click(enter)
    await screen.findByText('Native action plan')
    expect(feedback.confirm).toHaveBeenCalledTimes(2)
  })
  it('does not ask to discard when the legacy draft has been restored to its saved value', async () => {
    const user = userEvent.setup()
    api.getCurrentSupportPlanActions.mockResolvedValue({
      ...nativeSupportPlanFixture(),
      representationMode: 'V2_RESOURCE_ADAPTER',
    })
    render(<SupportPlanEntry />)
    const choice = await screen.findByLabelText('Legacy unsaved choice')
    await user.clear(choice)
    await user.type(choice, 'Temporary draft')
    await user.clear(choice)
    await user.type(choice, 'Saved choice')
    await user.click(
      screen.getByRole('button', {
        name: 'Xem phương án có ghi nhận cảm xúc',
      }),
    )
    await screen.findByText('Native action plan')
    expect(feedback.confirm).not.toHaveBeenCalled()
    expect(screen.queryByText('Legacy resource plan')).not.toBeInTheDocument()
  })
  it('preserves a v2 adapter and provides an explicit optional native alternative', async () => {
    api.getCurrentSupportPlanActions.mockResolvedValue({
      ...nativeSupportPlanFixture(),
      representationMode: 'V2_RESOURCE_ADAPTER',
    })
    render(<SupportPlanEntry />)
    await screen.findByText('Legacy resource plan')
    expect(screen.queryByText('Native action plan')).not.toBeInTheDocument()
    await userEvent.setup().click(
      screen.getByRole('button', {
        name: 'Xem phương án có ghi nhận cảm xúc',
      }),
    )
    await screen.findByText('Native action plan')
  })
  it('does not treat dependency failure as an empty plan or silently fall back', async () => {
    api.getCurrentSupportPlanActions.mockRejectedValue(
      new ApiError({
        status: 503,
        code: 'CARE_UNAVAILABLE',
        message: 'Failure',
      }),
    )
    render(<SupportPlanEntry />)
    await screen.findByText(/Chưa thể tải kế hoạch/)
    expect(screen.queryByText('Legacy resource plan')).not.toBeInTheDocument()
    expect(screen.queryByText('Native action plan')).not.toBeInTheDocument()
  })
  it('preserves terminal v2 history after current and draft become empty', async () => {
    api.getCurrentSupportPlanActions.mockRejectedValue(
      new ApiError({
        status: 404,
        code: 'SUPPORT_PLAN_CURRENT_NOT_FOUND',
        message: 'Missing',
      }),
    )
    api.getSupportPlanActionHistory.mockResolvedValue({
      items: [
        {
          ...nativeSupportPlanFixture(),
          status: 'COMPLETED',
          representationMode: 'V2_RESOURCE_ADAPTER',
        },
      ],
      nextCursor: null,
      hasMore: false,
    })
    render(<SupportPlanEntry />)
    await screen.findByText('Legacy resource plan')
    expect(screen.queryByText('Native action plan')).not.toBeInTheDocument()
  })
})
