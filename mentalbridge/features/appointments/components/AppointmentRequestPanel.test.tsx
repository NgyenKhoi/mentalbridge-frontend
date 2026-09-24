import { render, screen } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import AppointmentRequestPanel from './AppointmentRequestPanel'

const appointmentClient = vi.hoisted(() => ({
  list: vi.fn(),
  request: vi.fn(),
  slots: vi.fn(),
}))

vi.mock('../api/browser-client', () => ({
  appointmentBrowserClient: appointmentClient,
}))

const timezone = 'Asia/Ho_Chi_Minh'
const slotStart = '2099-01-02T02:00:00Z'
const slotEnd = '2099-01-02T03:00:00Z'
const appointmentStart = '2099-01-03T04:00:00Z'
const decisionDeadline = '2099-01-01T05:00:00Z'
const originalTimezone = process.env.TZ

function formatInSnapshotTimezone(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value))
}

describe('AppointmentRequestPanel', () => {
  beforeAll(() => {
    process.env.TZ = 'America/New_York'
  })

  afterAll(() => {
    if (originalTimezone === undefined) delete process.env.TZ
    else process.env.TZ = originalTimezone
  })

  it('renders slots and appointments in their timezone snapshot', async () => {
    appointmentClient.slots.mockResolvedValue({
      items: [
        {
          id: '123e4567-e89b-42d3-a456-426614174001',
          specialistAccountId: '123e4567-e89b-42d3-a456-426614174002',
          specialistDisplayName: 'Slot specialist',
          startAt: slotStart,
          endAt: slotEnd,
          timezone,
          modality: 'IN_APP_CHAT',
        },
      ],
      count: 1,
      generatedAt: '2099-01-01T00:00:00Z',
      videoEnabled: false,
    })
    appointmentClient.list.mockResolvedValue({
      items: [
        {
          id: '123e4567-e89b-42d3-a456-426614174003',
          slotId: '123e4567-e89b-42d3-a456-426614174004',
          specialistAccountId: '123e4567-e89b-42d3-a456-426614174005',
          specialistDisplayName: 'Appointment specialist',
          status: 'REQUESTED',
          modality: 'IN_APP_CHAT',
          scheduledStartAt: appointmentStart,
          scheduledEndAt: '2099-01-03T05:00:00Z',
          timezone,
          requestedAt: '2099-01-01T00:00:00Z',
          decisionDeadlineAt: decisionDeadline,
          heldCreditId: '123e4567-e89b-42d3-a456-426614174006',
        },
      ],
      count: 1,
      generatedAt: '2099-01-01T00:00:00Z',
    })

    render(<AppointmentRequestPanel />)

    const snapshotStart = formatInSnapshotTimezone(appointmentStart)
    const deviceStart = new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(appointmentStart))
    expect(snapshotStart).not.toBe(deviceStart)
    expect(await screen.findByText(snapshotStart)).toBeInTheDocument()
    expect(
      screen.getByText(formatInSnapshotTimezone(decisionDeadline)),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        `${formatInSnapshotTimezone(slotStart)} – ${formatInSnapshotTimezone(slotEnd)}`,
      ),
    ).toBeInTheDocument()
  })
})
