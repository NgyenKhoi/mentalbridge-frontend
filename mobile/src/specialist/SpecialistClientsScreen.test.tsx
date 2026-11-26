import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react-native'

import { SPECIALIST_ID } from '@/specialist-appointments/specialist-appointment-test-fixtures'
import {
  makeConsultationBrief,
  makeContinuityItem,
  makeContinuityList,
} from '@/specialist-continuity/specialist-continuity-test-fixtures'
import {
  makeSessionSummary,
  makeSessionSummaryList,
} from '@/specialist-summary/specialist-summary-test-fixtures'

import { SpecialistClientsScreen } from './SpecialistClientsScreen'
import { groupClientVisits } from './specialist-clients-model'

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))
jest.mock('@/theme/useDashboardFonts', () => ({
  useDashboardFonts: () => false,
}))

it('keeps the web client order while sorting each client’s own sessions', () => {
  const completed = makeContinuityItem({ status: 'COMPLETED' })
  const confirmed = makeContinuityItem({
    appointmentId: '30303030-3030-4030-8030-303030303030',
    status: 'CONFIRMED',
  })
  const otherClient = makeContinuityItem({
    appointmentId: '40404040-4040-4040-8040-404040404040',
    userAccountId: '50505050-5050-4050-8050-505050505050',
    status: 'IN_PROGRESS',
  })

  expect(
    groupClientVisits([completed, otherClient, confirmed]).map((client) =>
      client.appointments.map(({ appointmentId }) => appointmentId),
    ),
  ).toEqual([
    [confirmed.appointmentId, completed.appointmentId],
    [otherClient.appointmentId],
  ])
})

it('shows the completed session’s full summary and can open its version history', async () => {
  const appointment = makeContinuityItem({ status: 'COMPLETED' })
  const latest = makeSessionSummary({ version: 2 })
  const previous = makeSessionSummary({
    id: '60606060-6060-4060-8060-606060606060',
    specialistNoteForUser: 'Lời nhắn ở bản trước',
  })
  const list = jest
    .fn()
    .mockResolvedValue(makeSessionSummaryList([latest, previous]))
  const queryClient = new QueryClient()
  await render(
    <QueryClientProvider client={queryClient}>
      <SpecialistClientsScreen
        subject={SPECIALIST_ID}
        initialAppointmentId={undefined}
        data={makeContinuityList([appointment])}
        loading={false}
        failed={false}
        specialistName={undefined}
        continuityApi={{
          list: jest.fn(),
          getBrief: async () => makeConsultationBrief(),
        }}
        summaryApi={{ list, getPlanChange: jest.fn() }}
        refresh={jest.fn()}
      />
    </QueryClientProvider>,
  )

  expect(
    await screen.findByText('Bắt đầu từ một thay đổi nhỏ.'),
  ).toBeOnTheScreen()
  expect(screen.getByText('Ghi lại giờ ngủ trong ba ngày')).toBeOnTheScreen()
  expect(
    screen.getByText('Đề xuất một buổi trao đổi tiếp theo.'),
  ).toBeOnTheScreen()
  expect(list).toHaveBeenCalledWith(appointment.appointmentId)
  expect(screen.queryByText('Lời nhắn ở bản trước')).toBeNull()
  await fireEvent.press(
    screen.getByRole('button', { name: 'Xem 1 phiên bản trước' }),
  )
  expect(screen.getByText('Lời nhắn ở bản trước')).toBeOnTheScreen()
})
