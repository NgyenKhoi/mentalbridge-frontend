import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/api-error'
import type { SupportPlanV3 } from '../api/support-plan-contract'
import SupportPlanScheduleEditor from './SupportPlanScheduleEditor'

function plan(): SupportPlanV3 {
  return {
    supportPlanId: '10000000-0000-4000-8000-000000000640',
    modelVersion: 3,
    planPolicyVersion: 'support-plan-selection-v2',
    representationMode: 'NATIVE_V3',
    status: 'DRAFT',
    version: 2,
    safety: {
      status: 'NEGATIVE_SAFETY_SCREEN',
      reasonCode: 'STANDARD',
      policyVersion: 'safety-v1',
      guidanceCode: 'STANDARD_SAFETY_REMINDER',
      guidance: 'Tìm hỗ trợ trực tiếp nếu bạn cảm thấy không an toàn.',
    },
    focuses: [
      {
        focusId: 'focus-1',
        title: 'Giữ nhịp chăm sóc bản thân',
        rationale: null,
        personalizationProvenance: null,
        ordinal: 1,
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
            source: null,
            provenance: {
              category: 'USER_SELECTED',
              referenceId: null,
              referenceVersion: null,
              acceptedAt: '2026-10-12T01:00:00Z',
            },
            presentation: {
              title: 'Đi bộ nhẹ',
              summary: null,
              instructions: null,
              externalUrl: null,
            },
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
            createdAt: '2026-10-12T01:00:00Z',
            updatedAt: '2026-10-12T01:00:00Z',
            activatedAt: null,
            endedAt: null,
          },
        ],
      },
    ],
    createdAt: '2026-10-12T01:00:00Z',
    updatedAt: '2026-10-12T01:00:00Z',
    activatedAt: null,
    completedAt: null,
    completionReason: null,
    supersededAt: null,
    discardedAt: null,
    disclaimerCode: 'WELLBEING_SUPPORT_NOT_TREATMENT',
    disclaimer: 'Kế hoạch hỗ trợ không thay thế điều trị.',
  }
}

describe('SupportPlanScheduleEditor', () => {
  it('reviews a persisted default and sends an explicit bounded schedule change', async () => {
    const onDirtyChange = vi.fn()
    const onSave = vi.fn().mockResolvedValue(undefined)

    render(
      <SupportPlanScheduleEditor
        plan={plan()}
        onDirtyChange={onDirtyChange}
        onSave={onSave}
        onReload={vi.fn()}
      />,
    )

    expect(screen.getByText('Theo tuần · 08:00 · 15 phút')).toBeVisible()
    fireEvent.change(screen.getByLabelText('Giờ địa phương'), {
      target: { value: '09:30' },
    })
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
    fireEvent.click(screen.getByRole('button', { name: 'Lưu lịch' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
    expect(onSave).toHaveBeenCalledWith(
      '20000000-0000-4000-8000-000000000640',
      {
        schedule: expect.objectContaining({
          recurrenceType: 'WEEKLY',
          daysOfWeek: [1, 4],
          localTime: '09:30',
          estimatedDurationMinutes: 15,
          timezone: 'Asia/Ho_Chi_Minh',
        }),
      },
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    )
  })

  it('keeps edits visible after a stale response and offers an explicit reload', async () => {
    const onReload = vi.fn().mockResolvedValue(undefined)
    const onSave = vi.fn().mockRejectedValue(
      new ApiError({
        status: 412,
        code: 'SUPPORT_PLAN_VERSION_MISMATCH',
        message: 'stale',
      }),
    )

    render(
      <SupportPlanScheduleEditor
        plan={plan()}
        onSave={onSave}
        onReload={onReload}
      />,
    )

    fireEvent.change(screen.getByLabelText('Thời lượng dự kiến (phút)'), {
      target: { value: '25' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu lịch' }))

    expect(
      await screen.findByText(/Lựa chọn bạn đang nhập vẫn được giữ/),
    ).toBeVisible()
    expect(screen.getByLabelText('Thời lượng dự kiến (phút)')).toHaveValue(25)
    fireEvent.click(screen.getByRole('button', { name: 'Tải lịch mới' }))
    expect(onReload).toHaveBeenCalledOnce()
  })

  it('removes future workload without presenting the change as failure', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <SupportPlanScheduleEditor
        plan={plan()}
        onSave={onSave}
        onReload={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('checkbox', { name: 'Lên lịch' }))
    fireEvent.click(screen.getByRole('button', { name: 'Lưu lịch' }))

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        '20000000-0000-4000-8000-000000000640',
        { schedule: null },
        expect.any(String),
      ),
    )
    expect(
      await screen.findByText(/không ảnh hưởng đến kết quả kế hoạch/),
    ).toBeVisible()
  })

  it('restores the latest saved snapshot and marks a subsequent edit dirty', async () => {
    const onDirtyChange = vi.fn()
    render(
      <SupportPlanScheduleEditor
        plan={plan()}
        onDirtyChange={onDirtyChange}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onReload={vi.fn()}
      />,
    )
    const time = screen.getByLabelText('Giờ địa phương')
    fireEvent.change(time, { target: { value: '09:30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu lịch' }))
    await screen.findByText('Đã lưu lịch cho các hoạt động tương lai.')
    fireEvent.change(time, { target: { value: '11:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tác' }))
    expect(time).toHaveValue('09:30')
    expect(time).toHaveFocus()
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
    fireEvent.change(time, { target: { value: '12:00' } })
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
  })

  it('focuses invalid duration instead of sending a command', async () => {
    const onSave = vi.fn()
    render(
      <SupportPlanScheduleEditor
        plan={plan()}
        onSave={onSave}
        onReload={vi.fn()}
      />,
    )
    const duration = screen.getByLabelText('Thời lượng dự kiến (phút)')
    fireEvent.change(duration, { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu lịch' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Thời lượng cần từ 5 đến 180 phút',
    )
    expect(duration).toHaveAttribute('aria-invalid', 'true')
    expect(duration).toHaveFocus()
    expect(onSave).not.toHaveBeenCalled()
  })

  it.each([true, false])(
    'restores keyboard focus after undoing schedule enabled=%s',
    (enabled) => {
      const value = plan()
      if (!enabled) value.focuses[0].actions[0].schedules = []
      render(
        <SupportPlanScheduleEditor
          plan={value}
          onSave={vi.fn()}
          onReload={vi.fn()}
        />,
      )
      const toggle = screen.getByRole('checkbox', { name: 'Lên lịch' })
      fireEvent.click(toggle)
      fireEvent.click(screen.getByRole('button', { name: 'Hoàn tác' }))
      expect(toggle).toHaveProperty('checked', enabled)
      if (enabled) expect(screen.getByLabelText('Giờ địa phương')).toHaveFocus()
      else expect(toggle).toHaveFocus()
    },
  )

  it('uses themed selects and real checkboxes, with read-only controls on paused plans', () => {
    render(
      <SupportPlanScheduleEditor
        plan={{ ...plan(), status: 'PAUSED' }}
        onSave={vi.fn()}
        onReload={vi.fn()}
      />,
    )
    expect(
      screen.getByRole('combobox', { name: 'Nhịp hoạt động' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('combobox', { name: 'Thời điểm trong ngày' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('checkbox', { name: 'Nhắc tôi về hoạt động này' }),
    ).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'Thứ Hai' })).toBeChecked()
  })
})
