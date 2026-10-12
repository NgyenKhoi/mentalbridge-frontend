import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'

import { ApiError } from '@/api/api-error'

import type { SupportPlanActions } from './support-plan-contract'
import { SupportPlanScheduleEditor } from './SupportPlanScheduleEditor'

function projection(): SupportPlanActions {
  return {
    supportPlanId: '10000000-0000-4000-8000-000000000640',
    modelVersion: 3,
    planPolicyVersion: 'support-plan-selection-v2',
    representationMode: 'NATIVE_V3',
    status: 'DRAFT',
    version: 2,
    updatedAt: '2026-10-12T01:00:00Z',
    focuses: [
      {
        focusId: 'focus-1',
        title: 'Giữ nhịp chăm sóc bản thân',
        rationale: null,
        personalizationProvenance: null,
        actions: [
          {
            actionId: '20000000-0000-4000-8000-000000000640',
            actionType: 'ROUTINE_SELF_MANAGEMENT',
            actionVersion: 1,
            representationMode: 'NATIVE_V3',
            status: 'DRAFT',
            pathRole: 'PRIMARY',
            purposeCode: 'WELLBEING_ROUTINE',
            rationale: null,
            ordinal: 1,
            presentation: { title: 'Đi bộ nhẹ', summary: null },
            schedules: [
              {
                scheduleId: '30000000-0000-4000-8000-000000000640',
                version: 1,
                schedulePolicyVersion: 'support-plan-activity-schedule-v2',
                recurrenceType: 'WEEKLY',
                recurrenceDayOfWeek: null,
                daysOfWeek: [1, 4],
                preferredDaypart: 'MORNING',
                estimatedDurationMinutes: 15,
                localTime: '08:00:00',
                timezone: 'Asia/Ho_Chi_Minh',
                effectiveFrom: '2099-01-01',
                effectiveUntil: null,
                reminderEnabled: true,
                status: 'DRAFT',
              },
            ],
          },
        ],
      },
    ],
  }
}

describe('mobile SupportPlan schedule editor', () => {
  it('reviews and saves the same bounded schedule fields as web', async () => {
    const onDirtyChange = jest.fn()
    const onSave = jest.fn().mockResolvedValue(undefined)
    await render(
      <SupportPlanScheduleEditor
        plan={projection()}
        disabled={false}
        onDirtyChange={onDirtyChange}
        onSave={onSave}
        onReload={jest.fn()}
      />,
    )

    fireEvent.changeText(screen.getByLabelText('Giờ địa phương'), '09:30')
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true))
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Lưu lịch' }))
    })

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave).toHaveBeenCalledWith(
      '20000000-0000-4000-8000-000000000640',
      {
        schedule: expect.objectContaining({
          recurrenceType: 'WEEKLY',
          daysOfWeek: [1, 4],
          localTime: '09:30:00',
          estimatedDurationMinutes: 15,
          timezone: 'Asia/Ho_Chi_Minh',
        }),
      },
      expect.any(String),
    )
  })

  it('keeps the form after a stale response and supports an explicit reload', async () => {
    const onReload = jest.fn()
    const onSave = jest.fn().mockRejectedValue(
      new ApiError({
        status: 412,
        code: 'SUPPORT_PLAN_VERSION_MISMATCH',
        message: 'stale',
      }),
    )
    await render(
      <SupportPlanScheduleEditor
        plan={projection()}
        disabled={false}
        onSave={onSave}
        onReload={onReload}
      />,
    )

    fireEvent.changeText(
      screen.getByLabelText('Thời lượng dự kiến (phút)'),
      '25',
    )
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Lưu lịch' }).props
          .accessibilityState.disabled,
      ).toBe(false),
    )
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Lưu lịch' }))
    })

    expect(
      await screen.findByText(/Lựa chọn bạn đang nhập vẫn được giữ/),
    ).toBeTruthy()
    expect(screen.getByLabelText('Thời lượng dự kiến (phút)').props.value).toBe(
      '25',
    )
    fireEvent.press(screen.getByRole('button', { name: 'Tải lịch mới' }))
    expect(onReload).toHaveBeenCalledTimes(1)
  })

  it('removes future workload without classifying it as failure', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined)
    await render(
      <SupportPlanScheduleEditor
        plan={projection()}
        disabled={false}
        onSave={onSave}
        onReload={jest.fn()}
      />,
    )

    fireEvent.press(screen.getByRole('radio', { name: '✓ Đang lên lịch' }))
    await screen.findByRole('radio', { name: 'Không lên lịch' })
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Lưu lịch' }))
    })

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        '20000000-0000-4000-8000-000000000640',
        { schedule: null },
        expect.any(String),
      ),
    )
    expect(
      await screen.findByText(/không ảnh hưởng đến kết quả kế hoạch/),
    ).toBeTruthy()
  })
})
