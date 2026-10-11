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
    await openValidDraft('Tạo bản đính chính')
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
      await screen.findByText('Bản đã xuất bản · phiên bản 2'),
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
