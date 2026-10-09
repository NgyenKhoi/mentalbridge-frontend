import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import type { ReactElement } from 'react'

import { ApiError } from '@/api/api-error'
import type { SpecialistContinuityApi } from '@/specialist-continuity/specialist-continuity-api'
import {
  makeConsultationBrief,
  makeContinuityItem,
  makeContinuityList,
} from '@/specialist-continuity/specialist-continuity-test-fixtures'
import type { SpecialistSummaryApi } from '@/specialist-summary/specialist-summary-api'
import {
  makeSessionSummary,
  makeSessionSummaryList,
} from '@/specialist-summary/specialist-summary-test-fixtures'

import type { SpecialistAppointmentApi } from './specialist-appointment-api'
import {
  APPOINTMENT_ID,
  makeAppointment,
  makeAppointmentList,
} from './specialist-appointment-test-fixtures'
import { SpecialistAppointmentDetailScreen } from './SpecialistAppointmentDetailScreen'
import type { SpecialistChatHandoff } from './specialist-chat-handoff'

jest.mock('expo-router', () => ({ router: { back: jest.fn() } }))

jest.mock('@/auth/session-context', () => ({
  useSession: () => ({
    session: {
      subject: '22222222-2222-4222-8222-222222222222',
      role: 'SPECIALIST',
    },
  }),
}))

function appointmentApi(
  overrides: Partial<SpecialistAppointmentApi> = {},
): SpecialistAppointmentApi {
  return {
    listAssigned: jest
      .fn()
      .mockResolvedValue(
        makeAppointmentList([
          makeAppointment({ status: 'CONFIRMED', version: 2 }),
        ]),
      ),
    decide: jest.fn(),
    ...overrides,
  }
}

function continuityApi(
  overrides: Partial<SpecialistContinuityApi> = {},
): SpecialistContinuityApi {
  return {
    list: jest.fn().mockResolvedValue(makeContinuityList()),
    getBrief: jest.fn().mockResolvedValue(makeConsultationBrief()),
    ...overrides,
  }
}

function summaryApi(
  overrides: Partial<SpecialistSummaryApi> = {},
): SpecialistSummaryApi {
  return {
    list: jest.fn().mockResolvedValue(makeSessionSummaryList([])),
    publish: jest.fn().mockResolvedValue(makeSessionSummary()),
    ...overrides,
  }
}

