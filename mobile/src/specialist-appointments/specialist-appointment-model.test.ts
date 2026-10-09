import {
  canDecide,
  canPublishSummary,
  groupAppointments,
} from './specialist-appointment-model'
import { makeAppointment } from './specialist-appointment-test-fixtures'

describe('SPECIALIST appointment view model', () => {
  it('groups pending, upcoming and history from authoritative status and server time', () => {
    const groups = groupAppointments(
      [
        makeAppointment({ id: '10000000-0000-4000-8000-000000000001' }),
        makeAppointment({
          id: '10000000-0000-4000-8000-000000000002',
          status: 'CONFIRMED',
        }),
        makeAppointment({
          id: '10000000-0000-4000-8000-000000000003',
          status: 'COMPLETED',
          completionFactId: '20000000-0000-4000-8000-000000000003',
        }),
      ],
      '2030-10-10T03:00:00.000Z',
    )

    expect(groups.pending).toHaveLength(1)
    expect(groups.upcoming).toHaveLength(1)
    expect(groups.history).toHaveLength(1)
  })

  it('never grants summary authority without server COMPLETED and completion evidence', () => {
    expect(canPublishSummary(makeAppointment({ status: 'IN_PROGRESS' }))).toBe(
      false,
    )
    expect(canPublishSummary(makeAppointment({ status: 'COMPLETED' }))).toBe(
      false,
    )
    expect(
      canPublishSummary(
        makeAppointment({
          status: 'COMPLETED',
          completionFactId: '20000000-0000-4000-8000-000000000003',
        }),
      ),
    ).toBe(true)
  })

  it('uses server time to close an expired decision window', () => {
    const requested = makeAppointment({
      decisionDeadlineAt: '2030-10-12T02:00:00.000Z',
    })

    expect(canDecide(requested, '2030-10-12T01:59:59.000Z')).toBe(true)
    expect(canDecide(requested, '2030-10-12T02:00:00.000Z')).toBe(false)
  })
})
