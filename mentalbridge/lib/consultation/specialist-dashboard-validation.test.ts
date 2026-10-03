import { describe, expect, it } from 'vitest'

import { parseSpecialistDashboard } from './consultation-validation'

const asOf = '2026-10-03T02:00:00Z'
const appointment = {
  source: 'CONSULTATION',
  asOf,
  appointmentId: '10a7e5d8-7960-42fb-9706-e642f849b78f',
  status: 'CONFIRMED',
  modality: 'IN_APP_CHAT',
  scheduledStartAt: '2026-10-03T03:00:00Z',
  scheduledEndAt: '2026-10-03T04:00:00Z',
  timezone: 'Asia/Ho_Chi_Minh',
  decisionDeadlineAt: '2026-10-02T03:00:00Z',
}

function dashboard() {
  return {
    source: 'CONSULTATION',
    generatedAt: asOf,
    operationalStatus: 'READY',
    profile: {
      source: 'CONSULTATION',
      asOf,
      state: 'AVAILABLE',
      displayName: 'Chuyên gia An',
      timezone: 'Asia/Ho_Chi_Minh',
      approvalStatus: 'APPROVED',
    },
    todayConfirmedSessions: {
      source: 'CONSULTATION',
      asOf,
      state: 'AVAILABLE',
      count: 1,
      localDate: '2026-10-03',
      timezone: 'Asia/Ho_Chi_Minh',
      items: [appointment],
    },
    pendingAppointmentRequests: {
      source: 'CONSULTATION',
      asOf,
      state: 'EMPTY',
      count: 0,
      localDate: null,
      timezone: 'Asia/Ho_Chi_Minh',
      items: [],
    },
    nextAppointment: {
      source: 'CONSULTATION',
      asOf,
      state: 'AVAILABLE',
      item: appointment,
    },
    availability: {
      source: 'CONSULTATION',
      asOf,
      state: 'EMPTY',
      count: 0,
      items: [],
    },
    actionRequired: [
      {
        source: 'CONSULTATION',
        asOf,
        type: 'PUBLISH_AVAILABILITY',
        count: 1,
      },
    ],
  }
}

describe('specialist dashboard validation', () => {
  it('accepts a bounded authoritative operational projection', () => {
    expect(parseSpecialistDashboard(dashboard())).toMatchObject({
      operationalStatus: 'READY',
      todayConfirmedSessions: { count: 1 },
      availability: { count: 0 },
    })
  })

  it('rejects unexpected health or client fields instead of forwarding them', () => {
    const value = dashboard()
    const leakedAppointment = { ...appointment }
    Object.assign(leakedAppointment, { clientName: 'Không được phép' })
    value.todayConfirmedSessions.items = [leakedAppointment]

    expect(parseSpecialistDashboard(value)).toBeNull()
  })

  it('rejects workload data when profile eligibility is blocked', () => {
    const value = dashboard()
    value.operationalStatus = 'SUSPENDED'
    value.profile.approvalStatus = 'SUSPENDED'

    expect(parseSpecialistDashboard(value)).toBeNull()
  })
})
