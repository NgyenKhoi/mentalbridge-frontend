import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'

import { ApiError } from '@/api/api-error'

import type { ConsultationBriefApi } from './consultation-brief-api'
import { ConsultationBriefPanel } from './ConsultationBriefPanel'
import {
  activeBrief,
  appointmentId,
  draftBrief,
  otherAppointmentId,
  revokedBrief,
  screeningChoices,
} from './consultation-brief-fixtures'

function api(overrides: Partial<ConsultationBriefApi> = {}) {
  return {
    screeningContexts: jest.fn().mockResolvedValue(screeningChoices),
    get: jest.fn().mockResolvedValue(draftBrief),
    save: jest.fn().mockResolvedValue(draftBrief),
    approve: jest.fn().mockResolvedValue(activeBrief),
    revoke: jest.fn().mockResolvedValue(revokedBrief),
    ...overrides,
  } as jest.Mocked<ConsultationBriefApi>
}

describe('MB-723 ConsultationBriefPanel', () => {
  it('keeps a new draft private until the exact saved content is reviewed and approved', async () => {
    const feature = api({
      get: jest.fn().mockRejectedValue(
        new ApiError({
          code: 'CONSULTATION_BRIEF_NOT_FOUND',
          message: 'not found',
          status: 404,
        }),
      ),
    })
    await render(
      <ConsultationBriefPanel api={feature} appointmentId={appointmentId} />,
    )

    await screen.findByText('Bản nháp riêng tư')
    expect(
      screen.getByTestId('consultation-brief-open-approve').props
        .accessibilityState.disabled,
    ).toBe(true)

    await fireEvent.changeText(
      screen.getByLabelText('Tình hình hiện tại'),
      draftBrief.currentSituation,
    )
    await fireEvent.changeText(
      screen.getByLabelText('Mục tiêu cho buổi tư vấn'),
      draftBrief.userGoals.join('\n'),
    )
    await fireEvent.press(screen.getByTestId('consultation-brief-save'))

    await waitFor(() =>
      expect(feature.save).toHaveBeenCalledWith(
        appointmentId,
        {
          currentSituation: draftBrief.currentSituation,
          supportEvaluationId: draftBrief.supportEvaluationId,
          userGoals: draftBrief.userGoals,
        },
        undefined,
      ),
    )
    await waitFor(() =>
      expect(
        screen.getByTestId('consultation-brief-open-approve').props
          .accessibilityState.disabled,
      ).toBe(false),
    )

    await fireEvent.changeText(
      screen.getByLabelText('Tình hình hiện tại'),
      `${draftBrief.currentSituation} Nội dung chưa lưu.`,
    )
    expect(
      screen.getByTestId('consultation-brief-open-approve').props
        .accessibilityState.disabled,
    ).toBe(true)
    expect(feature.approve).not.toHaveBeenCalled()
    await fireEvent.changeText(
      screen.getByLabelText('Tình hình hiện tại'),
      draftBrief.currentSituation,
    )

    await fireEvent.press(screen.getByTestId('consultation-brief-open-approve'))
    expect(
      screen.getByText('Bạn muốn chia sẻ bản tóm tắt này?'),
    ).toBeOnTheScreen()
    expect(
      screen.getAllByText(
        /Nhật ký, câu trả lời sàng lọc, chat và ghi chú riêng/,
      ).length,
    ).toBeGreaterThan(0)
    expect(feature.approve).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByTestId('consultation-brief-confirm'))

    await waitFor(() =>
      expect(feature.approve).toHaveBeenCalledWith(appointmentId, 1),
    )
    expect(await screen.findByText('Đang chia sẻ')).toBeOnTheScreen()
  })

  it('requires a second explicit confirmation before revoking future reads', async () => {
    const feature = api({ get: jest.fn().mockResolvedValue(activeBrief) })
    await render(
      <ConsultationBriefPanel api={feature} appointmentId={appointmentId} />,
    )

    await screen.findByText('Đang chia sẻ')
    await fireEvent.press(screen.getByTestId('consultation-brief-open-revoke'))
    expect(screen.getByText('Thu hồi quyền truy cập?')).toBeOnTheScreen()
    expect(feature.revoke).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByTestId('consultation-brief-confirm'))

    await waitFor(() =>
      expect(feature.revoke).toHaveBeenCalledWith(appointmentId, 2),
    )
    expect(await screen.findByText('Đã thu hồi')).toBeOnTheScreen()
    expect(
      screen.queryByTestId('consultation-brief-open-revoke'),
    ).not.toBeOnTheScreen()
  })

  it('clears the old appointment while switching and ignores its late response', async () => {
    let resolveFirst: ((value: typeof draftBrief) => void) | undefined
    const first = new Promise<typeof draftBrief>((resolve) => {
      resolveFirst = resolve
    })
    const other = {
      ...activeBrief,
      appointmentId: otherAppointmentId,
      currentSituation: 'Nội dung chỉ thuộc lịch hẹn B.',
    }
    const feature = api({
      get: jest.fn((id: string) =>
        id === appointmentId ? first : Promise.resolve(other),
      ),
    })
    const view = await render(
      <ConsultationBriefPanel api={feature} appointmentId={appointmentId} />,
    )

    await view.rerender(
      <ConsultationBriefPanel
        api={feature}
        appointmentId={otherAppointmentId}
      />,
    )
    expect(
      await screen.findByText('Nội dung chỉ thuộc lịch hẹn B.'),
    ).toBeOnTheScreen()

    await act(async () => {
      resolveFirst?.(draftBrief)
      await first
    })
    expect(
      screen.queryByText(draftBrief.currentSituation),
    ).not.toBeOnTheScreen()
    expect(screen.getByText('Nội dung chỉ thuộc lịch hẹn B.')).toBeOnTheScreen()
  })

  it('closes old content and actions after a stale approval response', async () => {
    const feature = api({
      approve: jest.fn().mockRejectedValue(
        new ApiError({
          code: 'CONSULTATION_BRIEF_VERSION_MISMATCH',
          message: 'stale',
          status: 412,
        }),
      ),
    })
    await render(
      <ConsultationBriefPanel api={feature} appointmentId={appointmentId} />,
    )

    await screen.findByText('Bản nháp riêng tư')
    await fireEvent.press(screen.getByTestId('consultation-brief-open-approve'))
    await fireEvent.press(screen.getByTestId('consultation-brief-confirm'))

    expect(
      await screen.findByText(/Nội dung cũ đã được đóng để tránh chia sẻ nhầm/),
    ).toBeOnTheScreen()
    expect(
      screen.queryByText(draftBrief.currentSituation),
    ).not.toBeOnTheScreen()
    expect(
      screen.queryByTestId('consultation-brief-open-approve'),
    ).not.toBeOnTheScreen()
    expect(screen.getByText('Tải lại')).toBeOnTheScreen()
  })

  it.each([
    ['approve', draftBrief, 'consultation-brief-open-approve'],
    ['revoke', activeBrief, 'consultation-brief-open-revoke'],
  ] as const)(
    'does not claim unshared state after an ambiguous %s response',
    async (_action, initial, trigger) => {
      const feature = api({
        get: jest.fn().mockResolvedValue(initial),
        approve: jest
          .fn()
          .mockRejectedValue(new Error('response lost after server commit')),
        revoke: jest
          .fn()
          .mockRejectedValue(new Error('response lost after server commit')),
      })
      await render(
        <ConsultationBriefPanel api={feature} appointmentId={appointmentId} />,
      )
      await screen.findByText(
        initial.status === 'DRAFT' ? 'Bản nháp riêng tư' : 'Đang chia sẻ',
      )
      await fireEvent.press(screen.getByTestId(trigger))
      await fireEvent.press(screen.getByTestId('consultation-brief-confirm'))

      expect(
        await screen.findByText(/Chưa xác minh được trạng thái chia sẻ/),
      ).toBeOnTheScreen()
      expect(screen.queryByText(initial.currentSituation)).not.toBeOnTheScreen()
      expect(screen.getByText('Tải lại')).toBeOnTheScreen()
      expect(screen.queryByText(/Nội dung không được chia sẻ/)).toBeNull()
    },
  )

  it.each([
    [403, 'CONSULTATION_BRIEF_ACCESS_DENIED', /không có quyền/],
    [404, 'SUPPORT_EVALUATION_NOT_FOUND', /Không còn đủ dữ liệu hợp lệ/],
    [503, 'APPOINTMENT_CONTEXT_UNAVAILABLE', /Chưa thể xác nhận lịch hẹn/],
  ] as const)(
    'clears prior content for a fail-closed %s/%s action error',
    async (status, code, copy) => {
      const feature = api({
        approve: jest
          .fn()
          .mockRejectedValue(
            new ApiError({ code, message: 'synthetic', status }),
          ),
      })
      await render(
        <ConsultationBriefPanel api={feature} appointmentId={appointmentId} />,
      )

      await screen.findByText('Bản nháp riêng tư')
      await fireEvent.press(
        screen.getByTestId('consultation-brief-open-approve'),
      )
      await fireEvent.press(screen.getByTestId('consultation-brief-confirm'))

      expect(await screen.findByText(copy)).toBeOnTheScreen()
      expect(
        screen.queryByText(draftBrief.currentSituation),
      ).not.toBeOnTheScreen()
      expect(screen.getByText('Tải lại')).toBeOnTheScreen()
    },
  )

  it('does not render draft controls without a complete screening context', async () => {
    const feature = api({
      screeningContexts: jest.fn().mockResolvedValue({ count: 0, items: [] }),
      get: jest.fn().mockRejectedValue(
        new ApiError({
          code: 'CONSULTATION_BRIEF_NOT_FOUND',
          message: 'not found',
          status: 404,
        }),
      ),
    })
    await render(
      <ConsultationBriefPanel api={feature} appointmentId={appointmentId} />,
    )

    expect(
      await screen.findByText(/hoàn thành đủ PHQ-9 và GAD-7/),
    ).toBeOnTheScreen()
    expect(
      screen.queryByTestId('consultation-brief-save'),
    ).not.toBeOnTheScreen()
    expect(feature.save).not.toHaveBeenCalled()
  })
})
