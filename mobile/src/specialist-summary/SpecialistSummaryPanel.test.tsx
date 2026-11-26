import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'

import { ApiError } from '@/api/api-error'

import type { SpecialistSummaryApi } from './specialist-summary-api'
import type { SessionSummaryList } from './specialist-summary-contract'
import {
  makeSessionSummary,
  makeSessionSummaryList,
} from './specialist-summary-test-fixtures'
import {
  normalizeSummaryDraft,
  SpecialistSummaryPanel,
} from './SpecialistSummaryPanel'

function api(
  overrides: Partial<SpecialistSummaryApi> = {},
): SpecialistSummaryApi {
  return {
    list: jest.fn().mockResolvedValue(makeSessionSummaryList([])),
    publish: jest.fn().mockResolvedValue(makeSessionSummary()),
    ...overrides,
  }
}

function testClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  })
}

async function renderPanel(
  summaryApi: SpecialistSummaryApi,
  refreshAppointmentAuthority: () => Promise<boolean> = async () => true,
) {
  return await render(
    <QueryClientProvider client={testClient()}>
      <SpecialistSummaryPanel
        api={summaryApi}
        appointmentAuthorityConfirmed
        appointmentId="11111111-1111-4111-8111-111111111111"
        refreshAppointmentAuthority={refreshAppointmentAuthority}
      />
    </QueryClientProvider>,
  )
}

async function openValidDraft(buttonName = 'Tạo tóm tắt sau phiên') {
  await fireEvent.press(await screen.findByRole('button', { name: buttonName }))
  await fireEvent.changeText(
    screen.getByLabelText('Chủ đề đã trao đổi'),
    'Nhịp ngủ',
  )
}