function chatHandoff(
  overrides: Partial<SpecialistChatHandoff> = {},
): SpecialistChatHandoff {
  return {
    available: false,
    openAppointmentChat: jest.fn(),
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

async function renderDetail(
  props: Partial<
    React.ComponentProps<typeof SpecialistAppointmentDetailScreen>
  > = {},
  client = testClient(),
) {
  const ui: ReactElement = (
    <SpecialistAppointmentDetailScreen
      appointmentApi={props.appointmentApi ?? appointmentApi()}
      appointmentId={props.appointmentId ?? APPOINTMENT_ID}
      chatHandoff={props.chatHandoff ?? chatHandoff()}
      continuityApi={props.continuityApi ?? continuityApi()}
      summaryApi={props.summaryApi ?? summaryApi()}
    />
  )
  return {
    client,
    view: await render(
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
    ),
  }
}

describe('SPECIALIST appointment detail and continuity', () => {
  it('loads only the authorized ConsultationBrief snapshot', async () => {
    const api = continuityApi()
    await renderDetail({ continuityApi: api })

    await fireEvent.press(
      await screen.findByRole('button', {
        name: 'Xem thông tin được chia sẻ',
      }),
    )

    expect(
      await screen.findByText('Gần đây tôi khó giữ nhịp ngủ ổn định.'),
    ).toBeOnTheScreen()
    expect(api.getBrief).toHaveBeenCalledWith(APPOINTMENT_ID)
    expect(screen.queryByText(/Journal/)).toBeNull()
  })

  it.each([
    ['REVOKED', /đã thu hồi quyền xem/],
    ['EXPIRED', /đã kết thúc/],
  ] as const)(
    'does not render a cached brief when current access is %s',
    async (briefAccessState, message) => {
      const client = testClient()
      client.setQueryData(
        ['specialist-consultation-brief', APPOINTMENT_ID],
        makeConsultationBrief(),
      )
      await renderDetail(
        {
          continuityApi: continuityApi({
            list: jest
              .fn()
              .mockResolvedValue(
                makeContinuityList([makeContinuityItem({ briefAccessState })]),
              ),
          }),
        },
        client,
      )

      expect(await screen.findByText(message)).toBeOnTheScreen()
      expect(
        screen.queryByText('Gần đây tôi khó giữ nhịp ngủ ổn định.'),
      ).toBeNull()
      expect(
        client.getQueryData(['specialist-consultation-brief', APPOINTMENT_ID]),
      ).toBeUndefined()
    },
  )

  it('fails closed when the wrong specialist tries to read continuity', async () => {
    const getBrief = jest.fn().mockRejectedValue(
      new ApiError({
        code: 'CONSULTATION_BRIEF_NOT_FOUND',
        message: 'no',
        status: 404,
      }),
    )
    await renderDetail({ continuityApi: continuityApi({ getBrief }) })

    await fireEvent.press(
      await screen.findByRole('button', {
        name: 'Xem thông tin được chia sẻ',
      }),
    )

    expect(await screen.findByText(/không có quyền xem/)).toBeOnTheScreen()
    expect(
      screen.queryByText('Gần đây tôi khó giữ nhịp ngủ ổn định.'),
    ).toBeNull()
  })

  it('does not mount private detail modules for another specialist assignment', async () => {
    const continuity = continuityApi()
    const summaries = summaryApi()
    await renderDetail({
      appointmentApi: appointmentApi({
        listAssigned: jest.fn().mockResolvedValue(
          makeAppointmentList([
            makeAppointment({
              specialistAccountId: '99999999-9999-4999-8999-999999999999',
            }),
          ]),
        ),
      }),
      continuityApi: continuity,
      summaryApi: summaries,
    })

    expect(
      await screen.findByText(/không còn trong danh sách được giao cho bạn/),
    ).toBeOnTheScreen()
    expect(continuity.list).not.toHaveBeenCalled()
    expect(continuity.getBrief).not.toHaveBeenCalled()
    expect(summaries.list).not.toHaveBeenCalled()
  })

  it('recovers truthfully after the continuity dependency returns', async () => {
    const list = jest
      .fn()
      .mockRejectedValueOnce(
        new ApiError({
          code: 'DEPENDENCY_UNAVAILABLE',
          message: 'down',
          status: 503,
        }),
      )
      .mockResolvedValueOnce(makeContinuityList())
    await renderDetail({ continuityApi: continuityApi({ list }) })

    expect(
      await screen.findByText(/Nội dung riêng tư đang được ẩn/),
    ).toBeOnTheScreen()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Thử xác nhận lại' }),
    )

    expect(
      await screen.findByRole('button', {
        name: 'Xem thông tin được chia sẻ',
      }),
    ).toBeOnTheScreen()
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('keeps non-COMPLETED appointments unable to create a summary', async () => {
    const api = summaryApi()
    await renderDetail({ summaryApi: api })

    expect(
      await screen.findByText(/Tóm tắt chỉ được tạo sau khi hệ thống xác nhận/),
    ).toBeOnTheScreen()
    expect(
      screen.queryByRole('button', { name: 'Tạo tóm tắt sau phiên' }),
    ).toBeNull()
    expect(api.list).not.toHaveBeenCalled()
    expect(api.publish).not.toHaveBeenCalled()
  })

  it('enables SessionSummary only for authoritative evidence-backed COMPLETED', async () => {
    const completed = makeAppointment({
      status: 'COMPLETED',
      completionFactId: '66666666-6666-4666-8666-666666666666',
      version: 6,
    })
    const summaries = summaryApi()
    await renderDetail({
      appointmentApi: appointmentApi({
        listAssigned: jest
          .fn()
          .mockResolvedValue(makeAppointmentList([completed])),
      }),
      continuityApi: continuityApi({
        list: jest.fn().mockResolvedValue(
          makeContinuityList([
            makeContinuityItem({
              status: 'COMPLETED',
              appointmentVersion: 6,
              briefAccessState: 'UNAVAILABLE',
            }),
          ]),
        ),
      }),
      summaryApi: summaries,
    })

    expect(
      await screen.findByRole('button', { name: 'Tạo tóm tắt sau phiên' }),
    ).toBeOnTheScreen()
    expect(summaries.list).toHaveBeenCalledWith(APPOINTMENT_ID)
  })

  it('keeps a COMPLETED appointment read-only without a completion fact', async () => {
    const summaries = summaryApi()
    await renderDetail({
      appointmentApi: appointmentApi({
        listAssigned: jest
          .fn()
          .mockResolvedValue(
            makeAppointmentList([
              makeAppointment({ status: 'COMPLETED', completionFactId: null }),
            ]),
          ),
      }),
      summaryApi: summaries,
    })

    expect(
      await screen.findByText(/chưa cung cấp bằng chứng hoàn thành/),
    ).toBeOnTheScreen()
    expect(
      screen.queryByRole('button', { name: 'Tạo tóm tắt sau phiên' }),
    ).toBeNull()
    expect(summaries.list).not.toHaveBeenCalled()
  })

  it('exposes only the shared chat handoff and does not implement chat locally', async () => {
    const unavailable = chatHandoff()
    await renderDetail({ chatHandoff: unavailable })

    const button = await screen.findByRole('button', {
      name: 'Mở trò chuyện tư vấn',
    })
    expect(button).toBeDisabled()
    await fireEvent.press(button)
    expect(unavailable.openAppointmentChat).not.toHaveBeenCalled()
    expect(screen.queryByText(/tin nhắn giả|nội dung trò chuyện/)).toBeNull()
  })

  it('hands the exact appointment to the shared chat seam when available', async () => {
    const handoff = chatHandoff({ available: true })
    await renderDetail({ chatHandoff: handoff })

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Mở trò chuyện tư vấn' }),
    )
    expect(handoff.openAppointmentChat).toHaveBeenCalledWith(APPOINTMENT_ID)
  })

  it('reloads authoritative appointment state after an app remount', async () => {
    const listAssigned = jest
      .fn()
      .mockResolvedValueOnce(
        makeAppointmentList([
          makeAppointment({ status: 'REQUESTED', version: 1 }),
        ]),
      )
      .mockResolvedValueOnce(
        makeAppointmentList([
          makeAppointment({
            status: 'REJECTED',
            decisionReason: 'SPECIALIST_REJECTED',
            decidedAt: '2030-10-10T03:01:00.000Z',
            version: 2,
          }),
        ]),
      )
    const client = testClient()
    const detailProps = {
      appointmentApi: appointmentApi({ listAssigned }),
      continuityApi: continuityApi(),
      summaryApi: summaryApi(),
      chatHandoff: chatHandoff(),
    }
    const first = await renderDetail(detailProps, client)
    expect(await screen.findByText('Chờ phản hồi')).toBeOnTheScreen()
    await waitFor(() => expect(client.isFetching()).toBe(0))

    const reloadedClient = testClient()
    first.view.rerender(
      <QueryClientProvider client={reloadedClient}>
        <SpecialistAppointmentDetailScreen
          key="app-reload"
          appointmentApi={detailProps.appointmentApi}
          appointmentId={APPOINTMENT_ID}
          chatHandoff={detailProps.chatHandoff}
          continuityApi={detailProps.continuityApi}
          summaryApi={detailProps.summaryApi}
        />
      </QueryClientProvider>,
    )
    expect(await screen.findByText('Đã từ chối')).toBeOnTheScreen()
    await waitFor(() => expect(listAssigned).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(reloadedClient.isFetching()).toBe(0))
  })
})