describe('SPECIALIST SessionSummary authority', () => {
  it('retains the resource identity and immutable version when amending existing steps', () => {
    const result = normalizeSummaryDraft({
      topics: 'Nhịp ngủ',
      progressSummary: '',
      specialistNoteForUser: '',
      followUpSuggested: false,
      steps: [
        {
          type: 'PLATFORM_RESOURCE',
          title: 'Thở chậm',
          details: 'Thực hành trong 5 phút.',
          resourceId: '99999999-9999-4999-8999-999999999999',
          resourceVersion: 'resource-v2',
          resourceProposalReasonCode: 'POST_CONSULTATION_CONTINUITY',
        },
      ],
    })
    expect(result.agreedNextSteps[0]).toMatchObject({
      type: 'PLATFORM_RESOURCE',
      resourceId: '99999999-9999-4999-8999-999999999999',
      resourceVersion: 'resource-v2',
      resourceProposalReasonCode: 'POST_CONSULTATION_CONTINUITY',
    })
  })

  it('shows summary details and previous versions and prefills an amendment', async () => {
    const original = makeSessionSummary()
    const latest = makeSessionSummary({
      id: '88888888-8888-4888-8888-888888888889',
      version: 2,
      amendsSummaryId: original.id,
      progressSummary: 'Nội dung phiên bản mới nhất.',
      specialistNoteForUser: 'Lời nhắn cần được giữ khi đính chính.',
      agreedNextSteps: [
        {
          ...original.agreedNextSteps[0]!,
          details: 'Thực hiện trong ba ngày.',
        },
      ],
    })
    await renderPanel(
      api({
        list: jest
          .fn()
          .mockResolvedValue(makeSessionSummaryList([original, latest])),
      }),
    )
    expect(
      await screen.findByText('Phiên bản 2'),
    ).toBeOnTheScreen()
    expect(screen.getByText('Điều đã ghi nhận trong phiên')).toBeOnTheScreen()
    expect(screen.getByText('Thực hiện trong ba ngày.')).toBeOnTheScreen()
    expect(screen.queryByText('Phiên bản 1')).toBeNull()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Xem 1 phiên bản trước' }),
    )
    expect(screen.getByText('Phiên bản 1')).toBeOnTheScreen()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Đính chính bản tóm tắt' }),
    )
    expect(
      screen.getByLabelText('Tiến triển được ghi nhận'),
    ).toHaveDisplayValue(latest.progressSummary!)
    expect(screen.getByLabelText('Lời nhắn cho người dùng')).toHaveDisplayValue(
      latest.specialistNoteForUser!,
    )
    expect(screen.getByLabelText('Chi tiết bước 1')).toHaveDisplayValue(
      'Thực hiện trong ba ngày.',
    )
  })

  it('publishes a bounded summary and agreed next step after COMPLETED authority', async () => {
    const publish = jest.fn().mockResolvedValue(makeSessionSummary())
    const service = api({
      list: jest
        .fn()
        .mockResolvedValueOnce(makeSessionSummaryList([]))
        .mockResolvedValueOnce(makeSessionSummaryList([makeSessionSummary()])),
      publish,
    })
    await renderPanel(service)
    await openValidDraft()
    await fireEvent.press(
      screen.getByRole('button', { name: '+ Thêm bước tiếp theo' }),
    )
    await fireEvent.changeText(
      screen.getByLabelText('Tên bước 1'),
      'Viết nhật ký',
    )
    await fireEvent.press(
      screen.getByRole('button', { name: 'Xuất bản tóm tắt' }),
    )

    expect(await screen.findByText(/Đã xuất bản tóm tắt/)).toBeOnTheScreen()
    expect(publish).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      expect.objectContaining({
        topicsDiscussed: ['Nhịp ngủ'],
        agreedNextSteps: [
          expect.objectContaining({ type: 'CHECKLIST', title: 'Viết nhật ký' }),
        ],
      }),
      expect.any(String),
      undefined,
    )
  })

  it('keeps one command key for committed-but-response-failed replay', async () => {
    const saved = makeSessionSummary()
    const publish = jest
      .fn()
      .mockRejectedValueOnce(
        new ApiError({ code: 'NETWORK_ERROR', message: 'offline' }),
      )
      .mockResolvedValueOnce(saved)
    const service = api({
      list: jest
        .fn()
        .mockResolvedValueOnce(makeSessionSummaryList([]))
        .mockResolvedValueOnce(makeSessionSummaryList([saved])),
      publish,
    })
    await renderPanel(service)
    await openValidDraft()

    await fireEvent.press(
      screen.getByRole('button', { name: 'Xuất bản tóm tắt' }),
    )
    expect(
      await screen.findByText(/Nội dung bạn nhập vẫn được giữ/),
    ).toBeOnTheScreen()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Xuất bản tóm tắt' }),
    )

    await waitFor(() => expect(publish).toHaveBeenCalledTimes(2))
    expect(publish.mock.calls[0]?.[2]).toBe(publish.mock.calls[1]?.[2])
  })

  it('fails closed on a stale summary version until both authorities reload', async () => {
    let resolveSummaries: (value: SessionSummaryList) => void = () => undefined
    let resolveAppointment: (value: boolean) => void = () => undefined
    const summaries = new Promise<SessionSummaryList>((resolve) => {
      resolveSummaries = resolve
    })
    const appointment = new Promise<boolean>((resolve) => {
      resolveAppointment = resolve
    })
    const publish = jest.fn().mockRejectedValue(
      new ApiError({
        code: 'SESSION_SUMMARY_VERSION_MISMATCH',
        message: 'stale',
        status: 412,
      }),
    )
    const current = makeSessionSummary({ version: 1 })
    const refreshed = makeSessionSummary({
      id: '88888888-8888-4888-8888-888888888889',
      version: 2,
      amendsSummaryId: current.id,
    })
    const service = api({
      list: jest
        .fn()
        .mockResolvedValueOnce(makeSessionSummaryList([current]))
        .mockReturnValueOnce(summaries),
      publish,
    })
    await renderPanel(service, () => appointment)
    await openValidDraft('Đính chính bản tóm tắt')
    await fireEvent.press(
      screen.getByRole('button', { name: 'Xuất bản bản đính chính' }),
    )

    expect(
      await screen.findByText(/Đang xác nhận bản tóm tắt/),
    ).toBeOnTheScreen()
    expect(
      screen.getByRole('button', { name: 'Xuất bản bản đính chính' }),
    ).toBeDisabled()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Xuất bản bản đính chính' }),
    )
    expect(publish).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveSummaries(makeSessionSummaryList([refreshed, current]))
      resolveAppointment(true)
    })
    expect(
      await screen.findByText('Phiên bản 2'),
    ).toBeOnTheScreen()
  })

  it('stays locked when post-success authority refresh fails', async () => {
    const saved = makeSessionSummary()
    const service = api({
      list: jest
        .fn()
        .mockResolvedValueOnce(makeSessionSummaryList([]))
        .mockRejectedValueOnce(
          new ApiError({
            code: 'CONSULTATION_UNAVAILABLE',
            message: 'down',
            status: 503,
          }),
        ),
      publish: jest.fn().mockResolvedValue(saved),
    })
    await renderPanel(service, async () => false)
    await openValidDraft()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Xuất bản tóm tắt' }),
    )

    expect(
      await screen.findByText(/Tính năng xuất bản đang được khóa/),
    ).toBeOnTheScreen()
    expect(
      screen.getByRole('button', { name: 'Xuất bản bản đính chính' }),
    ).toBeDisabled()
  })

  it('validates Unicode code points without a UTF-16 maxLength gate', () => {
    expect(
      normalizeSummaryDraft({
        topics: '😀'.repeat(160),
        progressSummary: '🌱'.repeat(1000),
        specialistNoteForUser: '',
        followUpSuggested: false,
        steps: [],
      }).topicsDiscussed,
    ).toEqual(['😀'.repeat(160)])
    expect(() =>
      normalizeSummaryDraft({
        topics: '😀'.repeat(161),
        progressSummary: '',
        specialistNoteForUser: '',
        followUpSuggested: false,
        steps: [],
      }),
    ).toThrow('TOPICS_INVALID')
  })
})
